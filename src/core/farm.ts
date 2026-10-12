/** Shared footprint for the building, yard, and vegetation clearance. */
export const FARM = { x: 1.8, z: -27, rotation: -0.32, scale: 1 } as const

export function isFarmYard(x: number, z: number) {
  const dx = x - FARM.x
  const dz = z - FARM.z
  const localX = Math.cos(FARM.rotation) * dx - Math.sin(FARM.rotation) * dz
  const localZ = Math.sin(FARM.rotation) * dx + Math.cos(FARM.rotation) * dz
  return Math.abs(localX) < 5.3 * FARM.scale && localZ > -4.8 * FARM.scale && localZ < 6.6 * FARM.scale
}
