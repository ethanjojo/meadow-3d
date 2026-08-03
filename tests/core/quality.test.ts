import { describe, expect, it } from 'vitest'
import {
  evaluateQuality,
  QUALITY_PROFILES,
  selectInitialQuality,
} from '../../src/core/quality'

describe('quality selection', () => {
  it('starts reduced-motion and low-core devices conservatively', () => {
    expect(
      selectInitialQuality({
        logicalCores: 2,
        devicePixelRatio: 3,
        reducedMotion: true,
      }),
    ).toBe('low')
  })

  it('allows a modern desktop to start high', () => {
    expect(
      selectInitialQuality({
        logicalCores: 10,
        devicePixelRatio: 2,
        reducedMotion: false,
      }),
    ).toBe('high')
  })

  it('drops exactly one tier after sustained low frame rate', () => {
    expect(evaluateQuality('high', Array(120).fill(41))).toBe('medium')
    expect(evaluateQuality('medium', Array(120).fill(24))).toBe('low')
  })

  it('does not oscillate on a short frame-rate dip', () => {
    expect(evaluateQuality('high', [60, 60, 34, 58, 60])).toBe('high')
  })

  it('upgrades only after a long stable sample', () => {
    expect(evaluateQuality('medium', Array(299).fill(60))).toBe('medium')
    expect(evaluateQuality('medium', Array(300).fill(60))).toBe('high')
  })

  it('keeps the low tier materially cheaper than high', () => {
    expect(QUALITY_PROFILES.low.grassBlades).toBeLessThanOrEqual(8_000)
    expect(QUALITY_PROFILES.low.grassBlades).toBeLessThan(
      QUALITY_PROFILES.high.grassBlades,
    )
    expect(QUALITY_PROFILES.low.maxDpr).toBeLessThan(
      QUALITY_PROFILES.high.maxDpr,
    )
  })

  it('scales explicit atmospheric budgets with the quality tier', () => {
    expect(QUALITY_PROFILES.low).toMatchObject({
      cloudLayers: 1,
      starCount: 700,
      shootingStarPool: 1,
    })
    expect(QUALITY_PROFILES.medium).toMatchObject({
      cloudLayers: 2,
      starCount: 1_300,
      shootingStarPool: 2,
    })
    expect(QUALITY_PROFILES.high).toMatchObject({
      cloudLayers: 3,
      starCount: 2_000,
      shootingStarPool: 3,
    })
  })

  it('limits detailed grass maps and transmission by quality tier', () => {
    expect(QUALITY_PROFILES.high).toMatchObject({
      grassAtlas: true,
      grassTransmission: true,
    })
    expect(QUALITY_PROFILES.medium).toMatchObject({
      grassAtlas: true,
      grassTransmission: false,
    })
    expect(QUALITY_PROFILES.low).toMatchObject({
      grassAtlas: false,
      grassTransmission: false,
    })
  })

  it('applies the exact restrained postprocessing policy', () => {
    expect(QUALITY_PROFILES.high).toMatchObject({
      postprocessing: true,
      bloomStrength: 0.22,
      bloomResolutionScale: 1,
      vignetteStrength: 0.055,
      grassAtlas: true,
    })
    expect(QUALITY_PROFILES.medium).toMatchObject({
      postprocessing: true,
      bloomStrength: 0.14,
      bloomResolutionScale: 0.6,
      vignetteStrength: 0.045,
    })
    expect(QUALITY_PROFILES.low).toMatchObject({
      postprocessing: false,
      bloomStrength: 0,
      bloomResolutionScale: 0,
      vignetteStrength: 0,
      grassAtlas: false,
    })
  })
})
