import { describe, expect, it } from 'vitest'
import { DataTexture, Texture, type TextureLoader } from 'three'
import {
  getSolarDiscAppearance,
  moonDiscFragmentShader,
  sunDiscFragmentShader,
} from '../../src/scene/celestialShaders'
import {
  loadMoonTexture,
  type MoonTextureSet,
} from '../../src/scene/celestialTextures'

describe('celestial rendering', () => {
  it('softens and warms the low sun without enlarging the disc excessively', () => {
    const horizon = getSolarDiscAppearance(0.02, 0.95)
    const noon = getSolarDiscAppearance(1, 0)
    const reusable = {
      warmth: 0,
      hardDisc: 0,
      haloScale: 0,
      discScale: 0,
    }

    expect(getSolarDiscAppearance(0.2, 0.5, reusable)).toBe(reusable)
    expect(horizon.warmth).toBeGreaterThan(noon.warmth)
    expect(horizon.hardDisc).toBeLessThan(noon.hardDisc)
    expect(horizon.haloScale).toBeGreaterThan(noon.haloScale)
    expect(horizon.discScale).toBeLessThanOrEqual(1.04)
  })

  it('renders a soft solar limb and height-dependent extinction', () => {
    expect(sunDiscFragmentShader).toContain(
      'smoothstep(1.0, 0.82, radius)',
    )
    expect(sunDiscFragmentShader).toContain('uWarmth')
    expect(sunDiscFragmentShader).toContain('uHardDisc')
  })

  it('installs a detailed moon texture', () => {
    const requests: Array<{
      ok: (texture: Texture) => void
      fail: () => void
    }> = []
    const loader = {
      load: (
        _url: string,
        ok: (texture: Texture) => void,
        _progress: unknown,
        fail: () => void,
      ) => {
        requests.push({ ok, fail })
        return new Texture()
      },
    } as unknown as TextureLoader
    const received: MoonTextureSet[] = []
    const cancel = loadMoonTexture(loader, (set) => received.push(set))

    requests[0].ok(new Texture())

    expect(received[0].detailed).toBe(true)
    cancel()
  })

  it('ignores texture completion after cancellation', () => {
    let resolve: ((texture: Texture) => void) | undefined
    const loader = {
      load: (_url: string, ok: (texture: Texture) => void) => {
        resolve = ok
        return new Texture()
      },
    } as unknown as TextureLoader
    const received: MoonTextureSet[] = []
    const cancel = loadMoonTexture(loader, (set) => received.push(set))

    cancel()
    resolve?.(new Texture())

    expect(received).toEqual([])
  })

  it('falls back to an analytic texture when loading fails', () => {
    let reject: (() => void) | undefined
    const loader = {
      load: (
        _url: string,
        _ok: (texture: Texture) => void,
        _progress: unknown,
        fail: (error: unknown) => void,
      ) => {
        reject = () => fail(new Error('missing moon texture'))
        return new Texture()
      },
    } as unknown as TextureLoader
    const received: MoonTextureSet[] = []
    const cancel = loadMoonTexture(loader, (set) => received.push(set))

    reject?.()

    expect(received).toHaveLength(1)
    expect(received[0].detailed).toBe(false)
    expect(received[0].texture).toBeInstanceOf(DataTexture)
    received[0].texture.dispose()
    cancel()
  })

  it('renders textured lunar relief with shared moonlight', () => {
    expect(moonDiscFragmentShader).toContain('uMoonSurface')
    expect(moonDiscFragmentShader).toContain('uUseSurface')
    expect(moonDiscFragmentShader).toContain('uLunarAmbient')
  })
})
