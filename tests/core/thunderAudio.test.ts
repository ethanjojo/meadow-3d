import { afterEach, describe, expect, it, vi } from 'vitest'
import { createThunderAudio } from '../../src/audio/thunderAudio'
import { getStormEvent } from '../../src/core/sceneEffects'
import { createEnvironmentSnapshot } from '../../src/core/simulation'
import { sampleNatureClock } from '../../src/core/natureClock'

const player = vi.hoisted(() => ({ prepare: vi.fn(), trigger: vi.fn(async (_id: string, _settings: unknown, _isCurrent: () => boolean) => () => {}), suspend: vi.fn(), dispose: vi.fn(), preview: vi.fn(), setChannelVolumes: vi.fn() }))
vi.mock('../../src/audio/recordedAmbience', () => ({ createRecordedAmbience: () => player }))
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })
function setup() {
  vi.useFakeTimers()
  const context = { state: 'running' } as AudioContext
  const thunder = createThunderAudio(context, {} as AudioNode)
  const event = getStormEvent(25)
  const snapshot = createEnvironmentSnapshot(sampleNatureClock(event.start + .05), { mode: 'manual', dayPhase: .8, seasonIndex: 1, weather: 'storm' })
  thunder.start()
  return { thunder, event, snapshot }
}
describe('delayed storm audio', () => {
  it('uses the configured shared storm interval and distance and cancels the previous schedule', async () => {
    const { thunder, snapshot } = setup()
    thunder.sync(snapshot)
    thunder.setOptions({ interval: 20, distanceKm: 1.2 })
    const event = getStormEvent(15, { interval: 20, distanceKm: 1.2 })
    snapshot.elapsed = event.start + .05
    thunder.sync(snapshot)
    await vi.advanceTimersByTimeAsync((event.thunderAt - snapshot.elapsed) * 1000 + 1)
    expect(player.trigger).toHaveBeenCalledOnce()
    expect(player.trigger.mock.calls[0][0]).toBe('close')
    expect(player.trigger.mock.calls[0][1]).toMatchObject({ volume: .65 / (1 + 1.2 * .22) })
    thunder.dispose()
  })
  it('plays one thunder sound after the visible event, never at the flash', async () => {
    const { thunder, event, snapshot } = setup()
    thunder.sync(snapshot); thunder.sync(snapshot)
    expect(player.trigger).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync((event.thunderAt - snapshot.elapsed) * 1000 + 1)
    expect(player.trigger).toHaveBeenCalledOnce()
    expect(player.trigger.mock.calls[0][1]).toMatchObject({ rate: 1, pan: event.x * .6 })
    thunder.dispose()
  })
  it.each(['mute', 'clear', 'hidden'] as const)('cancels delayed thunder on %s', async action => {
    const { thunder, snapshot } = setup()
    thunder.sync(snapshot)
    if (action === 'mute') thunder.setLevel(0)
    if (action === 'clear') { snapshot.weather.storm = 0; thunder.sync(snapshot) }
    if (action === 'hidden') thunder.suspend()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(player.trigger).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    thunder.dispose()
  })
  it('does not replay an old event when joining a storm after the flash', async () => {
    const { thunder, snapshot } = setup()
    snapshot.elapsed += 3
    thunder.sync(snapshot)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(player.trigger).not.toHaveBeenCalled()
    thunder.dispose()
  })
})
