export type SeasonIndex = 0 | 1 | 2 | 3

export interface NatureClockConfig {
  dayDuration: number
  seasonDuration: number
  seed: number
}

export interface NatureSnapshot {
  elapsed: number
  dayPhase: number
  seasonPhase: number
  seasonIndex: SeasonIndex
  nextSeasonIndex: SeasonIndex
  seasonBlend: number
  windStrength: number
  weatherIntensity: number
}

export const DEFAULT_CLOCK: NatureClockConfig = {
  dayDuration: 180,
  seasonDuration: 360,
  seed: 7.31,
}

function fract(value: number) {
  return value - Math.floor(value)
}

function smooth01(value: number) {
  return value * value * (3 - 2 * value)
}

export function sampleNatureClock(
  elapsedSeconds: number,
  config: NatureClockConfig = DEFAULT_CLOCK,
): NatureSnapshot {
  const elapsed = Math.max(0, elapsedSeconds)
  const dayPhase = fract(elapsed / config.dayDuration)
  const seasonCycle = elapsed / config.seasonDuration
  const seasonPhase = fract(seasonCycle / 4)
  const seasonIndex = (Math.floor(seasonCycle) % 4) as SeasonIndex
  const seasonBlend = smooth01(fract(seasonCycle))
  const nextSeasonIndex = ((seasonIndex + 1) % 4) as SeasonIndex
  const broadWind = 0.5 + 0.5 * Math.sin(elapsed * 0.071 + config.seed)
  const gust =
    0.5 + 0.5 * Math.sin(elapsed * 0.193 + Math.sin(elapsed * 0.037))
  const weather =
    0.5 + 0.5 * Math.sin(elapsed * 0.013 + config.seed * 2)

  return {
    elapsed,
    dayPhase,
    seasonPhase,
    seasonIndex,
    nextSeasonIndex,
    seasonBlend,
    windStrength: Math.min(1, Math.max(0, broadWind * 0.65 + gust * 0.35)),
    weatherIntensity: smooth01(weather),
  }
}
