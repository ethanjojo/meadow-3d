import { playVoice, type VoiceSettings } from './playVoice'

export interface RecordedCall { id: string; path: string; duration: number; fadeIn?: number; fadeOut?: number }
export interface CallPlan {
  call: RecordedCall
  pause: number
  volume: number
  pan: number
  cutoff: number
  rate: number
  varyExcerpt?: boolean
}

export function chooseRecording<T extends { id: string }>(calls: readonly T[], previous: string | null, random = Math.random): T {
  const candidates = calls.filter(call => call.id !== previous)
  const pool = candidates.length ? candidates : calls
  if (!pool.length) throw new Error('No recordings available')
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}

/** One loader, voice lifecycle and timer implementation for all recorded ambience. */
export function createRecordedAmbience(context: AudioContext, calls: readonly RecordedCall[], plan: (available: readonly RecordedCall[]) => CallPlan | null, destination: AudioNode = context.destination) {
  const master = context.createGain()
  master.gain.value = 1
  master.connect(destination)
  const channels = new Map<string, { gain: GainNode; level: number }>(calls.map(call => {
    const gain = context.createGain()
    gain.gain.value = 1
    gain.connect(master)
    return [call.id, { gain, level: 1 }] as const
  }))
  const buffers = new Map<string, AudioBuffer>()
  const abort = new AbortController()
  let loading: Promise<void> | null = null
  let timer: number | null = null
  let disposed = false
  let running = false
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

  const schedule = (delay: number) => {
    if (disposed || !running || timer !== null || context.state !== 'running' || !buffers.size) return
    timer = window.setTimeout(() => {
      timer = null
      if (disposed || !running || context.state !== 'running') return
      const available = calls.filter(call => buffers.has(call.id) && channels.get(call.id)!.level > 0)
      const next = available.length ? plan(available) : null
      if (!next) { schedule(2_000); return }
      const buffer = buffers.get(next.call.id)!
      const voice = playVoice(context, buffer, { ...next, duration: next.call.duration, fadeIn: next.call.fadeIn, fadeOut: next.call.fadeOut }, channels.get(next.call.id)!.gain, () => voices.delete(voice.stop))
      voices.add(voice.stop)
      schedule(voice.duration * 1_000 + next.pause)
    }, delay)
  }

  const suspend = () => {
    running = false
    if (timer !== null) window.clearTimeout(timer)
    timer = null
    for (const stop of voices) stop()
    voices.clear()
  }

  return {
    prepare: load,
    async trigger(id: string, settings: Omit<VoiceSettings, 'duration'>, isCurrent: () => boolean) {
      await load()
      const buffer = buffers.get(id), call = calls.find(call => call.id === id), channel = channels.get(id)
      if (disposed || !isCurrent() || context.state !== 'running' || !buffer || !call || !channel || channel.level === 0) return null
      const voice = playVoice(context, buffer, { ...settings, duration: call.duration }, channel.gain, () => voices.delete(voice.stop))
      voices.add(voice.stop)
      return voice.stop
    },
    async start() {
      if (disposed) return
      running = true
      await load()
      schedule(2_000)
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
    setGain(value: number) { master.gain.setTargetAtTime(value, context.currentTime, 0.5) },
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
      master.disconnect()
    },
  }
}
