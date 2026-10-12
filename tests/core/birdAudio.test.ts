import { describe, expect, it } from 'vitest'
import { deriveBirdActivity, birdPause } from '../../src/audio/birdAudio'
import { chooseRecording } from '../../src/audio/recordedAmbience'

describe('natural bird activity', () => {
  it('is strongest in the morning, calmer at noon, silent at night and reduced in rain', () => {
    const morning = deriveBirdActivity(0.32, 0, 0)
    expect(morning).toBeGreaterThan(deriveBirdActivity(0.5, 0, 0))
    expect(deriveBirdActivity(0, 0, 0)).toBe(0)
    expect(deriveBirdActivity(0.9, 0, 0)).toBe(0)
    expect(deriveBirdActivity(0.32, 1, 1)).toBeLessThan(morning * 0.2)
  })
  it('mixes brief response gaps with longer quiet pauses instead of fixed intervals', () => {
    expect(birdPause(1, true, () => 0)).toBe(1_200)
    expect(birdPause(1, false, () => 0)).toBe(12_000)
    expect(birdPause(1, false, () => 1)).toBe(40_000)
    expect(birdPause(0.3, false, () => 0)).toBeGreaterThan(birdPause(1, false, () => 0))
  })
  it('never picks the same recording twice in a row when alternatives are available', () => {
    expect(chooseRecording(['blackbird', 'tit', 'sparrow'].map(id => ({ id })), 'blackbird', () => 0).id).toBe('tit')
  })
})
