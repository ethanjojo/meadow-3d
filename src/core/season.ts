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

const PROFILE_COLORS = PROFILES.map((profile) => ({
  grass: new Color(profile.grass),
  ground: new Color(profile.ground),
  tip: new Color(profile.tip),
}))

function mix(from: number, to: number, amount: number) {
  return Math.min(1, Math.max(0, from + (to - from) * amount))
}

export function getSeasonAppearance(
  snapshot: NatureSnapshot,
  target?: SeasonAppearance,
): SeasonAppearance {
  const current = PROFILES[snapshot.seasonIndex]
  const next = PROFILES[snapshot.nextSeasonIndex]
  const currentColors = PROFILE_COLORS[snapshot.seasonIndex]
  const nextColors = PROFILE_COLORS[snapshot.nextSeasonIndex]
  const amount = snapshot.seasonBlend
  const appearance = target ?? {
    grassColor: new Color(),
    groundColor: new Color(),
    tipColor: new Color(),
    dryness: 0,
    snowCoverage: 0,
    frost: 0,
    pollen: 0,
    rainBias: 0,
    snowBias: 0,
  }

  appearance.grassColor.copy(currentColors.grass).lerp(nextColors.grass, amount)
  appearance.groundColor.copy(currentColors.ground).lerp(nextColors.ground, amount)
  appearance.tipColor.copy(currentColors.tip).lerp(nextColors.tip, amount)
  appearance.dryness = mix(current.dryness, next.dryness, amount)
  appearance.snowCoverage = mix(current.snow, next.snow, amount)
  appearance.frost = mix(current.frost, next.frost, amount)
  appearance.pollen = mix(current.pollen, next.pollen, amount)
  appearance.rainBias = mix(current.rain, next.rain, amount)
  appearance.snowBias = mix(current.snowBias, next.snowBias, amount)
  return appearance
}

export function blendSeasonAppearance(
  source: SeasonAppearance,
  target: SeasonAppearance,
  amount: number,
  output: SeasonAppearance,
): SeasonAppearance {
  const blend = Math.min(1, Math.max(0, amount))
  output.grassColor.copy(source.grassColor).lerp(target.grassColor, blend)
  output.groundColor.copy(source.groundColor).lerp(target.groundColor, blend)
  output.tipColor.copy(source.tipColor).lerp(target.tipColor, blend)
  output.dryness = mix(source.dryness, target.dryness, blend)
  output.snowCoverage = mix(source.snowCoverage, target.snowCoverage, blend)
  output.frost = mix(source.frost, target.frost, blend)
  output.pollen = mix(source.pollen, target.pollen, blend)
  output.rainBias = mix(source.rainBias, target.rainBias, blend)
  output.snowBias = mix(source.snowBias, target.snowBias, blend)
  return output
}
