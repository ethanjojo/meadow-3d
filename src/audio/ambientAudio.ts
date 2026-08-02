import type { NatureSnapshot } from '../core/natureClock'

export interface AmbientAudioController {
  start: () => Promise<boolean>
  setNature: (snapshot: NatureSnapshot) => void
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
  let lfo: OscillatorNode | null = null
  let chirpTimer: number | null = null
  let latestSnapshot: NatureSnapshot | null = null

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
    oscillator.connect(gain).connect(context.destination)
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
    lfo = context.createOscillator()
    const lfoGain = context.createGain()

    windSource.buffer = noiseBuffer
    windSource.loop = true
    windFilter.type = 'lowpass'
    windFilter.frequency.value = 720
    windGain.gain.value = 0.022
    lfo.frequency.value = 0.085
    lfoGain.gain.value = 0.008

    windSource.connect(windFilter).connect(windGain).connect(context.destination)
    lfo.connect(lfoGain).connect(windGain.gain)
    windSource.start()
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
        420 + snapshot.windStrength * 1_150,
        now,
        0.45,
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
        lfo?.stop()
      } catch {
        // Nodes may already be stopped by a closed AudioContext.
      }
      windSource?.disconnect()
      windFilter?.disconnect()
      windGain?.disconnect()
      lfo?.disconnect()
      if (context && context.state !== 'closed') await context.close()
      context = null
    },
  }
}
