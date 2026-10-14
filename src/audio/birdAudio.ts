import { type RecordedCall } from './recordedAmbience'
import { BIRD_CHANNELS } from '../core/audioSettings'

export const BIRD_CALLS: readonly RecordedCall[] = BIRD_CHANNELS.map(({ id, duration }) => ({
  id, path: `audio/birds/${id}.wav`, duration,
}))

export function deriveBirdActivity(dayPhase: number, rain: number, storm: number) {
  const solarHeight = Math.sin(dayPhase * Math.PI * 2 - Math.PI / 2)
  const daylight = Math.min(1, Math.max(0, solarHeight * 4))
  const dawn = Math.exp(-(((dayPhase - 0.32) / 0.065) ** 2))
  const dusk = Math.exp(-(((dayPhase - 0.68) / 0.055) ** 2))
  return daylight * Math.min(1, 0.38 + dawn * 0.62 + dusk * 0.3) * (1 - rain * 0.7) * (1 - storm * 0.8)
}
