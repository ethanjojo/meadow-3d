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

export interface EnvironmentTransitionFrame {
  source: EnvironmentSnapshot
  target: EnvironmentSnapshot
  snapshot: EnvironmentSnapshot
  progress: number
  elapsed: number
  active: boolean
  settingsKey: string
  revision: number
}

export const ENVIRONMENT_TRANSITION_DURATION = 3

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

function easeInOut(amount: number) {
  const value = clamp(amount, 0, 1)
  return value * value * (3 - 2 * value)
}

function getSettingsKey(settings: SimulationSettings) {
  return `${settings.mode}:${settings.dayPhase}:${settings.seasonIndex}:${settings.weather}`
}

function isSeasonIndex(value: unknown): value is SeasonIndex {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0 && value <= 3
}

function isWeatherPreset(value: unknown): value is WeatherPreset {
  return typeof value === 'string' && WEATHER_PRESETS.includes(value as WeatherPreset)
}

function createSnapshot(
  auto: NatureSnapshot,
  dayPhase: number,
  seasonPosition: number,
  weather: WeatherState,
  target?: EnvironmentSnapshot,
): EnvironmentSnapshot {
  const normalizedSeasonPosition = wrap(seasonPosition, 4)
  const seasonIndex = Math.floor(normalizedSeasonPosition) as SeasonIndex
  const seasonBlend = normalizedSeasonPosition - seasonIndex
  const snapshot = target ?? {
    elapsed: 0,
    dayPhase: 0,
    seasonPhase: 0,
    seasonIndex: 0,
    nextSeasonIndex: 1,
    seasonBlend: 0,
    windStrength: 0,
    weatherIntensity: 0,
    autoElapsed: 0,
    seasonPosition: 0,
    weather: getWeatherProfile(weather.preset),
  }

  snapshot.dayCycle = auto.dayCycle
  snapshot.elapsed = auto.elapsed
  snapshot.dayPhase = wrap(dayPhase, 1)
  snapshot.seasonPhase = normalizedSeasonPosition / 4
  snapshot.seasonIndex = seasonIndex
  snapshot.nextSeasonIndex = ((seasonIndex + 1) % 4) as SeasonIndex
  snapshot.seasonBlend = seasonBlend
  snapshot.windStrength = weather.windStrength
  snapshot.weatherIntensity = Math.max(weather.rain, weather.snow, weather.storm)
  snapshot.autoElapsed = auto.elapsed
  snapshot.seasonPosition = normalizedSeasonPosition
  blendWeather(weather, weather, 0, snapshot.weather)
  return snapshot
}

function copyEnvironmentSnapshot(
  source: EnvironmentSnapshot,
  target?: EnvironmentSnapshot,
) {
  const snapshot = createSnapshot(
    source,
    source.dayPhase,
    source.seasonPosition,
    source.weather,
    target,
  )
  snapshot.autoElapsed = source.autoElapsed
  return snapshot
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
  target?: EnvironmentSnapshot,
  allowedWeather?: readonly WeatherPreset[],
): EnvironmentSnapshot {
  if (settings.mode === 'manual') {
    const weather = getWeatherProfile(settings.weather, target?.weather)
    return createSnapshot(
      auto,
      settings.dayPhase,
      settings.seasonIndex,
      weather,
      target,
    )
  }

  let weather = getAutomaticWeather(
    auto,
    getSeasonAppearance(auto),
    target?.weather,
  )
  if (allowedWeather && allowedWeather.length < WEATHER_PRESETS.length) {
    // Blend adjacent allowed profiles along the same continuous weather signal.
    const position = auto.weatherIntensity * Math.max(0, allowedWeather.length - 1)
    const index = Math.floor(position)
    weather = blendWeather(getWeatherProfile(allowedWeather[index] ?? 'clear'), getWeatherProfile(allowedWeather[Math.min(index + 1, allowedWeather.length - 1)] ?? 'clear'), position - index, target?.weather)
  }
  return createSnapshot(
    auto,
    auto.dayPhase,
    auto.seasonIndex + auto.seasonBlend,
    weather,
    target,
  )
}

export function createEnvironmentTransition(
  auto: NatureSnapshot,
  settings: SimulationSettings,
): EnvironmentTransitionFrame {
  const snapshot = createEnvironmentSnapshot(auto, settings)
  return {
    source: copyEnvironmentSnapshot(snapshot),
    target: copyEnvironmentSnapshot(snapshot),
    snapshot,
    progress: 1,
    elapsed: ENVIRONMENT_TRANSITION_DURATION,
    active: false,
    settingsKey: getSettingsKey(settings),
    revision: 0,
  }
}

export function stepEnvironmentTransition(
  frame: EnvironmentTransitionFrame,
  auto: NatureSnapshot,
  settings: SimulationSettings,
  deltaSeconds: number,
  options: { duration?: number; allowedWeather?: readonly WeatherPreset[]; realTime?: boolean } = {},
): EnvironmentTransitionFrame {
  const duration = options.duration ?? ENVIRONMENT_TRANSITION_DURATION
  const nextKey = getSettingsKey(settings) + (options.allowedWeather && options.allowedWeather.length < WEATHER_PRESETS.length ? `:${options.allowedWeather.join(',')}` : '') + (options.realTime ? ':device-time' : '')

  if (nextKey !== frame.settingsKey) {
    frame.source = copyEnvironmentSnapshot(frame.snapshot)
    frame.target = createEnvironmentSnapshot(auto, settings, undefined, options.allowedWeather)
    frame.progress = 0
    frame.elapsed = 0
    frame.active = true
    frame.settingsKey = nextKey
    frame.revision += 1
    createSnapshot(
      auto,
      frame.source.dayPhase,
      frame.source.seasonPosition,
      frame.source.weather,
      frame.snapshot,
    )
    return frame
  }

  if (!frame.active) {
    createEnvironmentSnapshot(auto, settings, frame.target, options.allowedWeather)
    copyEnvironmentSnapshot(frame.target, frame.source)
    copyEnvironmentSnapshot(frame.target, frame.snapshot)
    frame.progress = 1
    frame.elapsed = duration
    return frame
  }

  createEnvironmentSnapshot(auto, settings, frame.target, options.allowedWeather)
  const delta = Number.isFinite(deltaSeconds)
    ? clamp(deltaSeconds, 0, 0.5)
    : 0
  frame.elapsed = Math.min(
    duration,
    frame.elapsed + delta,
  )
  const completed =
    frame.elapsed >= duration - 1e-9
  const linearProgress = completed
    ? 1
    : frame.elapsed / duration
  frame.progress = easeInOut(linearProgress)

  createSnapshot(
    auto,
    mixCircular(frame.source.dayPhase, frame.target.dayPhase, 1, frame.progress),
    mixCircular(
      frame.source.seasonPosition,
      frame.target.seasonPosition,
      4,
      frame.progress,
    ),
    blendWeather(
      frame.source.weather,
      frame.target.weather,
      frame.progress,
      frame.snapshot.weather,
    ),
    frame.snapshot,
  )

  if (completed) {
    frame.elapsed = duration
    frame.progress = 1
    frame.active = false
    copyEnvironmentSnapshot(frame.target, frame.source)
    copyEnvironmentSnapshot(frame.target, frame.snapshot)
  }

  return frame
}
