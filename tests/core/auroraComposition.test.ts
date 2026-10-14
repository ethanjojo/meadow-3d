import { describe, expect, it } from 'vitest'
import { advanceAuroraComposition, createAuroraCompositionState, getAuroraComposition } from '../../src/core/auroraComposition'

describe('aurora compositions', () => {
  it('varies occurrences reproducibly within separated curtain bounds', () => {
    const samples = Array.from({ length: 100 }, (_, index) => getAuroraComposition(42, index))
    expect(getAuroraComposition(42, 3)).toEqual(samples[3])
    expect(new Set(samples.map(value => JSON.stringify(value))).size).toBe(100)
    expect(new Set(samples.map(value => value.styles.filter(style => style[3] === 1).length))).toEqual(new Set([1, 2, 3]))
    expect(samples.some(value => value.layout[0] < -.3)).toBe(true)
    expect(samples.some(value => value.layout[0] > .3)).toBe(true)
    for (const { layout, curtains } of samples) {
      expect(Math.abs(layout[0])).toBeLessThanOrEqual(.45)
      expect(Math.abs(layout[1])).toBeLessThanOrEqual(.7)
      // Worst-case independent bends/twists and tilts still leave a gap
      // between neighbouring creases throughout the visible sheet height.
      for (let index = 1; index < curtains.length; index++) {
        const left = curtains[index - 1], right = curtains[index]
        const maxBend = left[3] + right[3] + .066 + Math.abs(left[1] - right[1]) * .89
        expect(right[0] - left[0]).toBeGreaterThan(maxBend)
      }
    }
  })
  it('keeps one composition per event and picks a new one after a quiet gap', () => {
    const state = createAuroraCompositionState(7)
    advanceAuroraComposition(state, true, 0, 0, 1)
    const first = state.target
    for (let frame = 0; frame < 100; frame++) advanceAuroraComposition(state, true, 0, .5, 1 / 60)
    expect(state.occurrence).toBe(1)
    expect(state.target).toEqual(first)
    advanceAuroraComposition(state, false, 0, 0, 1)
    advanceAuroraComposition(state, true, 0, 0, 1)
    expect(state.occurrence).toBe(2)
    expect(state.current).toEqual(state.target)
    expect(state.target).not.toEqual(first)
  })
  it('selects each new preview once and morphs without a visible jump', () => {
    const state = createAuroraCompositionState(9)
    const before = state.current
    advanceAuroraComposition(state, true, 1000, .5, 0)
    expect(state.current).toEqual(before)
    expect(state.target).not.toEqual(before)
    advanceAuroraComposition(state, true, 1000, .5, 1)
    expect(state.occurrence).toBe(1)
    expect(state.current).not.toEqual(before)
    expect(state.current).not.toEqual(state.target)
    advanceAuroraComposition(state, false, 0, .4, 1)
    advanceAuroraComposition(state, true, 2000, .4, 1)
    expect(state.occurrence).toBe(2)
    advanceAuroraComposition(state, true, 0, .4, 1)
    expect(state.occurrence).toBe(2)
  })
})
