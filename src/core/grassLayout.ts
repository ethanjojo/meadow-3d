export interface GrassLayout {
  offsets: Float32Array
  scales: Float32Array
  phases: Float32Array
  stiffness: Float32Array
  yaw: Float32Array
}

export type GrassLayerKind = 'foreground' | 'middle' | 'horizon'

export interface GrassLayerLayout extends GrassLayout {
  widths: Float32Array
  leans: Float32Array
  colorVariation: Float32Array
}

export const GRASS_LAYER_RATIOS = {
  foreground: 0.22,
  middle: 0.33,
  horizon: 0.45,
} as const satisfies Record<GrassLayerKind, number>

const LAYER_BANDS = {
  foreground: { near: 5, far: -4.5, nearHalfWidth: 1.2, farHalfWidth: 8.2 },
  middle: { near: -3.5, far: -16, nearHalfWidth: 7.2, farHalfWidth: 16 },
  horizon: { near: -14, far: -34, nearHalfWidth: 13.5, farHalfWidth: 28 },
} as const satisfies Record<
  GrassLayerKind,
  { near: number; far: number; nearHalfWidth: number; farHalfWidth: number }
>

const LAYER_SCALE_RANGES = {
  foreground: [0.8, 1.7],
  middle: [0.68, 1.35],
  horizon: [0.48, 0.92],
} as const satisfies Record<GrassLayerKind, readonly [number, number]>

function createMulberry32(seed: number) {
  let state = seed >>> 0

  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function terrainHeight(x: number, z: number) {
  return (
    Math.sin(x * 0.09) * 0.13 +
    Math.sin(z * 0.13) * 0.08 +
    Math.sin((x + z) * 0.04) * 0.03
  )
}

export function getGrassLayerBudgets(total: number) {
  const bladeCount = Math.max(0, Math.floor(total))
  const foreground = Math.floor(bladeCount * GRASS_LAYER_RATIOS.foreground)
  const middle = Math.floor(bladeCount * GRASS_LAYER_RATIOS.middle)

  return {
    foreground,
    middle,
    horizon: bladeCount - foreground - middle,
  }
}

export function createGrassLayerLayout(
  count: number,
  kind: GrassLayerKind,
  seed: number,
): GrassLayerLayout {
  const bladeCount = Math.max(0, Math.floor(count))
  const band = LAYER_BANDS[kind]
  const [minimumScale, maximumScale] = LAYER_SCALE_RANGES[kind]
  const random = createMulberry32(seed)
  const offsets = new Float32Array(bladeCount * 3)
  const scales = new Float32Array(bladeCount)
  const phases = new Float32Array(bladeCount)
  const stiffness = new Float32Array(bladeCount)
  const yaw = new Float32Array(bladeCount)
  const widths = new Float32Array(bladeCount)
  const leans = new Float32Array(bladeCount)
  const colorVariation = new Float32Array(bladeCount)

  for (let index = 0; index < bladeCount; index += 1) {
    const depthProgress = random()
    const z = band.near + (band.far - band.near) * depthProgress
    const halfWidth =
      band.nearHalfWidth +
      (band.farHalfWidth - band.nearHalfWidth) * depthProgress
    const x = (random() * 2 - 1) * halfWidth
    const offsetIndex = index * 3

    offsets[offsetIndex] = x
    offsets[offsetIndex + 1] = terrainHeight(x, z)
    offsets[offsetIndex + 2] = z
    scales[index] = minimumScale + random() * (maximumScale - minimumScale)
    phases[index] = random() * Math.PI * 2
    stiffness[index] = 0.15 + random() * 0.8
    yaw[index] = random() * Math.PI * 2
    widths[index] = 0.7 + random() * 0.72
    leans[index] = (random() * 2 - 1) * 0.26
    colorVariation[index] = random()
  }

  return {
    offsets,
    scales,
    phases,
    stiffness,
    yaw,
    widths,
    leans,
    colorVariation,
  }
}

export function createGrassLayout(
  count: number,
  meadowRadius: number,
  seed: number,
): GrassLayout {
  const bladeCount = Math.max(0, Math.floor(count))
  const radiusLimit = Math.max(0, meadowRadius)
  const random = createMulberry32(seed)
  const offsets = new Float32Array(bladeCount * 3)
  const scales = new Float32Array(bladeCount)
  const phases = new Float32Array(bladeCount)
  const stiffness = new Float32Array(bladeCount)
  const yaw = new Float32Array(bladeCount)

  for (let index = 0; index < bladeCount; index += 1) {
    const distance = Math.sqrt(random()) * radiusLimit
    const angle = random() * Math.PI * 2
    const offsetIndex = index * 3

    offsets[offsetIndex] = Math.cos(angle) * distance
    offsets[offsetIndex + 1] = terrainHeight(
      offsets[offsetIndex],
      offsets[offsetIndex + 2],
    )
    offsets[offsetIndex + 2] = Math.sin(angle) * distance
    scales[index] = 0.65 + random() * 0.55
    phases[index] = random() * Math.PI * 2
    stiffness[index] = 0.15 + random() * 0.8
    yaw[index] = random() * Math.PI * 2
  }

  return { offsets, scales, phases, stiffness, yaw }
}
