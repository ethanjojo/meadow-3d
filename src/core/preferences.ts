import { parseAudioSettings, type AudioSettings } from './audioSettings'
import { SCENE_CONTROLS, parseSceneSettings, type SceneSettings } from './sceneSettings'
import { parseSimulationSettings, type SimulationSettings } from './simulation'

export interface MeadowPreferences { audio: AudioSettings; scene: SceneSettings; simulation: SimulationSettings }
export interface SavedPreset { id: string; name: string; settings: MeadowPreferences }
interface PreferencesDocument extends MeadowPreferences { app: 'living-meadow'; version: 1 }

export function exportPreferences(settings: MeadowPreferences) {
  const document: PreferencesDocument = { app: 'living-meadow', version: 1, ...settings }
  return JSON.stringify(document, null, 2)
}

/** A portable file must contain valid values, rather than silently replacing missing values. */
function requireCanonical(input: unknown, canonical: unknown, path: string): void {
  if (Array.isArray(canonical)) {
    if (!Array.isArray(input) || input.length !== canonical.length) throw new Error(`Invalid ${path}`)
    canonical.forEach((value, index) => requireCanonical(input[index], value, `${path}[${index}]`))
  } else if (canonical && typeof canonical === 'object') {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`Invalid ${path}`)
    for (const [key, value] of Object.entries(canonical)) requireCanonical((input as Record<string, unknown>)[key], value, `${path}.${key}`)
  } else if (input !== canonical) throw new Error(`Invalid ${path}`)
}

function validatePreferences(value: unknown): MeadowPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid settings file')
  const source = value as Record<string, unknown>
  // Additive version-1 migration: preserve user presets/exports made before Aurora.
  // All pre-existing fields and any supplied Aurora values still require strict validation.
  const scene = source.scene && typeof source.scene === 'object' && !Array.isArray(source.scene) ? { ...source.scene } as Record<string, unknown> : source.scene
  if (scene && typeof scene === 'object') for (const [key, control] of Object.entries(SCENE_CONTROLS)) {
    if (control.group === 'Aurora' && !(key in scene)) Object.assign(scene, { [key]: control.default })
  }
  const settings = { audio: parseAudioSettings(source.audio), scene: parseSceneSettings(source.scene), simulation: parseSimulationSettings(source.simulation) }
  requireCanonical(source.audio, settings.audio, 'audio')
  requireCanonical(scene, settings.scene, 'scene')
  requireCanonical(source.simulation, settings.simulation, 'simulation')
  return settings
}

export function importPreferences(text: string): MeadowPreferences {
  if (text.length > 128_000) throw new Error('Settings file is too large')
  const source = JSON.parse(text) as Record<string, unknown> | null
  if (!source || source.app !== 'living-meadow' || source.version !== 1) throw new Error('Unsupported settings file or version')
  return validatePreferences(source)
}

export function parseSavedPresets(value: unknown): SavedPreset[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.slice(0, 12).flatMap(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || item.id.length > 80 || typeof item.name !== 'string' || !item.name.trim() || seen.has(item.id)) return []
    try {
      const preset = { id: item.id, name: item.name.trim().slice(0, 48), settings: validatePreferences(item.settings) }
      seen.add(preset.id)
      return [preset]
    } catch { return [] }
  })
}
