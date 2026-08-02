export interface GrassLayout {
  offsets: Float32Array
  scales: Float32Array
  phases: Float32Array
  stiffness: Float32Array
  yaw: Float32Array
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
