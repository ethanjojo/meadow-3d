export const WEATHER_CHANNELS = [
  { id: 'wind', label: 'Wind' }, { id: 'rain', label: 'Rain' },
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
export type AudioPreviewState = { id: AudioChannelId; status: 'loading' | 'playing' | 'error' } | null
export interface AudioSettings {
  master: number
  channels: Record<AudioChannelId, number>
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  master: 1,
  channels: Object.fromEntries(AUDIO_CHANNELS.map(({ id }) => [id, 1])) as Record<AudioChannelId, number>,
}

function level(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1
}

export function parseAudioSettings(value: unknown): AudioSettings {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const channels = input.channels && typeof input.channels === 'object' ? input.channels as Record<string, unknown> : {}
  return {
    master: level(input.master),
    channels: Object.fromEntries(AUDIO_CHANNELS.map(({ id }) => [id, level(channels[id])])) as Record<AudioChannelId, number>,
  }
}
