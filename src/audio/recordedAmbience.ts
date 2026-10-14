import { playVoice, type VoiceSettings } from './playVoice'

export interface RecordedCall { id: string; path: string; duration: number; fadeIn?: number; fadeOut?: number }
/** Shared recording cache and finite voice lifecycle; scheduling belongs to recordedCalls. */
export function createRecordedAmbience(context: AudioContext, calls: readonly RecordedCall[], destination: AudioNode = context.destination) {
  const channels = new Map<string, { gain: GainNode; level: number }>(calls.map(call => {
    const gain = context.createGain()
    gain.gain.value = 1
    gain.connect(destination)
    return [call.id, { gain, level: 1 }] as const
  }))
  const buffers = new Map<string, AudioBuffer>()
  const abort = new AbortController()
  let loading: Promise<void> | null = null
  let disposed = false
  const voices = new Set<() => void>()

  const load = async () => {
    if (disposed) return
    loading ??= Promise.all(calls.map(async call => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}${call.path}`, { signal: abort.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const buffer = await context.decodeAudioData(await response.arrayBuffer())
        if (!disposed) buffers.set(call.id, buffer)
      } catch (error) {
        if (!disposed) console.warn(`Ambience recording ${call.id} could not be loaded`, error)
      }
    })).then(() => undefined)
    await loading
  }

  const suspend = () => {
    for (const stop of voices) stop()
    voices.clear()
  }

  return {
    prepare: load,
    async trigger(id: string, settings: Omit<VoiceSettings, 'duration'>, isCurrent: () => boolean, onEnded: () => void = () => {}) {
      await load()
      const buffer = buffers.get(id), call = calls.find(call => call.id === id), channel = channels.get(id)
      if (disposed || !isCurrent() || context.state !== 'running' || !buffer || !call || !channel || channel.level === 0) return null
      const voice = playVoice(context, buffer, { ...settings, duration: call.duration }, channel.gain, () => { voices.delete(voice.stop); onEnded() })
      voices.add(voice.stop)
      return voice.stop
    },
    async preview(id: string, isCurrent: () => boolean, onEnded: () => void) {
      await load()
      const buffer = buffers.get(id)
      const call = calls.find(candidate => candidate.id === id)
      if (disposed || !isCurrent() || !buffer || !call) return null
      const voice = playVoice(context, buffer, { duration: call.duration, fadeIn: call.fadeIn, fadeOut: call.fadeOut, volume: 0.3, rate: 1, pan: 0, cutoff: 12_000 }, context.destination, () => { voices.delete(voice.stop); onEnded() })
      voices.add(voice.stop)
      return voice.stop
    },
    setChannelVolumes(levels: Readonly<Record<string, number>>) {
      for (const [id, channel] of channels) {
        channel.level = levels[id] ?? 1
        channel.gain.gain.setTargetAtTime(channel.level, context.currentTime, 0.06)
      }
    },
    suspend,
    dispose() {
      disposed = true
      abort.abort()
      suspend()
      buffers.clear()
      for (const channel of channels.values()) channel.gain.disconnect()
    },
  }
}
