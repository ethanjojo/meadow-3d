import { describe, expect, it } from 'vitest'
import { getAuroraActivity, getAuroraVisibility, advanceAuroraOpacity } from '../../src/core/aurora'

describe('aurora', () => {
  it('has irregular bounded events with quiet gaps and smooth entrances', () => {
    const samples = Array.from({ length: 7200 }, (_, elapsed) => getAuroraActivity(elapsed, 1))
    expect(Math.max(...samples)).toBeGreaterThan(.5)
    expect(samples.filter(value => value === 0).length).toBeGreaterThan(4000)
    expect(samples.every(value => value >= 0 && value <= 1)).toBe(true)
    expect(Math.max(...samples.slice(1).map((value, index) => Math.abs(value - samples[index])))).toBeLessThan(.1)
    expect(getAuroraActivity(1000, 0)).toBe(0)
  })
  it('follows darkness and season and disappears in storms even when always enabled', () => {
    const input = { mode: 'night' as const, night: 1, seasonPosition: 3, rain: 0, storm: 0, fog: 0, moon: 0, elapsed: 1000, frequency: 1, preview: false }
    expect(getAuroraVisibility(input)).toBeGreaterThan(.5)
    expect(getAuroraVisibility({ ...input, night: 0 })).toBe(0)
    expect(getAuroraVisibility({ ...input, storm: 1 })).toBe(0)
    expect(getAuroraVisibility({ ...input, rain: 1 })).toBe(0)
    expect(getAuroraVisibility({ ...input, moon: 1 })).toBeLessThan(getAuroraVisibility(input))
    expect(getAuroraVisibility({ ...input, mode: 'off' })).toBe(0)
    expect(getAuroraVisibility({ ...input, mode: 'off', preview: true })).toBeGreaterThan(0)
  })
  it('fades settings changes and remains stable when no frame time passes', () => {
    expect(advanceAuroraOpacity(1, 0, 0)).toBe(1)
    expect(advanceAuroraOpacity(0, 1, 1)).toBeLessThan(.15)
    expect(advanceAuroraOpacity(1, 0, 1)).toBeGreaterThan(.85)
  })
  it('favours winter in automatic mode, with a continuous seasonal wrap', () => {
    const elapsed = Array.from({ length: 900 }, (_, index) => index).find(time => getAuroraActivity(time, 1) > .5)!
    const input = { mode: 'auto' as const, night: 1, seasonPosition: 3, rain: 0, storm: 0, fog: 0, moon: 0, elapsed, frequency: 1, preview: false }
    expect(getAuroraVisibility(input)).toBeGreaterThan(getAuroraVisibility({ ...input, seasonPosition: 1 }) * 3)
    expect(getAuroraVisibility({ ...input, seasonPosition: 3.9999 })).toBeCloseTo(getAuroraVisibility({ ...input, seasonPosition: 0 }), 3)
  })
})
