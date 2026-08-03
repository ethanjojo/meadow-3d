import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ACESFilmicToneMapping } from 'three'
import { createAmbientAudio, type AmbientAudioController } from './audio/ambientAudio'
import { SceneErrorBoundary } from './components/SceneErrorBoundary'
import { EnvironmentSettings } from './components/EnvironmentSettings'
import { SoundToggle } from './components/SoundToggle'
import { StaticFallback } from './components/StaticFallback'
import { QUALITY_PROFILES } from './core/quality'
import {
  DEFAULT_SIMULATION_SETTINGS,
  parseSimulationSettings,
  type EnvironmentSnapshot,
  type SimulationSettings,
} from './core/simulation'
import { hasWebGLSupport } from './core/webgl'
import { useAdaptiveQuality } from './hooks/useAdaptiveQuality'
import { usePageVisibility } from './hooks/usePageVisibility'
import { NatureScene } from './scene/NatureScene'
import './styles.css'

const ENVIRONMENT_STORAGE_KEY = 'living-meadow:environment'

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
  const visible = usePageVisibility()
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [simulationSettings, setSimulationSettings] = useState(
    getInitialSimulationSettings,
  )
  const [visibleSnapshot, setVisibleSnapshot] =
    useState<EnvironmentSnapshot | null>(null)
  const audioRef = useRef<AmbientAudioController | null>(null)
  const webglAvailable = useMemo(hasWebGLSupport, [])
  const reducedMotion = useMemo(
    () =>
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    [],
  )
  const capabilities = useMemo(
    () => ({
      logicalCores: navigator.hardwareConcurrency || 4,
      devicePixelRatio: window.devicePixelRatio || 1,
      reducedMotion,
    }),
    [reducedMotion],
  )
  const { tier: qualityTier, recordFrame } = useAdaptiveQuality(capabilities)
  const quality = QUALITY_PROFILES[qualityTier]

  const handleSoundChange = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      await audioRef.current?.suspend()
      setSoundEnabled(false)
      localStorage.setItem('living-meadow:sound', 'muted')
      return
    }

    const controller = audioRef.current ?? createAmbientAudio()
    audioRef.current = controller
    const started = await controller.start()
    setSoundEnabled(started)
    localStorage.setItem('living-meadow:sound', started ? 'enabled' : 'muted')
  }, [])

  const handleNatureSample = useCallback(
    (snapshot: EnvironmentSnapshot) => {
      audioRef.current?.setNature(snapshot)
      setVisibleSnapshot(snapshot)
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
    if (!audioRef.current || !soundEnabled) return
    void (visible ? audioRef.current.resume() : audioRef.current.suspend())
  }, [soundEnabled, visible])

  useEffect(
    () => () => {
      void audioRef.current?.dispose()
    },
    [],
  )

  const fallback = <StaticFallback />

  return (
    <main
      className="experience"
      aria-label="Živá louka"
      data-simulation-mode={simulationSettings.mode}
      data-weather={simulationSettings.weather}
      data-season={simulationSettings.seasonIndex}
    >
      {webglAvailable ? (
        <SceneErrorBoundary fallback={fallback}>
          <Canvas
            data-testid="nature-canvas"
            camera={{ position: [0, 1.08, 5.4], fov: 46, near: 0.1, far: 180 }}
            dpr={[1, quality.maxDpr]}
            shadows={quality.shadowSize > 0 ? 'percentage' : false}
            gl={{
              antialias: qualityTier !== 'low',
              alpha: false,
              powerPreference: 'high-performance',
              toneMapping: ACESFilmicToneMapping,
            }}
          >
            <Suspense fallback={null}>
              <NatureScene
                qualityTier={qualityTier}
                reducedMotion={reducedMotion}
                visible={visible}
                recordFrame={recordFrame}
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
            value={simulationSettings}
            visibleSnapshot={visibleSnapshot}
            onChange={handleSimulationSettingsChange}
          />
          <SoundToggle enabled={soundEnabled} onChange={handleSoundChange} />
        </div>
      ) : null}
    </main>
  )
}
