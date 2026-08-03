import type { ShaderMaterial } from 'three'
import type { AtmosphereState } from '../core/atmosphere'

export function syncGrassAtmosphereUniforms(
  uniforms: ShaderMaterial['uniforms'],
  atmosphere: AtmosphereState,
) {
  uniforms.uSunDirection.value.set(...atmosphere.celestial.sun.direction)
  uniforms.uMoonDirection.value.set(...atmosphere.celestial.moon.direction)
  uniforms.uSunColor.value
    .copy(atmosphere.sunColor)
    .multiplyScalar(atmosphere.sunIntensity)
  uniforms.uMoonColor.value
    .copy(atmosphere.moonColor)
    .multiplyScalar(atmosphere.moonIntensity)
  uniforms.uSkyColor.value
    .copy(atmosphere.skyLightColor)
    .multiplyScalar(atmosphere.skyLightIntensity)
  uniforms.uFogColor.value.copy(atmosphere.fogColor)
  uniforms.uFogDensity.value = atmosphere.fogDensity
}
