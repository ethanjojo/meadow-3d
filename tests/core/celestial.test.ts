import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import {
  getCelestialArcPoint,
  getCelestialPresentation,
  getCelestialState,
  getShootingStarState,
  projectShootingStarTrail,
  type ShootingStarState,
} from '../../src/core/celestial'

describe('celestial state', () => {
  it('moves the sun from the left horizon through a central peak to the right', () => {
    const sunrise = getCelestialArcPoint('sun', 0.25, 16 / 9)
    const noon = getCelestialArcPoint('sun', 0.5, 16 / 9)
    const sunset = getCelestialArcPoint('sun', 0.75, 16 / 9)

    expect(sunrise.x).toBeCloseTo(-0.9)
    expect(sunrise.y).toBeLessThan(0.05)
    expect(noon.x).toBeCloseTo(0)
    expect(noon.y).toBeGreaterThan(0.55)
    expect(sunset.x).toBeCloseTo(0.9)
    expect(sunset.y).toBeLessThan(0.05)
  })

  it('keeps the complementary moon arc lower in portrait viewports', () => {
    const landscape = getCelestialArcPoint('moon', 0, 16 / 9)
    const portrait = getCelestialArcPoint('moon', 0, 390 / 844)

    expect(landscape.x).toBeCloseTo(0)
    expect(portrait.x).toBeCloseTo(0)
    expect(portrait.y).toBeLessThan(landscape.y)
    expect(portrait.y).toBeGreaterThan(0.45)
  })

  it('uses a short same-body arc for a four-hour change', () => {
    const sourcePhase = 0.4
    const targetPhase = sourcePhase + 4 / 24
    const source = getCelestialArcPoint('sun', sourcePhase, 16 / 9)
    const target = getCelestialArcPoint('sun', targetPhase, 16 / 9)
    const presentation = getCelestialPresentation(
      sourcePhase,
      targetPhase,
      0.5,
      16 / 9,
      false,
    )

    expect(presentation.sun.opacity).toBeGreaterThan(0.9)
    expect(presentation.moon.opacity).toBe(0)
    expect(presentation.sun.x).toBeGreaterThan(source.x)
    expect(presentation.sun.x).toBeLessThan(target.x)
  })

  it('swaps noon and midnight bodies at opposite horizons', () => {
    const midpoint = getCelestialPresentation(0.5, 0, 0.5, 16 / 9, false)
    const incoming = getCelestialPresentation(0.5, 0, 0.75, 16 / 9, false)

    expect(midpoint.sun.x).toBeCloseTo(0.9)
    expect(midpoint.moon.x).toBeCloseTo(-0.9)
    expect(midpoint.sun.opacity).toBe(0)
    expect(midpoint.moon.opacity).toBe(0)
    expect(incoming.moon.opacity).toBeGreaterThan(0)
    expect(incoming.moon.x).toBeGreaterThan(-0.9)
  })

  it('reduces travel while preserving opacity choreography for reduced motion', () => {
    const source = getCelestialArcPoint('sun', 0.4, 16 / 9)
    const normal = getCelestialPresentation(0.4, 0.55, 0.25, 16 / 9, false)
    const reduced = getCelestialPresentation(0.4, 0.55, 0.25, 16 / 9, true)

    expect(Math.abs(reduced.sun.x - source.x)).toBeLessThan(
      Math.abs(normal.sun.x - source.x),
    )
    expect(reduced.sun.opacity).toBeCloseTo(normal.sun.opacity)
  })

  it('retargets from an exact frozen presentation without a jump', () => {
    const frozen = getCelestialPresentation(0.5, 0, 0.4, 16 / 9, false)
    const output = getCelestialPresentation(0, 0, 1, 16 / 9, false)
    const retargeted = getCelestialPresentation(
      0,
      0.65,
      0,
      16 / 9,
      false,
      output,
      frozen,
    )

    expect(retargeted).toBe(output)
    expect(retargeted.sun).toEqual(frozen.sun)
    expect(retargeted.moon).toEqual(frozen.moon)
  })

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
    expect(Math.abs(trail.head[0])).toBeLessThan(0.9)
    expect(Math.abs(trail.head[1])).toBeLessThan(0.9)
    expect(trail.head[2]).toBeGreaterThan(-1)
    expect(trail.head[2]).toBeLessThan(1)
    expect(trail.tail[0]).not.toBeCloseTo(trail.head[0])
  })

  it.each([
    ['desktop', 1280, 720],
    ['mobile', 390, 844],
  ])('keeps the first 100 scheduled trails inside the %s camera frustum', (
    _name,
    width,
    height,
  ) => {
    const camera = new PerspectiveCamera(46, width / height, 0.1, 180)
    camera.position.set(0, 1.08, 5.4)
    camera.lookAt(0, 0.78, -5)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()

    const states: ShootingStarState[] = []
    let lastWindow = -1
    for (let elapsed = 0; elapsed < 15_000 && states.length < 100; elapsed += 0.1) {
      const window = Math.floor(elapsed / 82.5)
      if (window === lastWindow) continue

      for (let slot = 0; slot < 3; slot += 1) {
        const state = getShootingStarState(elapsed, 731, slot, 1)
        if (state.active && state.progress >= 0.4) {
          states.push(state)
          lastWindow = window
          break
        }
      }
    }

    expect(states).toHaveLength(100)
    for (const state of states) {
      const trail = projectShootingStarTrail(state, false)
      for (const point of [trail.head, trail.tail]) {
        const projected = new Vector3(...point).unproject(camera).project(camera)
        expect(Math.abs(projected.x)).toBeLessThanOrEqual(0.92)
        expect(Math.abs(projected.y)).toBeLessThanOrEqual(0.92)
      }
    }
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
