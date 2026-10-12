export interface VoiceSettings {
  duration: number
  volume: number
  rate: number
  pan: number
  cutoff: number
  filterType?: BiquadFilterType
  varyExcerpt?: boolean
  fadeIn?: number
  fadeOut?: number
}

/** Shared finite voice graph for ambient calls and explicit sample playback. */
export function playVoice(context: AudioContext, buffer: AudioBuffer, settings: VoiceSettings, destination: AudioNode, onEnded: () => void) {
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const panner = context.createStereoPanner()
  const envelope = context.createGain()
  const duration = Math.min(settings.duration, buffer.duration / settings.rate)
  const sourceDuration = duration * settings.rate
  const offset = settings.varyExcerpt ? Math.random() * Math.max(0, buffer.duration - sourceDuration) : 0
  source.buffer = buffer
  source.playbackRate.value = settings.rate
  filter.type = settings.filterType ?? 'lowpass'
  filter.frequency.value = settings.cutoff
  filter.Q.value = 0.4
  panner.pan.value = settings.pan
  source.connect(filter).connect(panner).connect(envelope).connect(destination)
  const now = context.currentTime
  envelope.gain.setValueAtTime(0, now)
  envelope.gain.linearRampToValueAtTime(settings.volume, now + Math.min(settings.fadeIn ?? 0.15, duration / 4))
  envelope.gain.setValueAtTime(settings.volume, now + Math.max(duration / 4, duration - (settings.fadeOut ?? 0.4)))
  envelope.gain.linearRampToValueAtTime(0, now + duration)
  let active = true
  source.onended = () => {
    active = false
    source.disconnect(); filter.disconnect(); panner.disconnect(); envelope.disconnect()
    onEnded()
  }
  source.start(now, offset, sourceDuration)
  return { duration, stop() { if (active) source.stop() } }
}
