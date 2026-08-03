import { describe, expect, it } from 'vitest'
import {
  getSolarDiscAppearance,
  sunDiscFragmentShader,
} from '../../src/scene/celestialShaders'

describe('celestial rendering', () => {
  it('softens and warms the low sun without enlarging the disc excessively', () => {
    const horizon = getSolarDiscAppearance(0.02, 0.95)
    const noon = getSolarDiscAppearance(1, 0)
    const reusable = {
      warmth: 0,
      hardDisc: 0,
      haloScale: 0,
      discScale: 0,
    }

    expect(getSolarDiscAppearance(0.2, 0.5, reusable)).toBe(reusable)
    expect(horizon.warmth).toBeGreaterThan(noon.warmth)
    expect(horizon.hardDisc).toBeLessThan(noon.hardDisc)
    expect(horizon.haloScale).toBeGreaterThan(noon.haloScale)
    expect(horizon.discScale).toBeLessThanOrEqual(1.04)
  })

  it('renders a soft solar limb and height-dependent extinction', () => {
    expect(sunDiscFragmentShader).toContain(
      'smoothstep(1.0, 0.82, radius)',
    )
    expect(sunDiscFragmentShader).toContain('uWarmth')
    expect(sunDiscFragmentShader).toContain('uHardDisc')
  })
})
