import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { blendAtmosphere, getAtmosphere } from '../core/atmosphere'
import {
  DEFAULT_CLOCK,
  sampleNatureClock,
  type NatureSnapshot,
} from '../core/natureClock'
import { QUALITY_PROFILES, type QualityTier } from '../core/quality'
import { blendSeasonAppearance, getSeasonAppearance } from '../core/season'
import {
  createEnvironmentTransition,
  stepEnvironmentTransition,
  type EnvironmentSnapshot,
  type EnvironmentTransitionFrame,
  type SimulationSettings,
} from '../core/simulation'
import { blendWeatherEffects, deriveWeatherEffects } from '../core/weather'
import { Atmosphere } from './Atmosphere'
import { FixedCamera } from './FixedCamera'
import { Meadow } from './Meadow'
import { WeatherParticles } from './WeatherParticles'

interface NatureSceneProps {
  qualityTier: QualityTier
  reducedMotion: boolean
  visible: boolean
  recordFrame?: (deltaSeconds: number) => void
  onNatureSample?: (frame: EnvironmentTransitionFrame) => void
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
  const initialTransition = useMemo(
    () =>
      createEnvironmentTransition(
        initialAutoSnapshot,
        initialSettingsRef.current,
      ),
    [initialAutoSnapshot],
  )
  const transitionRef = useRef(initialTransition)
  const snapshotRef = useRef<EnvironmentSnapshot>(initialTransition.snapshot)
  const initialSeasons = useMemo(
    () => ({
      source: getSeasonAppearance(initialTransition.source),
      target: getSeasonAppearance(initialTransition.target),
      resolved: getSeasonAppearance(initialTransition.snapshot),
    }),
    [initialTransition],
  )
  const sourceSeasonRef = useRef(initialSeasons.source)
  const targetSeasonRef = useRef(initialSeasons.target)
  const seasonRef = useRef(initialSeasons.resolved)
  const initialAtmospheres = useMemo(
    () => ({
      source: getAtmosphere(initialTransition.source, initialSeasons.source),
      target: getAtmosphere(initialTransition.target, initialSeasons.target),
      resolved: getAtmosphere(
        initialTransition.snapshot,
        initialSeasons.resolved,
      ),
    }),
    [initialSeasons, initialTransition],
  )
  const sourceAtmosphereRef = useRef(initialAtmospheres.source)
  const targetAtmosphereRef = useRef(initialAtmospheres.target)
  const atmosphereRef = useRef(initialAtmospheres.resolved)
  const initialEffects = useMemo(() => {
    const createInput = (snapshot: EnvironmentSnapshot) => ({
      elapsed: snapshot.elapsed,
      dayPhase: snapshot.dayPhase,
      seasonPosition: snapshot.seasonPosition,
      weather: snapshot.weather,
      reducedMotion,
    })
    const sourceInput = createInput(initialTransition.source)
    const targetInput = createInput(initialTransition.target)
    const resolvedInput = createInput(initialTransition.snapshot)
    return {
      sourceInput,
      targetInput,
      source: deriveWeatherEffects(sourceInput),
      target: deriveWeatherEffects(targetInput),
      resolved: deriveWeatherEffects(resolvedInput),
    }
  }, [initialTransition, reducedMotion])
  const sourceEffectsInputRef = useRef(initialEffects.sourceInput)
  const targetEffectsInputRef = useRef(initialEffects.targetInput)
  const sourceEffectsRef = useRef(initialEffects.source)
  const targetEffectsRef = useRef(initialEffects.target)
  const effectsRef = useRef(initialEffects.resolved)
  const lastResolvedRevisionRef = useRef(initialTransition.revision)
  const activeElapsedRef = useRef(0)
  const lastExternalSampleRef = useRef(-1)

  useFrame((_, delta) => {
    if (!visible) return

    const safeDelta = Math.min(Math.max(delta, 0), 0.5)
    activeElapsedRef.current += safeDelta
    const autoSnapshot = sampleNatureClock(
      activeElapsedRef.current + DAY_START_OFFSET,
      DEFAULT_CLOCK,
    )
    const frame = stepEnvironmentTransition(
      transitionRef.current,
      autoSnapshot,
      simulationSettings,
      safeDelta,
    )
    transitionRef.current = frame
    const revisionChanged =
      frame.revision !== lastResolvedRevisionRef.current

    if (revisionChanged) {
      blendSeasonAppearance(
        seasonRef.current,
        seasonRef.current,
        0,
        sourceSeasonRef.current,
      )
      blendAtmosphere(
        atmosphereRef.current,
        atmosphereRef.current,
        0,
        sourceAtmosphereRef.current,
      )
      blendWeatherEffects(
        effectsRef.current,
        effectsRef.current,
        0,
        sourceEffectsRef.current,
      )
      lastResolvedRevisionRef.current = frame.revision
    } else if (!frame.active) {
      getSeasonAppearance(frame.source, sourceSeasonRef.current)
      getAtmosphere(
        frame.source,
        sourceSeasonRef.current,
        sourceAtmosphereRef.current,
      )
      const sourceInput = sourceEffectsInputRef.current
      sourceInput.elapsed = frame.source.elapsed
      sourceInput.dayPhase = frame.source.dayPhase
      sourceInput.seasonPosition = frame.source.seasonPosition
      sourceInput.weather = frame.source.weather
      sourceInput.reducedMotion = reducedMotion
      deriveWeatherEffects(sourceInput, sourceEffectsRef.current)
    }

    getSeasonAppearance(frame.target, targetSeasonRef.current)
    blendSeasonAppearance(
      sourceSeasonRef.current,
      targetSeasonRef.current,
      frame.progress,
      seasonRef.current,
    )
    getAtmosphere(
      frame.target,
      targetSeasonRef.current,
      targetAtmosphereRef.current,
    )
    blendAtmosphere(
      sourceAtmosphereRef.current,
      targetAtmosphereRef.current,
      frame.progress,
      atmosphereRef.current,
    )

    const targetInput = targetEffectsInputRef.current
    targetInput.elapsed = frame.target.elapsed
    targetInput.dayPhase = frame.target.dayPhase
    targetInput.seasonPosition = frame.target.seasonPosition
    targetInput.weather = frame.target.weather
    targetInput.reducedMotion = reducedMotion
    deriveWeatherEffects(targetInput, targetEffectsRef.current)
    blendWeatherEffects(
      sourceEffectsRef.current,
      targetEffectsRef.current,
      frame.progress,
      effectsRef.current,
    )

    snapshotRef.current = frame.snapshot
    recordFrame?.(delta)

    if (
      onNatureSample &&
      frame.snapshot.elapsed - lastExternalSampleRef.current >= 0.25
    ) {
      lastExternalSampleRef.current = frame.snapshot.elapsed
      onNatureSample(frame)
    }
  })

  return (
    <>
      <Atmosphere
        quality={quality}
        snapshotRef={snapshotRef}
        atmosphereRef={atmosphereRef}
        effectsRef={effectsRef}
        reducedMotion={reducedMotion}
        visible={visible}
      />
      <Meadow
        quality={quality}
        snapshotRef={snapshotRef}
        seasonRef={seasonRef}
        atmosphereRef={atmosphereRef}
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
