import { valueNoise } from './noise'
import { isFarmYard } from './farm'

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
  atlasCells: Float32Array
}

export const GRASS_LAYER_RATIOS = {
  foreground: 0.3,
  middle: 0.33,
  horizon: 0.37,
} as const satisfies Record<GrassLayerKind, number>

export const GRASS_MEADOW_RADIUS = 47.5

export const GRASS_LAYER_SEGMENTS = {
  foreground: 5,
  middle: 4,
  horizon: 2,
} as const satisfies Record<GrassLayerKind, number>

export const GRASS_LAYER_PROFILES = {
  foreground: {
    scale: [0.85, 1.55],
    lean: [-0.12, 0.12],
    stiffness: [0.45, 0.92],
  },
  middle: {
    scale: [0.68, 1.3],
    lean: [-0.16, 0.16],
    stiffness: [0.32, 0.88],
  },
  horizon: {
    scale: [0.48, 0.9],
    lean: [-0.14, 0.14],
    stiffness: [0.38, 0.92],
  },
} as const satisfies Record<
  GrassLayerKind,
  {
    scale: readonly [number, number]
    lean: readonly [number, number]
    stiffness: readonly [number, number]
  }
>

const LAYER_BANDS = {
  foreground: { near: 5, far: -4.5, nearHalfWidth: 1.2, farHalfWidth: 8.2 },
  middle: { near: -3.5, far: -16, nearHalfWidth: 7.2, farHalfWidth: 16 },
  horizon: { near: -14, far: -46, nearHalfWidth: 13.5, farHalfWidth: 34 },
} as const satisfies Record<
  GrassLayerKind,
  { near: number; far: number; nearHalfWidth: number; farHalfWidth: number }
>

const DEPTH_BIAS_EXPONENTS = {
  foreground: 1.35,
  middle: 1,
  horizon: 1,
} as const satisfies Record<GrassLayerKind, number>

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount
}

function smoothstep(minimum: number, maximum: number, value: number) {
  const amount = clamp01((value - minimum) / (maximum - minimum))
  return amount * amount * (3 - 2 * amount)
}

export function getGrassRootInfluence(heightRatio: number) {
  return smoothstep(0.38, 1, heightRatio) ** 2
}

export function getGrassBendLimit(
  windStrength: number,
  reducedMotion: boolean,
) {
  const calmLimit = (18 * Math.PI) / 180
  const stormLimit = (32 * Math.PI) / 180
  const limit = calmLimit + (stormLimit - calmLimit) * clamp01(windStrength)
  return limit * (reducedMotion ? 0.55 : 1)
}

export function getGrassClearance(distance: number) {
  const clearance = smoothstep(1.6, 8, Math.max(0, distance))
  return {
    height: 0.15 + clearance * 0.85,
    lean: clearance,
    wind: clearance,
  }
}

export function grassLayerUsesAtlas(kind: GrassLayerKind) {
  return kind === 'foreground'
}

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

function samplePatchNoise(x: number, z: number) {
  return clamp01(
    valueNoise(x / 9 + 3.7, z / 9 + 1.3) * 0.62 +
      valueNoise(x / 4.4 + 11.2, z / 4.4 + 7.8) * 0.38,
  )
}

export const getGrassPatchNoise = samplePatchNoise

interface BandPoint {
  x: number
  y: number
  z: number
}

function sampleBandPoint(kind: GrassLayerKind, random: () => number): BandPoint {
  const band = LAYER_BANDS[kind]
  const depthBias = DEPTH_BIAS_EXPONENTS[kind]
  let x: number
  let z: number
  do {
    const depthProgress = random() ** depthBias
    z = band.near + (band.far - band.near) * depthProgress
    const halfWidth =
      band.nearHalfWidth +
      (band.farHalfWidth - band.nearHalfWidth) * depthProgress
    const circleHalfWidth = Math.sqrt(
      Math.max(0, GRASS_MEADOW_RADIUS * GRASS_MEADOW_RADIUS - z * z),
    )
    x = (random() * 2 - 1) * Math.min(halfWidth, circleHalfWidth)
  } while (isFarmYard(x, z))
  return { x, y: terrainHeight(x, z), z }
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
  const profile = GRASS_LAYER_PROFILES[kind]
  const [minimumScale, maximumScale] = profile.scale
  const [minimumLean, maximumLean] = profile.lean
  const [minimumStiffness, maximumStiffness] = profile.stiffness
  const random = createMulberry32(seed)
  const offsets = new Float32Array(bladeCount * 3)
  const scales = new Float32Array(bladeCount)
  const phases = new Float32Array(bladeCount)
  const stiffness = new Float32Array(bladeCount)
  const yaw = new Float32Array(bladeCount)
  const widths = new Float32Array(bladeCount)
  const leans = new Float32Array(bladeCount)
  const colorVariation = new Float32Array(bladeCount)
  const atlasCells = new Float32Array(bladeCount)

  for (let index = 0; index < bladeCount; index += 1) {
    const { x, y, z } = sampleBandPoint(kind, random)
    const offsetIndex = index * 3

    offsets[offsetIndex] = x
    offsets[offsetIndex + 1] = y
    offsets[offsetIndex + 2] = z
    const patchNoise = samplePatchNoise(x, z)
    const randomScale =
      minimumScale + random() * (maximumScale - minimumScale)
    const scale = Math.min(
      maximumScale,
      Math.max(
        minimumScale,
        lerp(randomScale, minimumScale + (maximumScale - minimumScale) * patchNoise, 0.55),
      ),
    )
    const normalizedScale =
      (scale - minimumScale) / (maximumScale - minimumScale)
    const stiffnessRange = maximumStiffness - minimumStiffness
    scales[index] = scale
    phases[index] = random() * Math.PI * 2
    stiffness[index] = Math.min(
      maximumStiffness,
      minimumStiffness +
        random() * stiffnessRange * 0.65 +
        normalizedScale * stiffnessRange * 0.35,
    )
    yaw[index] = random() * Math.PI * 2
    widths[index] = 0.7 + random() * 0.72
    leans[index] = minimumLean + random() * (maximumLean - minimumLean)
    colorVariation[index] = random()
    atlasCells[index] = Math.floor(random() * 8)
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
    atlasCells,
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

export interface FlowerLayout {
  offsets: Float32Array
  scales: Float32Array
  phases: Float32Array
  yaws: Float32Array
  colorVariation: Float32Array
}

export function createFlowerLayout(count: number, seed: number, mix = {daisy: .68, buttercup: .32, cornflower: 0}): FlowerLayout {
  const flowerCount = Math.max(0, Math.floor(count))
  const random = createMulberry32(seed)
  const offsets = new Float32Array(flowerCount * 3)
  const scales = new Float32Array(flowerCount)
  const phases = new Float32Array(flowerCount)
  const yaws = new Float32Array(flowerCount)
  const colorVariation = new Float32Array(flowerCount)
  let cluster = sampleBandPoint('foreground', random)
  let clusterRemaining = 0
  let species = 0
  const total = mix.daisy + mix.buttercup + mix.cornflower || 1

  for (let index = 0; index < flowerCount; index += 1) {
    if (clusterRemaining === 0) {
      cluster = sampleBandPoint('foreground', random)
      clusterRemaining = 3 + Math.floor(random() * 5)
      const choice = random() * total
      species = choice < mix.daisy ? 0 : choice < mix.daisy + mix.buttercup ? 1 : 2
    }
    clusterRemaining -= 1
    const radius = Math.sqrt(random()) * (0.22 + random() * 0.48)
    const angle = random() * Math.PI * 2
    const z = Math.min(5, Math.max(-4.5, cluster.z + Math.sin(angle) * radius))
    const halfWidth = lerp(1.2, 8.2, (5 - z) / 9.5)
    const candidateX = Math.min(halfWidth, Math.max(-halfWidth, cluster.x + Math.cos(angle) * radius))
    const x = isFarmYard(candidateX, z) ? cluster.x : candidateX
    const y = terrainHeight(x, z)
    const offsetIndex = index * 3

    offsets[offsetIndex] = x
    offsets[offsetIndex + 1] = y
    offsets[offsetIndex + 2] = z
    const patchNoise = samplePatchNoise(x, z)
    scales[index] = (0.72 + random() * 0.56) * (0.7 + patchNoise * 0.6)
    phases[index] = random() * Math.PI * 2
    yaws[index] = random() * Math.PI * 2
    colorVariation[index] = species === 2 ? 1.1 + random() * .2 : species === 1 ? 0.72 + random() * 0.28 : random() * 0.62
  }

  return { offsets, scales, phases, yaws, colorVariation }
}
