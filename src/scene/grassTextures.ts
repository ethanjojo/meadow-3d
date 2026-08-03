import {
  ClampToEdgeWrapping,
  DataTexture,
  NoColorSpace,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  UnsignedByteType,
} from 'three'
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
