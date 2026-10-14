import { afterEach, describe, expect, it, vi } from 'vitest'
import { FARM_CALLS } from '../../src/audio/farmAudio'
import { createRecordedAmbience } from '../../src/audio/recordedAmbience'
import { createGrassLayerLayout } from '../../src/core/grassLayout'
import { isFarmYard } from '../../src/core/farm'

describe('farm ambience selection', () => {
  it('covers all requested animals without immediately repeating a call', () => {
    expect(FARM_CALLS.map(call => call.id)).toEqual(expect.arrayContaining([
      'cow', 'cat', 'dog', 'hen', 'sheep', 'goat', 'horse', 'donkey',
    ]))
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
    return { farm: createRecordedAmbience(context as unknown as AudioContext, FARM_CALLS), fetchSound, context, source }
  }

  it('caches recordings and stops active voices on disposal', async () => {
    const { farm, fetchSound, source } = setup()
    expect(fetchSound).not.toHaveBeenCalled()
    await farm.prepare()
    await farm.prepare()
    expect(fetchSound).toHaveBeenCalledTimes(FARM_CALLS.length)
    await farm.trigger('cow', { volume: .3, rate: 1, pan: 0, cutoff: 3000 }, () => true)
    expect(source.start).toHaveBeenCalledOnce()
    farm.dispose()
    expect(source.stop).toHaveBeenCalledOnce()
  })

  it('rejects muted or cancelled ambient triggers while leaving previews independent', async () => {
    const { farm, source } = setup()
    farm.setChannelVolumes({ cow: 0 })
    expect(await farm.trigger('cow', { volume: .3, rate: 1, pan: 0, cutoff: 3000 }, () => true)).toBeNull()
    expect(await farm.trigger('dog', { volume: .3, rate: 1, pan: 0, cutoff: 3000 }, () => false)).toBeNull()
    expect(source.start).not.toHaveBeenCalled()
    await farm.preview('cow', () => true, () => {})
    expect(source.start).toHaveBeenCalledOnce()
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
