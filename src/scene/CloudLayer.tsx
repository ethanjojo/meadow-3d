import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import {
  Color,
  DoubleSide,
  ShaderMaterial,
  Vector2,
} from 'three'
import {
  advanceCloudPhase,
  type AtmosphereState,
} from '../core/atmosphere'
import type { QualityProfile } from '../core/quality'
import type { EnvironmentSnapshot } from '../core/simulation'
import {
  cloudFragmentShader,
  cloudVertexShader,
  getCloudLayerProfile,
} from './cloudShaders'

interface CloudLayerProps {
  quality: QualityProfile
  snapshotRef: MutableRefObject<EnvironmentSnapshot>
  atmosphereRef: MutableRefObject<AtmosphereState>
  visible: boolean
}

function createCloudMaterial(layer: number) {
  const profile = getCloudLayerProfile(layer)
  return new ShaderMaterial({
    vertexShader: cloudVertexShader,
    fragmentShader: cloudFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uCloudLightColor: { value: new Color('#e4e9e5') },
      uCloudShadowColor: { value: new Color('#303b42') },
      uCloudLightIntensity: { value: 0.7 },
      uSolarScatter: { value: 0 },
      uLunarAmbient: { value: 0.12 },
      uCloudCover: { value: 0 },
      uStorm: { value: 0 },
      uTime: { value: 0 },
      uWind: { value: new Vector2(0.86, 0.5) },
      uNoiseScale: { value: profile.noiseScale },
      uDetailScale: { value: profile.detailScale },
      uOpacityScale: { value: profile.opacityScale },
    },
  })
}

export function CloudLayer({
  quality,
  snapshotRef,
  atmosphereRef,
  visible,
}: CloudLayerProps) {
  const cloudPhaseRef = useRef(0)
  const materials = useMemo(
    () =>
      Array.from({ length: quality.cloudLayers }, (_, layer) =>
        createCloudMaterial(layer),
      ),
    [quality.cloudLayers],
  )

  useEffect(
    () => () => {
      for (const material of materials) material.dispose()
    },
    [materials],
  )

  useFrame((_, deltaSeconds) => {
    if (!visible) return

    const snapshot = snapshotRef.current
    const atmosphere = atmosphereRef.current
    cloudPhaseRef.current = advanceCloudPhase(
      cloudPhaseRef.current,
      deltaSeconds,
      atmosphere.cloudSpeed,
    )
    for (const [layer, material] of materials.entries()) {
      const profile = getCloudLayerProfile(layer)
      material.uniforms.uCloudLightColor.value.copy(
        atmosphere.cloudLightColor,
      )
      material.uniforms.uCloudShadowColor.value.copy(
        atmosphere.cloudShadowColor,
      )
      material.uniforms.uCloudLightIntensity.value =
        atmosphere.cloudLightIntensity
      material.uniforms.uSolarScatter.value = atmosphere.solarScatter
      material.uniforms.uLunarAmbient.value = atmosphere.lunarAmbient
      material.uniforms.uCloudCover.value = snapshot.weather.cloudCover
      material.uniforms.uStorm.value = snapshot.weather.storm
      material.uniforms.uTime.value =
        cloudPhaseRef.current * profile.driftScale
      material.uniforms.uWind.value.set(...snapshot.weather.windDirection)
    }
  })

  return (
    <group renderOrder={3}>
      {materials.map((material, layer) => {
        const profile = getCloudLayerProfile(layer)
        return (
          <mesh
            key={layer}
            position={[
              layer * 9 - 8,
              profile.height,
              profile.depth,
            ]}
            rotation={[-Math.PI / 2.5, 0, layer * 0.18]}
            material={material}
            frustumCulled={false}
          >
            <planeGeometry
              args={[profile.width, profile.width * 0.58, 1, 1]}
            />
          </mesh>
        )
      })}
    </group>
  )
}
