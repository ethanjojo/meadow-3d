import { describe, expect, it } from 'vitest'
import {
  getCelestialState,
  getShootingStarState,
  projectShootingStarTrail,
} from '../../src/core/celestial'

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

  it('projects shooting-star trails into the visible sky volume', () => {
    const state = getShootingStarState(96.08, 731, 1, 1)
    const trail = projectShootingStarTrail(state, false)

    expect(state.active).toBe(true)
    expect(trail.head[1]).toBeGreaterThan(5)
    expect(trail.head[2]).toBeLessThan(-20)
    expect(trail.tail[0]).not.toBeCloseTo(trail.head[0])
    expect(trail.tail[1]).toBeGreaterThan(5)
  })

  it('shares one 45-to-120-second event timeline across the production pool', () => {
    const starts: Array<{ slot: number; time: number }> = []
    const previousActive = [false, false, false]
    let maximumConcurrent = 0

    for (let tick = 0; tick <= 36_000; tick += 1) {
      const elapsed = tick / 10
      let concurrent = 0
      for (let slot = 0; slot < 3; slot += 1) {
        const active = getShootingStarState(elapsed, 731, slot, 1).active
        if (active) {
          concurrent += 1
          if (!previousActive[slot]) starts.push({ slot, time: elapsed })
        }
        previousActive[slot] = active
      }
      maximumConcurrent = Math.max(maximumConcurrent, concurrent)
    }

    const gaps = starts.slice(1).map((event, index) => event.time - starts[index].time)
    expect(maximumConcurrent).toBe(1)
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(44.8)
    expect(Math.max(...gaps)).toBeLessThanOrEqual(120.2)
    expect(new Set(starts.map((event) => event.slot))).toEqual(new Set([0, 1, 2]))
  })
})
