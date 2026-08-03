import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, type MutableRefObject } from 'react'
import {
  Color,
  DoubleSide,
  ShaderMaterial,
  Vector2,
} from 'three'
import type { AtmosphereState } from '../core/atmosphere'
import type { QualityProfile } from '../core/quality'
import type { EnvironmentSnapshot } from '../core/simulation'

interface CloudLayerProps {
  quality: QualityProfile
  snapshotRef: MutableRefObject<EnvironmentSnapshot>
  atmosphereRef: MutableRefObject<AtmosphereState>
  visible: boolean
}

const cloudVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const cloudFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uCloudCover;
  uniform float uStorm;
  uniform float uTime;
  uniform vec2 uWind;
  uniform float uLayer;
  varying vec2 vUv;

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    float a = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
    float b = fract(sin(dot(cell + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
    float c = fract(sin(dot(cell + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
    float d = fract(sin(dot(cell + vec2(1.0), vec2(127.1, 311.7))) * 43758.5453);
    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
  }

  void main() {
    vec2 drift = normalize(uWind + vec2(0.0001)) * uTime;
    float broad = noise(vUv * (3.1 + uLayer * 0.35) + drift);
    float detail = noise(vUv * (8.4 + uLayer * 0.7) - drift * 1.7);
    float density = broad * 0.7 + detail * 0.3;
    float threshold = 0.82 - uCloudCover * 0.56;
    float cloud = smoothstep(threshold, threshold + 0.22, density);
    vec2 edgeDistance = min(vUv, 1.0 - vUv);
    float edge = smoothstep(0.0, 0.16, min(edgeDistance.x, edgeDistance.y));
    float alpha = cloud * edge * (0.18 + uCloudCover * 0.28 + uStorm * 0.12);
    gl_FragColor = vec4(mix(uColor, vec3(0.22, 0.25, 0.29), uStorm * 0.58), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function createCloudMaterial(layer: number) {
  return new ShaderMaterial({
    vertexShader: cloudVertexShader,
    fragmentShader: cloudFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uColor: { value: new Color('#e4e9e5') },
      uCloudCover: { value: 0 },
      uStorm: { value: 0 },
      uTime: { value: 0 },
      uWind: { value: new Vector2(0.86, 0.5) },
      uLayer: { value: layer },
    },
  })
}

export function CloudLayer({
  quality,
  snapshotRef,
  atmosphereRef,
  visible,
}: CloudLayerProps) {
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

  useFrame(() => {
    if (!visible) return

    const snapshot = snapshotRef.current
    const atmosphere = atmosphereRef.current
    for (const material of materials) {
      material.uniforms.uCloudCover.value = snapshot.weather.cloudCover
      material.uniforms.uStorm.value = snapshot.weather.storm
      material.uniforms.uTime.value = snapshot.autoElapsed * atmosphere.cloudSpeed
      material.uniforms.uWind.value.set(...snapshot.weather.windDirection)
    }
  })

  return (
    <group renderOrder={3}>
      {materials.map((material, layer) => (
        <mesh
          key={layer}
          position={[layer * 9 - 8, 18 + layer * 3.5, -28 - layer * 5]}
          rotation={[-Math.PI / 2.5, 0, layer * 0.18]}
          material={material}
          frustumCulled={false}
        >
          <planeGeometry args={[118 + layer * 16, 68 + layer * 9, 1, 1]} />
        </mesh>
      ))}
    </group>
  )
}
