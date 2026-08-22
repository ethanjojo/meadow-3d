import { describe, expect, it } from 'vitest'
import { hashLattice, valueNoise } from '../../src/core/noise'

describe('value noise', () => {
  it('is deterministic for the same coordinates', () => {
    expect(valueNoise(0.37, 0.82, 6)).toBe(valueNoise(0.37, 0.82, 6))
    expect(hashLattice(12, -5)).toBe(hashLattice(12, -5))
  })

  it('stays inside the unit range', () => {
    for (let index = 0; index < 256; index += 1) {
      const u = index * 0.618
      const v = index * 1.317
      const noise = valueNoise(u, v, 4)
      expect(noise).toBeGreaterThanOrEqual(0)
      expect(noise).toBeLessThanOrEqual(1)
      expect(hashLattice(index, index * 3)).toBeLessThanOrEqual(1)
    }
  })

  it('is spatially smooth', () => {
    const base = valueNoise(2.31, 1.17, 8)
    const neighbor = valueNoise(2.3101, 1.1701, 8)
    expect(Math.abs(neighbor - base)).toBeLessThan(0.001)
  })

  it('varies between distant cells', () => {
    let differences = 0
    for (let index = 0; index < 16; index += 1) {
      const first = valueNoise(index * 3.1, index * 1.7, 2)
      const second = valueNoise(index * 3.1 + 11, index * 1.7 + 7, 2)
      if (Math.abs(first - second) > 0.05) differences += 1
    }
    expect(differences).toBeGreaterThan(8)
  })
})
