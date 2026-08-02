import { describe, expect, it } from 'vitest'
import { createGrassLayout } from '../../src/core/grassLayout'

describe('createGrassLayout', () => {
  it('is deterministic and keeps blades inside the meadow radius', () => {
    const first = createGrassLayout(128, 24, 42)
    const second = createGrassLayout(128, 24, 42)

    expect(Array.from(first.offsets)).toEqual(Array.from(second.offsets))
    expect(first.offsets).toHaveLength(128 * 3)

    for (let index = 0; index < first.offsets.length; index += 3) {
      const x = first.offsets[index]
      const z = first.offsets[index + 2]
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(24)
    }
  })

  it('keeps scale, phase, stiffness, and yaw in useful ranges', () => {
    const layout = createGrassLayout(32, 10, 5)

    expect(layout.scales).toHaveLength(32)
    expect(layout.phases).toHaveLength(32)
    expect(layout.stiffness).toHaveLength(32)
    expect(layout.yaw).toHaveLength(32)

    for (const value of layout.scales) {
      expect(value).toBeGreaterThanOrEqual(0.65)
      expect(value).toBeLessThanOrEqual(1.4)
    }
    for (const value of layout.phases) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(Math.PI * 2)
    }
    for (const value of layout.stiffness) {
      expect(value).toBeGreaterThanOrEqual(0.15)
      expect(value).toBeLessThanOrEqual(0.95)
    }
  })

  it('handles an empty meadow without invalid buffers', () => {
    const layout = createGrassLayout(0, 10, 1)
    expect(layout.offsets).toHaveLength(0)
    expect(layout.scales).toHaveLength(0)
  })
})
