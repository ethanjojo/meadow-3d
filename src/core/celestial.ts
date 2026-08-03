export interface CelestialBodyState {
  direction: readonly [number, number, number]
  visibility: number
  halo: number
}

export interface CelestialState {
  sun: CelestialBodyState
  moon: CelestialBodyState
}

export interface ShootingStarState {
  active: boolean
  progress: number
  start: readonly [number, number, number]
  direction: readonly [number, number, number]
  brightness: number
}

export interface ShootingStarTrail {
  head: readonly [number, number, number]
  tail: readonly [number, number, number]
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function smoothstep(minimum: number, maximum: number, value: number) {
  const amount = clamp01((value - minimum) / (maximum - minimum))
  return amount * amount * (3 - 2 * amount)
}

function hash(seed: number) {
  let value = seed | 0
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_296
}

export function getCelestialState(dayPhase: number): CelestialState {
  const solarAngle = dayPhase * Math.PI * 2 - Math.PI / 2
  const horizontal = Math.cos(solarAngle)
  const sunDirection = [
    horizontal * 0.35,
    Math.sin(solarAngle),
    -horizontal * Math.sqrt(1 - 0.35 ** 2),
  ] as const
  const moonDirection = sunDirection.map((value) => -value) as [number, number, number]

  return {
    sun: {
      direction: sunDirection,
      visibility: smoothstep(-0.08, 0.12, sunDirection[1]),
      halo: smoothstep(-0.16, 0.08, sunDirection[1]),
    },
    moon: {
      direction: moonDirection,
      visibility: smoothstep(-0.08, 0.12, moonDirection[1]),
      halo: smoothstep(-0.16, 0.08, moonDirection[1]),
    },
  }
}

export function getShootingStarState(
  elapsed: number,
  seed: number,
  slot: number,
  nightAmount: number,
): ShootingStarState {
  const safeElapsed = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0)
  const safeSlot = Math.max(0, Math.floor(Number.isFinite(slot) ? slot : 0))
  const cycle = 82.5
  const window = Math.floor(safeElapsed / cycle)
  const windowTime = safeElapsed - window * cycle
  const eventSeed = (Math.floor(seed) || 0) + window * 7_919
  const eventStart = hash(eventSeed) * 37.5
  const duration = 1.2 + hash(eventSeed + 1) * 0.8
  const rawProgress = (windowTime - eventStart) / duration
  const assignedSlot = window % 3
  const active =
    safeSlot % 3 === assignedSlot && rawProgress >= 0 && rawProgress <= 1
  const progress = clamp01(rawProgress)
  const startX = -0.72 + hash(eventSeed + 2) * 1.25
  const startY = 0.38 + hash(eventSeed + 3) * 0.48
  const startZ = -0.65 + hash(eventSeed + 4) * 0.35
  const travelX = 0.28 + hash(eventSeed + 5) * 0.34
  const travelY = -(0.18 + hash(eventSeed + 6) * 0.25)
  const fade = active ? Math.sin(progress * Math.PI) : 0

  return {
    active,
    progress,
    start: [startX, startY, startZ],
    direction: [travelX, travelY, 0.08],
    brightness: fade * clamp01(nightAmount),
  }
}

export function projectShootingStarTrail(
  state: ShootingStarState,
  reducedMotion: boolean,
): ShootingStarTrail {
  const tailProgress = Math.max(
    0,
    state.progress - (reducedMotion ? 0.22 : 0.38),
  )
  const project = (progress: number) =>
    [
      (state.start[0] + state.direction[0] * progress) * 14,
      3.5 + (state.start[1] + state.direction[1] * progress) * 6,
      -24 + (state.start[2] + state.direction[2] * progress) * 2,
    ] as const

  return {
    head: project(state.progress),
    tail: project(tailProgress),
  }
}
