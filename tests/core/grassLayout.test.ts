import { describe, expect, it } from 'vitest'
import {
  createGrassLayerLayout,
  createGrassLayout,
  getGrassLayerBudgets,
  terrainHeight,
  type GrassLayerKind,
} from '../../src/core/grassLayout'

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

  it('gives the meadow gentle bounded undulation', () => {
    expect(terrainHeight(0, 0)).toBeCloseTo(0)
    expect(terrainHeight(8, -5)).not.toBeCloseTo(0)
    expect(Math.abs(terrainHeight(100, 100))).toBeLessThanOrEqual(0.24)
  })
})

describe('layered grass layout', () => {
  it('allocates every blade across foreground, middle, and horizon layers', () => {
    const budgets = getGrassLayerBudgets(1_000)

    expect(budgets.foreground + budgets.middle + budgets.horizon).toBe(1_000)
    expect(budgets.horizon).toBeGreaterThan(budgets.foreground)
  })

  it('creates deterministic width, lean, and color variation', () => {
    const first = createGrassLayerLayout(64, 'foreground', 42)
    const second = createGrassLayerLayout(64, 'foreground', 42)

    expect(Array.from(first.widths)).toEqual(Array.from(second.widths))
    expect(Array.from(first.leans)).toEqual(Array.from(second.leans))
    expect(Array.from(first.colorVariation)).toEqual(
      Array.from(second.colorVariation),
    )
    expect(first.leans).toHaveLength(64)
    expect(first.colorVariation).toHaveLength(64)
    expect(Math.max(...first.scales)).toBeGreaterThan(1.2)
  })

  it.each<[
    GrassLayerKind,
    readonly [minimum: number, maximum: number],
  ]>([
    ['foreground', [-4.5, 5]],
    ['middle', [-16, -3.5]],
    ['horizon', [-34, -14]],
  ])('keeps %s roots inside its visible depth band', (kind, [minimum, maximum]) => {
    const layout = createGrassLayerLayout(512, kind, 17)

    for (let index = 0; index < layout.offsets.length; index += 3) {
      const x = layout.offsets[index]
      const y = layout.offsets[index + 1]
      const z = layout.offsets[index + 2]

      expect(z).toBeGreaterThanOrEqual(minimum)
      expect(z).toBeLessThanOrEqual(maximum)
      expect(y).toBeCloseTo(terrainHeight(x, z), 5)
    }
  })

  it.each<[
    GrassLayerKind,
    readonly [near: number, far: number],
  ]>([
    ['foreground', [5, -4.5]],
    ['middle', [-3.5, -16]],
    ['horizon', [-14, -34]],
  ])('expands the %s horizontal envelope with depth', (kind, [near, far]) => {
    const layout = createGrassLayerLayout(4_096, kind, 91)
    let nearEnvelope = 0
    let farEnvelope = 0

    for (let index = 0; index < layout.offsets.length; index += 3) {
      const x = Math.abs(layout.offsets[index])
      const z = layout.offsets[index + 2]
      const depthProgress = (near - z) / (near - far)

      if (depthProgress < 0.2) nearEnvelope = Math.max(nearEnvelope, x)
      if (depthProgress > 0.8) farEnvelope = Math.max(farEnvelope, x)
    }

    expect(farEnvelope).toBeGreaterThan(nearEnvelope * 1.5)
  })
})
