import { Color } from 'three'
import { getCelestialState } from './celestial'
import type { SeasonAppearance } from './season'
import type { EnvironmentSnapshot } from './simulation'

export interface AtmosphereState {
  skyTop: Color
  skyHorizon: Color
  fogColor: Color
  sunElevation: number
  sunAzimuth: number
  sunIntensity: number
  moonIntensity: number
  starOpacity: number
  sunVisibility: number
  moonVisibility: number
  sunHalo: number
  moonHalo: number
  cloudOpacity: number
  cloudSpeed: number
  fogDensity: number
  exposure: number
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function smoothstep(minimum: number, maximum: number, value: number) {
  const normalized = clamp((value - minimum) / (maximum - minimum), 0, 1)
  return normalized * normalized * (3 - 2 * normalized)
}

export function getAtmosphere(
  snapshot: EnvironmentSnapshot,
  season: SeasonAppearance,
): AtmosphereState {
  const solarAngle = snapshot.dayPhase * Math.PI * 2 - Math.PI / 2
  const sunElevation = Math.sin(solarAngle)
  const daylight = smoothstep(-0.12, 0.18, sunElevation)
  const twilight = 1 - Math.abs(clamp(sunElevation * 2.4, -1, 1))
  const celestial = getCelestialState(snapshot.dayPhase)
  const cloudOpacity = clamp(
    snapshot.weather.cloudCover * (0.72 + snapshot.weather.storm * 0.18),
    0,
    0.94,
  )
  const cloudTransmission = 1 - cloudOpacity * 0.88
  const fogTransmission = 1 - snapshot.weather.fog * 0.76
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

  const nightTop = new Color('#071423')
  const dayTop = new Color('#286f9f')
  const nightHorizon = new Color('#1b3041')
  const dayHorizon = new Color('#9bbeb5')
  const sunset = new Color('#e7a46e')
  const skyTop = nightTop.lerp(dayTop, daylight)
  const skyHorizon = nightHorizon
    .lerp(dayHorizon, daylight)
    .lerp(sunset, twilight * (1 - Math.abs(daylight - 0.5) * 1.5) * 0.34)
  const fogColor = skyHorizon.clone().lerp(season.groundColor, 0.14)

  return {
    skyTop,
    skyHorizon,
    fogColor,
    sunElevation,
    sunAzimuth: solarAngle,
    sunIntensity: 0.05 + daylight * (0.65 + sunVisibility * 1.4),
    moonIntensity: 0.035 + (1 - daylight) * moonVisibility * 0.32,
    starOpacity,
    sunVisibility,
    moonVisibility,
    sunHalo: celestial.sun.halo * cloudTransmission * fogTransmission,
    moonHalo: celestial.moon.halo * cloudTransmission * fogTransmission,
    cloudOpacity,
    cloudSpeed: 0.004 + snapshot.weather.windStrength * 0.014,
    fogDensity: clamp(
      0.007 +
        season.frost * 0.006 +
        snapshot.weatherIntensity * 0.012 -
        daylight * 0.002 +
        snapshot.weather.fog * 0.018,
      0.002,
      0.04,
    ),
    exposure: clamp(0.6 + daylight * 0.48, 0.55, 1.15),
  }
}
