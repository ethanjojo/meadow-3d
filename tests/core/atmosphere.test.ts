import { describe, expect, it } from 'vitest'
import { DEFAULT_CLOCK, sampleNatureClock } from '../../src/core/natureClock'
import { getSeasonAppearance } from '../../src/core/season'
import { getAtmosphere } from '../../src/core/atmosphere'

function sampleAtDayPhase(dayPhase: number) {
  const snapshot = sampleNatureClock(DEFAULT_CLOCK.dayDuration * dayPhase)
  return getAtmosphere(snapshot, getSeasonAppearance(snapshot))
}

describe('getAtmosphere', () => {
  it('places the sun highest at noon and reveals stars at midnight', () => {
    const midnight = sampleAtDayPhase(0)
    const dawn = sampleAtDayPhase(0.25)
    const noon = sampleAtDayPhase(0.5)
    const dusk = sampleAtDayPhase(0.75)

    expect(noon.sunElevation).toBeGreaterThan(dawn.sunElevation)
    expect(noon.sunElevation).toBeGreaterThan(dusk.sunElevation)
    expect(midnight.starOpacity).toBeGreaterThan(0.8)
    expect(noon.starOpacity).toBeLessThan(0.05)
  })

  it('keeps exposure and fog within render-safe ranges', () => {
    for (const dayPhase of [0, 0.25, 0.5, 0.75]) {
      const atmosphere = sampleAtDayPhase(dayPhase)
      expect(atmosphere.fogDensity).toBeGreaterThanOrEqual(0.002)
      expect(atmosphere.fogDensity).toBeLessThanOrEqual(0.04)
      expect(atmosphere.exposure).toBeGreaterThanOrEqual(0.55)
      expect(atmosphere.exposure).toBeLessThanOrEqual(1.15)
    }
  })
})
