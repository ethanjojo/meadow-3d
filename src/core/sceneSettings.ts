import type { WeatherEffects } from './weather'

export interface SceneSettings {
  flowerDensity: number
  fireflyDensity: number
  precipitationDensity: number
  starBrightness: number
  shootingStars: boolean
  lightning: boolean
  gentleMotion: boolean
}

export const DEFAULT_SCENE_SETTINGS: Readonly<SceneSettings> = {
  flowerDensity: 1 / 3,
  fireflyDensity: 1,
  precipitationDensity: 1,
  starBrightness: 1,
  shootingStars: true,
  lightning: true,
  gentleMotion: false,
}

export function parseSceneSettings(value: unknown): SceneSettings {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const number = (key: keyof SceneSettings) => typeof source[key] === 'number' && Number.isFinite(source[key])
    ? Math.min(1, Math.max(0, source[key] as number)) : DEFAULT_SCENE_SETTINGS[key] as number
  const boolean = (key: keyof SceneSettings) => typeof source[key] === 'boolean'
    ? source[key] as boolean : DEFAULT_SCENE_SETTINGS[key] as boolean
  return {
    flowerDensity: number('flowerDensity'), fireflyDensity: number('fireflyDensity'),
    precipitationDensity: number('precipitationDensity'), starBrightness: number('starBrightness'),
    shootingStars: boolean('shootingStars'), lightning: boolean('lightning'), gentleMotion: boolean('gentleMotion'),
  }
}

export function getFlowerCount(budget: number, settings: SceneSettings) {
  return Math.round(budget * settings.flowerDensity / DEFAULT_SCENE_SETTINGS.flowerDensity)
}

/** Visual preferences never alter the simulation, snow accumulation, or sound mix. */
export function applySceneEffects(effects: WeatherEffects, settings: SceneSettings, output: WeatherEffects) {
  Object.assign(output, effects)
  output.rain *= settings.precipitationDensity
  output.snow *= settings.precipitationDensity
  if (!settings.lightning) output.stormFlash = 0
  return output
}
