import { describe, expect, it } from 'vitest'
import { blendAtmosphere, getAtmosphere, getCloudSunWeight } from '../../src/core/atmosphere'
import { sampleNatureClock } from '../../src/core/natureClock'
import { createEnvironmentSnapshot } from '../../src/core/simulation'
import { getSeasonAppearance } from '../../src/core/season'

describe('cloud lighting handover', () => {
  it('takes a continuous lighting arc even between opposite noon and midnight directions', () => {
    const make = (phase: number) => {
      const snapshot = createEnvironmentSnapshot(sampleNatureClock(0), { mode: 'manual', dayPhase: phase, seasonIndex: 1, weather: 'clear' })
      return getAtmosphere(snapshot, getSeasonAppearance(snapshot))
    }
    const source = make(.5), target = make(0)
    const before = blendAtmosphere(source, target, .499, make(0)).celestial.sun.direction
    const after = blendAtmosphere(source, target, .501, make(0)).celestial.sun.direction
    expect(Math.hypot(...before)).toBeCloseTo(1)
    expect(Math.hypot(...after)).toBeCloseTo(1)
    expect(Math.hypot(...before.map((value, index) => value - after[index]))).toBeLessThan(.05)
  })
  it('fades through twilight in both directions instead of switching light sources', () => {
    expect(getCloudSunWeight(1)).toBe(1)
    expect(getCloudSunWeight(-1)).toBe(0)
    expect(getCloudSunWeight(-.03)).toBeCloseTo(.5)
    expect(Math.abs(getCloudSunWeight(-.0301) - getCloudSunWeight(-.0299))).toBeLessThan(.002)
    const elevations = [-.18, -.12, -.06, 0, .06, .12]
    const weights = elevations.map(getCloudSunWeight)
    expect(weights).toEqual([...weights].sort((a, b) => a - b))
    expect([...elevations].reverse().map(getCloudSunWeight)).toEqual([...weights].reverse())
  })
})
