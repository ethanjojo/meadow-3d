import { describe, expect, it } from 'vitest'
import { DEFAULT_CLOCK, sampleNatureClock } from '../../src/core/natureClock'
import {
  blendSeasonAppearance,
  getSeasonAppearance,
} from '../../src/core/season'

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

  it('updates reusable appearance storage without replacing its colors', () => {
    const output = getSeasonAppearance(sampleNatureClock(0))
    const grassColor = output.grassColor

    expect(
      getSeasonAppearance(
        sampleNatureClock(DEFAULT_CLOCK.seasonDuration * 3),
        output,
      ),
    ).toBe(output)
    expect(output.grassColor).toBe(grassColor)
    expect(output.snowCoverage).toBeCloseTo(0.78)
  })

  it('blends complete seasonal appearances into caller-owned storage', () => {
    const spring = getSeasonAppearance(sampleNatureClock(0))
    const winter = getSeasonAppearance(
      sampleNatureClock(DEFAULT_CLOCK.seasonDuration * 3),
    )
    const output = getSeasonAppearance(sampleNatureClock(0))
    const expectedGrass = spring.grassColor.clone().lerp(winter.grassColor, 0.5)

    expect(blendSeasonAppearance(spring, winter, 0.5, output)).toBe(output)
    expect(output.grassColor.getHex()).toBe(expectedGrass.getHex())
    expect(output.snowCoverage).toBeCloseTo(
      (spring.snowCoverage + winter.snowCoverage) / 2,
    )
    expect(output.rainBias).toBeCloseTo((spring.rainBias + winter.rainBias) / 2)
  })
})
