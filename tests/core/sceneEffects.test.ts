import { describe, expect, it } from 'vitest'
import { getStormEvent, sampleGust, advanceSnowCover } from '../../src/core/sceneEffects'

describe('coherent scenery effects', () => {
  it('uses reproducible irregular storm gaps and delayed distance-dependent thunder', () => {
    const events = Array.from({ length: 20 }, (_, id) => getStormEvent(id * 42 + 25))
    const gaps = events.slice(1).map((event, i) => event.start - events[i].start)
    expect(new Set(gaps.map(gap => gap.toFixed(1))).size).toBeGreaterThan(12)
    for (const event of events) {
      expect(event.thunderAt - event.start).toBeGreaterThanOrEqual(.9)
      expect(event.thunderAt - event.start).toBeLessThanOrEqual(3)
      expect(getStormEvent(event.start).id).toBe(event.id)
      expect(getStormEvent(event.start + .05).flash).toBeGreaterThan(0)
    }
    expect(new Set(events.map(event => event.kind))).toEqual(new Set(['ground', 'cloud']))
  })
  it('has quiet intervals around short lightning flashes', () => {
    const event = getStormEvent(25)
    expect(getStormEvent(event.start - 1).flash).toBe(0)
    expect(getStormEvent(event.start + 1).flash).toBe(0)
    expect(getStormEvent(NaN).start).toBe(getStormEvent(0).start)
  })
  it('keeps gusts bounded and continuous for audio, vegetation and precipitation', () => {
    for (let time = 0; time < 200; time += .25) {
      const gust = sampleGust(time)
      expect(gust).toBeGreaterThanOrEqual(.65)
      expect(gust).toBeLessThanOrEqual(1.25)
      expect(Math.abs(gust - sampleGust(time + .01))).toBeLessThan(.01)
    }
  })
  it('accumulates snow gradually and melts it without snapping on weather changes', () => {
    expect(advanceSnowCover(0, 1, 1)).toBeGreaterThan(0)
    expect(advanceSnowCover(0, 1, 1)).toBeLessThan(.05)
    expect(advanceSnowCover(.8, 0, 1)).toBeLessThan(.8)
    expect(advanceSnowCover(.8, 0, 1)).toBeGreaterThan(.75)
    expect(advanceSnowCover(.8, 0, 0)).toBe(.8)
  })
  it('finishes manual season changes at the exact snow target without historical winter residue', () => {
    expect(advanceSnowCover(.78, 0, .016, { from: .78, progress: .5 })).toBeCloseTo(.39)
    expect(advanceSnowCover(.4, 0, .016, { from: .78, progress: 1 })).toBe(0)
    expect(advanceSnowCover(.4, .85, .016, { from: .4, progress: .5 })).toBeCloseTo(.625)
    const retargeted = advanceSnowCover(.39, 0, .016, { from: .39, progress: 0 })
    expect(retargeted).toBe(.39)
  })
})
