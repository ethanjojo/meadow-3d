import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAmbientAudio } from '../../src/audio/ambientAudio'

const players = vi.hoisted(() => ({ start: vi.fn(), suspend: vi.fn(), dispose: vi.fn(), setChannelVolumes: vi.fn(), setDayGain: vi.fn(), setActivity: vi.fn() }))
vi.mock('../../src/audio/farmAudio', () => ({ createFarmAudio: () => players }))
vi.mock('../../src/audio/birdAudio', () => ({ createBirdAudio: () => players, deriveBirdActivity: () => 0 }))
vi.mock('../../src/audio/thunderAudio', () => ({ createThunderAudio: () => ({ ...players, setLevel: vi.fn(), sync: vi.fn() }) }))

function setup(withSession = true) {
  const session = { type: 'ambient' }
  vi.stubGlobal('navigator', withSession ? { audioSession: session } : {})
  const param = () => ({ value: 0, setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() })
  const node = () => {
    const result = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), gain: param(), frequency: param(), Q: param(), pan: param(), playbackRate: param(), onended: null as (() => void) | null }
    result.connect.mockReturnValue(result)
    return result
  }
  const sources: ReturnType<typeof node>[] = []
  const context = {
    state: 'suspended', currentTime: 0, sampleRate: 24_000, destination: node(),
    createGain: node, createBiquadFilter: node, createOscillator: node, createStereoPanner: node,
    createBuffer: (_channels: number, length: number) => ({ duration: length / 24_000, getChannelData: () => new Float32Array(length) }),
    createBufferSource: () => { const source = node(); sources.push(source); return source },
    resume: vi.fn(async () => { context.state = 'running' }),
    suspend: vi.fn(async () => { context.state = 'suspended' }),
    close: vi.fn(async () => { context.state = 'closed' }),
  }
  vi.stubGlobal('AudioContext', function () { return context })
  return { controller: createAmbientAudio(), context, session, sources }
}

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('mobile audio activation', () => {
  it('selects playback before resuming synchronously in the user gesture and restores the previous session on mute', async () => {
    const { controller, context, session } = setup()
    const started = controller.start()
    expect(context.resume).toHaveBeenCalledOnce()
    expect(session.type).toBe('playback')
    expect(await started).toBe(true)
    await controller.suspend()
    expect(session.type).toBe('ambient')
    await controller.dispose()
  })

  it('resumes an interrupted Safari context instead of treating it as running', async () => {
    const { controller, context } = setup()
    await controller.start()
    context.state = 'interrupted'
    await controller.resume()
    expect(context.resume).toHaveBeenCalledTimes(2)
    expect(context.state).toBe('running')
    await controller.dispose()
  })

  it('does not start ambience when the context remains interrupted', async () => {
    const { controller, context, session } = setup()
    context.resume.mockImplementation(async () => { context.state = 'interrupted' })
    expect(await controller.start()).toBe(false)
    expect(players.start).not.toHaveBeenCalled()
    expect(session.type).toBe('ambient')
    await controller.dispose()
  })

  it('uses playback for a muted preview and releases the session when it ends', async () => {
    const { controller, session, sources } = setup()
    const ended = vi.fn()
    expect(await controller.preview('wind', ended)).toBe(true)
    expect(session.type).toBe('playback')
    sources.at(-1)!.onended!()
    expect(ended).toHaveBeenCalledOnce()
    expect(session.type).toBe('ambient')
    await controller.dispose()
  })

  it('keeps standard Web Audio working when Audio Session API is unavailable', async () => {
    const { controller } = setup(false)
    expect(await controller.start()).toBe(true)
    await controller.dispose()
  })

  it('keeps mute in effect when an earlier activation resolves afterwards', async () => {
    const { controller, context, session } = setup()
    let finishResume!: () => void
    context.resume.mockImplementation(() => new Promise<void>(resolve => { finishResume = resolve }))
    const started = controller.start()
    await controller.suspend()
    context.state = 'running'
    finishResume()
    expect(await started).toBe(false)
    expect(players.start).not.toHaveBeenCalled()
    expect(session.type).toBe('ambient')
    await controller.dispose()
  })
})
