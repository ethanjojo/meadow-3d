import { describe, expect, it } from 'vitest'
import { Color, ShaderMaterial, Vector3 } from 'three'
import { getCelestialState } from '../../src/core/celestial'
import { DEFAULT_CLOCK, sampleNatureClock } from '../../src/core/natureClock'
import { getSeasonAppearance } from '../../src/core/season'
import {
  advanceCloudPhase,
  blendAtmosphere,
  getAtmosphere,
} from '../../src/core/atmosphere'
import {
  createEnvironmentSnapshot,
  type WeatherPreset,
} from '../../src/core/simulation'
import { syncGrassAtmosphereUniforms } from '../../src/scene/grassAtmosphere'
import { grassFragmentShader } from '../../src/scene/grassShaders'

function sampleAtDayPhase(dayPhase: number, weather: WeatherPreset = 'clear') {
  const snapshot = sampleNatureClock(DEFAULT_CLOCK.dayDuration * dayPhase)
  const environment = createEnvironmentSnapshot(snapshot, {
    mode: 'manual',
    dayPhase,
    seasonIndex: snapshot.seasonIndex,
    weather,
  })
  return getAtmosphere(environment, getSeasonAppearance(environment))
}

describe('getAtmosphere', () => {
  it('places the sun highest at noon and reveals stars at midnight', () => {
    const midnight = sampleAtDayPhase(0)
    const dawn = sampleAtDayPhase(0.25)
    const noon = sampleAtDayPhase(0.5)
    const dusk = sampleAtDayPhase(0.75)

    expect(noon.sunElevation).toBeGreaterThan(dawn.sunElevation)
    expect(noon.sunElevation).toBeGreaterThan(dusk.sunElevation)
    expect(midnight.starOpacity).toBeGreaterThan(0.8)
    expect(noon.starOpacity).toBeLessThan(0.05)
  })

  it('keeps exposure and fog within render-safe ranges', () => {
    for (const dayPhase of [0, 0.25, 0.5, 0.75]) {
      const atmosphere = sampleAtDayPhase(dayPhase)
      expect(atmosphere.fogDensity).toBeGreaterThanOrEqual(0.002)
      expect(atmosphere.fogDensity).toBeLessThanOrEqual(0.04)
      expect(atmosphere.exposure).toBeGreaterThanOrEqual(0.55)
      expect(atmosphere.exposure).toBeLessThanOrEqual(1.15)
    }
  })

  it('keeps sunset directional, twilight continuous, and clear night readable', () => {
    const sunset = sampleAtDayPhase(0.73, 'clear')
    const afterSunset = sampleAtDayPhase(0.77, 'clear')
    const night = sampleAtDayPhase(0, 'clear')

    expect(sunset.solarScatter).toBeGreaterThan(0.45)
    expect(afterSunset.twilight).toBeGreaterThan(0.15)
    expect(night.lunarAmbient).toBeGreaterThanOrEqual(0.12)
    expect(night.skyLightIntensity).toBeGreaterThanOrEqual(0.4)
    expect(night.moonIntensity).toBeGreaterThanOrEqual(0.28)
    expect(sunset.cloudLightColor.r).toBeGreaterThan(
      sunset.cloudLightColor.b,
    )
  })

  it('uses weather cover to dim stars and celestial halos coherently', () => {
    const clearNight = sampleAtDayPhase(0, 'clear')
    const foggyNight = sampleAtDayPhase(0, 'fog')
    const stormyDay = sampleAtDayPhase(0.5, 'storm')
    const clearDay = sampleAtDayPhase(0.5, 'clear')

    expect(clearNight.cloudOpacity).toBeLessThan(stormyDay.cloudOpacity)
    expect(foggyNight.starOpacity).toBeLessThan(clearNight.starOpacity)
    expect(stormyDay.sunHalo).toBeLessThan(clearDay.sunHalo)
    expect(clearNight.moonHalo).toBeGreaterThan(0.5)
  })

  it('advances cloud phase continuously when weather changes after long uptime', () => {
    const longRunningPhase = 100
    const afterSpeedChange = advanceCloudPhase(longRunningPhase, 0.1, 0.011)
    const afterLongFrame = advanceCloudPhase(afterSpeedChange, 4, 0.011)

    expect(afterSpeedChange - longRunningPhase).toBeCloseTo(0.0011, 8)
    expect(afterLongFrame - afterSpeedChange).toBeCloseTo(0.0011, 8)
  })

  it('updates one reusable state with shared celestial and attenuated light values', () => {
    const auto = sampleNatureClock(DEFAULT_CLOCK.dayDuration * 0.5)
    const clear = createEnvironmentSnapshot(auto, {
      mode: 'manual',
      dayPhase: 0.5,
      seasonIndex: 1,
      weather: 'clear',
    })
    const storm = createEnvironmentSnapshot(auto, {
      mode: 'manual',
      dayPhase: 0.5,
      seasonIndex: 1,
      weather: 'storm',
    })
    const state = getAtmosphere(clear, getSeasonAppearance(clear))
    const celestial = state.celestial
    const clearSunIntensity = state.sunIntensity

    const updated = getAtmosphere(
      storm,
      getSeasonAppearance(storm),
      state,
    )

    expect(updated).toBe(state)
    expect(updated.celestial).toBe(celestial)
    expect(updated.celestial.sun.direction).toEqual(
      getCelestialState(storm.dayPhase).sun.direction,
    )
    expect(updated.sunIntensity).toBeLessThan(clearSunIntensity)
    expect(updated.sunColor.getHexString()).toBe('fff2cf')
    expect(updated.moonColor.getHexString()).toBe('8ba8cf')
    expect(updated.skyLightIntensity).toBeGreaterThan(0)
  })

  it('blends complete lighting state into reusable storage', () => {
    const source = sampleAtDayPhase(0.25, 'clear')
    const target = sampleAtDayPhase(0.5, 'storm')
    const output = sampleAtDayPhase(0, 'fog')
    const skyTop = output.skyTop
    const celestial = output.celestial
    const expectedSky = source.skyTop.clone().lerp(target.skyTop, 0.5)

    expect(blendAtmosphere(source, target, 0.5, output)).toBe(output)
    expect(output.skyTop).toBe(skyTop)
    expect(output.celestial).toBe(celestial)
    expect(output.skyTop.getHex()).toBe(expectedSky.getHex())
    expect(output.fogDensity).toBeCloseTo(
      (source.fogDensity + target.fogDensity) / 2,
    )
    expect(output.exposure).toBeCloseTo((source.exposure + target.exposure) / 2)
    expect(output.groundLightColor.getHex()).toBe(
      source.groundLightColor.clone().lerp(target.groundLightColor, 0.5).getHex(),
    )
    expect(output.sunIntensity).toBeCloseTo(
      (source.sunIntensity + target.sunIntensity) / 2,
    )
    expect(output.moonIntensity).toBeCloseTo(
      (source.moonIntensity + target.moonIntensity) / 2,
    )
    expect(Math.hypot(...output.celestial.sun.direction)).toBeCloseTo(1)
  })

  it('blends every new atmosphere field into reusable storage', () => {
    const source = sampleAtDayPhase(0.73)
    const target = sampleAtDayPhase(0)
    const output = sampleAtDayPhase(0.5)
    const cloudColor = output.cloudLightColor

    blendAtmosphere(source, target, 0.5, output)

    expect(output.cloudLightColor).toBe(cloudColor)
    expect(output.solarScatter).toBeCloseTo(
      (source.solarScatter + target.solarScatter) / 2,
    )
    expect(output.lunarAmbient).toBeCloseTo(
      (source.lunarAmbient + target.lunarAmbient) / 2,
    )
  })

  it('synchronizes complete hemisphere, sun, and moon grass lighting', () => {
    const atmosphere = sampleAtDayPhase(0.5, 'storm')
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
        uLunarAmbient: { value: 0 },
        uFogColor: { value: new Color() },
        uFogDensity: { value: 0 },
      },
    })

    syncGrassAtmosphereUniforms(material.uniforms, atmosphere)

    expect(material.uniforms.uSkyColor.value.getHex()).toBe(
      atmosphere.skyLightColor.getHex(),
    )
    expect(material.uniforms.uGroundLightColor.value.getHex()).toBe(
      atmosphere.groundLightColor.getHex(),
    )
    expect(material.uniforms.uSkyLightIntensity.value).toBe(
      atmosphere.skyLightIntensity,
    )
    expect(material.uniforms.uSunColor.value.getHex()).toBe(
      atmosphere.sunColor.getHex(),
    )
    expect(material.uniforms.uSunIntensity.value).toBe(atmosphere.sunIntensity)
    expect(material.uniforms.uMoonIntensity.value).toBe(
      atmosphere.moonIntensity,
    )
    expect(material.uniforms.uLunarAmbient.value).toBe(
      atmosphere.lunarAmbient,
    )
    expect(grassFragmentShader).toContain('moonWetHighlight')
  })
})
