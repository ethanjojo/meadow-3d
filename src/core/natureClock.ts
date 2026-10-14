export type SeasonIndex = 0 | 1 | 2 | 3

export interface NatureClockConfig {
  dayDuration: number
  seasonDuration: number
  seed: number
}

export interface NatureSnapshot {
  elapsed: number
  dayPhase: number
  dayCycle?: number
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
    dayPhase, dayCycle: elapsed / config.dayDuration,
    seasonPhase,
    seasonIndex,
    nextSeasonIndex,
    seasonBlend,
    windStrength: Math.min(1, Math.max(0, broadWind * 0.65 + gust * 0.35)),
    weatherIntensity: smooth01(weather),
  }
}

/** Independent accumulated phases preserve scene position when durations change. */
export interface NatureClockState { elapsed: number; dayCycle: number; seasonCycle: number; weatherElapsed: number }
export function createNatureClockState(elapsed = DEFAULT_CLOCK.dayDuration * .31): NatureClockState {
  return { elapsed, dayCycle: elapsed / DEFAULT_CLOCK.dayDuration, seasonCycle: elapsed / DEFAULT_CLOCK.seasonDuration, weatherElapsed: elapsed }
}
export function advanceNatureClock(state: NatureClockState, delta: number, options: { dayDuration: number; seasonDuration: number; timePaused: boolean; realTime: boolean; weatherChangeSpeed: number }, deviceDate = new Date()): NatureSnapshot {
  const seconds = options.timePaused ? 0 : Math.max(0, delta)
  state.elapsed += seconds
  state.dayCycle += seconds / options.dayDuration
  state.seasonCycle += seconds / options.seasonDuration
  state.weatherElapsed += seconds * options.weatherChangeSpeed
  const snapshot = sampleNatureClock(state.weatherElapsed)
  snapshot.elapsed = state.elapsed
  if (options.realTime && !options.timePaused) state.dayCycle = Math.floor(state.dayCycle) + (deviceDate.getHours() * 3600 + deviceDate.getMinutes() * 60 + deviceDate.getSeconds()) / 86400
  snapshot.dayCycle = state.dayCycle
  snapshot.dayPhase = fract(state.dayCycle)
  snapshot.seasonPhase = fract(state.seasonCycle / 4)
  snapshot.seasonIndex = (Math.floor(state.seasonCycle) % 4) as SeasonIndex
  snapshot.nextSeasonIndex = ((snapshot.seasonIndex + 1) % 4) as SeasonIndex
  snapshot.seasonBlend = smooth01(fract(state.seasonCycle))
  return snapshot
}
