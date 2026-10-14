import type { NatureSnapshot } from './natureClock'
import type { SeasonAppearance } from './season'
import type { WeatherPreset, WeatherState } from './simulation'
import { getStormEvent } from './sceneEffects'

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

export interface RainStreakOrientation {
  x: number
  y: number
  z: number
}

export const RAIN_STREAK_WIND_DRIFT = 2.8
export const RAIN_STREAK_FALL_DISTANCE = 14

interface WeatherEffectInput {
  elapsed: number
  dayPhase: number
  seasonPosition: number
  weather: WeatherState
  reducedMotion: boolean
  stormInterval?: number
  stormDistanceKm?: number
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

export function deriveRainStreakOrientation(
  windDirection: readonly [number, number],
  windStrength: number,
  target?: RainStreakOrientation,
): RainStreakOrientation {
  const length = Math.hypot(windDirection[0], windDirection[1]) || 1
  const lean =
    clamp01(windStrength) *
    RAIN_STREAK_WIND_DRIFT /
    RAIN_STREAK_FALL_DISTANCE
  const orientation = target ?? { x: 0, y: -1, z: 0 }
  orientation.x = windDirection[0] / length * lean
  orientation.y = -1
  orientation.z = windDirection[1] / length * lean
  return orientation
}

export function deriveWeatherEffects({
  elapsed,
  dayPhase,
  seasonPosition,
  weather,
  reducedMotion,
  stormInterval, stormDistanceKm,
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
  const dewSky = 1 - smoothstep(0.25, 0.5, weather.cloudCover)
  const dewAir = 1 - smoothstep(0.2, 0.5, weather.fog)
  const dawn = 1 - smoothstep(0.035, 0.13, circularDistance(dayPhase, 0.25, 1))
  const stormEvent = getStormEvent(elapsed, { interval: stormInterval, distanceKm: stormDistanceKm })

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
  effects.dew = clamp01(
    weather.dew * dawn * dewSky * dewAir * (1 - precipitation),
  )
  effects.stormFlash = reducedMotion
    ? 0
    : clamp01(weather.storm * stormEvent.flash / (1 + stormEvent.distanceKm * .25))
  return effects
}

export function blendWeatherEffects(
  source: WeatherEffects,
  target: WeatherEffects,
  amount: number,
  output: WeatherEffects,
): WeatherEffects {
  const blend = clamp01(amount)
  output.pollen = mix(source.pollen, target.pollen, blend)
  output.rain = mix(source.rain, target.rain, blend)
  output.snow = mix(source.snow, target.snow, blend)
  output.fireflies = mix(source.fireflies, target.fireflies, blend)
  output.dew = mix(source.dew, target.dew, blend)
  output.stormFlash = mix(source.stormFlash, target.stormFlash, blend)
  return output
}

function writeWeather(
  weather: WeatherProfile,
  target?: WeatherState,
): WeatherState {
  const result = target ?? {
    preset: weather.preset,
    cloudCover: 0,
    fog: 0,
    rain: 0,
    snow: 0,
    storm: 0,
    wetness: 0,
    fireflies: 0,
    dew: 0,
    windStrength: 0,
    windDirection: [0, 0],
  }
  result.preset = weather.preset
  result.cloudCover = weather.cloudCover
  result.fog = weather.fog
  result.rain = weather.rain
  result.snow = weather.snow
  result.storm = weather.storm
  result.wetness = weather.wetness
  result.fireflies = weather.fireflies
  result.dew = weather.dew
  result.windStrength = weather.windStrength
  const direction = result.windDirection as [number, number]
  direction[0] = weather.windDirection[0]
  direction[1] = weather.windDirection[1]
  return result
}

export function getWeatherProfile(
  preset: WeatherPreset,
  target?: WeatherState,
): WeatherState {
  const profile = WEATHER_PROFILES[preset]
  return writeWeather(profile, target)
}

export function blendWeather(
  from: WeatherProfile,
  to: WeatherProfile,
  amount: number,
  target?: WeatherState,
): WeatherState {
  const blend = clamp01(amount)
  const result = target ?? getWeatherProfile(from.preset)
  result.preset = blend === 0 ? from.preset : to.preset
  result.cloudCover = mix(from.cloudCover, to.cloudCover, blend)
  result.fog = mix(from.fog, to.fog, blend)
  result.rain = mix(from.rain, to.rain, blend)
  result.snow = mix(from.snow, to.snow, blend)
  result.storm = mix(from.storm, to.storm, blend)
  result.wetness = mix(from.wetness, to.wetness, blend)
  result.fireflies = mix(from.fireflies, to.fireflies, blend)
  result.dew = mix(from.dew, to.dew, blend)
  result.windStrength = mix(from.windStrength, to.windStrength, blend)
  const direction = result.windDirection as [number, number]
  direction[0] = mix(from.windDirection[0], to.windDirection[0], blend)
  direction[1] = mix(from.windDirection[1], to.windDirection[1], blend)
  return result
}

function getAutomaticRainWeather(
  intensity: number,
  target?: WeatherState,
): WeatherState {
  if (intensity > 0.82) {
    return blendWeather(
      WEATHER_PROFILES.rain,
      WEATHER_PROFILES.storm,
      (intensity - 0.82) / 0.18,
      target,
    )
  }
  if (intensity > 0.56) {
    return blendWeather(
      WEATHER_PROFILES.cloudy,
      WEATHER_PROFILES.rain,
      (intensity - 0.56) / 0.26,
      target,
    )
  }
  return blendWeather(
    WEATHER_PROFILES.clear,
    WEATHER_PROFILES.cloudy,
    intensity / 0.56,
    target,
  )
}

const WEATHER_COMPONENTS = ['cloudCover', 'fog', 'rain', 'snow', 'storm', 'wetness', 'fireflies', 'dew', 'windStrength'] as const

export function getAutomaticWeather(
  snapshot: NatureSnapshot,
  season: SeasonAppearance,
  target?: WeatherState,
): WeatherState {
  const intensity = clamp01(snapshot.weatherIntensity)
  const result = getAutomaticRainWeather(intensity, target)
  const winter = smoothstep(-.02, .02, season.snowBias - season.rainBias)
  if (winter === 0) return result
  const clear = WEATHER_PROFILES.clear
  const snow = WEATHER_PROFILES.snow
  for (const key of WEATHER_COMPONENTS) result[key] = mix(result[key], mix(clear[key], snow[key], intensity), winter)
  const direction = result.windDirection as [number, number]
  direction[0] = mix(direction[0], mix(clear.windDirection[0], snow.windDirection[0], intensity), winter)
  direction[1] = mix(direction[1], mix(clear.windDirection[1], snow.windDirection[1], intensity), winter)
  if (winter > .5) result.preset = 'snow'
  return result
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
