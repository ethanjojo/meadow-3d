import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENE_SETTINGS } from '../../src/core/sceneSettings'
import { resolveRenderPreferences } from '../../src/core/renderPreferences'
describe('render preferences', () => {
  it('keeps auto quality while allowing individual graphics features to be disabled', () => {
    const result = resolveRenderPreferences({ ...DEFAULT_SCENE_SETTINGS, bloom: false, shadows: false }, 'high')
    expect(result.tier).toBe('high')
    expect(result.profile.bloomStrength).toBe(0)
    expect(result.profile.shadowSize).toBe(0)
  })
  it('power saving overrides an expensive manual profile and caps frames', () => {
    const result = resolveRenderPreferences({ ...DEFAULT_SCENE_SETTINGS, quality: 'high', powerSaving: true }, 'medium')
    expect(result.tier).toBe('low'); expect(result.fps).toBe(30)
    expect(resolveRenderPreferences({ ...DEFAULT_SCENE_SETTINGS, quality: 'medium', fpsLimit: '60' }, 'low').tier).toBe('medium')
  })
})
