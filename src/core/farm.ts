/** Shared footprint for the building, yard, and vegetation clearance. */
export const FARM = { x: 1.8, z: -27, rotation: -0.32, scale: 1 } as const

export const FARM_WINDOWS = [
  { x: 0, y: 4.55, width: 1.15, height: 1.15 },
  { x: -2.2, y: 1.92, width: .65, height: .85 },
  { x: 2.2, y: 1.92, width: .65, height: .85 },
] as const

/** A fixed evening routine in scene time, including independently staggered fades. */
export function getFarmWindowLight(dayPhase: number, windowIndex = 0) {
  if (!Number.isFinite(dayPhase)) return 0
  const hour = ((dayPhase % 1 + 1) % 1) * 24
  const index = Math.max(0, Math.min(FARM_WINDOWS.length - 1, Math.floor(windowIndex)))
  const start = 18.5 + index * .06
  const end = 21 - index * .04
  const ease = (value: number) => {
    const t = Math.min(1, Math.max(0, value))
    return t * t * (3 - 2 * t)
  }
  return ease((hour - start) / .15) * ease((end - hour) / .15)
}

export function isFarmYard(x: number, z: number) {
  const dx = x - FARM.x
  const dz = z - FARM.z
  const localX = Math.cos(FARM.rotation) * dx - Math.sin(FARM.rotation) * dz
  const localZ = Math.sin(FARM.rotation) * dx + Math.cos(FARM.rotation) * dz
  return Math.abs(localX) < 5.3 * FARM.scale && localZ > -4.8 * FARM.scale && localZ < 6.6 * FARM.scale
}
