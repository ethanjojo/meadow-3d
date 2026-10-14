import { describe, expect, it } from 'vitest'
import { deriveBirdActivity } from '../../src/audio/birdAudio'

describe('natural bird activity', () => {
  it('is strongest in the morning, calmer at noon, silent at night and reduced in rain', () => {
    const morning = deriveBirdActivity(0.32, 0, 0)
    expect(morning).toBeGreaterThan(deriveBirdActivity(0.5, 0, 0))
    expect(deriveBirdActivity(0, 0, 0)).toBe(0)
    expect(deriveBirdActivity(0.9, 0, 0)).toBe(0)
    expect(deriveBirdActivity(0.32, 1, 1)).toBeLessThan(morning * 0.2)
  })
})
