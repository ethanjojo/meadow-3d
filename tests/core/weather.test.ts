import { describe, expect, it } from 'vitest'
import { Color } from 'three'
import type { NatureSnapshot } from '../../src/core/natureClock'
import type { SeasonAppearance } from '../../src/core/season'
import { getWeatherOpacity } from '../../src/core/weather'

const snapshot: NatureSnapshot = {
  elapsed: 10,
  dayPhase: 0.5,
  seasonPhase: 0,
  seasonIndex: 0,
  nextSeasonIndex: 1,
  seasonBlend: 0,
  windStrength: 0.6,
  weatherIntensity: 0.8,
}

const season: SeasonAppearance = {
  grassColor: new Color('#4d7f32'),
  groundColor: new Color('#40552b'),
  tipColor: new Color('#83a84e'),
  dryness: 0,
  snowCoverage: 0,
  frost: 0,
  pollen: 0.7,
  rainBias: 0.6,
  snowBias: 0,
}

describe('getWeatherOpacity', () => {
  it('makes spring daylight favor pollen and rain over snow', () => {
    const opacity = getWeatherOpacity(snapshot, season)
    expect(opacity.pollen).toBeGreaterThan(0)
    expect(opacity.rain).toBeGreaterThan(0)
    expect(opacity.snow).toBe(0)
  })

  it('fades pollen at night', () => {
    const night = getWeatherOpacity({ ...snapshot, dayPhase: 0 }, season)
    expect(night.pollen).toBe(0)
  })

  it('keeps every weather channel normalized', () => {
    const intenseWinter = getWeatherOpacity(
      { ...snapshot, weatherIntensity: 2 },
      { ...season, pollen: 0, rainBias: 0.2, snowBias: 1 },
    )
    for (const opacity of Object.values(intenseWinter)) {
      expect(opacity).toBeGreaterThanOrEqual(0)
      expect(opacity).toBeLessThanOrEqual(1)
    }
  })
})
