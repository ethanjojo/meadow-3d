import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { blendAtmosphere, getAtmosphere } from '../core/atmosphere'
import { getCelestialPresentation } from '../core/celestial'
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

interface DevelopmentCelestialOverride {
  sourceDayPhase: number
  targetDayPhase: number
  progress: number
}

interface DevelopmentCelestialSample {
  sun: { x: number; y: number; opacity: number }
  moon: { x: number; y: number; opacity: number }
}

type DevelopmentWindow = Window & {
  __livingMeadowCelestial?: DevelopmentCelestialSample
}

function getDevelopmentCelestialOverride(): DevelopmentCelestialOverride | null {
  if (!import.meta.env.DEV) return null
  const raw = new URLSearchParams(window.location.search).get(
    '__e2eCelestial',
  )
  if (!raw) return null
  const values = raw.split(',').map(Number)
  if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) {
    return null
  }
  return {
    sourceDayPhase: values[0],
    targetDayPhase: values[1],
    progress: Math.min(1, Math.max(0, values[2])),
  }
}

export function NatureScene({
  qualityTier,
  reducedMotion,
  visible,
  recordFrame,
  onNatureSample,
  simulationSettings,
}: NatureSceneProps) {
  const quality = QUALITY_PROFILES[qualityTier]
  const size = useThree((state) => state.size)
  const aspect = size.width / Math.max(1, size.height)
  const developmentCelestialOverride = useMemo(
    getDevelopmentCelestialOverride,
    [],
  )
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
  const initialCelestial = useMemo(
    () => ({
      frozen: getCelestialPresentation(
        initialTransition.source.dayPhase,
        initialTransition.target.dayPhase,
        initialTransition.progress,
        aspect,
        reducedMotion,
      ),
      resolved: getCelestialPresentation(
        initialTransition.source.dayPhase,
        initialTransition.target.dayPhase,
        initialTransition.progress,
        aspect,
        reducedMotion,
      ),
    }),
    [aspect, initialTransition, reducedMotion],
  )
  const frozenCelestialSourceRef = useRef(initialCelestial.frozen)
  const celestialPresentationRef = useRef(initialCelestial.resolved)
  const developmentCelestialSampleRef = useRef<DevelopmentCelestialSample>({
    sun: { x: 0, y: 0, opacity: 0 },
    moon: { x: 0, y: 0, opacity: 0 },
  })
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
      getCelestialPresentation(
        frame.source.dayPhase,
        frame.target.dayPhase,
        0,
        aspect,
        reducedMotion,
        frozenCelestialSourceRef.current,
        celestialPresentationRef.current,
      )
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

    getCelestialPresentation(
      developmentCelestialOverride?.sourceDayPhase ?? frame.source.dayPhase,
      developmentCelestialOverride?.targetDayPhase ?? frame.target.dayPhase,
      developmentCelestialOverride?.progress ?? frame.progress,
      aspect,
      reducedMotion,
      celestialPresentationRef.current,
      frozenCelestialSourceRef.current,
    )
    if (import.meta.env.DEV && developmentCelestialOverride) {
      const presentation = celestialPresentationRef.current
      const sample = developmentCelestialSampleRef.current
      sample.sun.x = presentation.sun.x
      sample.sun.y = presentation.sun.y
      sample.sun.opacity = presentation.sun.opacity
      sample.moon.x = presentation.moon.x
      sample.moon.y = presentation.moon.y
      sample.moon.opacity = presentation.moon.opacity
      ;(window as DevelopmentWindow).__livingMeadowCelestial = sample
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
        celestialPresentationRef={celestialPresentationRef}
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
        reducedMotion={reducedMotion}
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
