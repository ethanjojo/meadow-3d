import type {
  EnvironmentSnapshot,
  EnvironmentTransitionFrame,
} from '../core/simulation'
import { createRecordedCalls } from './recordedCalls'
import { DEFAULT_SCENE_SETTINGS, type SceneSettings } from '../core/sceneSettings'
import { DEFAULT_AUDIO_SETTINGS, type AudioChannelId, type AudioSettings } from '../core/audioSettings'
import { playVoice } from './playVoice'
import { createThunderAudio } from './thunderAudio'

export interface AmbientAudioController {
  start: () => Promise<boolean>
  setNature: (frame: EnvironmentTransitionFrame) => void
  setAudioSettings: (settings: AudioSettings) => void
  setSceneSettings?: (settings: SceneSettings) => void
  preview: (id: AudioChannelId, onEnded: () => void) => Promise<boolean>
  stopPreview: () => void
  suspend: () => Promise<void>
  resume: () => Promise<void>
  dispose: () => Promise<void>
}

export interface AmbientAudioMix {
  windGain: number
  windFrequency: number
  rainGain: number
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

export function deriveAmbientAudioMix(
  snapshot: EnvironmentSnapshot,
): AmbientAudioMix {
  return {
    windGain: 0.012 + snapshot.weather.windStrength * 0.035,
    windFrequency: 420 + snapshot.weather.windStrength * 1_150,
    rainGain: snapshot.weather.rain * 0.032 + snapshot.weather.storm * 0.012,
  }
}

function blendAmbientAudioMix(
  source: AmbientAudioMix,
  target: AmbientAudioMix,
  amount: number,
): AmbientAudioMix {
  const blend = clamp01(amount)
  return {
    windGain: source.windGain + (target.windGain - source.windGain) * blend,
    windFrequency:
      source.windFrequency +
      (target.windFrequency - source.windFrequency) * blend,
    rainGain: source.rainGain + (target.rainGain - source.rainGain) * blend,
  }
}

export function deriveAmbientAudioMixFromFrame(
  frame: EnvironmentTransitionFrame,
): AmbientAudioMix {
  return blendAmbientAudioMix(
    deriveAmbientAudioMix(frame.source),
    deriveAmbientAudioMix(frame.target),
    frame.progress,
  )
}

type SafariWindow = Window & {
  webkitAudioContext?: typeof AudioContext
}
type AudioSessionType = 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record'
type AudioSessionNavigator = Navigator & { audioSession?: { type: AudioSessionType } }

export function createAmbientAudio(initialSettings = DEFAULT_AUDIO_SETTINGS): AmbientAudioController {
  let settings = initialSettings
  let context: AudioContext | null = null
  let masterGain: GainNode | null = null
  let windSource: AudioBufferSourceNode | null = null
  let windFilter: BiquadFilterNode | null = null
  let windGain: GainNode | null = null
  let rainSource: AudioBufferSourceNode | null = null
  let rainFilter: BiquadFilterNode | null = null
  let rainGain: GainNode | null = null
  let lfo: OscillatorNode | null = null
  let frozenMix: AmbientAudioMix | null = null
  let lastAppliedMix: AmbientAudioMix | null = null
  let lastRevision = -1
  let recordings: ReturnType<typeof createRecordedCalls> | null = null
  let sceneSettings = DEFAULT_SCENE_SETTINGS
  let lastSnapshot: EnvironmentSnapshot | null = null
  let thunder: ReturnType<typeof createThunderAudio> | null = null
  let noiseBuffer: AudioBuffer | null = null
  let ambientRunning = false
  let previewRevision = 0
  let cancelPreview: (() => void) | null = null
  let previousSessionType: AudioSessionType | null = null
  let activationRevision = 0

  const setPlaybackSession = (active: boolean) => {
    const session = (navigator as AudioSessionNavigator).audioSession
    if (!session) return
    if (active) {
      previousSessionType ??= session.type
      session.type = 'playback'
    } else if (previousSessionType !== null) {
      session.type = previousSessionType
      previousSessionType = null
    }
  }

  const stopPreview = () => {
    previewRevision++
    cancelPreview?.()
    cancelPreview = null
    if (!ambientRunning) {
      if (context?.state === 'running') void context.suspend()
      setPlaybackSession(false)
    }
  }

  const initialize = () => {
    const AudioContextConstructor =
      window.AudioContext ?? (window as SafariWindow).webkitAudioContext
    if (!AudioContextConstructor) return false

    context = new AudioContextConstructor()
    masterGain = context.createGain()
    masterGain.gain.value = 0
    masterGain.connect(context.destination)
    recordings = createRecordedCalls(context, masterGain, settings)
    if (lastSnapshot) recordings.setNature(lastSnapshot)
    thunder = createThunderAudio(context, masterGain)
    thunder.setLevel(settings.channels.thunder * settings.groups.weather)
    thunder.setOptions({ interval: sceneSettings.lightningInterval, distanceKm: settings.thunderDistance })
    noiseBuffer = context.createBuffer(
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
    lfo = context.createOscillator()
    const lfoGain = context.createGain()

    windSource.buffer = noiseBuffer
    windSource.loop = true
    windFilter.type = 'lowpass'
    windFilter.frequency.value = 720
    windGain.gain.value = 0.022 * settings.channels.wind * settings.groups.weather
    rainSource.buffer = noiseBuffer
    rainSource.loop = true
    rainFilter.type = 'highpass'
    rainFilter.frequency.value = 1_650
    rainGain.gain.value = 0
    lfo.frequency.value = 0.085
    lfoGain.gain.value = 90

    windSource.connect(windFilter).connect(windGain).connect(masterGain)
    rainSource.connect(rainFilter).connect(rainGain).connect(masterGain)
    // Modulate the wind filter, so a zero wind level stays completely silent.
    lfo.connect(lfoGain).connect(windFilter.frequency)
    windSource.start()
    rainSource.start()
    lfo.start()
    return true
  }

  const activateAmbience = async () => {
    const revision = ++activationRevision
    try {
      if (!context && !initialize()) return false
      // Select the media session before resume, still inside the tap handler.
      setPlaybackSession(true)
      await context?.resume()
      if (revision !== activationRevision) return false
      if (context?.state !== 'running') {
        setPlaybackSession(false)
        return false
      }
      ambientRunning = true
      masterGain?.gain.setTargetAtTime(settings.master, context!.currentTime, 0.06)
      void recordings?.start()
      thunder?.start()
      return true
    } catch {
      if (revision === activationRevision) setPlaybackSession(false)
      return false
    }
  }

  return {
    start: activateAmbience,

    setAudioSettings(next) {
      settings = next
      if (!context) return
      masterGain?.gain.setTargetAtTime(ambientRunning ? settings.master : 0, context.currentTime, 0.06)
      recordings?.setSettings(settings)
      thunder?.setLevel(settings.channels.thunder * settings.groups.weather)
      thunder?.setOptions({ interval: sceneSettings.lightningInterval, distanceKm: settings.thunderDistance })
      windGain?.gain.setTargetAtTime((lastAppliedMix?.windGain ?? 0.022) * settings.channels.wind * settings.groups.weather, context.currentTime, 0.06)
      rainGain?.gain.setTargetAtTime((lastAppliedMix?.rainGain ?? 0) * settings.channels.rain * settings.groups.weather, context.currentTime, 0.06)
    },

    async preview(id, onEnded) {
      stopPreview()
      const revision = previewRevision
      try {
        if (!context && !initialize()) return false
        const audio = context!
        setPlaybackSession(true)
        await audio.resume()
        if (revision !== previewRevision) return false
        if (audio.state !== 'running') {
          if (!ambientRunning) setPlaybackSession(false)
          return false
        }
        const finished = () => {
          if (revision !== previewRevision) return
          cancelPreview = null
          if (!ambientRunning) {
            void audio.suspend()
            setPlaybackSession(false)
          }
          onEnded()
        }
        if (id === 'wind' || id === 'rain') {
          cancelPreview = playVoice(audio, noiseBuffer!, { duration: 2, volume: 0.06, rate: 1, pan: 0, cutoff: id === 'wind' ? 720 : 1_650, filterType: id === 'wind' ? 'lowpass' : 'highpass' }, audio.destination, finished).stop
        } else {
          const cancel = id === 'thunder'
            ? await thunder!.preview(() => revision === previewRevision, finished)
            : await recordings!.preview(id, () => revision === previewRevision, finished)
          if (revision !== previewRevision) { cancel?.(); return false }
          cancelPreview = cancel
        }
        if (!cancelPreview && revision === previewRevision && !ambientRunning) {
          void audio.suspend()
          setPlaybackSession(false)
        }
        return cancelPreview !== null && revision === previewRevision
      } catch {
        if (revision === previewRevision && !ambientRunning) setPlaybackSession(false)
        return false
      }
    },
    stopPreview,

    setSceneSettings(next) {
      sceneSettings = next
      thunder?.setOptions({ interval: next.lightningInterval, distanceKm: settings.thunderDistance })
    },

    setNature(frame) {
      lastSnapshot = frame.snapshot
      recordings?.setNature(frame.snapshot)
      thunder?.sync(frame.snapshot)
      const sourceMix = deriveAmbientAudioMix(frame.source)
      const targetMix = deriveAmbientAudioMix(frame.target)
      if (frame.revision !== lastRevision) {
        frozenMix = lastAppliedMix ? { ...lastAppliedMix } : sourceMix
        lastRevision = frame.revision
      } else if (!frame.active) {
        frozenMix = sourceMix
      }
      const mix = blendAmbientAudioMix(
        frozenMix ?? sourceMix,
        targetMix,
        frame.progress,
      )
      lastAppliedMix = mix
      if (!context || !windGain || !windFilter) return
      const now = context.currentTime
      windGain.gain.setTargetAtTime(
        mix.windGain * settings.channels.wind * settings.groups.weather,
        now,
        0.35,
      )
      windFilter.frequency.setTargetAtTime(
        mix.windFrequency,
        now,
        0.45,
      )
      rainGain?.gain.setTargetAtTime(
        mix.rainGain * settings.channels.rain * settings.groups.weather,
        now,
        0.28,
      )
    },

    async suspend() {
      activationRevision++
      ambientRunning = false
      stopPreview()
      masterGain?.gain.setValueAtTime(0, context?.currentTime ?? 0)
      recordings?.suspend()
      thunder?.suspend()
      if (context?.state === 'running') await context.suspend()
    },

    async resume() {
      if (context && context.state !== 'closed') await activateAmbience()
    },

    async dispose() {
      activationRevision++
      ambientRunning = false
      stopPreview()
      recordings?.dispose()
      recordings = null
      thunder?.dispose()
      thunder = null
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
      masterGain?.disconnect()
      lfo?.disconnect()
      if (context && context.state !== 'closed') await context.close()
      context = null
      masterGain = null
      noiseBuffer = null
      frozenMix = null
      lastAppliedMix = null
      lastRevision = -1
    },
  }
}
