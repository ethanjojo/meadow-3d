import type { NatureSnapshot } from './natureClock'
import type { SeasonAppearance } from './season'
import type { WeatherPreset, WeatherState } from './simulation'

export interface WeatherOpacity {
  pollen: number
  rain: number
  snow: number
}

export interface WeatherEffects extends WeatherOpacity {
  fireflies: number
  dew: number
  stormFlash: number
}

interface WeatherEffectInput {
  elapsed: number
  dayPhase: number
  seasonPosition: number
  weather: WeatherState
  reducedMotion: boolean
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

function circularDistance(from: number, to: number, period: number) {
  const distance = Math.abs(((from - to + period / 2) % period + period) % period - period / 2)
  return distance
}

export function deriveWeatherEffects({
  elapsed,
  dayPhase,
  seasonPosition,
  weather,
  reducedMotion,
}: WeatherEffectInput, target?: WeatherEffects): WeatherEffects {
  const solarAngle = dayPhase * Math.PI * 2 - Math.PI / 2
  const daylight = smoothstep(-0.05, 0.18, Math.sin(solarAngle))
  const night = 1 - smoothstep(-0.2, 0.05, Math.sin(solarAngle))
  const summer = 1 - smoothstep(0.32, 0.72, circularDistance(seasonPosition, 1, 4))
  const winter = 1 - smoothstep(0.42, 0.82, circularDistance(seasonPosition, 3, 4))
  const spring = 1 - smoothstep(0.45, 1.15, circularDistance(seasonPosition, 0, 4))
  const precipitation = clamp01(weather.rain + weather.snow)
  const calm = 1 - smoothstep(0.38, 0.72, weather.windStrength)
  const fairWeather =
    (1 - smoothstep(0.62, 0.78, weather.cloudCover)) *
    (1 - precipitation) *
    (1 - clamp01(weather.storm))
  const dawn = 1 - smoothstep(0.035, 0.13, circularDistance(dayPhase, 0.25, 1))
  const safeElapsed = Number.isFinite(elapsed) ? elapsed : 0
  const flashPhase = ((safeElapsed % 13.7) + 13.7) % 13.7
  const firstFlash = 1 - smoothstep(0, 0.11, Math.abs(flashPhase - 1.15))
  const secondFlash = 1 - smoothstep(0, 0.08, Math.abs(flashPhase - 1.48))

  const effects = target ?? {
    pollen: 0,
    rain: 0,
    snow: 0,
    fireflies: 0,
    dew: 0,
    stormFlash: 0,
  }
  effects.pollen = clamp01(
      (spring * 0.82 + summer * 0.34) *
        daylight *
        (1 - precipitation) *
        (1 - weather.cloudCover * 0.55),
    )
  effects.rain = clamp01(weather.rain)
  effects.snow = clamp01(weather.snow * winter)
  effects.fireflies = clamp01(
    weather.fireflies * summer * night * calm * fairWeather *
      (reducedMotion ? 0.35 : 1),
  )
  effects.dew = clamp01(weather.dew * dawn * (1 - precipitation))
  effects.stormFlash = reducedMotion
    ? 0
    : clamp01(weather.storm * Math.max(firstFlash, secondFlash * 0.72))
  return effects
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
