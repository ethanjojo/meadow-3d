import type { NatureSnapshot, SeasonIndex } from './natureClock'
import { getSeasonAppearance } from './season'
import {
  blendWeather,
  getAutomaticWeather,
  getWeatherProfile,
} from './weather'

export type SimulationMode = 'auto' | 'manual'
export type WeatherPreset = 'clear' | 'cloudy' | 'fog' | 'rain' | 'storm' | 'snow'

export interface SimulationSettings {
  mode: SimulationMode
  dayPhase: number
  seasonIndex: SeasonIndex
  weather: WeatherPreset
}

export interface WeatherState {
  preset: WeatherPreset
  cloudCover: number
  fog: number
  rain: number
  snow: number
  storm: number
  wetness: number
  fireflies: number
  dew: number
  windStrength: number
  windDirection: readonly [number, number]
}

export interface EnvironmentSnapshot extends NatureSnapshot {
  autoElapsed: number
  seasonPosition: number
  weather: WeatherState
}

export const DEFAULT_SIMULATION_SETTINGS: SimulationSettings = {
  mode: 'auto',
  dayPhase: 0.31,
  seasonIndex: 0,
  weather: 'clear',
}

const WEATHER_PRESETS: readonly WeatherPreset[] = [
  'clear',
  'cloudy',
  'fog',
  'rain',
  'storm',
  'snow',
]

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function wrap(value: number, period: number) {
  return ((value % period) + period) % period
}

function mixCircular(current: number, target: number, period: number, amount: number) {
  const distance = wrap(target - current + period / 2, period) - period / 2
  return wrap(current + distance * amount, period)
}

function isSeasonIndex(value: unknown): value is SeasonIndex {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0 && value <= 3
}

function isWeatherPreset(value: unknown): value is WeatherPreset {
  return typeof value === 'string' && WEATHER_PRESETS.includes(value as WeatherPreset)
}

function getTarget(auto: NatureSnapshot, settings: SimulationSettings) {
  if (settings.mode === 'manual') {
    return {
      dayPhase: wrap(settings.dayPhase, 1),
      seasonPosition: settings.seasonIndex,
      weather: getWeatherProfile(settings.weather),
    }
  }

  return {
    dayPhase: auto.dayPhase,
    seasonPosition: auto.seasonIndex + auto.seasonBlend,
    weather: getAutomaticWeather(auto, getSeasonAppearance(auto)),
  }
}

function createSnapshot(
  auto: NatureSnapshot,
  dayPhase: number,
  seasonPosition: number,
  weather: WeatherState,
): EnvironmentSnapshot {
  const normalizedSeasonPosition = wrap(seasonPosition, 4)
  const seasonIndex = Math.floor(normalizedSeasonPosition) as SeasonIndex
  const seasonBlend = normalizedSeasonPosition - seasonIndex

  return {
    ...auto,
    dayPhase: wrap(dayPhase, 1),
    seasonPhase: normalizedSeasonPosition / 4,
    seasonIndex,
    nextSeasonIndex: ((seasonIndex + 1) % 4) as SeasonIndex,
    seasonBlend,
    windStrength: weather.windStrength,
    weatherIntensity: Math.max(weather.rain, weather.snow, weather.storm),
    autoElapsed: auto.elapsed,
    seasonPosition: normalizedSeasonPosition,
    weather,
  }
}

export function parseSimulationSettings(value: unknown): SimulationSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return DEFAULT_SIMULATION_SETTINGS
  }

  const candidate = value as Record<string, unknown>
  if (
    (candidate.mode !== 'auto' && candidate.mode !== 'manual') ||
    typeof candidate.dayPhase !== 'number' ||
    !Number.isFinite(candidate.dayPhase) ||
    candidate.dayPhase < 0 ||
    candidate.dayPhase > 1 ||
    !isSeasonIndex(candidate.seasonIndex) ||
    !isWeatherPreset(candidate.weather)
  ) {
    return DEFAULT_SIMULATION_SETTINGS
  }

  return {
    mode: candidate.mode,
    dayPhase: candidate.dayPhase,
    seasonIndex: candidate.seasonIndex,
    weather: candidate.weather,
  }
}

export function createEnvironmentSnapshot(
  auto: NatureSnapshot,
  settings: SimulationSettings,
): EnvironmentSnapshot {
  const target = getTarget(auto, settings)
  return createSnapshot(auto, target.dayPhase, target.seasonPosition, target.weather)
}

export function stepEnvironment(
  current: EnvironmentSnapshot,
  auto: NatureSnapshot,
  settings: SimulationSettings,
  deltaSeconds: number,
): EnvironmentSnapshot {
  const delta = Number.isFinite(deltaSeconds)
    ? clamp(deltaSeconds, 0, 0.1)
    : 0
  const amount = 1 - Math.exp(-delta / 2.5)
  const target = getTarget(auto, settings)

  return createSnapshot(
    auto,
    mixCircular(current.dayPhase, target.dayPhase, 1, amount),
    mixCircular(current.seasonPosition, target.seasonPosition, 4, amount),
    blendWeather(current.weather, target.weather, amount),
  )
}
