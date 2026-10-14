import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRecordedCalls } from '../../src/audio/recordedCalls'
import { parseAudioSettings } from '../../src/core/audioSettings'
import { createEnvironmentSnapshot } from '../../src/core/simulation'
import { sampleNatureClock } from '../../src/core/natureClock'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
function setup() {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })))
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() })
  const node = () => { const result = { connect: vi.fn(), disconnect: vi.fn() }; result.connect.mockReturnValue(result); return result }
  const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; onended: (() => void) | null }[] = []
  const context = {
    state: 'running', currentTime: 0, destination: node(),
    createGain: () => ({ ...node(), gain: param() }),
    createBiquadFilter: () => ({ ...node(), frequency: param(), Q: param() }),
    createStereoPanner: () => ({ ...node(), pan: param() }),
    createBufferSource: () => {
      const source = { ...node(), playbackRate: param(), buffer: null, start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null }
      source.stop.mockImplementation(() => source.onended?.())
      sources.push(source); return source
    },
    decodeAudioData: vi.fn(async () => ({ duration: 4 })),
  }
  const settings = parseAudioSettings(null)
  for (const call of Object.values(settings.calls)) call.enabled = false
  settings.calls.cow = { ...settings.calls.cow, enabled: true, activity: 'custom', startHour: 20, endHour: 6, minInterval: 5, maxInterval: 5 }
  const snapshot = createEnvironmentSnapshot(sampleNatureClock(0), { mode: 'manual', dayPhase: 23 / 24, seasonIndex: 1, weather: 'clear' })
  const controller = createRecordedCalls(context as unknown as AudioContext, context.destination as unknown as AudioNode, settings)
  controller.setNature(snapshot)
  return { controller, settings, snapshot, sources, context }
}

describe('recorded call voice lifecycle', () => {
  it('uses real seconds for pauses, stops calls outside scene hours, and keeps preview independent', async () => {
    const { controller, snapshot, sources } = setup()
    await controller.start()
    snapshot.elapsed += 10_000 // Accelerating scene time cannot accelerate call intervals.
    controller.setNature(snapshot)
    await vi.advanceTimersByTimeAsync(4_750)
    expect(sources).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(250)
    expect(sources).toHaveLength(1)
    snapshot.dayPhase = 12 / 24
    controller.setNature(snapshot)
    expect(sources[0].stop).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(sources).toHaveLength(1)
    await controller.preview('cow', () => true, () => {})
    expect(sources).toHaveLength(2)
    controller.suspend()
    expect(sources[1].stop).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    controller.dispose()
  })
  it('restarts calls after context interruption and cancels live voices when disabled', async () => {
    const { controller, context, settings, sources } = setup()
    await controller.start()
    context.state = 'interrupted'
    await vi.advanceTimersByTimeAsync(250)
    context.state = 'running'
    await controller.start()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(sources).toHaveLength(1)
    const disabled = structuredClone(settings); disabled.calls.cow.enabled = false
    controller.setSettings(disabled)
    expect(sources[0].stop).toHaveBeenCalledOnce()
    controller.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })
})
