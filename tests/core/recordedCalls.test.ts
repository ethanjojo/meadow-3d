import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRecordedCalls, recordingActivity, recordingVoice } from '../../src/audio/recordedCalls'
import { DEFAULT_AUDIO_SETTINGS, parseAudioSettings } from '../../src/core/audioSettings'
import { createEnvironmentSnapshot } from '../../src/core/simulation'
import { isWithinHours } from '../../src/core/timeWindow'
import { sampleNatureClock } from '../../src/core/natureClock'

const player = vi.hoisted(() => ({ prepare: vi.fn(async () => {}), trigger: vi.fn(async (_id: string, _settings: unknown, _isCurrent: () => boolean, _onEnded: () => void) => vi.fn()), setChannelVolumes: vi.fn((_levels: Record<string, number>) => {}), suspend: vi.fn(), dispose: vi.fn(), preview: vi.fn() }))
vi.mock('../../src/audio/recordedAmbience', () => ({ createRecordedAmbience: () => player }))
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); vi.restoreAllMocks() })
const daytime = () => createEnvironmentSnapshot(sampleNatureClock(0), { mode: 'manual', dayPhase: .5, seasonIndex: 1, weather: 'clear' })

function setup() {
  vi.useFakeTimers()
  const settings = parseAudioSettings(DEFAULT_AUDIO_SETTINGS)
  for (const call of Object.values(settings.calls)) { call.activity = 'always'; call.minInterval = 2; call.maxInterval = 2; call.enabled = false }
  settings.calls.cow.enabled = true
  settings.calls.cat.enabled = true
  settings.maxConcurrent = 1
  settings.minimumGap = 0
  const controller = createRecordedCalls({ state: 'running' } as AudioContext, {} as AudioNode, settings)
  controller.setNature(daytime())
  return { settings, controller }
}

describe('recording schedules', () => {
  it('supports overnight and full-day active intervals', () => {
    expect(isWithinHours(23 / 24, 20, 6)).toBe(true)
    expect(isWithinHours(5 / 24, 20, 6)).toBe(true)
    expect(isWithinHours(12 / 24, 20, 6)).toBe(false)
    expect(isWithinHours(6 / 24, 20, 6)).toBe(false)
    expect(isWithinHours(12 / 24, 6, 6)).toBe(true)
  })
  it('allows explicit night birds and separately respects severe weather', () => {
    const snapshot = daytime(); snapshot.dayPhase = 0
    const setting = { ...DEFAULT_AUDIO_SETTINGS.calls.blackbird }
    expect(recordingActivity('blackbird', setting, snapshot)).toBe(0)
    setting.activity = 'always'
    expect(recordingActivity('blackbird', setting, snapshot)).toBe(1)
    snapshot.weather.storm = 1
    expect(recordingActivity('blackbird', setting, snapshot)).toBeCloseTo(.2)
    setting.respectWeather = false
    expect(recordingActivity('blackbird', setting, snapshot)).toBe(1)
  })
  it('attenuates and filters far calls and honors fixed stereo placement', () => {
    const setting = { ...DEFAULT_AUDIO_SETTINGS.calls.cow, pan: 'left' as const }
    const far = recordingVoice(setting, 0, () => .5)
    const near = recordingVoice({ ...setting, distance: 'near' }, 0, () => .5)
    expect(far.volume).toBeLessThan(near.volume)
    expect(far.cutoff).toBeLessThan(near.cutoff)
    expect(far.pan).toBe(-.7)
  })
  it('reserves concurrency before async playback and releases it on voice completion', async () => {
    const { controller } = setup()
    await controller.start()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(player.trigger).toHaveBeenCalledOnce()
    const ended = player.trigger.mock.calls[0][3] as () => void
    ended()
    await vi.advanceTimersByTimeAsync(250)
    expect(player.trigger).toHaveBeenCalledTimes(2)
    expect(player.trigger.mock.calls.map(call => call[0])).toEqual(['cow', 'cat'])
    controller.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('applies global spacing even when several recordings are due', async () => {
    const { controller, settings } = setup()
    settings.maxConcurrent = 4; settings.minimumGap = 3
    controller.setSettings(settings)
    await controller.start()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(player.trigger).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(2_750)
    expect(player.trigger).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(250)
    expect(player.trigger).toHaveBeenCalledTimes(2)
    controller.dispose()
  })
  it('cancels active calls immediately on group mute and reschedules changed intervals', async () => {
    const { controller, settings } = setup()
    await controller.start()
    await vi.advanceTimersByTimeAsync(2_000)
    const stop = await player.trigger.mock.results[0].value
    const muted = structuredClone(settings); muted.groups.farm = 0
    controller.setSettings(muted)
    expect(stop).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(player.trigger).toHaveBeenCalledOnce()
    muted.groups.farm = 1; muted.calls.cow.minInterval = 10; muted.calls.cow.maxInterval = 10; muted.calls.cat.enabled = false
    controller.setSettings(muted)
    await vi.advanceTimersByTimeAsync(9_750)
    expect(player.trigger).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(250)
    expect(player.trigger).toHaveBeenCalledTimes(2)
    controller.dispose()
  })
  it('cannot restart timers when mute interrupts recording loading', async () => {
    const { controller } = setup()
    let finish!: () => void
    player.prepare.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const pending = controller.start()
    controller.suspend()
    finish(); await pending
    expect(vi.getTimerCount()).toBe(0)
    controller.dispose()
  })
  it('schedules no idle timer until an eligible call is enabled', async () => {
    const { controller, settings } = setup()
    const disabled = structuredClone(settings)
    disabled.calls.cow.enabled = false; disabled.calls.cat.enabled = false
    controller.setSettings(disabled)
    await controller.start()
    expect(vi.getTimerCount()).toBe(0)
    const enabled = structuredClone(disabled); enabled.calls.cow.enabled = true
    controller.setSettings(enabled)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(player.trigger).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0) // Voice completion wakes the next schedule.
    controller.dispose()
  })
  it('keeps configured pauses in real seconds even for naturally quiet night animals', async () => {
    const { controller, settings } = setup()
    vi.spyOn(Math, 'random').mockReturnValue(.5)
    const night = daytime(); night.dayPhase = 0
    const natural = structuredClone(settings)
    natural.calls.cat.enabled = false
    natural.calls.cow.activity = 'natural'; natural.calls.cow.minInterval = 5; natural.calls.cow.maxInterval = 7
    controller.setSettings(natural); controller.setNature(night)
    await controller.start()
    await vi.advanceTimersByTimeAsync(5_999)
    expect(player.trigger).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(player.trigger).toHaveBeenCalledOnce()
    controller.dispose()
  })
  it('updates live weather attenuation without double-applying group or channel volumes', () => {
    const { controller, settings } = setup()
    const levels = structuredClone(settings)
    levels.groups.farm = .5; levels.channels.cow = .4; levels.calls.cat.respectWeather = false
    controller.setSettings(levels)
    const storm = daytime(); storm.weather.storm = 1
    controller.setNature(storm)
    const mix = player.setChannelVolumes.mock.calls.at(-1)![0] as Record<string, number>
    expect(mix.cow).toBeCloseTo(.5 * .4 * .2)
    expect(mix.cat).toBe(.5)
    controller.dispose()
  })
})
