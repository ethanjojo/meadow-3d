import { describe, expect, it } from 'vitest'
import { applySceneEffects, DEFAULT_SCENE_SETTINGS, getFlowerCount, parseSceneSettings } from '../../src/core/sceneSettings'

describe('scene preferences', () => {
  it('validates persisted input and clamps only finite numbers', () => {
    expect(parseSceneSettings(null)).toEqual(DEFAULT_SCENE_SETTINGS)
    expect(parseSceneSettings({ flowerDensity: -4, fireflyDensity: 7, starBrightness: NaN, shootingStars: 'false', lightning: false })).toMatchObject({
      flowerDensity: 0, fireflyDensity: 1, starBrightness: 1, shootingStars: true, lightning: false,
      farmLights: true,
    })
    expect(parseSceneSettings({ farmLights: false }).farmLights).toBe(false)
  })
  it('preserves the sparse default and bounded device-specific flower budgets', () => {
    expect(getFlowerCount(240, parseSceneSettings(null))).toBe(240)
    expect(getFlowerCount(240, parseSceneSettings({ flowerDensity: 0 }))).toBe(0)
    expect(getFlowerCount(240, parseSceneSettings({ flowerDensity: 1 }))).toBe(720)
    expect(getFlowerCount(48, parseSceneSettings({ flowerDensity: 1 }))).toBe(144)
  })
  it('scales visual effects without mutating weather or accumulating multipliers', () => {
    const raw = { rain: .8, snow: .6, fireflies: .7, pollen: .3, dew: .4, stormFlash: .9 }
    const output = { ...raw }
    const settings = parseSceneSettings({ precipitationDensity: .5, fireflyDensity: 0, lightning: false })
    applySceneEffects(raw, settings, output)
    applySceneEffects(raw, settings, output)
    expect(output).toEqual({ rain: .4, snow: .3, fireflies: .7, pollen: .3, dew: .4, stormFlash: 0 })
    expect(raw.rain).toBe(.8)
    applySceneEffects(raw, parseSceneSettings(null), output)
    expect(output).toEqual(raw)
  })
})
