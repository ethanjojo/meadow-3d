import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearMipmapLinearFilter,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  UnsignedByteType,
} from 'three'
import moonSurfaceUrl from '../assets/moon-surface.png'

export interface MoonTextureSet {
  texture: Texture
  detailed: boolean
}

function configureMoonTexture(texture: Texture, maximumAnisotropy: number) {
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearMipmapLinearFilter
  texture.anisotropy = Math.min(
    8,
    Math.max(
      1,
      Number.isFinite(maximumAnisotropy) ? maximumAnisotropy : 1,
    ),
  )
  texture.needsUpdate = true
  return texture
}

export function createMoonTextureFallback() {
  const texture = new DataTexture(
    new Uint8Array([178, 178, 178, 255]),
    1,
    1,
    RGBAFormat,
    UnsignedByteType,
  )
  return configureMoonTexture(texture, 1)
}

export function loadMoonTexture(
  loader: TextureLoader,
  onReady: (set: MoonTextureSet) => void,
  maximumAnisotropy = 1,
) {
  let active = true
  loader.load(
    moonSurfaceUrl,
    (texture) => {
      if (!active) {
        texture.dispose()
        return
      }
      onReady({
        texture: configureMoonTexture(texture, maximumAnisotropy),
        detailed: true,
      })
    },
    undefined,
    () => {
      if (!active) return
      onReady({ texture: createMoonTextureFallback(), detailed: false })
    },
  )
  return () => {
    active = false
  }
}
