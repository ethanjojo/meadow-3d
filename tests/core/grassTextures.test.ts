import { describe, expect, it, vi } from 'vitest'
import {
  ClampToEdgeWrapping,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three'
import {
  createGrassTextureFallbacks,
  createGroundDetailTexture,
  loadGrassTextures,
  type GrassTextureSet,
} from '../../src/scene/grassTextures'

interface PendingLoad {
  ready: (texture: Texture) => void
  error: (error: unknown) => void
}

function createMockLoader() {
  const pending: PendingLoad[] = []
  const loader = {
    load: vi.fn(
      (
        _url: string,
        ready: (texture: Texture) => void,
        _progress: unknown,
        error: (error: unknown) => void,
      ) => {
        pending.push({ ready, error })
        return new Texture()
      },
    ),
  } as unknown as TextureLoader
  return { loader, pending }
}

describe('grass texture fallbacks', () => {
  it('creates safe one-pixel color and surface textures', () => {
    const textures = createGrassTextureFallbacks()

    expect(textures.detailed).toBe(false)
    expect(textures.color.image).toMatchObject({ width: 1, height: 1 })
    expect(textures.surface.image).toMatchObject({ width: 1, height: 1 })
    expect(textures.color.wrapS).toBe(ClampToEdgeWrapping)
    expect(textures.color.wrapT).toBe(ClampToEdgeWrapping)
    expect(textures.surface.wrapS).toBe(ClampToEdgeWrapping)
    expect(textures.surface.wrapT).toBe(ClampToEdgeWrapping)
    expect(textures.color.colorSpace).toBe(SRGBColorSpace)
    expect(textures.surface.colorSpace).toBe(NoColorSpace)

    textures.color.dispose()
    textures.surface.dispose()
  })

  it('configures both detailed textures and disposes them on cleanup', () => {
    const { loader, pending } = createMockLoader()
    const ready = vi.fn<(textures: GrassTextureSet) => void>()
    const color = new Texture()
    const surface = new Texture()
    const colorDispose = vi.spyOn(color, 'dispose')
    const surfaceDispose = vi.spyOn(surface, 'dispose')
    const cleanup = loadGrassTextures(loader, 16, ready)

    pending[0].ready(color)
    expect(ready).not.toHaveBeenCalled()
    pending[1].ready(surface)

    expect(ready).toHaveBeenCalledWith({ color, surface, detailed: true })
    expect(color.anisotropy).toBe(8)
    expect(surface.anisotropy).toBe(8)
    expect(color.colorSpace).toBe(SRGBColorSpace)
    expect(surface.colorSpace).toBe(NoColorSpace)

    cleanup()
    expect(colorDispose).toHaveBeenCalledOnce()
    expect(surfaceDispose).toHaveBeenCalledOnce()
  })

  it('delivers procedural fallbacks when either atlas fails', () => {
    const { loader, pending } = createMockLoader()
    const ready = vi.fn<(textures: GrassTextureSet) => void>()
    const cleanup = loadGrassTextures(loader, 4, ready)

    pending[0].error(new Error('network'))

    expect(ready).toHaveBeenCalledOnce()
    const fallbacks = ready.mock.calls[0][0]
    expect(fallbacks.detailed).toBe(false)
    expect(fallbacks.color.image).toMatchObject({ width: 1, height: 1 })
    expect(fallbacks.surface.image).toMatchObject({ width: 1, height: 1 })

    const lateSurface = new Texture()
    const lateDispose = vi.spyOn(lateSurface, 'dispose')
    pending[1].ready(lateSurface)
    expect(lateDispose).toHaveBeenCalledOnce()

    cleanup()
    fallbacks.color.dispose()
    fallbacks.surface.dispose()
  })
})

describe('ground detail texture', () => {
  it('builds a tiling mottled map with clamped anisotropy', () => {
    const texture = createGroundDetailTexture(64)
    const { data, width, height } = texture.image as {
      data: Uint8Array
      width: number
      height: number
    }

    expect(width).toBe(128)
    expect(height).toBe(128)
    expect(data).toHaveLength(width * height * 4)
    expect(texture.wrapS).toBe(RepeatWrapping)
    expect(texture.wrapT).toBe(RepeatWrapping)
    expect(texture.repeat.x).toBeGreaterThan(1)
    expect(texture.colorSpace).toBe(SRGBColorSpace)
    expect(texture.anisotropy).toBe(8)

    let minimum = 255
    let maximum = 0
    for (let index = 0; index < data.length; index += 4) {
      minimum = Math.min(minimum, data[index + 1])
      maximum = Math.max(maximum, data[index + 1])
    }
    expect(maximum).toBeGreaterThan(minimum)

    texture.dispose()
  })
})
