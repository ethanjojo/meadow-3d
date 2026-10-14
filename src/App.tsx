import { Canvas } from '@react-three/fiber'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ACESFilmicToneMapping } from 'three'
import { createAmbientAudio, type AmbientAudioController } from './audio/ambientAudio'
import { SceneErrorBoundary } from './components/SceneErrorBoundary'
import { EnvironmentSettings } from './components/EnvironmentSettings'
import { SoundToggle } from './components/SoundToggle'
import { StaticFallback } from './components/StaticFallback'
import { FrameScheduler } from './components/FrameScheduler'
import { PreferencesTools } from './components/PreferencesTools'
import type { MeadowPreferences } from './core/preferences'
import { resolveRenderPreferences } from './core/renderPreferences'
import { parseSceneSettings, type SceneSettings } from './core/sceneSettings'
import { parseAudioSettings, type AudioChannelId, type AudioPreviewState, type AudioSettings } from './core/audioSettings'
import {
  DEFAULT_SIMULATION_SETTINGS,
  parseSimulationSettings,
  type EnvironmentSnapshot,
  type EnvironmentTransitionFrame,
  type SimulationSettings,
} from './core/simulation'
import { hasWebGLSupport } from './core/webgl'
import { useAdaptiveQuality } from './hooks/useAdaptiveQuality'
import { usePageVisibility } from './hooks/usePageVisibility'
import './styles.css'

const NatureScene = lazy(() => import('./scene/NatureScene').then(module => ({ default: module.NatureScene })))

const ENVIRONMENT_STORAGE_KEY = 'living-meadow:environment'
const AUDIO_STORAGE_KEY = 'living-meadow:audio'
const SCENE_STORAGE_KEY = 'living-meadow:scene'

interface VisibleTransitionSample {
  snapshot: EnvironmentSnapshot
  active: boolean
  progress: number
  revision: number
}

function copyVisibleSnapshot(
  snapshot: EnvironmentSnapshot,
): EnvironmentSnapshot {
  return {
    ...snapshot,
    weather: {
      ...snapshot.weather,
      windDirection: [...snapshot.weather.windDirection] as [number, number],
    },
  }
}

function getInitialSimulationSettings(): SimulationSettings {
  try {
    return parseSimulationSettings(
      JSON.parse(localStorage.getItem(ENVIRONMENT_STORAGE_KEY) ?? 'null'),
    )
  } catch {
    return DEFAULT_SIMULATION_SETTINGS
  }
}

export function App() {
  const [sceneSettings, setSceneSettings] = useState(() => {
    try { return parseSceneSettings(JSON.parse(localStorage.getItem(SCENE_STORAGE_KEY) ?? 'null')) }
    catch { return parseSceneSettings(null) }
  })
  const sceneSettingsRef = useRef(sceneSettings)
  const [auroraPreviewUntil, setAuroraPreviewUntil] = useState(0)
  useEffect(() => {
    if (!auroraPreviewUntil) return
    const timer = setTimeout(() => setAuroraPreviewUntil(0), Math.max(0, auroraPreviewUntil - Date.now()))
    return () => clearTimeout(timer)
  }, [auroraPreviewUntil])
  const handleAuroraPreview = () => setAuroraPreviewUntil(current => current > Date.now() ? 0 : Date.now() + 45_000)
  sceneSettingsRef.current = sceneSettings
  const handleSceneChange = useCallback((value: SceneSettings) => {
    const next = parseSceneSettings(value)
    setSceneSettings(next)
    sceneSettingsRef.current = next
    audioRef.current?.setSceneSettings?.(next)
    try { localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(next)) }
    catch { /* Settings still apply when storage is unavailable. */ }
  }, [])
  const visible = usePageVisibility()
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [audioSettings, setAudioSettings] = useState(() => {
    try { return parseAudioSettings(JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY) ?? 'null')) }
    catch { return parseAudioSettings(null) }
  })
  const audioSettingsRef = useRef(audioSettings)
  const lastAudibleVolumeRef = useRef(audioSettings.master > 0 ? audioSettings.master : 1)
  const soundIntentRef = useRef(false)
  const soundRevisionRef = useRef(0)
  const [preview, setPreview] = useState<AudioPreviewState>(null)
  const previewIdRef = useRef<AudioChannelId | null>(null)
  const previewRequestRef = useRef(0)
  const [simulationSettings, setSimulationSettings] = useState(
    getInitialSimulationSettings,
  )
  const [visibleFrame, setVisibleFrame] =
    useState<VisibleTransitionSample | null>(null)
  const audioRef = useRef<AmbientAudioController | null>(null)
  const webglAvailable = useMemo(hasWebGLSupport, [])
  const reducedMotion = useMemo(
    () =>
      (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false) || sceneSettings.gentleMotion,
    [sceneSettings.gentleMotion],
  )
  const capabilities = useMemo(
    () => ({
      logicalCores: navigator.hardwareConcurrency || 4,
      devicePixelRatio: window.devicePixelRatio || 1,
      reducedMotion,
    }),
    [reducedMotion],
  )
  const { tier: automaticQuality, recordFrame } = useAdaptiveQuality(capabilities)
  const rendering = useMemo(() => resolveRenderPreferences(sceneSettings, automaticQuality), [sceneSettings, automaticQuality])
  const qualityTier = rendering.tier
  const quality = rendering.profile
  const getAudioController = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = createAmbientAudio(audioSettingsRef.current)
      audioRef.current.setSceneSettings?.(sceneSettingsRef.current)
    }
    return audioRef.current
  }, [])

  const handleAudioChange = useCallback((value: AudioSettings) => {
    const next = parseAudioSettings(value)
    audioSettingsRef.current = next
    if (next.master > 0) lastAudibleVolumeRef.current = next.master
    setAudioSettings(next)
    audioRef.current?.setAudioSettings(next)
    try { localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(next)) }
    catch { /* The current session remains usable when storage is unavailable. */ }
  }, [])

  const handleStopPreview = useCallback(() => {
    previewRequestRef.current++
    previewIdRef.current = null
    audioRef.current?.stopPreview()
    setPreview(null)
  }, [])

  const handleSoundChange = useCallback(async (enabled: boolean) => {
    const revision = ++soundRevisionRef.current
    soundIntentRef.current = enabled
    if (!enabled) {
      handleStopPreview()
      setSoundEnabled(false)
      await audioRef.current?.suspend()
      return
    }
    if (audioSettingsRef.current.master === 0) handleAudioChange({ ...audioSettingsRef.current, master: lastAudibleVolumeRef.current })
    const controller = getAudioController()
    const started = await controller.start()
    if (revision !== soundRevisionRef.current) {
      if (!soundIntentRef.current) await controller.suspend()
      return
    }
    soundIntentRef.current = started
    setSoundEnabled(started)
  }, [handleAudioChange, handleStopPreview, getAudioController])

  const handleMasterVolumeChange = useCallback((master: number) => {
    handleAudioChange({ ...audioSettingsRef.current, master })
    if (master === 0) void handleSoundChange(false)
    else if (!soundIntentRef.current) void handleSoundChange(true)
  }, [handleAudioChange, handleSoundChange])

  const handlePreview = useCallback(async (id: AudioChannelId) => {
    if (previewIdRef.current === id) { handleStopPreview(); return }
    const request = ++previewRequestRef.current
    previewIdRef.current = id
    setPreview({ id, status: 'loading' })
    const controller = getAudioController()
    const started = await controller.preview(id, () => {
      if (request !== previewRequestRef.current) return
      previewIdRef.current = null
      setPreview(null)
    })
    if (request !== previewRequestRef.current) return
    setPreview({ id, status: started ? 'playing' : 'error' })
    if (!started) previewIdRef.current = null
  }, [handleStopPreview, getAudioController])

  const handleNatureSample = useCallback(
    (frame: EnvironmentTransitionFrame) => {
      audioRef.current?.setNature(frame)
      setVisibleFrame({
        snapshot: copyVisibleSnapshot(frame.snapshot),
        active: frame.active,
        progress: frame.progress,
        revision: frame.revision,
      })
    },
    [],
  )

  const handleSimulationSettingsChange = useCallback(
    (next: SimulationSettings) => {
      setSimulationSettings(next)
      try {
        localStorage.setItem(ENVIRONMENT_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Controls remain usable when storage is unavailable.
      }
    },
    [],
  )

  useEffect(() => {
    if (!audioRef.current) return
    if (!visible) { handleStopPreview(); void audioRef.current.suspend() }
    else if (soundEnabled) void audioRef.current.resume()
  }, [soundEnabled, visible, handleStopPreview])

  useEffect(
    () => () => {
      void audioRef.current?.dispose()
    },
    [],
  )

  const handlePreferencesApply = useCallback((next: MeadowPreferences) => {
    handleStopPreview()
    handleSceneChange(next.scene)
    handleAudioChange(next.audio)
    handleSimulationSettingsChange(next.simulation)
    if (next.audio.master === 0) void handleSoundChange(false)
  }, [handleStopPreview, handleSceneChange, handleAudioChange, handleSimulationSettingsChange, handleSoundChange])

  const fallback = <StaticFallback />

  return (
    <main
      className="experience"
      aria-label="Living Meadow"
      data-simulation-mode={simulationSettings.mode}
      data-weather={simulationSettings.weather}
      data-season={simulationSettings.seasonIndex}
      data-transition-active={visibleFrame?.active ?? false}
      data-transition-progress={visibleFrame?.progress ?? 1}
      data-auto-elapsed={visibleFrame?.snapshot.autoElapsed ?? 0}
      data-transition-revision={visibleFrame?.revision ?? 0}
      data-quality={qualityTier}
    >
      {webglAvailable ? (
        <SceneErrorBoundary fallback={fallback}>
          <Canvas
            frameloop={!visible ? 'never' : rendering.fps > 0 ? 'demand' : 'always'}
            data-testid="nature-canvas"
            camera={{ position: [0, 1.08, 5.4], fov: 46, near: 0.1, far: 180 }}
            dpr={[1, quality.maxDpr]}
            shadows={quality.shadowSize > 0 ? 'percentage' : false}
            gl={{
              antialias: qualityTier !== 'low',
              alpha: false,
              precision: 'highp',
              powerPreference: 'high-performance',
              toneMapping: ACESFilmicToneMapping,
            }}
          >
            {rendering.fps > 0 ? <FrameScheduler fps={rendering.fps} visible={visible} /> : null}
            <Suspense fallback={null}>
              <NatureScene
                auroraPreviewUntil={auroraPreviewUntil}
                sceneSettings={sceneSettings}
                qualityTier={qualityTier}
                qualityProfile={quality}
                stormDistanceKm={audioSettings.thunderDistance}
                reducedMotion={reducedMotion}
                visible={visible}
                recordFrame={sceneSettings.quality === 'auto' && !sceneSettings.powerSaving && rendering.fps === 0 ? recordFrame : undefined}
                onNatureSample={handleNatureSample}
                simulationSettings={simulationSettings}
              />
            </Suspense>
          </Canvas>
        </SceneErrorBoundary>
      ) : (
        fallback
      )}
      {webglAvailable ? (
        <div className="experience-controls">
          <EnvironmentSettings
            auroraPreviewActive={auroraPreviewUntil > 0}
            onAuroraPreview={handleAuroraPreview}
            preferencesTools={<PreferencesTools value={{ scene: sceneSettings, audio: audioSettings, simulation: simulationSettings }} onApply={handlePreferencesApply} />}
            sceneSettings={sceneSettings}
            onSceneChange={handleSceneChange}
            value={simulationSettings}
            visibleSnapshot={visibleFrame?.snapshot}
            onChange={handleSimulationSettingsChange}
            audioSettings={audioSettings}
            soundEnabled={soundEnabled}
            onAudioChange={handleAudioChange}
            onSoundChange={handleSoundChange}
            onMasterVolumeChange={handleMasterVolumeChange}
            preview={preview}
            onPreview={handlePreview}
            onStopPreview={handleStopPreview}
          />
          <SoundToggle enabled={soundEnabled} onChange={handleSoundChange} volume={audioSettings.master}
            onVolumeChange={handleMasterVolumeChange} />
        </div>
      ) : null}
    </main>
  )
}
