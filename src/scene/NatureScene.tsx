import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  DEFAULT_CLOCK,
  sampleNatureClock,
  type NatureSnapshot,
} from '../core/natureClock'
import { QUALITY_PROFILES, type QualityTier } from '../core/quality'
import { getSeasonAppearance } from '../core/season'
import type { SimulationSettings } from '../core/simulation'
import { Atmosphere } from './Atmosphere'
import { CinematicCamera } from './CinematicCamera'
import { Meadow } from './Meadow'
import { WeatherParticles } from './WeatherParticles'

interface NatureSceneProps {
  qualityTier: QualityTier
  reducedMotion: boolean
  visible: boolean
  recordFrame?: (deltaSeconds: number) => void
  onNatureSample?: (snapshot: NatureSnapshot) => void
  simulationSettings: SimulationSettings
}

const DAY_START_OFFSET = DEFAULT_CLOCK.dayDuration * 0.31

export function NatureScene({
  qualityTier,
  reducedMotion,
  visible,
  recordFrame,
  onNatureSample,
}: NatureSceneProps) {
  const quality = QUALITY_PROFILES[qualityTier]
  const initialSnapshot = useMemo(
    () => sampleNatureClock(DAY_START_OFFSET, DEFAULT_CLOCK),
    [],
  )
  const snapshotRef = useRef(initialSnapshot)
  const seasonRef = useRef(getSeasonAppearance(initialSnapshot))
  const activeElapsedRef = useRef(0)
  const lastExternalSampleRef = useRef(-1)

  useFrame((_, delta) => {
    if (!visible) return

    const safeDelta = Math.min(delta, 0.1)
    activeElapsedRef.current += safeDelta
    const snapshot = sampleNatureClock(
      activeElapsedRef.current + DAY_START_OFFSET,
      DEFAULT_CLOCK,
    )
    snapshotRef.current = snapshot
    seasonRef.current = getSeasonAppearance(snapshot)
    recordFrame?.(delta)

    if (
      onNatureSample &&
      snapshot.elapsed - lastExternalSampleRef.current >= 0.25
    ) {
      lastExternalSampleRef.current = snapshot.elapsed
      onNatureSample(snapshot)
    }
  })

  return (
    <>
      <Atmosphere
        quality={quality}
        snapshotRef={snapshotRef}
        seasonRef={seasonRef}
        visible={visible}
      />
      <Meadow
        quality={quality}
        snapshotRef={snapshotRef}
        seasonRef={seasonRef}
      />
      <WeatherParticles
        quality={quality}
        snapshotRef={snapshotRef}
        seasonRef={seasonRef}
        reducedMotion={reducedMotion}
        visible={visible}
      />
      <CinematicCamera reducedMotion={reducedMotion} visible={visible} />
    </>
  )
}
