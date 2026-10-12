import {
  Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry,
  Vector3,
} from 'three'
import type { FlowerLayout } from '../core/grassLayout'

export type FlowerSpecies = 'daisy' | 'buttercup'
export const FLOWER_HEAD_HEIGHT = 0.56

/** One small shared mesh per species/detail level; every plant is GPU-instanced. */
export function createFlowerGeometry(
  layout: FlowerLayout, instances: readonly number[], species: FlowerSpecies, detailed: boolean,
) {
  const positions: number[] = []
  const uvs: number[] = []
  const parts: number[] = []
  const indices: number[] = []
  const vertex = (x: number, y: number, z: number, u: number, v: number, part: number) => {
    const index = positions.length / 3
    positions.push(x, y, z)
    uvs.push(u, v)
    parts.push(part)
    return index
  }
  const stemSegments = detailed ? 5 : 3
  const stemSides = detailed ? 5 : 3
  for (let row = 0; row <= stemSegments; row += 1) {
    const t = row / stemSegments
    for (let side = 0; side <= stemSides; side += 1) {
      const angle = side / stemSides * Math.PI * 2
      const radius = 0.004 * (1 - t * .35)
      vertex(.03 * t * t + Math.cos(angle) * radius, t * FLOWER_HEAD_HEIGHT,
        Math.sin(angle) * radius, side / stemSides, t, 0)
      if (row < stemSegments && side < stemSides) {
        const a = row * (stemSides + 1) + side
        const b = a + stemSides + 1
        indices.push(a, b, a + 1, a + 1, b, b + 1)
      }
    }
  }
  // Folded lance-shaped leaves have a raised central vein.
  for (let leaf = 0; leaf < (detailed ? 2 : 1); leaf += 1) {
    const y = .24 + leaf * .16
    const direction = leaf === 0 ? 1 : -1
    const base = .03 * (y / FLOWER_HEAD_HEIGHT) ** 2
    const a = vertex(base, y, 0, .5, 0, 1)
    const b = vertex(base + .045 * direction, y + .028, -.013, 0, .5, 1)
    const c = vertex(base + .048 * direction, y + .04, 0, .5, .5, 1)
    const d = vertex(base + .045 * direction, y + .028, .013, 1, .5, 1)
    const e = vertex(base + .095 * direction, y + .055, 0, .5, 1, 1)
    indices.push(a, b, c, a, c, d, b, e, c, c, e, d)
  }
  const petalCount = species === 'daisy' ? (detailed ? 12 : 8) : 5
  const rows = detailed ? 4 : 2
  for (let petal = 0; petal < petalCount; petal += 1) {
    const angle = petal / petalCount * Math.PI * 2
    const start = positions.length / 3
    for (let row = 0; row <= rows; row += 1) {
      const t = row / rows
      const radius = .012 + t * (species === 'daisy' ? .048 : .035)
      const width = Math.sin(Math.PI * t) * (species === 'daisy' ? .009 : .016) + .001
      const cup = species === 'daisy' ? .009 * Math.sin(t * Math.PI) - .008 * t * t : .026 * t * t
      for (let side = 0; side < 3; side += 1) {
        const transverse = (side - 1) * width
        vertex(.03 + Math.cos(angle) * radius - Math.sin(angle) * transverse,
          FLOWER_HEAD_HEIGHT + cup + (side === 1 ? .003 : 0),
          Math.sin(angle) * radius + Math.cos(angle) * transverse, side / 2, t, 2)
        if (row < rows && side < 2) {
          const a = start + row * 3 + side
          indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3)
        }
      }
    }
  }
  // Raised hemispherical pollen center, visible from the side as well as above.
  const centerStart = positions.length / 3
  const rings = detailed ? 3 : 2
  const sides = detailed ? 12 : 8
  for (let row = 0; row <= rings; row += 1) {
    const angle = row / rings * Math.PI / 2
    for (let side = 0; side <= sides; side += 1) {
      const azimuth = side / sides * Math.PI * 2
      vertex(.03 + Math.cos(azimuth) * Math.sin(angle) * .015,
        FLOWER_HEAD_HEIGHT + .002 + Math.cos(angle) * .013,
        Math.sin(azimuth) * Math.sin(angle) * .015, side / sides, row / rings, 3)
      if (row < rings && side < sides) {
        const a = centerStart + row * (sides + 1) + side
        const b = a + sides + 1
        indices.push(a, a + 1, b, a + 1, b + 1, b)
      }
    }
  }
  const geometry = new InstancedBufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('flowerPart', new Float32BufferAttribute(parts, 1))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const attributes = {
    instanceOffset: [layout.offsets, 3], instanceScale: [layout.scales, 1],
    instancePhase: [layout.phases, 1], instanceYaw: [layout.yaws, 1],
    instanceColorVariation: [layout.colorVariation, 1],
  } as const
  for (const [name, [values, size]] of Object.entries(attributes)) {
    const data = new Float32Array(instances.length * size)
    instances.forEach((source, destination) => {
      data.set(values.subarray(source * size, (source + 1) * size), destination * size)
    })
    geometry.setAttribute(name, new InstancedBufferAttribute(data, size))
  }
  geometry.instanceCount = instances.length
  return geometry
}

export function createFlowerBatches(layout: FlowerLayout, camera: Vector3, detailed: boolean) {
  const groups: Record<string, { species: FlowerSpecies; detailed: boolean; instances: number[] }> = {}
  for (let index = 0; index < layout.scales.length; index += 1) {
    const species = layout.colorVariation[index] > .68 ? 'buttercup' : 'daisy'
    const near = detailed && Math.hypot(layout.offsets[index * 3] - camera.x, layout.offsets[index * 3 + 2] - camera.z) < 7
    const key = `${species}-${near ? 'near' : 'far'}`
    const group = groups[key] ??= { species, detailed: near, instances: [] }
    group.instances.push(index)
  }
  return Object.entries(groups).map(([key, group]) => ({
    key, geometry: createFlowerGeometry(layout, group.instances, group.species, group.detailed),
  }))
}
