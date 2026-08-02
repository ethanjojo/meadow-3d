import { Canvas } from '@react-three/fiber'
import { Suspense, useMemo } from 'react'
import { ACESFilmicToneMapping } from 'three'
import { QUALITY_PROFILES } from './core/quality'
import { useAdaptiveQuality } from './hooks/useAdaptiveQuality'
import { usePageVisibility } from './hooks/usePageVisibility'
import { NatureScene } from './scene/NatureScene'
import './styles.css'

export function App() {
  const visible = usePageVisibility()
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

  return (
    <main className="experience" aria-label="Živá louka">
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
          />
        </Suspense>
      </Canvas>
    </main>
  )
}
