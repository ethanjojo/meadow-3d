import { describe, expect, it } from 'vitest'
import { DEFAULT_CLOCK, sampleNatureClock } from '../../src/core/natureClock'

describe('sampleNatureClock', () => {
  it('wraps daily and seasonal phases without discontinuity', () => {
    expect(sampleNatureClock(0, DEFAULT_CLOCK).dayPhase).toBeCloseTo(0)
    expect(
      sampleNatureClock(DEFAULT_CLOCK.dayDuration, DEFAULT_CLOCK).dayPhase,
    ).toBeCloseTo(0)
    expect(
      sampleNatureClock(DEFAULT_CLOCK.seasonDuration * 4, DEFAULT_CLOCK)
        .seasonPhase,
    ).toBeCloseTo(0)
  })

  it('reports adjacent seasons and a normalized blend', () => {
    const sample = sampleNatureClock(
      DEFAULT_CLOCK.seasonDuration * 1.25,
      DEFAULT_CLOCK,
    )

    expect(sample.seasonIndex).toBe(1)
    expect(sample.nextSeasonIndex).toBe(2)
    expect(sample.seasonBlend).toBeCloseTo(0.15625)
  })

  it('keeps weather and wind in bounded ranges', () => {
    for (let second = 0; second < 1000; second += 7) {
      const sample = sampleNatureClock(second, DEFAULT_CLOCK)
      expect(sample.windStrength).toBeGreaterThanOrEqual(0)
      expect(sample.windStrength).toBeLessThanOrEqual(1)
      expect(sample.weatherIntensity).toBeGreaterThanOrEqual(0)
      expect(sample.weatherIntensity).toBeLessThanOrEqual(1)
    }
  })

  it('clamps negative elapsed time to the beginning', () => {
    expect(sampleNatureClock(-12, DEFAULT_CLOCK).elapsed).toBe(0)
  })
})
