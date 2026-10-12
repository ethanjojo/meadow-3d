import { afterEach, describe, expect, it, vi } from 'vitest'
import { FARM_CALLS, chooseFarmCall, createFarmAudio, farmCallDelay } from '../../src/audio/farmAudio'
import { createGrassLayerLayout } from '../../src/core/grassLayout'
import { isFarmYard } from '../../src/core/farm'

describe('farm ambience selection', () => {
  it('covers all requested animals without immediately repeating a call', () => {
    expect(FARM_CALLS.map(call => call.id)).toEqual(expect.arrayContaining([
      'cow', 'cat', 'dog', 'hen', 'sheep', 'goat', 'horse', 'donkey',
    ]))
    for (const call of FARM_CALLS) {
      expect(chooseFarmCall(FARM_CALLS, call.id, () => 0).id).not.toBe(call.id)
    }
  })
  it('spaces calls out more at night, with bounded random intervals', () => {
    expect(farmCallDelay(1, () => 0)).toBe(9_000)
    expect(farmCallDelay(1, () => 1)).toBe(21_000)
    expect(farmCallDelay(0, () => 0)).toBeGreaterThan(farmCallDelay(1, () => 0))
  })
  it('keeps horizon vegetation out of the farm yard', () => {
    const layout = createGrassLayerLayout(6_000, 'horizon', 12_247)
    for (let i = 0; i < layout.offsets.length; i += 3) {
      expect(isFarmYard(layout.offsets[i], layout.offsets[i + 2])).toBe(false)
    }
  })
})

describe('recorded farm audio lifecycle', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  function setup() {
    vi.useFakeTimers()
    const fetchSound = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }))
    vi.stubGlobal('fetch', fetchSound)
    const param = () => ({ value: 0, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn() })
    const node = () => { const result = { connect: vi.fn(), disconnect: vi.fn() }; result.connect.mockReturnValue(result); return result }
    const source = { ...node(), buffer: null, playbackRate: param(), start: vi.fn(), stop: vi.fn(), onended: null }
    const context = {
      state: 'running', currentTime: 0, destination: node(),
      createBiquadFilter: () => ({ ...node(), frequency: param(), Q: param() }),
      createStereoPanner: () => ({ ...node(), pan: param() }),
      createGain: () => ({ ...node(), gain: param() }),
      createBufferSource: () => source,
      decodeAudioData: vi.fn(async () => ({ duration: 4 })),
    }
    return { farm: createFarmAudio(context as unknown as AudioContext), fetchSound, context, source }
  }

  it('loads only on enable, reuses decoded buffers and cancels calls on mute/disposal', async () => {
    const { farm, fetchSound, source } = setup()
    expect(fetchSound).not.toHaveBeenCalled()
    await farm.start()
    expect(fetchSound).toHaveBeenCalledTimes(FARM_CALLS.length)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(source.start).toHaveBeenCalledTimes(1)
    farm.suspend()
    expect(source.stop).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    await farm.start()
    expect(fetchSound).toHaveBeenCalledTimes(FARM_CALLS.length)
    farm.dispose()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(source.start).toHaveBeenCalledTimes(1)
  })

  it('does not start calls while the shared context is suspended', async () => {
    const { farm, context, source } = setup()
    context.state = 'suspended'
    await farm.start()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(source.start).not.toHaveBeenCalled()
    context.state = 'running'
    await farm.start()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(source.start).toHaveBeenCalledTimes(1)
    farm.dispose()
  })

  it('omits muted animals and resumes only the enabled animal', async () => {
    const { farm, source } = setup()
    const muted = Object.fromEntries(FARM_CALLS.map(call => [call.id, 0]))
    farm.setChannelVolumes(muted)
    await farm.start()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(source.start).not.toHaveBeenCalled()
    farm.setChannelVolumes({ ...muted, cow: 0.25 })
    await vi.advanceTimersByTimeAsync(2_000)
    expect(source.start).toHaveBeenCalledTimes(1)
    farm.dispose()
  })
  it('previews a recording without starting ambient scheduling and respects cancelled loading', async () => {
    const { farm, source } = setup()
    const stop = await farm.preview('cow', () => true, () => {})
    expect(source.start).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    stop?.()
    const cancelled = await farm.preview('dog', () => false, () => {})
    expect(cancelled).toBeNull()
    expect(source.start).toHaveBeenCalledTimes(1)
    farm.dispose()
  })
  it('previews the complete short donkey excerpt without playing the rest of the source recording', async () => {
    const { farm, context, source } = setup()
    context.decodeAudioData.mockResolvedValue({ duration: 6 })
    await farm.preview('donkey', () => true, () => {})
    expect(source.start).toHaveBeenCalledWith(0, 0, 2.08)
    farm.dispose()
  })
})
