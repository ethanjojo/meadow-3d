import { describe, expect, it } from 'vitest'
import { getCelestialAppearance } from '../../src/core/celestialAppearance'

describe('sun and moon appearance', () => {
  it('warms the sun smoothly near the horizon without tinting midday orange', () => {
    expect(getCelestialAppearance(0, 1, 0, 0).sunWarmth).toBe(0)
    expect(getCelestialAppearance(0, 0, 0, 0).sunWarmth).toBe(1)
    expect(getCelestialAppearance(0, .25, 0, 0).sunWarmth).toBeCloseTo(.5)
  })
  it('wraps the slow lunar phase without changing its lighting direction', () => {
    const first = getCelestialAppearance(40, .5, 0, 0)
    const cycle = getCelestialAppearance(40 + Math.PI * 2 * 900, .5, 0, 0)
    expect(cycle.moonPhase).toBeCloseTo(first.moonPhase)
  })
  it('widens a subdued moon halo in haze and thin cloud without creating a bright opaque disc', () => {
    const clear = getCelestialAppearance(0, 0, 0, 0)
    const haze = getCelestialAppearance(0, 0, .5, .3)
    expect(haze.moonHaloScale).toBeGreaterThan(clear.moonHaloScale)
    expect(haze.moonHaloStrength).toBeLessThanOrEqual(.4)
    expect(getCelestialAppearance(0, 0, 1, 1).moonHaloStrength).toBeLessThan(haze.moonHaloStrength)
  })
})
