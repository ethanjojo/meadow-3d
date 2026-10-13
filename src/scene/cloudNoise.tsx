import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { DataTexture, NearestFilter, NoColorSpace, RGBAFormat, RepeatWrapping, UnsignedByteType } from 'three'

export const CLOUD_NOISE_SIZE = 128

export function createCloudNoiseData(seed = 9823) {
  const data = new Uint8Array(CLOUD_NOISE_SIZE * CLOUD_NOISE_SIZE * 4)
  let state = seed >>> 0
  for (let index = 0; index < data.length; index += 1) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    data[index] = state >>> 24
  }
  return data
}

export function createCloudNoiseTexture() {
  const texture = new DataTexture(createCloudNoiseData(), CLOUD_NOISE_SIZE, CLOUD_NOISE_SIZE, RGBAFormat, UnsignedByteType)
  texture.name = 'shared-cloud-noise'
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.minFilter = texture.magFilter = NearestFilter
  texture.colorSpace = NoColorSpace
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

const CloudNoiseContext = createContext<DataTexture | null>(null)

export function CloudNoiseProvider({ children }: { children: ReactNode }) {
  const texture = useMemo(createCloudNoiseTexture, [])
  useEffect(() => () => texture.dispose(), [texture])
  return <CloudNoiseContext.Provider value={texture}>{children}</CloudNoiseContext.Provider>
}

export function useCloudNoise() {
  const texture = useContext(CloudNoiseContext)
  if (!texture) throw new Error('Cloud noise must be supplied by the scene provider')
  return texture
}
