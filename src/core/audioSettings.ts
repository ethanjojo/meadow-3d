export const WEATHER_CHANNELS = [
  { id: 'wind', label: 'Wind' }, { id: 'rain', label: 'Rain' },
  { id: 'thunder', label: 'Thunder' },
] as const
export const BIRD_CHANNELS = [
  { id: 'blackbird', label: 'Blackbird', duration: 7 },
  { id: 'tit', label: 'Great tit', duration: 4 },
  { id: 'chaffinch', label: 'Chaffinch', duration: 4 },
  { id: 'sparrow', label: 'Sparrows', duration: 4 },
] as const
export const FARM_CHANNELS = [
  { id: 'cow', label: 'Cow', duration: 1.91, path: 'audio/cow.wav' }, { id: 'cat', label: 'Cat', duration: 1.75, path: 'audio/cat-skymary.wav' },
  { id: 'dog', label: 'Dog', duration: 2, path: 'audio/dog.mp3' }, { id: 'hen', label: 'Hen', duration: 3, path: 'audio/hen.mp3' },
  { id: 'sheep', label: 'Sheep', duration: 0.81, path: 'audio/sheep.wav' }, { id: 'goat', label: 'Goat', duration: 0.87, path: 'audio/goat-single.wav' },
  { id: 'horse', label: 'Horse', duration: 1.53, path: 'audio/horse-neigh.wav' }, { id: 'donkey', label: 'Donkey', duration: 2.08, path: 'audio/donkey-single.wav' },
  { id: 'rooster', label: 'Rooster', duration: 1.81, path: 'audio/rooster.wav' }, { id: 'duck', label: 'Duck', duration: 2.75, path: 'audio/duck-real.wav' },
  { id: 'pig', label: 'Pig', duration: 0.93, path: 'audio/pig-calm.wav' },
] as const
export const AUDIO_CHANNELS = [...WEATHER_CHANNELS, ...BIRD_CHANNELS, ...FARM_CHANNELS]
export type AudioChannelId = (typeof AUDIO_CHANNELS)[number]['id']
export type RecordingChannelId = (typeof BIRD_CHANNELS)[number]['id'] | (typeof FARM_CHANNELS)[number]['id']
export interface RecordingSettings {
  enabled: boolean
  activity: 'natural' | 'always' | 'custom'
  startHour: number
  endHour: number
  minInterval: number
  maxInterval: number
  distance: 'near' | 'medium' | 'far'
  pan: 'left' | 'center' | 'right' | 'random'
  respectWeather: boolean
}
export type AudioPreviewState = { id: AudioChannelId; status: 'loading' | 'playing' | 'error' } | null
export const AUDIO_SETTING_LIMITS = {
  interval: { min: 5, max: 1800 },
  concurrency: { min: 1, max: 4 },
  gap: { min: 0, max: 30 },
  thunderDistance: { min: 1.2, max: 5 },
} as const
export interface AudioSettings {
  master: number
  channels: Record<AudioChannelId, number>
  groups: Record<'weather' | 'birds' | 'farm', number>
  calls: Record<RecordingChannelId, RecordingSettings>
  variation: number
  maxConcurrent: number
  minimumGap: number
  thunderDistance: number
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  master: 1,
  channels: Object.fromEntries(AUDIO_CHANNELS.map(({ id }) => [id, 1])) as Record<AudioChannelId, number>,
  groups: { weather: 1, birds: 1, farm: 1 },
  calls: Object.fromEntries([...BIRD_CHANNELS, ...FARM_CHANNELS].map(({ id }) => [id, {
    enabled: true, activity: 'natural', startHour: 6, endHour: 20,
    minInterval: BIRD_CHANNELS.some(channel => channel.id === id) ? 45 : 100,
    maxInterval: BIRD_CHANNELS.some(channel => channel.id === id) ? 140 : 260,
    distance: 'far', pan: 'random', respectWeather: true,
  }])) as Record<RecordingChannelId, RecordingSettings>,
  variation: .25, maxConcurrent: 2, minimumGap: 3, thunderDistance: 3.1,
}

function level(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1
}

export function parseAudioSettings(value: unknown): AudioSettings {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const channels = input.channels && typeof input.channels === 'object' ? input.channels as Record<string, unknown> : {}
  const groups = input.groups && typeof input.groups === 'object' ? input.groups as Record<string, unknown> : {}
  const calls = input.calls && typeof input.calls === 'object' ? input.calls as Record<string, unknown> : {}
  const number = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
  const choice = <T extends string>(value: unknown, choices: readonly T[], fallback: T): T => choices.includes(value as T) ? value as T : fallback
  return {
    master: level(input.master),
    channels: Object.fromEntries(AUDIO_CHANNELS.map(({ id }) => [id, level(channels[id])])) as Record<AudioChannelId, number>,
    groups: { weather: level(groups.weather), birds: level(groups.birds), farm: level(groups.farm) },
    calls: Object.fromEntries(Object.entries(DEFAULT_AUDIO_SETTINGS.calls).map(([id, defaults]) => {
      const saved = calls[id] && typeof calls[id] === 'object' ? calls[id] as Record<string, unknown> : {}
      const minInterval = number(saved.minInterval, defaults.minInterval, AUDIO_SETTING_LIMITS.interval.min, AUDIO_SETTING_LIMITS.interval.max)
      return [id, {
        enabled: typeof saved.enabled === 'boolean' ? saved.enabled : defaults.enabled,
        activity: choice(saved.activity, ['natural', 'always', 'custom'], defaults.activity),
        startHour: number(saved.startHour, defaults.startHour, 0, 24) % 24, endHour: number(saved.endHour, defaults.endHour, 0, 24) % 24,
        minInterval, maxInterval: Math.max(minInterval, number(saved.maxInterval, defaults.maxInterval, AUDIO_SETTING_LIMITS.interval.min, AUDIO_SETTING_LIMITS.interval.max)),
        distance: choice(saved.distance, ['near', 'medium', 'far'], defaults.distance),
        pan: choice(saved.pan, ['left', 'center', 'right', 'random'], defaults.pan),
        respectWeather: typeof saved.respectWeather === 'boolean' ? saved.respectWeather : defaults.respectWeather,
      }]
    })) as Record<RecordingChannelId, RecordingSettings>,
    variation: number(input.variation, DEFAULT_AUDIO_SETTINGS.variation, 0, 1),
    maxConcurrent: Math.round(number(input.maxConcurrent, DEFAULT_AUDIO_SETTINGS.maxConcurrent, AUDIO_SETTING_LIMITS.concurrency.min, AUDIO_SETTING_LIMITS.concurrency.max)),
    minimumGap: number(input.minimumGap, DEFAULT_AUDIO_SETTINGS.minimumGap, AUDIO_SETTING_LIMITS.gap.min, AUDIO_SETTING_LIMITS.gap.max),
    thunderDistance: number(input.thunderDistance, DEFAULT_AUDIO_SETTINGS.thunderDistance, AUDIO_SETTING_LIMITS.thunderDistance.min, AUDIO_SETTING_LIMITS.thunderDistance.max),
  }
}
