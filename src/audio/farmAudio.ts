import { chooseRecording, createRecordedAmbience, type RecordedCall } from './recordedAmbience'
import { FARM_CHANNELS } from '../core/audioSettings'

export interface FarmCall { id: string; duration: number }
export const FARM_CALLS = FARM_CHANNELS

export function chooseFarmCall(calls: readonly FarmCall[], previous: string | null, random = Math.random) {
  return chooseRecording(calls, previous, random)
}

export function farmCallDelay(dayGain: number, random = Math.random) {
  return 9_000 + random() * 12_000 + (1 - dayGain) * 18_000
}

export function createFarmAudio(context: AudioContext, destination: AudioNode = context.destination) {
  const calls = FARM_CALLS.map(call => ({ ...call, fadeIn: 0.025, fadeOut: 0.08 }))
  let dayGain = 1
  let previous: string | null = null
  let remaining: RecordedCall[] = []
  const player = createRecordedAmbience(context, calls, available => {
    remaining = remaining.filter(call => available.some(candidate => candidate.id === call.id))
    if (!remaining.length) remaining = [...available]
    const call = chooseRecording(remaining, previous)
    remaining = remaining.filter(candidate => candidate.id !== call.id)
    previous = call.id
    return {
      call, pause: farmCallDelay(dayGain), volume: 0.38 + dayGain * 0.2,
      pan: 0.16 + Math.random() * 0.16, cutoff: 2_500, rate: 1,
    }
  }, destination)
  return { ...player, setDayGain(value: number) { dayGain = Math.min(1, Math.max(0, value)) } }
}
