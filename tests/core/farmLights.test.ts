import { describe, expect, it } from 'vitest'
import { getFarmWindowLight } from '../../src/core/farm'

describe('evening farm windows', () => {
  const at = (hour: number, index = 0) => getFarmWindowLight(hour / 24, index)
  it('lights only in the early evening, using the selected scene time', () => {
    for (const hour of [0, 6, 12, 18, 21, 23.9]) expect(at(hour)).toBe(0)
    for (const index of [0, 1, 2]) expect(at(19.5, index)).toBe(1)
    expect(getFarmWindowLight(1)).toBe(0)
    expect(getFarmWindowLight(NaN)).toBe(0)
  })
  it('fades at both ends and staggers windows without random flicker', () => {
    expect(at(18.55)).toBeGreaterThan(0)
    expect(at(18.55)).toBeLessThan(1)
    expect(at(18.55, 2)).toBe(0)
    expect(at(20.95)).toBeGreaterThan(0)
    expect(at(20.95)).toBeLessThan(1)
    expect(at(20.95, 2)).toBe(0)
    expect(at(19.5, 1)).toBe(at(19.5, 1))
  })
})
