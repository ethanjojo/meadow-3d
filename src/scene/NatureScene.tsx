import { isWithinHours } from '../core/timeWindow'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { advanceCloudPhase, blendAtmosphere, getAtmosphere } from '../core/atmosphere'
import { advanceSnowCover, sampleGust } from '../core/sceneEffects'
import { applySceneEffects, getFlowerCount, type SceneSettings } from '../core/sceneSettings'
import { getCelestialPresentation } from '../core/celestial'
import {
  DEFAULT_CLOCK, advanceNatureClock, createNatureClockState,
  sampleNatureClock,
  type NatureSnapshot,
} from '../core/natureClock'
import { QUALITY_PROFILES, type QualityProfile, type QualityTier } from '../core/quality'
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
import { Farm } from './Farm'
import { Meadow } from './Meadow'
import { PostProcessing } from './PostProcessing'
import { WeatherParticles } from './WeatherParticles'
import { GroundMist } from './GroundMist'
import { CloudNoiseProvider } from './cloudNoise'


interface NatureSceneProps {
  auroraPreviewUntil?: number
  sceneSettings: SceneSettings
  qualityTier: QualityTier
  qualityProfile?: QualityProfile
  stormDistanceKm?: number
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
  __livingMeadowEffects?: { stormFlash: number; snowCover: number; cloudPhase: number; fireflies: number; windStrength: number }
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
  auroraPreviewUntil,
  sceneSettings,
  qualityTier, qualityProfile, stormDistanceKm,
  reducedMotion,
  visible,
  recordFrame,
  onNatureSample,
  simulationSettings,
}: NatureSceneProps) {
  const quality = qualityProfile ?? QUALITY_PROFILES[qualityTier]
  const vegetationReduced = reducedMotion || sceneSettings.gentleMotion || sceneSettings.gentleVegetation
  const particlesReduced = reducedMotion || sceneSettings.gentleMotion || sceneSettings.gentleParticles
  const size = useThree((state) => state.size)
  const aspect = size.width / Math.max(1, size.height)
  const developmentCelestialOverride = useMemo(
    getDevelopmentCelestialOverride,
    [],
  )
  const developmentEffectsTime = useMemo(() => {
    if (!import.meta.env.DEV) return null
    const raw = new URLSearchParams(window.location.search).get('__e2eEffects')
    return raw !== null && Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : null
  }, [])
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
  const snapshotRef = useRef<EnvironmentSnapshot>({...initialTransition.snapshot, weather: {...initialTransition.snapshot.weather}})
  const visualEnvironmentRef = useRef({ cloudCover: sceneSettings.cloudCover, windStrength: sceneSettings.windStrength, windGusts: sceneSettings.windGusts, fogDensity: sceneSettings.fogDensity, goldenWarmth: sceneSettings.goldenWarmth })
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
  const visualAtmosphereRef = useRef(getAtmosphere(initialTransition.snapshot, initialSeasons.resolved))
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
  const visualEffectsRef = useRef({ ...initialEffects.resolved })
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
  const clockStateRef = useRef(createNatureClockState())
  const activeElapsedRef = useRef(0)
  const lastExternalSampleRef = useRef(-1)
  const cloudPhaseRef = useRef(0)
  const snowCoverRef = useRef(initialSeasons.resolved.snowCoverage)
  const snowTransitionSourceRef = useRef(snowCoverRef.current)
  const snowTransitionActiveRef = useRef(initialTransition.active)
  const developmentEffectsSampleRef = useRef({ stormFlash: 0, snowCover: 0, cloudPhase: 0, fireflies: 0, windStrength: 0 })

  useFrame((_, delta) => {
    if (!visible) return

    const safeDelta = Math.min(Math.max(delta, 0), 0.5)
    const visualSettings = visualEnvironmentRef.current
    const preferenceBlend = 1 - Math.exp(-safeDelta * 3 / sceneSettings.transitionDuration)
    for (const key of Object.keys(visualSettings) as Array<keyof typeof visualSettings>) visualSettings[key] += (sceneSettings[key] - visualSettings[key]) * preferenceBlend
    activeElapsedRef.current += safeDelta
    const autoSnapshot = developmentEffectsTime !== null ? sampleNatureClock(developmentEffectsTime, DEFAULT_CLOCK) : advanceNatureClock(clockStateRef.current, safeDelta, sceneSettings)
    const frame = stepEnvironmentTransition(
      transitionRef.current,
      autoSnapshot,
      simulationSettings,
      safeDelta,
      { duration: sceneSettings.transitionDuration, allowedWeather: sceneSettings.allowedWeather, realTime: sceneSettings.realTime },
    )
    transitionRef.current = frame
    const revisionChanged =
      frame.revision !== lastResolvedRevisionRef.current

    if (revisionChanged) {
      snowTransitionSourceRef.current = snowCoverRef.current
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
        visualSettings.goldenWarmth,
      )
      const sourceInput = sourceEffectsInputRef.current
      sourceInput.elapsed = frame.source.elapsed
      sourceInput.dayPhase = frame.source.dayPhase
      sourceInput.seasonPosition = frame.source.seasonPosition
      sourceInput.weather = frame.source.weather
      sourceInput.reducedMotion = reducedMotion
      Object.assign(sourceInput, {stormInterval: sceneSettings.lightningInterval, stormDistanceKm})
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
      visualSettings.goldenWarmth,
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
    Object.assign(targetInput, {stormInterval: sceneSettings.lightningInterval, stormDistanceKm})
    deriveWeatherEffects(targetInput, targetEffectsRef.current)
    blendWeatherEffects(
      sourceEffectsRef.current,
      targetEffectsRef.current,
      frame.progress,
      effectsRef.current,
    )

    const visualSnapshot = snapshotRef.current
    const visualWeather = visualSnapshot.weather
    Object.assign(visualSnapshot, frame.snapshot)
    Object.assign(visualWeather, frame.snapshot.weather)
    visualSnapshot.weather = visualWeather
    const gust = 1 + (sampleGust(frame.snapshot.elapsed) - 1) * visualSettings.windGusts
    visualWeather.windStrength = Math.min(1, frame.snapshot.weather.windStrength * gust * visualSettings.windStrength)
    cloudPhaseRef.current = advanceCloudPhase(cloudPhaseRef.current, sceneSettings.timePaused ? 0 : safeDelta, atmosphereRef.current.cloudSpeed * sceneSettings.cloudSpeed * gust * (reducedMotion ? .35 : 1))
    atmosphereRef.current.cloudPhase = cloudPhaseRef.current
    visualWeather.cloudCover = Math.min(1, frame.snapshot.weather.cloudCover * visualSettings.cloudCover)
    blendAtmosphere(atmosphereRef.current, atmosphereRef.current, 0, visualAtmosphereRef.current)
    const atmosphere = visualAtmosphereRef.current
    atmosphere.fogDensity *= visualSettings.fogDensity
    atmosphere.sunHalo *= sceneSettings.sunGlow
    atmosphere.moonHalo *= sceneSettings.moonGlow
    atmosphere.moonIntensity *= sceneSettings.moonBrightness
    if (!sceneSettings.naturalEffects) atmosphere.starOpacity = 1
    const snowTransition = frame.active || snowTransitionActiveRef.current
    const targetSnow = snowTransition
      ? Math.max(targetSeasonRef.current.snowCoverage, targetEffectsRef.current.snow * .85)
      : Math.max(seasonRef.current.snowCoverage, effectsRef.current.snow * .85)
    snowCoverRef.current = advanceSnowCover(snowCoverRef.current, targetSnow * sceneSettings.snowCover, safeDelta, snowTransition ? { from: snowTransitionSourceRef.current, progress: frame.progress } : undefined, {accumulation: sceneSettings.snowAccumulation, melt: sceneSettings.snowMelt})
    snowTransitionActiveRef.current = frame.active
    visualAtmosphereRef.current.snowCover = snowCoverRef.current
    applySceneEffects(effectsRef.current, sceneSettings, visualEffectsRef.current)
    const visual = visualEffectsRef.current
    if (!sceneSettings.naturalEffects) { visual.snow = frame.snapshot.weather.snow * sceneSettings.precipitationDensity * sceneSettings.snowDensity; visual.fireflies = reducedMotion ? .25 : .7 }
    if (sceneSettings.fireflySchedule === 'always') visual.fireflies = reducedMotion ? .25 : .7
    if (sceneSettings.fireflySchedule === 'custom') visual.fireflies = isWithinHours(frame.snapshot.dayPhase, sceneSettings.fireflyStart, sceneSettings.fireflyEnd) ? (reducedMotion ? .25 : .7) : 0
    visual.fireflies *= sceneSettings.fireflyBrightness
    if (import.meta.env.DEV) {
      const sample = developmentEffectsSampleRef.current
      sample.stormFlash = effectsRef.current.stormFlash
      sample.snowCover = snowCoverRef.current
      sample.cloudPhase = cloudPhaseRef.current
      sample.fireflies = effectsRef.current.fireflies
      sample.windStrength = frame.snapshot.weather.windStrength
      ;(window as DevelopmentWindow).__livingMeadowEffects = sample
    }
    recordFrame?.(delta)

    if (
      onNatureSample &&
      activeElapsedRef.current - lastExternalSampleRef.current >= 0.25
    ) {
      lastExternalSampleRef.current = activeElapsedRef.current
      onNatureSample(frame)
    }
  })

  return (
    <CloudNoiseProvider>
      <Atmosphere
        auroraPreviewUntil={auroraPreviewUntil}
        sceneSettings={sceneSettings}
        stormDistanceKm={stormDistanceKm}
        quality={quality}
        snapshotRef={snapshotRef}
        atmosphereRef={visualAtmosphereRef}
        celestialPresentationRef={celestialPresentationRef}
        effectsRef={visualEffectsRef}
        reducedMotion={reducedMotion}
        visible={visible}
      />
      <Meadow
        sceneSettings={sceneSettings}
        flowerCount={getFlowerCount(quality.flowerCount, sceneSettings)}
        quality={quality}
        snapshotRef={snapshotRef}
        seasonRef={seasonRef}
        atmosphereRef={visualAtmosphereRef}
        effectsRef={visualEffectsRef}
        reducedMotion={vegetationReduced}
      />
      <WeatherParticles
        sceneSettings={sceneSettings}
        fireflyDensity={sceneSettings.fireflyDensity}
        quality={quality}
        snapshotRef={snapshotRef}
        seasonRef={seasonRef}
        atmosphereRef={visualAtmosphereRef}
        effectsRef={visualEffectsRef}
        reducedMotion={particlesReduced}
        visible={visible}
      />
      <GroundMist sceneSettings={sceneSettings} quality={quality} atmosphereRef={visualAtmosphereRef} snapshotRef={snapshotRef} visible={visible} reducedMotion={reducedMotion} />
      {sceneSettings.farmVisible ? <Farm sceneSettings={sceneSettings} lightsEnabled={sceneSettings.farmLights} atmosphereRef={visualAtmosphereRef} snapshotRef={snapshotRef} effectsRef={visualEffectsRef} /> : null}
      <FixedCamera />
      {quality.postprocessing ? <PostProcessing quality={quality} /> : null}
    </CloudNoiseProvider>
  )
}
