import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ACESFilmicToneMapping } from 'three'
import { createAmbientAudio, type AmbientAudioController } from './audio/ambientAudio'
import { SceneErrorBoundary } from './components/SceneErrorBoundary'
import { SoundToggle } from './components/SoundToggle'
import { StaticFallback } from './components/StaticFallback'
import { QUALITY_PROFILES } from './core/quality'
import { hasWebGLSupport } from './core/webgl'
import { useAdaptiveQuality } from './hooks/useAdaptiveQuality'
import { usePageVisibility } from './hooks/usePageVisibility'
import { NatureScene } from './scene/NatureScene'
import './styles.css'

export function App() {
  const visible = usePageVisibility()
  const [soundEnabled, setSoundEnabled] = useState(false)
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
    (snapshot: Parameters<AmbientAudioController['setNature']>[0]) => {
      audioRef.current?.setNature(snapshot)
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
    <main className="experience" aria-label="Živá louka">
      {webglAvailable ? (
        <SceneErrorBoundary fallback={fallback}>
          <Canvas
            data-testid="nature-canvas"
            camera={{ position: [0, 1.15, 5.4], fov: 48, near: 0.1, far: 180 }}
            dpr={[1, quality.maxDpr]}
            shadows={quality.shadowSize > 0}
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
              />
            </Suspense>
          </Canvas>
        </SceneErrorBoundary>
      ) : (
        fallback
      )}
      {webglAvailable ? (
        <div className="experience-controls">
          <SoundToggle enabled={soundEnabled} onChange={handleSoundChange} />
        </div>
      ) : null}
    </main>
  )
}
