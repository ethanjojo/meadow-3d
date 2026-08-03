import type { EnvironmentSnapshot } from '../core/simulation'

export interface AmbientAudioController {
  start: () => Promise<boolean>
  setNature: (snapshot: EnvironmentSnapshot) => void
  suspend: () => Promise<void>
  resume: () => Promise<void>
  dispose: () => Promise<void>
}

export interface AmbientAudioMix {
  chirpLayer: 'day' | 'night'
  windGain: number
  windFrequency: number
  rainGain: number
  dayGain: number
  nightGain: number
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

export function deriveAmbientAudioMix(
  snapshot: EnvironmentSnapshot,
): AmbientAudioMix {
  const solarHeight = Math.sin(snapshot.dayPhase * Math.PI * 2 - Math.PI / 2)
  const day = clamp01(solarHeight * 1.8)
  const night = clamp01(-solarHeight * 1.8)

  return {
    chirpLayer: solarHeight > 0 ? 'day' : 'night',
    windGain: 0.012 + snapshot.weather.windStrength * 0.035,
    windFrequency: 420 + snapshot.weather.windStrength * 1_150,
    rainGain: snapshot.weather.rain * 0.032 + snapshot.weather.storm * 0.012,
    dayGain: day * (1 - snapshot.weather.rain * 0.58),
    nightGain:
      night *
      (0.25 + snapshot.weather.fireflies * 0.75) *
      (1 - snapshot.weather.rain * 0.82),
  }
}

type SafariWindow = Window & {
  webkitAudioContext?: typeof AudioContext
}

export function createAmbientAudio(): AmbientAudioController {
  let context: AudioContext | null = null
  let windSource: AudioBufferSourceNode | null = null
  let windFilter: BiquadFilterNode | null = null
  let windGain: GainNode | null = null
  let rainSource: AudioBufferSourceNode | null = null
  let rainFilter: BiquadFilterNode | null = null
  let rainGain: GainNode | null = null
  let dayGain: GainNode | null = null
  let nightGain: GainNode | null = null
  let lfo: OscillatorNode | null = null
  let chirpTimer: number | null = null
  let latestSnapshot: EnvironmentSnapshot | null = null

  const createChirp = () => {
    if (!context || context.state !== 'running' || !latestSnapshot) return

    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const mix = deriveAmbientAudioMix(latestSnapshot)
    const daylight = mix.chirpLayer === 'day'
    const startTime = context.currentTime
    oscillator.type = daylight ? 'sine' : 'triangle'
    oscillator.frequency.setValueAtTime(daylight ? 2_400 : 4_800, startTime)
    oscillator.frequency.exponentialRampToValueAtTime(
      daylight ? 3_200 : 4_200,
      startTime + 0.16,
    )
    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(daylight ? 0.012 : 0.004, startTime + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22)
    const chirpDestination = daylight ? dayGain : nightGain
    oscillator.connect(gain).connect(chirpDestination ?? context.destination)
    oscillator.start(startTime)
    oscillator.stop(startTime + 0.24)
  }

  const initialize = () => {
    const AudioContextConstructor =
      window.AudioContext ?? (window as SafariWindow).webkitAudioContext
    if (!AudioContextConstructor) return false

    context = new AudioContextConstructor()
    const noiseBuffer = context.createBuffer(
      1,
      context.sampleRate * 2,
      context.sampleRate,
    )
    const noise = noiseBuffer.getChannelData(0)
    for (let index = 0; index < noise.length; index += 1) {
      noise[index] = Math.random() * 2 - 1
    }

    windSource = context.createBufferSource()
    windFilter = context.createBiquadFilter()
    windGain = context.createGain()
    rainSource = context.createBufferSource()
    rainFilter = context.createBiquadFilter()
    rainGain = context.createGain()
    dayGain = context.createGain()
    nightGain = context.createGain()
    lfo = context.createOscillator()
    const lfoGain = context.createGain()

    windSource.buffer = noiseBuffer
    windSource.loop = true
    windFilter.type = 'lowpass'
    windFilter.frequency.value = 720
    windGain.gain.value = 0.022
    rainSource.buffer = noiseBuffer
    rainSource.loop = true
    rainFilter.type = 'highpass'
    rainFilter.frequency.value = 1_650
    rainGain.gain.value = 0
    dayGain.gain.value = 1
    nightGain.gain.value = 0
    dayGain.connect(context.destination)
    nightGain.connect(context.destination)
    lfo.frequency.value = 0.085
    lfoGain.gain.value = 0.008

    windSource.connect(windFilter).connect(windGain).connect(context.destination)
    rainSource.connect(rainFilter).connect(rainGain).connect(context.destination)
    lfo.connect(lfoGain).connect(windGain.gain)
    windSource.start()
    rainSource.start()
    lfo.start()
    chirpTimer = window.setInterval(createChirp, 4_600)
    return true
  }

  return {
    async start() {
      try {
        if (!context && !initialize()) return false
        await context?.resume()
        return context?.state === 'running'
      } catch {
        return false
      }
    },

    setNature(snapshot) {
      latestSnapshot = snapshot
      if (!context || !windGain || !windFilter) return
      const now = context.currentTime
      const mix = deriveAmbientAudioMix(snapshot)
      windGain.gain.setTargetAtTime(
        mix.windGain,
        now,
        0.35,
      )
      windFilter.frequency.setTargetAtTime(
        mix.windFrequency,
        now,
        0.45,
      )
      rainGain?.gain.setTargetAtTime(
        mix.rainGain,
        now,
        0.28,
      )
      dayGain?.gain.setTargetAtTime(mix.dayGain, now, 0.5)
      nightGain?.gain.setTargetAtTime(
        mix.nightGain,
        now,
        0.5,
      )
    },

    async suspend() {
      if (context?.state === 'running') await context.suspend()
    },

    async resume() {
      if (context?.state === 'suspended') await context.resume()
    },

    async dispose() {
      if (chirpTimer !== null) window.clearInterval(chirpTimer)
      chirpTimer = null
      try {
        windSource?.stop()
        rainSource?.stop()
        lfo?.stop()
      } catch {
        // Nodes may already be stopped by a closed AudioContext.
      }
      windSource?.disconnect()
      windFilter?.disconnect()
      windGain?.disconnect()
      rainSource?.disconnect()
      rainFilter?.disconnect()
      rainGain?.disconnect()
      dayGain?.disconnect()
      nightGain?.disconnect()
      lfo?.disconnect()
      if (context && context.state !== 'closed') await context.close()
      context = null
    },
  }
}
