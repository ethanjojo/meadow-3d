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
  it('normalizes independent schedules, group levels and voice budgets without sharing defaults', () => {
    const parsed = parseAudioSettings({ groups: { farm: .2, weather: -3 }, calls: { cat: { enabled: false, activity: 'custom', startHour: 22, endHour: 5, minInterval: 90, maxInterval: 20, pan: 'left', distance: 'near' }, cow: { activity: 'broken', startHour: NaN } }, maxConcurrent: 20, minimumGap: -1, variation: Infinity, thunderDistance: .1 })
    expect(parsed.groups).toEqual({ farm: .2, weather: 0, birds: 1 })
    expect(parsed.calls.cat).toMatchObject({ enabled: false, activity: 'custom', startHour: 22, endHour: 5, minInterval: 90, maxInterval: 90, pan: 'left', distance: 'near' })
    expect(parsed.calls.cow).toEqual(DEFAULT_AUDIO_SETTINGS.calls.cow)
    expect(parsed.maxConcurrent).toBe(4)
    expect(parsed.minimumGap).toBe(0)
    expect(parsed.variation).toBe(DEFAULT_AUDIO_SETTINGS.variation)
    expect(parsed.thunderDistance).toBe(1.2)
    parsed.calls.cow.enabled = false
    expect(DEFAULT_AUDIO_SETTINGS.calls.cow.enabled).toBe(true)
    expect(parseAudioSettings({ calls: { cow: { startHour: 24, endHour: 24 } } }).calls.cow).toMatchObject({ startHour: 0, endHour: 0 })
  })
})
