import { Color } from 'three'
import { getCelestialState, type CelestialState } from './celestial'
import type { SeasonAppearance } from './season'
import type { EnvironmentSnapshot } from './simulation'

const WEATHER_SKY = new Color('#53616a')
const WEATHER_HORIZON = new Color('#7f8582')
const NIGHT_TOP = new Color('#0a1a2c')
const DAY_TOP = new Color('#286f9f')
const NIGHT_HORIZON = new Color('#22394c')
const DAY_HORIZON = new Color('#9bbeb5')
const SUNSET = new Color('#e7a46e')
const LOW_SUN = new Color('#ff983f')
const GOLDEN_HORIZON = new Color('#f39855')
const GOLDEN_SKY_LIGHT = new Color('#edb185')
const DAY_SUN = new Color('#fff2cf')
const MOON_LIGHT = new Color('#8ba8cf')
const NIGHT_SKY_LIGHT = new Color('#8298ae')
const DAY_SKY_LIGHT = new Color('#b8d3df')

export interface AtmosphereState {
  celestial: CelestialState
  skyTop: Color
  skyHorizon: Color
  fogColor: Color
  sunColor: Color
  moonColor: Color
  skyLightColor: Color
  groundLightColor: Color
  sunElevation: number
  goldenHour: number
  sunAzimuth: number
  sunIntensity: number
  moonIntensity: number
  skyLightIntensity: number
  starOpacity: number
  sunVisibility: number
  moonVisibility: number
  sunHalo: number
  moonHalo: number
  cloudOpacity: number
  cloudSpeed: number
  cloudPhase: number
  snowCover: number
  fogDensity: number
  exposure: number
}

function mix(from: number, to: number, amount: number) {
  return from + (to - from) * amount
}

function blendDirection(
  source: readonly [number, number, number],
  target: readonly [number, number, number],
  amount: number,
  output: [number, number, number],
) {
  output[0] = mix(source[0], target[0], amount)
  output[1] = mix(source[1], target[1], amount)
  output[2] = mix(source[2], target[2], amount)
  let length = Math.hypot(output[0], output[1], output[2])
  if (length < 1e-6) {
    output[0] = source[0]
    output[1] = source[1]
    output[2] = source[2]
    length = Math.hypot(output[0], output[1], output[2]) || 1
  }
  output[0] /= length
  output[1] /= length
  output[2] /= length
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function smoothstep(minimum: number, maximum: number, value: number) {
  const normalized = clamp((value - minimum) / (maximum - minimum), 0, 1)
  return normalized * normalized * (3 - 2 * normalized)
}

export function advanceCloudPhase(
  phase: number,
  deltaSeconds: number,
  speed: number,
) {
  const safePhase = Number.isFinite(phase) ? phase : 0
  const safeDelta = Number.isFinite(deltaSeconds)
    ? clamp(deltaSeconds, 0, 0.1)
    : 0
  const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0
  return safePhase + safeDelta * safeSpeed
}

export function getAtmosphere(
  snapshot: EnvironmentSnapshot,
  season: SeasonAppearance,
  target?: AtmosphereState,
): AtmosphereState {
  const state = target ?? {
    celestial: getCelestialState(snapshot.dayPhase),
    skyTop: new Color(),
    skyHorizon: new Color(),
    fogColor: new Color(),
    sunColor: new Color(),
    moonColor: new Color(),
    skyLightColor: new Color(),
    groundLightColor: new Color(),
    sunElevation: 0,
    goldenHour: 0,
    sunAzimuth: 0,
    sunIntensity: 0,
    moonIntensity: 0,
    skyLightIntensity: 0,
    starOpacity: 0,
    sunVisibility: 0,
    moonVisibility: 0,
    sunHalo: 0,
    moonHalo: 0,
    cloudOpacity: 0,
    cloudSpeed: 0,
    cloudPhase: 0,
    snowCover: season.snowCoverage,
    fogDensity: 0,
    exposure: 0,
  }
  const solarAngle = snapshot.dayPhase * Math.PI * 2 - Math.PI / 2
  const sunElevation = Math.sin(solarAngle)
  const daylight = smoothstep(-0.12, 0.18, sunElevation)
  const twilight = 1 - Math.abs(clamp(sunElevation * 2.4, -1, 1))
  const celestial = getCelestialState(snapshot.dayPhase, state.celestial)
  const cloudOpacity = clamp(
    snapshot.weather.cloudCover * (0.72 + snapshot.weather.storm * 0.18),
    0,
    0.94,
  )
  const cloudTransmission = 1 - cloudOpacity * 0.88
  const fogTransmission = 1 - snapshot.weather.fog * 0.76
  // Low, above-horizon sunlight warms the whole scene; dense weather blocks it.
  const goldenHour = smoothstep(-0.04, 0.1, sunElevation) *
    (1 - smoothstep(0.25, 0.62, sunElevation)) *
    (1 - snapshot.weather.cloudCover * 0.85) * fogTransmission *
    (1 - snapshot.weather.storm * 0.65)
  const starOpacity =
    (1 - smoothstep(-0.28, 0.04, sunElevation)) *
    cloudTransmission *
    fogTransmission *
    (1 - celestial.moon.visibility * 0.1)
  const sunVisibility =
    celestial.sun.visibility *
    (1 - cloudOpacity * 0.62) *
    (1 - snapshot.weather.fog * 0.52)
  const moonVisibility =
    celestial.moon.visibility *
    (1 - cloudOpacity * 0.68) *
    (1 - snapshot.weather.fog * 0.6)

  state.skyTop.copy(NIGHT_TOP).lerp(DAY_TOP, daylight)
  state.skyHorizon
    .copy(NIGHT_HORIZON)
    .lerp(DAY_HORIZON, daylight)
    .lerp(SUNSET, twilight * (1 - Math.abs(daylight - 0.5) * 1.5) * 0.34)
    .lerp(GOLDEN_HORIZON, goldenHour * 0.88)
  const skyDesaturation = clamp(
    snapshot.weather.cloudCover * 0.18 +
      snapshot.weather.fog * 0.22 +
      snapshot.weather.storm * 0.24,
    0,
    0.52,
  )
  state.skyTop.lerp(WEATHER_SKY, skyDesaturation)
  state.skyHorizon.lerp(WEATHER_HORIZON, skyDesaturation * 0.72)
  state.fogColor.copy(state.skyHorizon).lerp(season.groundColor, 0.14)
  state.sunColor.copy(DAY_SUN).lerp(LOW_SUN, goldenHour)
  state.moonColor.copy(MOON_LIGHT)
  state.skyLightColor
    .copy(NIGHT_SKY_LIGHT)
    .lerp(DAY_SKY_LIGHT, daylight)
    .lerp(GOLDEN_SKY_LIGHT, goldenHour * 0.42)
    .lerp(WEATHER_SKY, skyDesaturation * 0.35)
  state.groundLightColor.copy(season.groundColor)
  state.sunElevation = sunElevation
  state.goldenHour = goldenHour
  state.sunAzimuth = solarAngle
  state.sunIntensity = 0.05 + daylight * (0.65 + sunVisibility * 1.4)
  state.moonIntensity = 0.05 + (1 - daylight) * moonVisibility * 0.46
  state.skyLightIntensity = clamp(
    0.38 + daylight * 0.32 - snapshot.weather.cloudCover * 0.08 -
      snapshot.weather.fog * 0.05 - goldenHour * 0.12,
    0.34,
    0.7,
  )
  state.starOpacity = starOpacity
  state.sunVisibility = sunVisibility
  state.moonVisibility = moonVisibility
  state.sunHalo = celestial.sun.halo * cloudTransmission * fogTransmission
  state.moonHalo = celestial.moon.halo * cloudTransmission * fogTransmission
  state.cloudOpacity = cloudOpacity
  state.cloudSpeed = 0.004 + snapshot.weather.windStrength * 0.014
  state.fogDensity = clamp(
    0.007 +
      season.frost * 0.006 +
      snapshot.weatherIntensity * 0.012 -
      daylight * 0.002 +
      snapshot.weather.fog * 0.018,
    0.002,
    0.04,
  )
  state.exposure = clamp(
    0.64 + daylight * 0.46 - snapshot.weather.cloudCover * 0.1 -
      snapshot.weather.fog * 0.04 - snapshot.weather.storm * 0.08,
    0.62,
    1.15,
  )
  return state
}

export function blendAtmosphere(
  source: AtmosphereState,
  target: AtmosphereState,
  amount: number,
  output: AtmosphereState,
): AtmosphereState {
  const blend = clamp(amount, 0, 1)
  output.skyTop.copy(source.skyTop).lerp(target.skyTop, blend)
  output.skyHorizon.copy(source.skyHorizon).lerp(target.skyHorizon, blend)
  output.fogColor.copy(source.fogColor).lerp(target.fogColor, blend)
  output.sunColor.copy(source.sunColor).lerp(target.sunColor, blend)
  output.moonColor.copy(source.moonColor).lerp(target.moonColor, blend)
  output.skyLightColor
    .copy(source.skyLightColor)
    .lerp(target.skyLightColor, blend)
  output.groundLightColor
    .copy(source.groundLightColor)
    .lerp(target.groundLightColor, blend)

  blendDirection(
    source.celestial.sun.direction,
    target.celestial.sun.direction,
    blend,
    output.celestial.sun.direction,
  )
  blendDirection(
    source.celestial.moon.direction,
    target.celestial.moon.direction,
    blend,
    output.celestial.moon.direction,
  )
  output.celestial.sun.visibility = mix(
    source.celestial.sun.visibility,
    target.celestial.sun.visibility,
    blend,
  )
  output.celestial.sun.halo = mix(
    source.celestial.sun.halo,
    target.celestial.sun.halo,
    blend,
  )
  output.celestial.moon.visibility = mix(
    source.celestial.moon.visibility,
    target.celestial.moon.visibility,
    blend,
  )
  output.celestial.moon.halo = mix(
    source.celestial.moon.halo,
    target.celestial.moon.halo,
    blend,
  )

  output.sunElevation = mix(source.sunElevation, target.sunElevation, blend)
  output.goldenHour = mix(source.goldenHour, target.goldenHour, blend)
  output.sunAzimuth = mix(source.sunAzimuth, target.sunAzimuth, blend)
  output.sunIntensity = mix(source.sunIntensity, target.sunIntensity, blend)
  output.moonIntensity = mix(source.moonIntensity, target.moonIntensity, blend)
  output.skyLightIntensity = mix(
    source.skyLightIntensity,
    target.skyLightIntensity,
    blend,
  )
  output.starOpacity = mix(source.starOpacity, target.starOpacity, blend)
  output.sunVisibility = mix(source.sunVisibility, target.sunVisibility, blend)
  output.moonVisibility = mix(source.moonVisibility, target.moonVisibility, blend)
  output.sunHalo = mix(source.sunHalo, target.sunHalo, blend)
  output.moonHalo = mix(source.moonHalo, target.moonHalo, blend)
  output.cloudOpacity = mix(source.cloudOpacity, target.cloudOpacity, blend)
  output.cloudSpeed = mix(source.cloudSpeed, target.cloudSpeed, blend)
  output.cloudPhase = mix(source.cloudPhase, target.cloudPhase, blend)
  output.snowCover = mix(source.snowCover, target.snowCover, blend)
  output.fogDensity = mix(source.fogDensity, target.fogDensity, blend)
  output.exposure = mix(source.exposure, target.exposure, blend)
  return output
}
