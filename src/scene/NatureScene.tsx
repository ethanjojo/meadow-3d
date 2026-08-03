import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  DEFAULT_CLOCK,
  sampleNatureClock,
  type NatureSnapshot,
} from '../core/natureClock'
import { QUALITY_PROFILES, type QualityTier } from '../core/quality'
import { getSeasonAppearance } from '../core/season'
import {
  createEnvironmentSnapshot,
  stepEnvironment,
  type EnvironmentSnapshot,
  type SimulationSettings,
} from '../core/simulation'
import { deriveWeatherEffects } from '../core/weather'
import { Atmosphere } from './Atmosphere'
import { FixedCamera } from './FixedCamera'
import { Meadow } from './Meadow'
import { WeatherParticles } from './WeatherParticles'

interface NatureSceneProps {
  qualityTier: QualityTier
  reducedMotion: boolean
  visible: boolean
  recordFrame?: (deltaSeconds: number) => void
  onNatureSample?: (snapshot: EnvironmentSnapshot) => void
  simulationSettings: SimulationSettings
}

const DAY_START_OFFSET = DEFAULT_CLOCK.dayDuration * 0.31

export function NatureScene({
  qualityTier,
  reducedMotion,
  visible,
  recordFrame,
  onNatureSample,
  simulationSettings,
}: NatureSceneProps) {
  const quality = QUALITY_PROFILES[qualityTier]
  const initialAutoSnapshot = useMemo(
    () => sampleNatureClock(DAY_START_OFFSET, DEFAULT_CLOCK),
    [],
  )
  const initialSettingsRef = useRef(simulationSettings)
  const initialSnapshot = useMemo(
    () => createEnvironmentSnapshot(initialAutoSnapshot, initialSettingsRef.current),
    [initialAutoSnapshot],
  )
  const snapshotRef = useRef(initialSnapshot)
  const seasonRef = useRef(getSeasonAppearance(initialSnapshot))
  const effectsInputRef = useRef({
    elapsed: initialSnapshot.elapsed,
    dayPhase: initialSnapshot.dayPhase,
    seasonPosition: initialSnapshot.seasonPosition,
    weather: initialSnapshot.weather,
    reducedMotion,
  })
  const effectsRef = useRef(deriveWeatherEffects(effectsInputRef.current))
  const activeElapsedRef = useRef(0)
  const lastExternalSampleRef = useRef(-1)

  useFrame((_, delta) => {
    if (!visible) return

    const safeDelta = Math.min(delta, 0.1)
    activeElapsedRef.current += safeDelta
    const autoSnapshot = sampleNatureClock(
      activeElapsedRef.current + DAY_START_OFFSET,
      DEFAULT_CLOCK,
    )
    const snapshot = stepEnvironment(
      snapshotRef.current,
      autoSnapshot,
      simulationSettings,
      safeDelta,
    )
    snapshotRef.current = snapshot
    seasonRef.current = getSeasonAppearance(snapshot)
    const effectsInput = effectsInputRef.current
    effectsInput.elapsed = snapshot.elapsed
    effectsInput.dayPhase = snapshot.dayPhase
    effectsInput.seasonPosition = snapshot.seasonPosition
    effectsInput.weather = snapshot.weather
    effectsInput.reducedMotion = reducedMotion
    deriveWeatherEffects(effectsInput, effectsRef.current)
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
        effectsRef={effectsRef}
        reducedMotion={reducedMotion}
        visible={visible}
      />
      <Meadow
        quality={quality}
        snapshotRef={snapshotRef}
        seasonRef={seasonRef}
        effectsRef={effectsRef}
      />
      <WeatherParticles
        quality={quality}
        snapshotRef={snapshotRef}
        seasonRef={seasonRef}
        effectsRef={effectsRef}
        reducedMotion={reducedMotion}
        visible={visible}
      />
      <FixedCamera />
    </>
  )
}
