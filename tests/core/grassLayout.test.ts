import { describe, expect, it } from 'vitest'
import {
  GRASS_LAYER_PROFILES,
  createGrassLayerLayout,
  createGrassLayout,
  getGrassBendLimit,
  getGrassClearance,
  getGrassLayerBudgets,
  getGrassRootInfluence,
  terrainHeight,
  type GrassLayerKind,
} from '../../src/core/grassLayout'
import { grassVertexShader } from '../../src/scene/grassShaders'

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
  it('uses the exact physical ranges for every depth layer', () => {
    expect(GRASS_LAYER_PROFILES).toEqual({
      foreground: {
        scale: [0.85, 1.55],
        lean: [-0.12, 0.12],
        stiffness: [0.45, 0.92],
      },
      middle: {
        scale: [0.68, 1.3],
        lean: [-0.16, 0.16],
        stiffness: [0.32, 0.88],
      },
      horizon: {
        scale: [0.48, 0.9],
        lean: [-0.14, 0.14],
        stiffness: [0.38, 0.92],
      },
    })
  })

  it.each<GrassLayerKind>(['foreground', 'middle', 'horizon'])(
    'keeps %s scale, lean, and stiffness inside its profile',
    (kind) => {
      const layout = createGrassLayerLayout(4_096, kind, 23)
      const profile = GRASS_LAYER_PROFILES[kind]

      for (const scale of layout.scales) {
        expect(scale).toBeGreaterThanOrEqual(profile.scale[0])
        expect(scale).toBeLessThanOrEqual(profile.scale[1])
      }
      for (const lean of layout.leans) {
        expect(lean).toBeGreaterThanOrEqual(profile.lean[0])
        expect(lean).toBeLessThanOrEqual(profile.lean[1])
      }
      for (const stiffness of layout.stiffness) {
        expect(stiffness).toBeGreaterThanOrEqual(profile.stiffness[0])
        expect(stiffness).toBeLessThanOrEqual(profile.stiffness[1])
      }
    },
  )

  it('correlates taller foreground blades with greater stiffness', () => {
    const layout = createGrassLayerLayout(4_096, 'foreground', 81)
    const scales = Array.from(layout.scales)
    const stiffness = Array.from(layout.stiffness)
    const meanScale = scales.reduce((sum, value) => sum + value, 0) / scales.length
    const meanStiffness =
      stiffness.reduce((sum, value) => sum + value, 0) / stiffness.length
    let covariance = 0
    let scaleVariance = 0
    let stiffnessVariance = 0

    for (let index = 0; index < scales.length; index += 1) {
      const scaleDelta = scales[index] - meanScale
      const stiffnessDelta = stiffness[index] - meanStiffness
      covariance += scaleDelta * stiffnessDelta
      scaleVariance += scaleDelta ** 2
      stiffnessVariance += stiffnessDelta ** 2
    }
    const correlation =
      covariance / Math.sqrt(scaleVariance * stiffnessVariance)

    expect(correlation).toBeGreaterThan(0.25)
  })

  it('locks blade roots and caps calm, storm, and reduced-motion bend', () => {
    expect(getGrassRootInfluence(0)).toBe(0)
    expect(getGrassRootInfluence(0.35)).toBeLessThan(0.02)
    expect(getGrassRootInfluence(1)).toBe(1)
    expect(getGrassBendLimit(0, false)).toBeCloseTo((18 * Math.PI) / 180)
    expect(getGrassBendLimit(1, false)).toBeCloseTo((32 * Math.PI) / 180)
    expect(getGrassBendLimit(1, true)).toBeLessThan(
      getGrassBendLimit(1, false),
    )
  })

  it('suppresses blade height, lean, and wind near the camera', () => {
    const close = getGrassClearance(1)
    const clear = getGrassClearance(9)

    expect(close.height * close.lean * close.wind).toBeLessThan(
      clear.height * clear.lean * clear.wind,
    )
  })

  it('uses root-locked bounded curvature without scale-multiplied bend', () => {
    expect(grassVertexShader).toContain('uniform float uBendLimit')
    expect(grassVertexShader).toContain(
      'pow(smoothstep(0.38, 1.0, heightRatio), 2.0)',
    )
    expect(grassVertexShader).toContain(
      'clamp(waveSignal * flexibility, -uBendLimit, uBendLimit)',
    )
    expect(grassVertexShader).not.toMatch(
      /instanceLean\s*\*[^;]*instanceScale/,
    )
    expect(grassVertexShader).not.toMatch(
      /windDirection\s*\*[^;]*instanceScale/,
    )
  })

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
