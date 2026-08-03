import type { ShaderMaterial } from 'three'
import type { AtmosphereState } from '../core/atmosphere'

export function syncGrassAtmosphereUniforms(
  uniforms: ShaderMaterial['uniforms'],
  atmosphere: AtmosphereState,
) {
  uniforms.uSunDirection.value.set(...atmosphere.celestial.sun.direction)
  uniforms.uMoonDirection.value.set(...atmosphere.celestial.moon.direction)
  uniforms.uSunColor.value.copy(atmosphere.sunColor)
  uniforms.uMoonColor.value.copy(atmosphere.moonColor)
  uniforms.uSkyColor.value.copy(atmosphere.skyLightColor)
  uniforms.uGroundLightColor.value.copy(atmosphere.groundLightColor)
  uniforms.uSkyLightIntensity.value = atmosphere.skyLightIntensity
  uniforms.uSunIntensity.value = atmosphere.sunIntensity
  uniforms.uMoonIntensity.value = atmosphere.moonIntensity
  uniforms.uLunarAmbient.value = atmosphere.lunarAmbient
  uniforms.uFogColor.value.copy(atmosphere.fogColor)
  uniforms.uFogDensity.value = atmosphere.fogDensity
}
