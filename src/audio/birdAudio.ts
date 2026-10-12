import { chooseRecording, createRecordedAmbience, type RecordedCall } from './recordedAmbience'
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

export function birdPause(activity: number, response: boolean, random = Math.random) {
  if (response) return 1_200 + random() * 2_800
  return 12_000 + random() * 28_000 + (1 - activity) * 20_000
}

export function createBirdAudio(context: AudioContext, destination: AudioNode = context.destination) {
  let activity = 0
  let previous: string | null = null
  let responses = 0
  const player = createRecordedAmbience(context, BIRD_CALLS, available => {
    if (activity < 0.015) { responses = 0; return null }
    const call = chooseRecording(available, previous)
    previous = call.id
    // At most two short replies, then a longer pause, regardless of randomness.
    const response = responses < 2 && Math.random() < activity * 0.55
    responses = response ? responses + 1 : 0
    const distance = Math.random()
    return {
      call, pause: birdPause(activity, response), volume: 0.12 + (1 - distance) * 0.17,
      pan: Math.random() * 1.5 - 0.75, cutoff: 3_200 + (1 - distance) * 4_500,
      rate: 0.98 + Math.random() * 0.04, varyExcerpt: true,
    }
  }, destination)
  player.setGain(0)
  return {
    ...player,
    setActivity(value: number) {
      activity = Math.min(1, Math.max(0, value))
      player.setGain(activity)
    },
  }
}
