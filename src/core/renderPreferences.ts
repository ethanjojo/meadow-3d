import { QUALITY_PROFILES, type QualityProfile, type QualityTier } from './quality'
import type { SceneSettings } from './sceneSettings'

export function resolveRenderPreferences(settings: SceneSettings, automaticTier: QualityTier) {
  const tier = settings.powerSaving ? 'low' : settings.quality === 'auto' ? automaticTier : settings.quality
  const base = QUALITY_PROFILES[tier]
  const profile: QualityProfile = { ...base, shadowSize: settings.shadows ? base.shadowSize : 0, bloomStrength: settings.bloom ? base.bloomStrength : 0 }
  return { tier, profile, fps: settings.powerSaving ? 30 : Number(settings.fpsLimit) }
}
