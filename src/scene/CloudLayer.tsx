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
  uniform vec3 uTint;
  uniform float uTintStrength;
  uniform float uCloudCover;
  uniform float uStorm;
  uniform float uTime;
  uniform vec2 uWind;
  uniform vec2 uReliefDir;
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

  float fbm(vec2 point) {
    float value = noise(point) * 0.54;
    point = point * 2.17 + vec2(19.7, -8.3);
    value += noise(point) * 0.28;
    point = point * 2.29 + vec2(-4.1, 27.9);
    value += noise(point) * 0.18;
    return value;
  }

  void main() {
    vec2 drift = normalize(uWind + vec2(0.0001)) * uTime;
    vec2 warp = vec2(
      noise(vUv * 2.6 + drift * 0.6),
      noise(vUv * 2.6 - vec2(31.2) - drift * 0.5)
    ) - 0.5;
    vec2 field = vUv * (3.1 + uLayer * 0.35) + warp * 0.55;

    float broad = fbm(field + drift);
    float detail = fbm(field * 2.4 - drift * 1.7);
    float density = broad * 0.68 + detail * 0.32;
    float threshold = 0.80 - uCloudCover * 0.56;
    float cloud = smoothstep(threshold, threshold + 0.2, density);
    cloud = pow(cloud, 1.22);

    float neighbor = fbm(field + drift + uReliefDir * 0.11);
    float relief = clamp((density - neighbor) * 2.8, -1.0, 1.0);

    vec2 edgeDistance = min(vUv, 1.0 - vUv);
    float edge = smoothstep(0.0, 0.16, min(edgeDistance.x, edgeDistance.y));
    float alpha = cloud * edge * (0.16 + uCloudCover * 0.34 + uStorm * 0.14);

    vec3 base = mix(uColor, vec3(0.2, 0.23, 0.27), uStorm * 0.62);
    base *= 0.86 + cloud * 0.1;
    vec3 lit = base * (1.0 + relief * 0.28) +
      uTint * max(relief, 0.0) * uTintStrength * 0.85;
    gl_FragColor = vec4(lit, alpha);
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
      uTint: { value: new Color('#ffd9a0') },
      uTintStrength: { value: 0 },
      uCloudCover: { value: 0 },
      uStorm: { value: 0 },
      uTime: { value: 0 },
      uWind: { value: new Vector2(0.86, 0.5) },
      uReliefDir: { value: new Vector2(-0.55, 0.83).normalize() },
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
    for (const material of materials) {
      material.uniforms.uCloudCover.value = snapshot.weather.cloudCover
      material.uniforms.uStorm.value = snapshot.weather.storm
      material.uniforms.uTime.value = cloudPhaseRef.current
      material.uniforms.uWind.value.set(...snapshot.weather.windDirection)
      material.uniforms.uTint.value
        .copy(atmosphere.sunColor)
        .lerp(atmosphere.moonColor, 0.55)
      material.uniforms.uTintStrength.value =
        Math.min(
          1,
          (atmosphere.sunIntensity + atmosphere.moonIntensity) / 1.4,
        ) *
        (1 - snapshot.weather.storm * 0.8) *
        (1 - snapshot.weather.cloudCover * 0.35)
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
