import { describe, expect, it } from 'vitest'
import { getCelestialState, getShootingStarState } from '../../src/core/celestial'

describe('celestial state', () => {
  it('places moon opposite the sun and hides bodies below the horizon', () => {
    const noon = getCelestialState(0.5)
    const midnight = getCelestialState(0)

    expect(noon.sun.visibility).toBeGreaterThan(0.9)
    expect(noon.moon.visibility).toBeLessThan(0.05)
    expect(midnight.moon.visibility).toBeGreaterThan(0.9)
    expect(noon.moon.direction).toEqual(noon.sun.direction.map((value) => -value))
  })

  it('schedules rare repeatable shooting stars', () => {
    const first = getShootingStarState(420, 731, 0, 1)
    const second = getShootingStarState(420, 731, 0, 1)

    expect(second).toEqual(first)
    expect(first.progress).toBeGreaterThanOrEqual(0)
    expect(first.progress).toBeLessThanOrEqual(1)
    expect(getShootingStarState(420, 731, 0, 0).brightness).toBe(0)
  })
})
