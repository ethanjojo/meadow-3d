import { describe, expect, it } from 'vitest'
import { Color } from 'three'
import type { NatureSnapshot } from '../../src/core/natureClock'
import type { SeasonAppearance } from '../../src/core/season'
import {
  blendWeather,
  blendWeatherEffects,
  deriveRainStreakOrientation,
  deriveWeatherEffects,
  getAutomaticWeather,
  getWeatherOpacity,
  getWeatherProfile,
} from '../../src/core/weather'

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

  it('makes storms darker, wetter, and windier than clear weather', () => {
    const clear = getWeatherProfile('clear')
    const storm = getWeatherProfile('storm')
    expect(storm.cloudCover).toBeGreaterThan(clear.cloudCover)
    expect(storm.wetness).toBeGreaterThan(clear.wetness)
    expect(storm.windStrength).toBeGreaterThan(clear.windStrength)
  })

  it('blends every numeric weather channel continuously', () => {
    const mixed = blendWeather(
      getWeatherProfile('clear'),
      getWeatherProfile('snow'),
      0.5,
    )
    expect(mixed.snow).toBeGreaterThan(0)
    expect(mixed.snow).toBeLessThan(1)
    expect(mixed.cloudCover).toBeGreaterThan(0)
    expect(mixed.cloudCover).toBeLessThan(1)
  })

  it('returns profile copies so callers cannot mutate presets', () => {
    const clear = getWeatherProfile('clear')
    clear.cloudCover = 1
    ;(clear.windDirection as [number, number])[0] = 0

    expect(getWeatherProfile('clear').cloudCover).toBe(0.08)
    expect(getWeatherProfile('clear').windDirection).toEqual([0.86, 0.5])
  })

  it('reuses caller-owned profile and wind direction storage', () => {
    const target = getWeatherProfile('snow')
    const direction = target.windDirection

    expect(getWeatherProfile('clear', target)).toBe(target)
    expect(target.windDirection).toBe(direction)
    expect(target).toEqual(getWeatherProfile('clear'))
  })

  it('reuses caller-owned blend and automatic weather storage', () => {
    const clear = getWeatherProfile('clear')
    const snow = getWeatherProfile('snow')
    const target = getWeatherProfile('storm')
    const direction = target.windDirection

    expect(blendWeather(clear, snow, 0.5, target)).toBe(target)
    expect(target.windDirection).toBe(direction)
    expect(target.snow).toBeCloseTo(0.5)

    expect(getAutomaticWeather(snapshot, season, target)).toBe(target)
    expect(target.windDirection).toBe(direction)
  })

  it('keeps automatic winter precipitation season-appropriate', () => {
    const weather = getAutomaticWeather(
      { ...snapshot, weatherIntensity: 1 },
      { ...season, rainBias: 0.2, snowBias: 0.85 },
    )

    expect(weather.snow).toBeGreaterThan(0)
    expect(weather.rain).toBe(0)
  })

  it('allows fireflies only on calm summer nights', () => {
    const summerNight = deriveWeatherEffects({
      elapsed: 120,
      dayPhase: 0,
      seasonPosition: 1,
      weather: getWeatherProfile('clear'),
      reducedMotion: false,
    })
    const winterNight = deriveWeatherEffects({
      elapsed: 120,
      dayPhase: 0,
      seasonPosition: 3,
      weather: getWeatherProfile('clear'),
      reducedMotion: false,
    })
    expect(summerNight.fireflies).toBeGreaterThan(0)
    expect(winterNight.fireflies).toBe(0)
  })

  it('forms dew at a clear dawn after low precipitation', () => {
    const dawn = deriveWeatherEffects({
      elapsed: 120,
      dayPhase: 0.24,
      seasonPosition: 1,
      weather: getWeatherProfile('clear'),
      reducedMotion: false,
    })
    const rainyDawn = deriveWeatherEffects({
      elapsed: 120,
      dayPhase: 0.24,
      seasonPosition: 1,
      weather: getWeatherProfile('rain'),
      reducedMotion: false,
    })
    expect(dawn.dew).toBeGreaterThan(0)
    expect(rainyDawn.dew).toBe(0)
  })

  it('does not form dew at cloudy or foggy dawns', () => {
    const deriveDawn = (preset: 'cloudy' | 'fog') =>
      deriveWeatherEffects({
        elapsed: 120,
        dayPhase: 0.24,
        seasonPosition: 1,
        weather: getWeatherProfile(preset),
        reducedMotion: false,
      })

    expect(deriveDawn('cloudy').dew).toBe(0)
    expect(deriveDawn('fog').dew).toBe(0)
  })

  it('matches rain streak orientation to the center trajectory', () => {
    const calm = deriveRainStreakOrientation([1, 0], 0)
    const eastWind = deriveRainStreakOrientation([1, 0], 0.8)
    const westWind = deriveRainStreakOrientation([-1, 0], 0.8)
    const diagonalWind = deriveRainStreakOrientation([3, 4], 0.8)

    expect(calm).toEqual({ x: 0, y: -1, z: 0 })
    expect(eastWind.x).toBeGreaterThan(0)
    expect(westWind.x).toBeLessThan(0)
    expect(Math.abs(eastWind.x / eastWind.y)).toBeCloseTo(
      0.04857142857142858,
    )
    expect(
      Math.hypot(diagonalWind.x, diagonalWind.z) /
        Math.abs(diagonalWind.y),
    ).toBeCloseTo(0.04857142857142858)
  })

  it('suppresses fast storm flashes for reduced motion', () => {
    const effects = deriveWeatherEffects({
      elapsed: 120,
      dayPhase: 0.4,
      seasonPosition: 1,
      weather: getWeatherProfile('storm'),
      reducedMotion: true,
    })
    expect(effects.stormFlash).toBe(0)
  })

  it('blends all derived effects into reusable storage', () => {
    const source = {
      pollen: 0.8,
      rain: 0,
      snow: 0,
      fireflies: 0.6,
      dew: 0.4,
      stormFlash: 0,
    }
    const target = {
      pollen: 0,
      rain: 1,
      snow: 0.5,
      fireflies: 0,
      dew: 0,
      stormFlash: 0.8,
    }
    const output = { ...source }

    expect(blendWeatherEffects(source, target, 0.5, output)).toBe(output)
    expect(output).toEqual({
      pollen: 0.4,
      rain: 0.5,
      snow: 0.25,
      fireflies: 0.3,
      dew: 0.2,
      stormFlash: 0.4,
    })
  })
})
