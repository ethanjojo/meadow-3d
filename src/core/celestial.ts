export interface CelestialBodyState {
  direction: [number, number, number]
  visibility: number
  halo: number
}

export interface CelestialState {
  sun: CelestialBodyState
  moon: CelestialBodyState
}

export type CelestialBodyKind = 'sun' | 'moon'

export interface CelestialArcPoint {
  x: number
  y: number
  opacity: number
  scaleY: number
}

export interface CelestialPresentation {
  sun: CelestialArcPoint
  moon: CelestialArcPoint
}

export interface ShootingStarState {
  active: boolean
  progress: number
  start: readonly [number, number, number]
  direction: readonly [number, number, number]
  brightness: number
}

export interface ShootingStarTrail {
  head: [number, number, number]
  tail: [number, number, number]
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function wrap01(value: number) {
  return ((value % 1) + 1) % 1
}

function easeInOut(value: number) {
  const amount = clamp01(value)
  return amount * amount * (3 - 2 * amount)
}

function smoothstep(minimum: number, maximum: number, value: number) {
  const amount = clamp01((value - minimum) / (maximum - minimum))
  return amount * amount * (3 - 2 * amount)
}

function getArcProgress(kind: CelestialBodyKind, dayPhase: number) {
  const phase = wrap01(dayPhase)
  if (kind === 'sun') {
    if (phase < 0.25) return { progress: 0, visible: false }
    if (phase > 0.75) return { progress: 1, visible: false }
    return { progress: (phase - 0.25) / 0.5, visible: true }
  }

  const relative = wrap01(phase - 0.75)
  if (relative <= 0.5) {
    return { progress: relative / 0.5, visible: true }
  }
  return { progress: relative < 0.75 ? 1 : 0, visible: false }
}

function getVisibleBody(dayPhase: number): CelestialBodyKind {
  const phase = wrap01(dayPhase)
  return phase >= 0.25 && phase <= 0.75 ? 'sun' : 'moon'
}

function circularDistance(from: number, to: number) {
  return Math.abs(wrap01(to - from + 0.5) - 0.5)
}

function createArcPoint(): CelestialArcPoint {
  return { x: 0, y: -0.04, opacity: 0, scaleY: 0.92 }
}

function createPresentation(): CelestialPresentation {
  return { sun: createArcPoint(), moon: createArcPoint() }
}

function copyArcPoint(source: CelestialArcPoint, output: CelestialArcPoint) {
  output.x = source.x
  output.y = source.y
  output.opacity = source.opacity
  output.scaleY = source.scaleY
  return output
}

function copyPresentation(
  source: CelestialPresentation,
  output: CelestialPresentation,
) {
  copyArcPoint(source.sun, output.sun)
  copyArcPoint(source.moon, output.moon)
  return output
}

function interpolateArcPoint(
  source: CelestialArcPoint,
  target: CelestialArcPoint,
  positionAmount: number,
  opacityAmount: number,
  output: CelestialArcPoint,
) {
  output.x = source.x + (target.x - source.x) * positionAmount
  output.y = source.y + (target.y - source.y) * positionAmount
  output.opacity =
    source.opacity + (target.opacity - source.opacity) * opacityAmount
  output.scaleY =
    source.scaleY + (target.scaleY - source.scaleY) * positionAmount
  return output
}

const SOURCE_PRESENTATION_SCRATCH = createPresentation()
const TARGET_PRESENTATION_SCRATCH = createPresentation()
const HORIZON_POINT_SCRATCH = createArcPoint()

export function getCelestialArcPoint(
  kind: CelestialBodyKind,
  dayPhase: number,
  aspect: number,
  output: CelestialArcPoint = createArcPoint(),
): CelestialArcPoint {
  const { progress, visible } = getArcProgress(kind, dayPhase)
  const safeAspect = Number.isFinite(aspect) ? Math.max(0.46, aspect) : 1
  const portraitAmount = clamp01((safeAspect - 0.46) / 0.54)
  const peak = 0.52 + portraitAmount * 0.16
  const arcHeight = Math.sin(progress * Math.PI)
  output.x = -0.9 + progress * 1.8
  output.y = -0.04 + arcHeight * peak
  output.opacity =
    visible && progress > 0 && progress < 1
      ? smoothstep(0, 0.08, arcHeight)
      : 0
  output.scaleY = 0.92 + smoothstep(0, 0.18, arcHeight) * 0.08
  return output
}

function writeHorizonPoint(x: number) {
  HORIZON_POINT_SCRATCH.x = x
  HORIZON_POINT_SCRATCH.y = -0.04
  HORIZON_POINT_SCRATCH.opacity = 0
  HORIZON_POINT_SCRATCH.scaleY = 0.92
  return HORIZON_POINT_SCRATCH
}

export function getCelestialPresentation(
  sourceDayPhase: number,
  targetDayPhase: number,
  amount: number,
  aspect: number,
  reducedMotion: boolean,
  output: CelestialPresentation = createPresentation(),
  frozenSource?: CelestialPresentation,
): CelestialPresentation {
  const source = frozenSource ?? SOURCE_PRESENTATION_SCRATCH
  if (!frozenSource) {
    getCelestialArcPoint('sun', sourceDayPhase, aspect, source.sun)
    getCelestialArcPoint('moon', sourceDayPhase, aspect, source.moon)
  }
  const target = TARGET_PRESENTATION_SCRATCH
  getCelestialArcPoint('sun', targetDayPhase, aspect, target.sun)
  getCelestialArcPoint('moon', targetDayPhase, aspect, target.moon)

  const linearAmount = clamp01(amount)
  if (linearAmount === 0) return copyPresentation(source, output)
  if (linearAmount === 1) return copyPresentation(target, output)

  const eased = easeInOut(linearAmount)
  const travelScale = reducedMotion ? 0.35 : 1
  const sourceKind = frozenSource
    ? frozenSource.sun.opacity >= frozenSource.moon.opacity
      ? 'sun'
      : 'moon'
    : getVisibleBody(sourceDayPhase)
  const targetKind = getVisibleBody(targetDayPhase)
  const shortSameBodyArc =
    circularDistance(sourceDayPhase, targetDayPhase) <= 0.25 &&
    sourceKind === targetKind

  if (shortSameBodyArc) {
    const positionAmount = eased * travelScale
    interpolateArcPoint(
      source.sun,
      target.sun,
      positionAmount,
      eased,
      output.sun,
    )
    interpolateArcPoint(
      source.moon,
      target.moon,
      positionAmount,
      eased,
      output.moon,
    )
    return output
  }

  const outgoing = source[sourceKind]
  const incoming = target[targetKind]
  const outgoingHorizonX = outgoing.x < 0 ? -0.9 : 0.9
  const incomingHorizonX = -outgoingHorizonX
  const outgoingAmount = clamp01(eased * 2)
  const incomingAmount = clamp01(eased * 2 - 1)

  if (sourceKind !== targetKind) {
    interpolateArcPoint(
      outgoing,
      writeHorizonPoint(outgoingHorizonX),
      outgoingAmount * travelScale,
      outgoingAmount,
      output[sourceKind],
    )
    output[sourceKind].opacity = outgoing.opacity * (1 - outgoingAmount)
    interpolateArcPoint(
      writeHorizonPoint(incomingHorizonX),
      incoming,
      incomingAmount * travelScale,
      incomingAmount,
      output[targetKind],
    )
    output[targetKind].opacity = incoming.opacity * incomingAmount
    return output
  }

  const hiddenKind = sourceKind === 'sun' ? 'moon' : 'sun'
  copyArcPoint(target[hiddenKind], output[hiddenKind])
  if (eased <= 0.5) {
    interpolateArcPoint(
      outgoing,
      writeHorizonPoint(outgoingHorizonX),
      outgoingAmount * travelScale,
      outgoingAmount,
      output[sourceKind],
    )
    output[sourceKind].opacity = outgoing.opacity * (1 - outgoingAmount)
  } else {
    interpolateArcPoint(
      writeHorizonPoint(incomingHorizonX),
      incoming,
      incomingAmount * travelScale,
      incomingAmount,
      output[targetKind],
    )
    output[targetKind].opacity = incoming.opacity * incomingAmount
  }
  return output
}

function hash(seed: number) {
  let value = seed | 0
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_296
}

export function getCelestialState(
  dayPhase: number,
  target: CelestialState = {
    sun: { direction: [0, 0, 0], visibility: 0, halo: 0 },
    moon: { direction: [0, 0, 0], visibility: 0, halo: 0 },
  },
): CelestialState {
  const solarAngle = dayPhase * Math.PI * 2 - Math.PI / 2
  const horizontal = Math.cos(solarAngle)
  const sunDirection = target.sun.direction
  const moonDirection = target.moon.direction
  sunDirection[0] = horizontal * 0.35
  sunDirection[1] = Math.sin(solarAngle)
  sunDirection[2] = -horizontal * Math.sqrt(1 - 0.35 ** 2)
  moonDirection[0] = -sunDirection[0]
  moonDirection[1] = -sunDirection[1]
  moonDirection[2] = -sunDirection[2]
  target.sun.visibility = smoothstep(-0.08, 0.12, sunDirection[1])
  target.sun.halo = smoothstep(-0.16, 0.08, sunDirection[1])
  target.moon.visibility = smoothstep(-0.08, 0.12, moonDirection[1])
  target.moon.halo = smoothstep(-0.16, 0.08, moonDirection[1])
  return target
}

export function getShootingStarState(
  elapsed: number,
  seed: number,
  slot: number,
  nightAmount: number,
): ShootingStarState {
  const safeElapsed = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0)
  const safeSlot = Math.max(0, Math.floor(Number.isFinite(slot) ? slot : 0))
  const cycle = 95
  const window = Math.floor(safeElapsed / cycle)
  const windowTime = safeElapsed - window * cycle
  const eventSeed = (Math.floor(seed) || 0) + window * 7_919
  const eventStart = 8 + hash(eventSeed) * 43
  const duration = .7 + hash(eventSeed + 1) * .65
  const paired = hash(eventSeed + 9) > .9 && safeSlot % 3 === (window + 1) % 3
  const offset = paired ? 3.2 + hash(eventSeed + 10) * 1.6 : 0
  const rawProgress = (windowTime - eventStart - offset) / duration
  const assignedSlot = paired ? (window + 1) % 3 : window % 3
  const active =
    safeSlot % 3 === assignedSlot && rawProgress >= 0 && rawProgress <= 1.25
  const progress = clamp01(rawProgress)
  const rightward = hash(eventSeed + 8) > .5
  const startX = rightward ? -.72 + hash(eventSeed + 2) * .8 : .72 - hash(eventSeed + 2) * .8
  const startY = 0.38 + hash(eventSeed + 3) * 0.48
  const startZ = -0.65 + hash(eventSeed + 4) * 0.35
  const travelX = (0.28 + hash(eventSeed + 5) * 0.34) * (rightward ? 1 : -1)
  const travelY = -(0.18 + hash(eventSeed + 6) * 0.25)
  const fade = active ? Math.min(1, rawProgress * 8) * (1 - smoothstep(.75, 1.25, rawProgress)) : 0

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
  target: ShootingStarTrail = {
    head: [0, 0, 0],
    tail: [0, 0, 0],
  },
): ShootingStarTrail {
  const tailProgress = Math.max(
    0,
    state.progress - (reducedMotion ? 0.22 : 0.38),
  )
  const project = (progress: number, point: ShootingStarTrail['head']) => {
    point[0] = (state.start[0] + state.direction[0] * progress) * 0.72
    point[1] = state.start[1] + state.direction[1] * progress
    point[2] = 0.8
  }

  project(state.progress, target.head)
  project(tailProgress, target.tail)
  return target
}
