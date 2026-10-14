import type { SceneSettings } from '../core/sceneSettings'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, type MutableRefObject } from 'react'
import { BackSide, Color, ShaderMaterial, Vector2, Vector3 } from 'three'
import type { AtmosphereState } from '../core/atmosphere'
import { getCloudSunWeight } from '../core/atmosphere'
import type { QualityProfile } from '../core/quality'
import type { EnvironmentSnapshot } from '../core/simulation'
import type { WeatherEffects } from '../core/weather'
import { cloudFieldChunk } from './cloudShaders'
import { useCloudNoise } from './cloudNoise'
import { getStormEvent } from '../core/sceneEffects'

interface CloudLayerProps {
  sceneSettings: SceneSettings
  stormDistanceKm?: number
  quality: QualityProfile
  snapshotRef: MutableRefObject<EnvironmentSnapshot>
  atmosphereRef: MutableRefObject<AtmosphereState>
  effectsRef: MutableRefObject<WeatherEffects>
  visible: boolean
}

export function CloudLayer({ sceneSettings, stormDistanceKm, quality, snapshotRef, atmosphereRef, effectsRef, visible }: CloudLayerProps) {
  const cloudNoise = useCloudNoise()
  const material = useMemo(() => new ShaderMaterial({
    side: BackSide, transparent: true, depthWrite: false,
    defines: { CLOUD_LAYERS: quality.cloudLayers },
    uniforms: {
      uCloudNoise: { value: cloudNoise },
      uCover: { value: 0 }, uStorm: { value: 0 }, uFlash: { value: 0 }, uFlashX: { value: 0 },
      uDrift: { value: new Vector2() }, uSunDirection: { value: new Vector3(0, 1, 0) }, uMoonDirection: { value: new Vector3(0, -1, 0) },
      uColor: { value: new Color() }, uSunTint: { value: new Color() }, uMoonTint: { value: new Color() }, uSunWeight: { value: 1 }, uDay: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vDirection = world.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uCover, uStorm, uFlash, uFlashX, uDay, uSunWeight;
      uniform vec2 uDrift;
      uniform vec3 uSunDirection, uMoonDirection, uColor, uSunTint, uMoonTint;
      varying vec3 vDirection;
      ${cloudFieldChunk}
      void main() {
        vec3 ray = normalize(vDirection);
        vec2 p = cloudSkyPoint(ray);
        float density = cloudDensity(p, uDrift, uCover);
        #if CLOUD_LAYERS > 1
          float wisps = cloudDensity(p * 1.23 + vec2(37.0, -19.0), uDrift * 0.73, uCover * 0.85);
          density = max(density, wisps * 0.42);
        #endif
        #if CLOUD_LAYERS > 2
          density = max(density, cloudDensity(p * 0.7 - 42.0, uDrift * 0.45, uCover * 0.8) * 0.25);
        #endif
        float sunEdge = 0.0, moonEdge = 0.0;
        if (uSunWeight > 0.0) sunEdge = cloudLightEdge(p, density, uSunDirection, uDrift, uCover);
        if (uSunWeight < 1.0) moonEdge = cloudLightEdge(p, density, uMoonDirection, uDrift, uCover);
        float thickness = smoothstep(0.2, 1.0, density);
        vec3 base = uColor * mix(1.06, 0.52 - uStorm * 0.16, thickness);
        vec3 edgeTint = uSunTint * sunEdge * uSunWeight + uMoonTint * moonEdge * (1.0 - uSunWeight);
        base += edgeTint * (0.08 + 0.55 * uDay) * (1.0 - uStorm * 0.7);
        float sunSilver = pow(max(dot(ray, normalize(uSunDirection)), 0.0), 12.0);
        float moonSilver = pow(max(dot(ray, normalize(uMoonDirection)), 0.0), 12.0);
        vec3 silverTint = uSunTint * sunSilver * uSunWeight + uMoonTint * moonSilver * (1.0 - uSunWeight);
        base += silverTint * (1.0 - thickness) * (0.04 + uDay * 0.24);
        float flashDistance = (ray.x - uFlashX * .55) * 3.5;
        float localFlash = exp(-flashDistance * flashDistance);
        base += vec3(0.65, 0.76, 1.0) * uFlash * (.18 + localFlash * .82);
        float horizon = smoothstep(0.02, 0.22, ray.y);
        float alpha = density * horizon * mix(0.88, 0.97, uCover);
        gl_FragColor = vec4(base, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }), [quality.cloudLayers, cloudNoise])
  useEffect(() => () => material.dispose(), [material])
  useFrame(() => {
    if (!visible) return
    const state = atmosphereRef.current, weather = snapshotRef.current.weather
    const day = Math.max(0, Math.min(1, state.sunIntensity / 1.8))
    material.uniforms.uCover.value = weather.cloudCover
    material.uniforms.uStorm.value = weather.storm
    material.uniforms.uFlash.value = effectsRef.current.stormFlash
    material.uniforms.uFlashX.value = getStormEvent(snapshotRef.current.elapsed, {interval: sceneSettings.lightningInterval, distanceKm: stormDistanceKm}).x
    material.uniforms.uDay.value = day
    material.uniforms.uDrift.value.set(...weather.windDirection).normalize().multiplyScalar(state.cloudPhase)
    material.uniforms.uSunWeight.value = getCloudSunWeight(state.sunElevation)
    material.uniforms.uSunDirection.value.set(...state.celestial.sun.direction)
    material.uniforms.uMoonDirection.value.set(...state.celestial.moon.direction)
    material.uniforms.uColor.value.copy(state.skyLightColor).multiplyScalar(.18 + day * 1.05)
    material.uniforms.uSunTint.value.copy(state.sunColor)
    material.uniforms.uMoonTint.value.copy(state.moonColor)
  })
  return <mesh name="cloud-sky" renderOrder={3} scale={103} material={material} frustumCulled={false}><sphereGeometry args={[1, 40, 20]} /></mesh>
}
