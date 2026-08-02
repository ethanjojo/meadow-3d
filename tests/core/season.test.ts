import { describe, expect, it } from 'vitest'
import { DEFAULT_CLOCK, sampleNatureClock } from '../../src/core/natureClock'
import { getSeasonAppearance } from '../../src/core/season'

describe('getSeasonAppearance', () => {
  it('blends summer grass continuously toward autumn', () => {
    const snapshot = sampleNatureClock(DEFAULT_CLOCK.seasonDuration * 1.5)
    const appearance = getSeasonAppearance(snapshot)

    expect(appearance.dryness).toBeCloseTo(0.485)
    expect(appearance.grassColor.getHexString()).toBe('6e7131')
  })

  it('wraps winter to spring with normalized surface effects', () => {
    const snapshot = sampleNatureClock(DEFAULT_CLOCK.seasonDuration * 3.99)
    const appearance = getSeasonAppearance(snapshot)

    expect(appearance.snowCoverage).toBeGreaterThanOrEqual(0)
    expect(appearance.snowCoverage).toBeLessThanOrEqual(1)
    expect(appearance.frost).toBeGreaterThanOrEqual(0)
    expect(appearance.frost).toBeLessThanOrEqual(1)
  })

  it('does not mutate colors returned by an earlier sample', () => {
    const spring = getSeasonAppearance(sampleNatureClock(0))
    const original = spring.grassColor.getHex()

    getSeasonAppearance(sampleNatureClock(DEFAULT_CLOCK.seasonDuration * 2))

    expect(spring.grassColor.getHex()).toBe(original)
  })
})
