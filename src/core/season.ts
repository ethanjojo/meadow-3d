import { Color } from 'three'
import type { NatureSnapshot } from './natureClock'

interface SeasonProfile {
  grass: string
  ground: string
  tip: string
  dryness: number
  snow: number
  frost: number
  pollen: number
  rain: number
  snowBias: number
}

export interface SeasonAppearance {
  grassColor: Color
  groundColor: Color
  tipColor: Color
  dryness: number
  snowCoverage: number
  frost: number
  pollen: number
  rainBias: number
  snowBias: number
}

const PROFILES: readonly SeasonProfile[] = [
  {
    grass: '#4d7f32',
    ground: '#40552b',
    tip: '#83a84e',
    dryness: 0.05,
    snow: 0,
    frost: 0.05,
    pollen: 0.8,
    rain: 0.65,
    snowBias: 0,
  },
  {
    grass: '#58772f',
    ground: '#51452a',
    tip: '#9a9d45',
    dryness: 0.25,
    snow: 0,
    frost: 0,
    pollen: 0.45,
    rain: 0.35,
    snowBias: 0,
  },
  {
    grass: '#806a32',
    ground: '#5b4328',
    tip: '#b18745',
    dryness: 0.72,
    snow: 0,
    frost: 0.15,
    pollen: 0.08,
    rain: 0.55,
    snowBias: 0.05,
  },
  {
    grass: '#72806f',
    ground: '#4c514a',
    tip: '#d6ded9',
    dryness: 0.55,
    snow: 0.78,
    frost: 0.9,
    pollen: 0,
    rain: 0.2,
    snowBias: 0.85,
  },
] as const

function mix(from: number, to: number, amount: number) {
  return Math.min(1, Math.max(0, from + (to - from) * amount))
}

function mixColor(from: string, to: string, amount: number) {
  return new Color(from).lerp(new Color(to), amount)
}

export function getSeasonAppearance(
  snapshot: NatureSnapshot,
): SeasonAppearance {
  const current = PROFILES[snapshot.seasonIndex]
  const next = PROFILES[snapshot.nextSeasonIndex]
  const amount = snapshot.seasonBlend

  return {
    grassColor: mixColor(current.grass, next.grass, amount),
    groundColor: mixColor(current.ground, next.ground, amount),
    tipColor: mixColor(current.tip, next.tip, amount),
    dryness: mix(current.dryness, next.dryness, amount),
    snowCoverage: mix(current.snow, next.snow, amount),
    frost: mix(current.frost, next.frost, amount),
    pollen: mix(current.pollen, next.pollen, amount),
    rainBias: mix(current.rain, next.rain, amount),
    snowBias: mix(current.snowBias, next.snowBias, amount),
  }
}
