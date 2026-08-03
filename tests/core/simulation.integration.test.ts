import { describe, expect, it } from 'vitest'
import { Color, ShaderMaterial, Vector3 } from 'three'
import { getAtmosphere } from '../../src/core/atmosphere'
import { DEFAULT_CLOCK, sampleNatureClock } from '../../src/core/natureClock'
import { getSeasonAppearance } from '../../src/core/season'
import { createEnvironmentSnapshot } from '../../src/core/simulation'
import { deriveWeatherEffects } from '../../src/core/weather'
import { syncGrassAtmosphereUniforms } from '../../src/scene/grassAtmosphere'

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

  it('writes the shared atmosphere light and fog contract into grass uniforms', () => {
    const auto = sampleNatureClock(DEFAULT_CLOCK.dayDuration * 0.5)
    const snapshot = createEnvironmentSnapshot(auto, {
      mode: 'manual',
      dayPhase: 0.5,
      seasonIndex: 1,
      weather: 'fog',
    })
    const atmosphere = getAtmosphere(snapshot, getSeasonAppearance(snapshot))
    const material = new ShaderMaterial({
      uniforms: {
        uSunDirection: { value: new Vector3() },
        uMoonDirection: { value: new Vector3() },
        uSunColor: { value: new Color() },
        uMoonColor: { value: new Color() },
        uSkyColor: { value: new Color() },
        uGroundLightColor: { value: new Color() },
        uSkyLightIntensity: { value: 0 },
        uSunIntensity: { value: 0 },
        uMoonIntensity: { value: 0 },
        uFogColor: { value: new Color() },
        uFogDensity: { value: 0 },
      },
    })

    syncGrassAtmosphereUniforms(material.uniforms, atmosphere)

    expect(material.uniforms.uSunDirection.value.toArray()).toEqual(
      atmosphere.celestial.sun.direction,
    )
    expect(material.uniforms.uMoonDirection.value.toArray()).toEqual(
      atmosphere.celestial.moon.direction,
    )
    expect(material.uniforms.uSunColor.value.toArray()).toEqual(
      atmosphere.sunColor.toArray(),
    )
    expect(material.uniforms.uMoonColor.value.toArray()).toEqual(
      atmosphere.moonColor.toArray(),
    )
    expect(material.uniforms.uSkyColor.value.toArray()).toEqual(
      atmosphere.skyLightColor.toArray(),
    )
    expect(material.uniforms.uGroundLightColor.value.toArray()).toEqual(
      atmosphere.groundLightColor.toArray(),
    )
    expect(material.uniforms.uSkyLightIntensity.value).toBe(
      atmosphere.skyLightIntensity,
    )
    expect(material.uniforms.uSunIntensity.value).toBe(atmosphere.sunIntensity)
    expect(material.uniforms.uMoonIntensity.value).toBe(
      atmosphere.moonIntensity,
    )
    expect(material.uniforms.uFogColor.value.getHex()).toBe(
      atmosphere.fogColor.getHex(),
    )
    expect(material.uniforms.uFogDensity.value).toBe(atmosphere.fogDensity)
  })
})
