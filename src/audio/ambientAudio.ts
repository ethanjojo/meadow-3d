import type { EnvironmentSnapshot } from '../core/simulation'

export interface AmbientAudioController {
  start: () => Promise<boolean>
  setNature: (snapshot: EnvironmentSnapshot) => void
  suspend: () => Promise<void>
  resume: () => Promise<void>
  dispose: () => Promise<void>
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
  let nightGain: GainNode | null = null
  let lfo: OscillatorNode | null = null
  let chirpTimer: number | null = null
  let latestSnapshot: EnvironmentSnapshot | null = null

  const createChirp = () => {
    if (!context || context.state !== 'running' || !latestSnapshot) return

    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const daylight = Math.sin(latestSnapshot.dayPhase * Math.PI * 2 - Math.PI / 2) > 0
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
    oscillator.connect(gain).connect(nightGain ?? context.destination)
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
    nightGain.gain.value = 0
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
      windGain.gain.setTargetAtTime(
        0.012 + snapshot.windStrength * 0.035,
        now,
        0.35,
      )
      windFilter.frequency.setTargetAtTime(
        420 + snapshot.weather.windStrength * 1_150,
        now,
        0.45,
      )
      rainGain?.gain.setTargetAtTime(
        snapshot.weather.rain * 0.032 + snapshot.weather.storm * 0.012,
        now,
        0.28,
      )
      const solarHeight = Math.sin(snapshot.dayPhase * Math.PI * 2 - Math.PI / 2)
      const night = Math.min(1, Math.max(0, -solarHeight * 1.8))
      nightGain?.gain.setTargetAtTime(
        night *
          (0.25 + snapshot.weather.fireflies * 0.75) *
          (1 - snapshot.weather.rain * 0.82),
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
      nightGain?.disconnect()
      lfo?.disconnect()
      if (context && context.state !== 'closed') await context.close()
      context = null
    },
  }
}
