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
  clusterHue: Float32Array
  clusterShape: Float32Array
}

export interface GrassCluster {
  hue: number
  height: number
  width: number
  stiffness: number
  dryness: number
  shape: number
}

export const GRASS_LAYER_RATIOS = {
  foreground: 0.28,
  middle: 0.32,
  horizon: 0.4,
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
  foreground: { near: 4.4, far: -4.5, nearHalfWidth: 1.6, farHalfWidth: 8.2 },
  middle: { near: -3.5, far: -16, nearHalfWidth: 7.2, farHalfWidth: 16 },
  horizon: { near: -14, far: -34, nearHalfWidth: 13.5, farHalfWidth: 28 },
} as const satisfies Record<
  GrassLayerKind,
  { near: number; far: number; nearHalfWidth: number; farHalfWidth: number }
>

const FLOAT32_RANGE_EPSILON = 0.000001

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
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

function spatialWave(x: number, z: number, seed: number) {
  return (
    Math.sin(x * 0.19 + seed * 0.011) * 0.5 +
    Math.sin(z * 0.16 - seed * 0.007) * 0.3 +
    Math.sin((x + z) * 0.08 + seed * 0.003) * 0.2
  )
}

export function sampleGrassCluster(
  x: number,
  z: number,
  seed: number,
  target: GrassCluster = {
    hue: 0,
    height: 1,
    width: 1,
    stiffness: 0,
    dryness: 0,
    shape: 0,
  },
) {
  const field = spatialWave(x, z, seed)
  const normalized = Math.min(1, Math.max(0, field * 0.5 + 0.5))
  target.hue = (normalized - 0.5) * 0.12
  target.height = 0.92 + normalized * 0.16
  target.width = 0.9 + normalized * 0.2
  target.stiffness = (normalized - 0.5) * 0.1
  target.dryness = normalized * 0.12
  target.shape = Math.min(3, Math.floor(normalized * 4))
  return target
}

export function estimateGrassTipTravel(
  scale: number,
  stiffness: number,
  windStrength: number,
  clearanceWind: number,
) {
  const bend = getGrassBendLimit(windStrength, false)
  const flexibility = 1 - stiffness * 0.62
  return scale * Math.sin(bend * flexibility * clearanceWind)
}

export function getGrassClearance(distance: number) {
  const clearance = smoothstep(0.65, 5.5, Math.max(0, distance))
  return {
    height: 0.7 + clearance * 0.3,
    lean: 0.6 + clearance * 0.4,
    wind: 0.7 + clearance * 0.3,
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
  const profile = GRASS_LAYER_PROFILES[kind]
  const [minimumScale, maximumScale] = profile.scale
  const [minimumLean, maximumLean] = profile.lean
  const [minimumStiffness, maximumStiffness] = profile.stiffness
  const storedMinimumScale = minimumScale + FLOAT32_RANGE_EPSILON
  const storedMaximumScale = maximumScale - FLOAT32_RANGE_EPSILON
  const storedMinimumStiffness = minimumStiffness + FLOAT32_RANGE_EPSILON
  const storedMaximumStiffness = maximumStiffness - FLOAT32_RANGE_EPSILON
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
  const clusterHue = new Float32Array(bladeCount)
  const clusterShape = new Float32Array(bladeCount)
  const cluster: GrassCluster = {
    hue: 0,
    height: 1,
    width: 1,
    stiffness: 0,
    dryness: 0,
    shape: 0,
  }

  for (let index = 0; index < bladeCount; index += 1) {
    const depthSample = random()
    const depthProgress =
      kind === 'foreground' ? depthSample ** 1.45 : depthSample
    const z = band.near + (band.far - band.near) * depthProgress
    const halfWidth =
      band.nearHalfWidth +
      (band.farHalfWidth - band.nearHalfWidth) * depthProgress
    const x = (random() * 2 - 1) * halfWidth
    const offsetIndex = index * 3

    offsets[offsetIndex] = x
    offsets[offsetIndex + 1] = terrainHeight(x, z)
    offsets[offsetIndex + 2] = z
    sampleGrassCluster(x, z, seed, cluster)
    const authoredScale =
      minimumScale + random() * (maximumScale - minimumScale)
    const scale = Math.min(
      storedMaximumScale,
      Math.max(storedMinimumScale, authoredScale * cluster.height),
    )
    const normalizedScale =
      (scale - minimumScale) / (maximumScale - minimumScale)
    const stiffnessRange = maximumStiffness - minimumStiffness
    scales[index] = scale
    phases[index] = random() * Math.PI * 2
    stiffness[index] = Math.max(
      storedMinimumStiffness,
      Math.min(
        storedMaximumStiffness,
        minimumStiffness +
          random() * stiffnessRange * 0.65 +
          normalizedScale * stiffnessRange * 0.35 +
          cluster.stiffness,
      ),
    )
    yaw[index] = random() * Math.PI * 2
    widths[index] = (0.7 + random() * 0.72) * cluster.width
    leans[index] = minimumLean + random() * (maximumLean - minimumLean)
    colorVariation[index] = Math.min(
      1,
      Math.max(0, random() + cluster.dryness - 0.06),
    )
    atlasCells[index] = Math.floor(random() * 8)
    clusterHue[index] = cluster.hue
    clusterShape[index] = cluster.shape
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
    clusterHue,
    clusterShape,
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
