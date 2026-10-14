import { isWithinHours } from './timeWindow'
import type { SceneSettings } from './sceneSettings'
/** Shared footprint for the building, yard, and vegetation clearance. */
export const FARM = { x: 1.8, z: -27, rotation: -0.32, scale: 1 } as const

export const FARM_WINDOWS = [
  { x: 0, y: 4.55, width: 1.15, height: 1.15 },
  { x: -2.2, y: 1.92, width: .65, height: .85 },
  { x: 2.2, y: 1.92, width: .65, height: .85 },
] as const

/** Configurable window routine in scene time, including independently staggered fades. */
export function getFarmWindowLight(dayPhase: number, windowIndex = 0, settings?: SceneSettings, dayIndex = 0) {
  if (!Number.isFinite(dayPhase)) return 0
  const hour = ((dayPhase % 1 + 1) % 1) * 24
  const index = Math.max(0, Math.min(FARM_WINDOWS.length - 1, Math.floor(windowIndex)))
  if (settings && (!settings.farmLights || settings.farmLightMode === 'off')) return 0
  if (settings?.farmLightMode === 'custom' && settings.farmLightStart === settings.farmLightEnd) return settings.farmLightBrightness
  if (settings?.farmLightMode === 'always') return settings.farmLightBrightness
  const stagger = !settings || settings.farmLightStagger
  const variation = settings?.farmLightVariation ? Math.sin(Math.floor(dayIndex) * 12.9898) * .2 : 0
  const baseStart = settings?.farmLightMode === 'custom' ? settings.farmLightStart : 18.5
  const baseEnd = settings?.farmLightMode === 'custom' ? settings.farmLightEnd : 21
  const baseDuration = ((baseEnd - baseStart) % 24 + 24) % 24
  // Keep every staggered interval inside the original unwrapped night window.
  // Even the last window retains at least half the selected activity duration.
  const staggerScale = stagger ? Math.min(1, baseDuration / ((FARM_WINDOWS.length - 1) * .1 * 2)) : 0
  const startOffset = index * .06 * staggerScale
  const endOffset = index * .04 * staggerScale
  const start = baseStart + startOffset + variation
  const duration = baseDuration - startOffset - endOffset
  const end = start + duration
  const sinceStart = ((hour - start) % 24 + 24) % 24
  if (!isWithinHours(dayPhase, (start + 24) % 24, (end + 24) % 24)) return 0
  const fade = Math.min((settings?.farmLightFade ?? 9) / 60, duration / 2)
  if (duration === 0) return settings?.farmLightBrightness ?? 1
  if (fade === 0) return settings?.farmLightBrightness ?? 1
  const ease = (value: number) => {
    const t = Math.min(1, Math.max(0, value))
    return t * t * (3 - 2 * t)
  }
  return ease(sinceStart / fade) * ease((duration - sinceStart) / fade) * (settings?.farmLightBrightness ?? 1)
}

export function isFarmYard(x: number, z: number) {
  const dx = x - FARM.x
  const dz = z - FARM.z
  const localX = Math.cos(FARM.rotation) * dx - Math.sin(FARM.rotation) * dz
  const localZ = Math.sin(FARM.rotation) * dx + Math.cos(FARM.rotation) * dz
  return Math.abs(localX) < 5.3 * FARM.scale && localZ > -4.8 * FARM.scale && localZ < 6.6 * FARM.scale
}
