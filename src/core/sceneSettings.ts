import type { WeatherEffects } from './weather'
import type { WeatherPreset } from './simulation'
export type SettingsSection = 'nature' | 'sky' | 'farm' | 'time'
type Option = { value: string; label: string }
export type SceneControl = { section: SettingsSection; group: string; label: string; hint?: string } & (
 | { kind: 'range' | 'time'; default: number; min: number; max: number; step: number; unit?: string }
 | { kind: 'toggle'; default: boolean }
 | { kind: 'select'; default: string; options: readonly Option[] }
)
const activityOptions = [{ value: 'natural', label: 'Natural' }, { value: 'always', label: 'All day' }, { value: 'custom', label: 'Custom hours' }] as const
const range = (section: SettingsSection, group: string, label: string, value = 1, min = 0, max = 2, step = .05, unit = '×', hint?: string) => ({ section, group, label, kind: 'range' as const, default: value, min, max, step, unit, hint })
const toggle = (section: SettingsSection, group: string, label: string, value = true, hint?: string) => ({ section, group, label, kind: 'toggle' as const, default: value, hint })
const time = (section: SettingsSection, group: string, label: string, value: number) => ({ section, group, label, kind: 'time' as const, default: value, min: 0, max: 23.99, step: 1 / 60 })
/** One registry defines labels, defaults, limits and validation. */
export const SCENE_CONTROLS = {
 flowerDensity: range('nature', 'Flowers', 'Flower density', 1 / 3, 0, 1, .01, '%'),
 flowerSize: range('nature', 'Flowers', 'Flower size', 1, .5, 1.5),
 daisyRatio: range('nature', 'Flowers', 'Daisies', .68, 0, 1, .01, '%'),
 buttercupRatio: range('nature', 'Flowers', 'Buttercups', .32, 0, 1, .01, '%'),
 cornflowerRatio: range('nature', 'Flowers', 'Cornflowers', 0, 0, 1, .01, '%', 'Relative species mix. All zero hides flowers.'),
 flowerMotion: range('nature', 'Flowers', 'Flower movement'),
 grassDensity: range('nature', 'Grass', 'Grass detail', 1, .25, 1, .05, '×', 'Higher detail uses more GPU power.'),
 grassHeight: range('nature', 'Grass', 'Grass height', 1, .5, 1.5),
 grassMotion: range('nature', 'Grass', 'Grass movement'),
 fireflyDensity: range('nature', 'Fireflies', 'Firefly density', 1, 0, 1, .01, '%'),
 fireflyBrightness: range('nature', 'Fireflies', 'Firefly brightness'),
 fireflySpeed: range('nature', 'Fireflies', 'Firefly speed', 1, .1, 2),
 fireflySchedule: { section: 'nature', group: 'Fireflies', label: 'Firefly activity', kind: 'select', default: 'natural', options: activityOptions },
 fireflyStart: time('nature', 'Fireflies', 'Fireflies from', 18),
 fireflyEnd: time('nature', 'Fireflies', 'Fireflies until', 6),
 windStrength: range('nature', 'Wind & motion', 'Wind strength'),
 windGusts: range('nature', 'Wind & motion', 'Wind gusts'),
 dewIntensity: range('nature', 'Wind & motion', 'Morning dew'),
 gentleMotion: toggle('nature', 'Wind & motion', 'Gentler motion', false, 'System reduced motion always takes priority.'),
 gentleVegetation: toggle('nature', 'Wind & motion', 'Gentler vegetation', false),
 gentleParticles: toggle('nature', 'Wind & motion', 'Gentler particles', false),
 naturalEffects: toggle('sky', 'Natural conditions', 'Natural effect conditions', true, 'Stars, meteors and fireflies follow daylight, season and weather.'),
 cloudCover: range('sky', 'Clouds & fog', 'Cloud amount', 1, 0, 2, .05, '×', 'Scales current weather cloud cover.'),
 cloudSpeed: range('sky', 'Clouds & fog', 'Cloud speed'),
 cloudShadow: range('sky', 'Clouds & fog', 'Cloud shadows'),
 fogDensity: range('sky', 'Clouds & fog', 'Fog density'),
 groundMist: range('sky', 'Clouds & fog', 'Ground mist'),
 precipitationDensity: range('sky', 'Rain & snow', 'Rain & snow particles', 1, 0, 1, .01, '%'),
 rainDensity: range('sky', 'Rain & snow', 'Rain amount', 1, 0, 1, .01, '%'),
 snowDensity: range('sky', 'Rain & snow', 'Snow amount', 1, 0, 1, .01, '%'),
 rainSpeed: range('sky', 'Rain & snow', 'Rain speed', 1, .25, 2),
 snowSpeed: range('sky', 'Rain & snow', 'Snow speed', 1, .25, 2),
 precipitationWind: range('sky', 'Rain & snow', 'Particle wind'),
 snowCover: range('sky', 'Rain & snow', 'Snow coverage', 1, 0, 1, .01, '%'),
 snowAccumulation: range('sky', 'Rain & snow', 'Snow buildup time', 24, 1, 120, 1, 's'),
 snowMelt: range('sky', 'Rain & snow', 'Snow melting time', 65, 1, 240, 1, 's'),
 starBrightness: range('sky', 'Stars & meteors', 'Star brightness'),
 starDensity: range('sky', 'Stars & meteors', 'Star density', 1, 0, 1, .01, '%'),
 starTwinkle: range('sky', 'Stars & meteors', 'Star twinkling'),
 auroraMode: { section: 'sky', group: 'Aurora', label: 'Aurora mode', kind: 'select', default: 'auto', options: [{ value: 'auto', label: 'Automatic' }, { value: 'night', label: 'Always at night' }, { value: 'off', label: 'Off' }] },
 auroraBrightness: range('sky', 'Aurora', 'Aurora brightness', .8, 0, 2),
 auroraFrequency: range('sky', 'Aurora', 'Aurora frequency', 1, .25, 3, .05, '×', 'Automatic events last 2–4 minutes, with irregular quiet gaps. Winter favours stronger displays.'),
 auroraSpeed: range('sky', 'Aurora', 'Aurora movement', 1, 0, 2),
 shootingStars: toggle('sky', 'Stars & meteors', 'Shooting stars'),
 meteorInterval: range('sky', 'Stars & meteors', 'Meteor interval', 95, 10, 600, 5, 's'),
 meteorBrightness: range('sky', 'Stars & meteors', 'Meteor brightness'),
 meteorTrail: range('sky', 'Stars & meteors', 'Meteor trail length', 1, .25, 2),
 lightning: toggle('sky', 'Storm', 'Lightning flashes'),
 lightningInterval: range('sky', 'Storm', 'Lightning interval', 42, 10, 180, 1, 's'),
 lightningBrightness: range('sky', 'Storm', 'Lightning brightness'),
 groundLightning: toggle('sky', 'Storm', 'Ground strikes'),
 sunGlow: range('sky', 'Sun & moon', 'Sun glow'),
 goldenWarmth: range('sky', 'Sun & moon', 'Golden hour warmth'),
 moonBrightness: range('sky', 'Sun & moon', 'Moon brightness'),
 moonGlow: range('sky', 'Sun & moon', 'Moon glow'),
 moonEarthshine: range('sky', 'Sun & moon', 'Moon shadow detail'),
 moonPhaseMode: { section: 'sky', group: 'Sun & moon', label: 'Moon phase mode', kind: 'select', default: 'auto', options: [{ value: 'auto', label: 'Automatic' }, { value: 'fixed', label: 'Fixed phase' }] },
 moonPhase: range('sky', 'Sun & moon', 'Moon phase', .5, 0, 1, .01, '%'),
 farmVisible: toggle('farm', 'Building', 'Show farm'),
 farmLights: toggle('farm', 'Window lights', 'Farm lights'),
 farmLightMode: { section: 'farm', group: 'Window lights', label: 'Window light schedule', kind: 'select', default: 'auto', options: [{ value: 'auto', label: 'Evening routine' }, { value: 'custom', label: 'Custom hours' }, { value: 'always', label: 'Always on' }, { value: 'off', label: 'Always off' }] },
 farmLightStart: time('farm', 'Window lights', 'Lights on at', 18.5),
 farmLightEnd: time('farm', 'Window lights', 'Lights off at', 21),
 farmLightBrightness: range('farm', 'Window lights', 'Window brightness'),
 farmLightWarmth: range('farm', 'Window lights', 'Window warmth', .5, 0, 1, .01, '%'),
 farmLightFade: range('farm', 'Window lights', 'Window fade duration', 9, 0, 60, 1, 'scene min'),
 farmLightStagger: toggle('farm', 'Window lights', 'Stagger individual windows'),
 farmLightVariation: toggle('farm', 'Window lights', 'Vary evening routine', false),
 dayDuration: range('time', 'Clock', 'Day length', 180, 60, 3600, 30, 's'),
 seasonDuration: range('time', 'Clock', 'Season length', 360, 120, 7200, 60, 's'),
 timePaused: toggle('time', 'Clock', 'Pause scene time', false),
 realTime: toggle('time', 'Clock', 'Use device time', false, 'In automatic mode. Manual time takes priority.'),
 weatherChangeSpeed: range('time', 'Automatic weather', 'Weather change speed', 1, .1, 3),
 transitionDuration: range('time', 'Clock', 'Transition duration', 3, .5, 15, .5, 's'),
 quality: { section: 'time', group: 'Performance', label: 'Graphics quality', kind: 'select', default: 'auto', options: [{ value: 'auto', label: 'Automatic' }, { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }] },
 fpsLimit: { section: 'time', group: 'Performance', label: 'Frame rate limit', kind: 'select', default: '0', options: [{ value: '0', label: 'Unlimited' }, { value: '30', label: '30 FPS' }, { value: '60', label: '60 FPS' }] },
 powerSaving: toggle('time', 'Performance', 'Power saving', false, 'Low graphics and 30 FPS.'),
 bloom: toggle('time', 'Performance', 'Glow / bloom', true, 'Available at Medium and High quality.'),
 shadows: toggle('time', 'Performance', 'Cast shadows', true, 'Available at Medium and High quality.'),
} as const satisfies Record<string, SceneControl>
type ControlValue<T> = T extends { kind: 'select'; options: readonly { value: infer V }[] } ? V : T extends { default: boolean } ? boolean : number
export type SceneSettings = { -readonly [K in keyof typeof SCENE_CONTROLS]: ControlValue<(typeof SCENE_CONTROLS)[K]> } & { allowedWeather: WeatherPreset[] }
export const ALL_WEATHER: WeatherPreset[] = ['clear', 'cloudy', 'fog', 'rain', 'storm', 'snow']
export const DEFAULT_SCENE_SETTINGS = Object.fromEntries([...Object.entries(SCENE_CONTROLS).map(([key, control]) => [key, control.default]), ['allowedWeather', ALL_WEATHER]]) as SceneSettings
export function parseSceneSettings(value: unknown): SceneSettings {
 const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
 const result: Record<string, unknown> = {}
 for (const [key, control] of Object.entries(SCENE_CONTROLS)) {
  const raw = source[key]
  if (control.kind === 'range' || control.kind === 'time') result[key] = typeof raw === 'number' && Number.isFinite(raw) ? Math.min(control.max, Math.max(control.min, raw)) : control.default
  else if (control.kind === 'toggle') result[key] = typeof raw === 'boolean' ? raw : control.default
  else result[key] = control.options.some(option => option.value === raw) ? raw : control.default
 }
 const rawWeather = source.allowedWeather
 const allowed = Array.isArray(rawWeather) ? ALL_WEATHER.filter(weather => rawWeather.includes(weather)) : [...ALL_WEATHER]
 result.allowedWeather = allowed.length ? allowed : ['clear']
 return result as SceneSettings
}
export function getFlowerCount(budget: number, settings: SceneSettings) {
 return settings.daisyRatio + settings.buttercupRatio + settings.cornflowerRatio > 0 ? Math.round(budget * settings.flowerDensity / DEFAULT_SCENE_SETTINGS.flowerDensity) : 0
}
/** Visual preferences never alter sound volume. */
export function applySceneEffects(effects: WeatherEffects, settings: SceneSettings, output: WeatherEffects) {
 Object.assign(output, effects)
 output.rain *= settings.precipitationDensity * settings.rainDensity
 output.snow *= settings.precipitationDensity * settings.snowDensity
 output.dew *= settings.dewIntensity
 output.stormFlash *= settings.lightning ? settings.lightningBrightness : 0
 return output
}
