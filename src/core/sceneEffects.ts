import { clamp01, hashLattice, valueNoise } from './noise'

export interface StormEvent {
  id: number
  start: number
  kind: 'ground' | 'cloud'
  distanceKm: number
  thunderAt: number
  flash: number
  x: number
}

/** Active-time schedule shared by lightning and thunder, independent of frame rate. */
export function getStormEvent(elapsed: number, options: { interval?: number; distanceKm?: number } = {}): StormEvent {
  const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0
  const interval = Math.max(10, options.interval ?? 42)
  const id = Math.floor(time / interval)
  const start = id * interval + (6 + hashLattice(id, 831) * 16) * interval / 42
  const distanceKm = options.distanceKm ?? 1.2 + hashLattice(id, 832) * 3.8
  const age = time - start
  const pulse = (at: number, width: number) => Math.max(0, 1 - Math.abs(age - at) / width) ** 2
  const double = hashLattice(id, 833) > .4
  return {
    // Keep distance cues, but compress sound travel time for the miniature scene.
    id, start, distanceKm, thunderAt: start + .9 + (distanceKm - 1.2) / 3.8 * 2.1,
    kind: hashLattice(id, 834) > .42 ? 'ground' : 'cloud',
    flash: Math.max(pulse(.055, .055), double ? pulse(.24, .075) * .65 : 0),
    x: -.68 + hashLattice(id, 835) * 1.36,
  }
}

export function sampleGust(elapsed: number) {
  return .65 + valueNoise(Math.max(0, elapsed) * .075, 14.7) * .6
}

export function advanceSnowCover(current: number, target: number, delta: number, transition?: { from: number; progress: number }, timings = { accumulation: 24, melt: 65 }) {
  if (transition) return clamp01(transition.from + (clamp01(target) - transition.from) * clamp01(transition.progress))
  const seconds = Number.isFinite(delta) ? Math.max(0, Math.min(delta, 1)) : 0
  return clamp01(current + (clamp01(target) - current) * (1 - Math.exp(-seconds / (target > current ? timings.accumulation : timings.melt))))
}
