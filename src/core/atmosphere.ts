import { Color } from 'three'
import type { NatureSnapshot } from './natureClock'
import type { SeasonAppearance } from './season'

export interface AtmosphereState {
  skyTop: Color
  skyHorizon: Color
  fogColor: Color
  sunElevation: number
  sunAzimuth: number
  sunIntensity: number
  moonIntensity: number
  starOpacity: number
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
  snapshot: NatureSnapshot,
  season: SeasonAppearance,
): AtmosphereState {
  const solarAngle = snapshot.dayPhase * Math.PI * 2 - Math.PI / 2
  const sunElevation = Math.sin(solarAngle)
  const daylight = smoothstep(-0.12, 0.18, sunElevation)
  const twilight = 1 - Math.abs(clamp(sunElevation * 2.4, -1, 1))
  const starOpacity = 1 - smoothstep(-0.28, 0.04, sunElevation)

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
    sunIntensity: 0.05 + daylight * 2.05,
    moonIntensity: 0.035 + (1 - daylight) * 0.32,
    starOpacity,
    fogDensity: clamp(
      0.007 +
        season.frost * 0.006 +
        snapshot.weatherIntensity * 0.012 -
        daylight * 0.002,
      0.002,
      0.04,
    ),
    exposure: clamp(0.6 + daylight * 0.48, 0.55, 1.15),
  }
}
