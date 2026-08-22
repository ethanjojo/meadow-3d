import {
  ClampToEdgeWrapping,
  DataTexture,
  NoColorSpace,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  UnsignedByteType,
} from 'three'
import { valueNoise } from '../core/noise'
import colorAtlasUrl from '../assets/grass-blades-color.png'
import surfaceAtlasUrl from '../assets/grass-blades-surface.png'

export interface GrassTextureSet {
  color: Texture
  surface: Texture
  detailed: boolean
}

function configureTexture(
  texture: Texture,
  colorSpace: typeof SRGBColorSpace | typeof NoColorSpace,
  anisotropy: number,
) {
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.colorSpace = colorSpace
  texture.anisotropy = anisotropy
  texture.needsUpdate = true
  return texture
}

export function createGrassTextureFallbacks(): GrassTextureSet {
  const color = new DataTexture(
    new Uint8Array([112, 156, 66, 255]),
    1,
    1,
    RGBAFormat,
    UnsignedByteType,
  )
  const surface = new DataTexture(
    new Uint8Array([224, 128, 128, 255]),
    1,
    1,
    RGBAFormat,
    UnsignedByteType,
  )
  configureTexture(color, SRGBColorSpace, 1)
  configureTexture(surface, NoColorSpace, 1)
  return { color, surface, detailed: false }
}

export function createGroundDetailTexture(maximumAnisotropy = 1) {
  const size = 128
  const data = new Uint8Array(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size
      const coarse = valueNoise(u, v, 6)
      const fine = valueNoise(u, v, 18)
      const tone = Math.min(1, Math.max(0, coarse * 0.68 + fine * 0.32))
      const brightness = 176 + tone * 79
      const pixelIndex = (y * size + x) * 4
      data[pixelIndex] = Math.min(255, brightness * 1.03)
      data[pixelIndex + 1] = brightness
      data[pixelIndex + 2] = Math.min(255, brightness * 0.94)
      data[pixelIndex + 3] = 255
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(14, 14)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = Math.min(8, Math.max(1, maximumAnisotropy))
  texture.needsUpdate = true
  return texture
}

export function loadGrassTextures(
  loader: TextureLoader,
  maximumAnisotropy: number,
  onReady: (textures: GrassTextureSet) => void,
): () => void {
  const anisotropy = Math.min(
    8,
    Math.max(1, Number.isFinite(maximumAnisotropy) ? maximumAnisotropy : 1),
  )
  let cancelled = false
  let settled = false
  let color: Texture | null = null
  let surface: Texture | null = null

  const finishIfReady = () => {
    if (cancelled || settled || !color || !surface) return
    settled = true
    configureTexture(color, SRGBColorSpace, anisotropy)
    configureTexture(surface, NoColorSpace, anisotropy)
    onReady({ color, surface, detailed: true })
  }
  const fail = () => {
    if (cancelled || settled) return
    settled = true
    color?.dispose()
    surface?.dispose()
    color = null
    surface = null
    onReady(createGrassTextureFallbacks())
  }
  const receiveColor = (texture: Texture) => {
    if (cancelled || settled) {
      texture.dispose()
      return
    }
    color = texture
    finishIfReady()
  }
  const receiveSurface = (texture: Texture) => {
    if (cancelled || settled) {
      texture.dispose()
      return
    }
    surface = texture
    finishIfReady()
  }

  loader.load(colorAtlasUrl, receiveColor, undefined, fail)
  loader.load(surfaceAtlasUrl, receiveSurface, undefined, fail)

  return () => {
    cancelled = true
    color?.dispose()
    surface?.dispose()
    color = null
    surface = null
  }
}
