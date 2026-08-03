import type { NatureSnapshot } from './natureClock'
import type { SeasonAppearance } from './season'
import type { WeatherPreset, WeatherState } from './simulation'

export interface WeatherOpacity {
  pollen: number
  rain: number
  snow: number
}

type WeatherProfile = Readonly<
  Omit<WeatherState, 'windDirection'>
> & {
  readonly windDirection: readonly [number, number]
}

export const WEATHER_PROFILES: Readonly<Record<WeatherPreset, WeatherProfile>> = {
  clear: {
    preset: 'clear',
    cloudCover: 0.08,
    fog: 0.08,
    rain: 0,
    snow: 0,
    storm: 0,
    wetness: 0,
    fireflies: 1,
    dew: 0.7,
    windStrength: 0.28,
    windDirection: [0.86, 0.5],
  },
  cloudy: {
    preset: 'cloudy',
    cloudCover: 0.6,
    fog: 0.25,
    rain: 0,
    snow: 0,
    storm: 0,
    wetness: 0.08,
    fireflies: 0.15,
    dew: 0.2,
    windStrength: 0.42,
    windDirection: [0.86, 0.5],
  },
  fog: {
    preset: 'fog',
    cloudCover: 0.35,
    fog: 1,
    rain: 0,
    snow: 0,
    storm: 0,
    wetness: 0.2,
    fireflies: 0,
    dew: 0.35,
    windStrength: 0.1,
    windDirection: [0.86, 0.5],
  },
  rain: {
    preset: 'rain',
    cloudCover: 0.85,
    fog: 0.35,
    rain: 0.75,
    snow: 0,
    storm: 0.08,
    wetness: 1,
    fireflies: 0,
    dew: 0,
    windStrength: 0.58,
    windDirection: [0.86, 0.5],
  },
  storm: {
    preset: 'storm',
    cloudCover: 1,
    fog: 0.55,
    rain: 1,
    snow: 0,
    storm: 1,
    wetness: 1,
    fireflies: 0,
    dew: 0,
    windStrength: 0.95,
    windDirection: [0.86, 0.5],
  },
  snow: {
    preset: 'snow',
    cloudCover: 0.8,
    fog: 0.35,
    rain: 0,
    snow: 1,
    storm: 0,
    wetness: 0.35,
    fireflies: 0,
    dew: 0,
    windStrength: 0.38,
    windDirection: [0.86, 0.5],
  },
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function mix(from: number, to: number, amount: number) {
  return from + (to - from) * amount
}

function smoothstep(minimum: number, maximum: number, value: number) {
  const amount = clamp01((value - minimum) / (maximum - minimum))
  return amount * amount * (3 - 2 * amount)
}

export function getWeatherProfile(preset: WeatherPreset): WeatherState {
  const profile = WEATHER_PROFILES[preset]
  return {
    ...profile,
    windDirection: [...profile.windDirection] as [number, number],
  }
}

export function blendWeather(
  from: WeatherState,
  to: WeatherState,
  amount: number,
): WeatherState {
  const blend = clamp01(amount)
  return {
    preset: blend === 0 ? from.preset : to.preset,
    cloudCover: mix(from.cloudCover, to.cloudCover, blend),
    fog: mix(from.fog, to.fog, blend),
    rain: mix(from.rain, to.rain, blend),
    snow: mix(from.snow, to.snow, blend),
    storm: mix(from.storm, to.storm, blend),
    wetness: mix(from.wetness, to.wetness, blend),
    fireflies: mix(from.fireflies, to.fireflies, blend),
    dew: mix(from.dew, to.dew, blend),
    windStrength: mix(from.windStrength, to.windStrength, blend),
    windDirection: [
      mix(from.windDirection[0], to.windDirection[0], blend),
      mix(from.windDirection[1], to.windDirection[1], blend),
    ],
  }
}

export function getAutomaticWeather(
  snapshot: NatureSnapshot,
  season: SeasonAppearance,
): WeatherState {
  const intensity = clamp01(snapshot.weatherIntensity)

  if (season.snowBias > season.rainBias) {
    return blendWeather(getWeatherProfile('clear'), getWeatherProfile('snow'), intensity)
  }
  if (intensity > 0.82) {
    return blendWeather(
      getWeatherProfile('rain'),
      getWeatherProfile('storm'),
      (intensity - 0.82) / 0.18,
    )
  }
  if (intensity > 0.56) {
    return blendWeather(
      getWeatherProfile('cloudy'),
      getWeatherProfile('rain'),
      (intensity - 0.56) / 0.26,
    )
  }
  return blendWeather(
    getWeatherProfile('clear'),
    getWeatherProfile('cloudy'),
    intensity / 0.56,
  )
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
