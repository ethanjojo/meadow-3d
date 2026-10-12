import { describe, expect, it } from 'vitest'
import { DEFAULT_AUDIO_SETTINGS, parseAudioSettings } from '../../src/core/audioSettings'

describe('audio settings', () => {
  it('clamps stored levels and defaults missing or malformed channels', () => {
    const parsed = parseAudioSettings({ master: 2, channels: { cow: -1, rain: 0.4, wind: 'bad', dog: Infinity } })
    expect(parsed.master).toBe(1)
    expect(parsed.channels.cow).toBe(0)
    expect(parsed.channels.rain).toBe(0.4)
    expect(parsed.channels.wind).toBe(1)
    expect(parsed.channels.dog).toBe(1)
    expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS)
  })
})
