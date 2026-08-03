import { describe, expect, it } from 'vitest'
import {
  cloudFragmentShader,
  getCloudLayerProfile,
} from '../../src/scene/cloudShaders'

describe('cloud rendering', () => {
  it('separates cloud layers by scale, height, drift, and parallax', () => {
    const first = getCloudLayerProfile(0)
    const second = getCloudLayerProfile(1)

    expect(first.noiseScale).not.toBe(second.noiseScale)
    expect(first.height).toBeLessThan(second.height)
    expect(first.driftScale).not.toBe(second.driftScale)
    expect(first.depth).toBeGreaterThan(second.depth)
  })

  it('clamps out-of-range layer indexes to an exact profile', () => {
    expect(getCloudLayerProfile(-1)).toBe(getCloudLayerProfile(0))
    expect(getCloudLayerProfile(8)).toBe(getCloudLayerProfile(2))
  })

  it('uses shared sunset, moon, and storm lighting', () => {
    expect(cloudFragmentShader).toContain('uCloudLightColor')
    expect(cloudFragmentShader).toContain('uCloudShadowColor')
    expect(cloudFragmentShader).toContain('uSolarScatter')
    expect(cloudFragmentShader).toContain('uLunarAmbient')
    expect(cloudFragmentShader).toContain('uStorm')
  })
})
