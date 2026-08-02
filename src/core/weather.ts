import type { NatureSnapshot } from './natureClock'
import type { SeasonAppearance } from './season'

export interface WeatherOpacity {
  pollen: number
  rain: number
  snow: number
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function smoothstep(minimum: number, maximum: number, value: number) {
  const amount = clamp01((value - minimum) / (maximum - minimum))
  return amount * amount * (3 - 2 * amount)
}

export function getWeatherOpacity(
  snapshot: NatureSnapshot,
  season: SeasonAppearance,
): WeatherOpacity {
  const solarAngle = snapshot.dayPhase * Math.PI * 2 - Math.PI / 2
  const daylight = smoothstep(-0.05, 0.18, Math.sin(solarAngle))
  const weather = clamp01(snapshot.weatherIntensity)
  const precipitation = smoothstep(0.76, 0.95, weather)

  return {
    pollen: clamp01(
      season.pollen * (1 - precipitation * 0.9) * daylight * 0.045,
    ),
    rain: clamp01(season.rainBias * precipitation * 0.82),
    snow: clamp01(season.snowBias * precipitation),
  }
}
