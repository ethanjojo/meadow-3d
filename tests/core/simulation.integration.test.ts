import { describe, expect, it } from 'vitest'
import { getAtmosphere } from '../../src/core/atmosphere'
import { DEFAULT_CLOCK, sampleNatureClock } from '../../src/core/natureClock'
import { getSeasonAppearance } from '../../src/core/season'
import { createEnvironmentSnapshot } from '../../src/core/simulation'
import { deriveWeatherEffects } from '../../src/core/weather'

describe('shared environment state', () => {
  it('keeps manual storm consequences coherent across consumers', () => {
    const auto = sampleNatureClock(DEFAULT_CLOCK.dayDuration * 0.4)
    const storm = createEnvironmentSnapshot(auto, {
      mode: 'manual',
      dayPhase: 0.4,
      seasonIndex: 1,
      weather: 'storm',
    })
    const clear = createEnvironmentSnapshot(auto, {
      mode: 'manual',
      dayPhase: 0.4,
      seasonIndex: 1,
      weather: 'clear',
    })
    const season = getSeasonAppearance(storm)
    const stormAtmosphere = getAtmosphere(storm, season)
    const clearAtmosphere = getAtmosphere(clear, getSeasonAppearance(clear))
    const effects = deriveWeatherEffects({
      elapsed: storm.elapsed,
      dayPhase: storm.dayPhase,
      seasonPosition: storm.seasonPosition,
      weather: storm.weather,
      reducedMotion: true,
    })

    expect(storm.weather.windStrength).toBeGreaterThan(
      clear.weather.windStrength,
    )
    expect(stormAtmosphere.fogDensity).toBeGreaterThan(
      clearAtmosphere.fogDensity,
    )
    expect(effects.rain).toBeGreaterThan(0)
    expect(effects.snow).toBe(0)
    expect(effects.stormFlash).toBe(0)
  })
})
