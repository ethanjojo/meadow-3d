import { BIRD_CHANNELS, FARM_CHANNELS, WEATHER_CHANNELS } from './audioSettings'
export const SOUND_GROUPS = [{ id: 'weather', title: 'Weather', channels: WEATHER_CHANNELS }, { id: 'birds', title: 'Birds', channels: BIRD_CHANNELS }, { id: 'farm', title: 'Farm animals', channels: FARM_CHANNELS }] as const
export const SOUND_LABELS = {
 master: 'Master volume', playback: 'Playback behaviour',
 variation: 'Volume variation', maxConcurrent: 'Simultaneous animal calls', minimumGap: 'Minimum gap between calls',
 thunderDistance: 'Thunder distance',
} as const
export const CALL_LABELS = {
 enabled: 'enabled', activity: 'activity', startHour: 'from', endHour: 'until',
 minInterval: 'minimum interval', maxInterval: 'maximum interval', distance: 'distance', pan: 'placement',
 respectWeather: 'follows weather', details: 'timing & placement',
} as const
export const SOUND_HINTS = {
 variation: 'Small differences make repeated calls feel more natural.',
 thunderDistance: 'Sets thunder volume and delay after each flash.',
} as const
export const callLabel = (name: string, key: keyof typeof CALL_LABELS) => `${name} ${CALL_LABELS[key]}`
export const groupVolumeLabel = (title: string) => `${title} volume`
