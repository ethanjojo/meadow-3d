import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, type MutableRefObject } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ShaderMaterial,
} from 'three'
import type { NatureSnapshot } from '../core/natureClock'
import type { QualityProfile } from '../core/quality'
import type { SeasonAppearance } from '../core/season'
import { getWeatherOpacity } from '../core/weather'

interface WeatherParticlesProps {
  quality: QualityProfile
  snapshotRef: MutableRefObject<NatureSnapshot>
  seasonRef: MutableRefObject<SeasonAppearance>
  reducedMotion: boolean
  visible: boolean
}

const particleVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uKind;
  uniform float uPointSize;
  uniform float uWind;
  varying float vFade;

  void main() {
    vec3 animated = position;
    if (uKind < 0.5) {
      animated.y = mod(position.y, 3.6) - 0.25;
      animated.x += sin(position.y * 1.7 + uTime * 0.38 + position.z) * (0.18 + uWind * 0.32);
      animated.y += sin(position.x * 0.5 + uTime * 0.62) * 0.22;
    } else if (uKind < 1.5) {
      animated.y = mod(position.y + 3.0 - uTime * 8.0, 15.0) - 2.0;
      animated.x += uWind * 0.85 * (12.0 - animated.y) / 14.0;
    } else {
      animated.y = mod(position.y + 3.0 - uTime * 0.7, 15.0) - 2.0;
      animated.x += sin(uTime * 0.42 + position.y * 1.6) * (0.45 + uWind * 0.4);
      animated.z += cos(uTime * 0.31 + position.x) * 0.28;
    }

    vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = uPointSize * clamp(18.0 / -viewPosition.z, 0.45, 2.2);
    vFade = smoothstep(-2.0, 1.0, animated.y) * smoothstep(13.0, 9.0, animated.y);
  }
`

const particleFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uKind;
  varying float vFade;

  void main() {
    vec2 centered = gl_PointCoord - 0.5;
    float shape;
    if (uKind > 0.5 && uKind < 1.5) {
      shape = smoothstep(0.22, 0.04, abs(centered.x)) * smoothstep(0.5, 0.02, abs(centered.y));
    } else {
      shape = smoothstep(0.5, 0.08, length(centered));
    }
    if (shape < 0.02) discard;
    gl_FragColor = vec4(uColor, shape * uOpacity * vFade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function createParticleGeometry(count: number) {
  const positions = new Float32Array(count * 3)
  let state = 1_973
  const random = () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 4_294_967_296
  }

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3
    positions[offset] = (random() - 0.5) * 40
    positions[offset + 1] = random() * 14 - 1
    positions[offset + 2] = random() * 25 - 17
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  return geometry
}

function createParticleMaterial(kind: number, color: string, size: number) {
  return new ShaderMaterial({
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uKind: { value: kind },
      uPointSize: { value: size },
      uWind: { value: 0.5 },
      uColor: { value: new Color(color) },
      uOpacity: { value: 0 },
    },
  })
}

export function WeatherParticles({
  quality,
  snapshotRef,
  seasonRef,
  reducedMotion,
  visible,
}: WeatherParticlesProps) {
  const geometry = useMemo(
    () => createParticleGeometry(quality.particles),
    [quality.particles],
  )
  const materials = useMemo(
    () => [
      createParticleMaterial(0, '#d8c279', 1.2),
      createParticleMaterial(1, '#a8cce2', 4.6),
      createParticleMaterial(2, '#edf4f2', 5.6),
    ],
    [],
  )

  useEffect(() => {
    geometry.setDrawRange(
      0,
      reducedMotion ? Math.floor(quality.particles * 0.25) : quality.particles,
    )
  }, [geometry, quality.particles, reducedMotion])

  useEffect(
    () => () => {
      geometry.dispose()
      for (const material of materials) material.dispose()
    },
    [geometry, materials],
  )

  useFrame(() => {
    if (!visible) return

    const snapshot = snapshotRef.current
    const opacity = getWeatherOpacity(snapshot, seasonRef.current)
    const opacities = [opacity.pollen, opacity.rain, opacity.snow]

    for (let index = 0; index < materials.length; index += 1) {
      materials[index].uniforms.uTime.value = snapshot.elapsed
      materials[index].uniforms.uWind.value = snapshot.windStrength
      materials[index].uniforms.uOpacity.value = opacities[index]
    }
  })

  return (
    <group>
      {materials.map((material, index) => (
        <points
          key={index}
          geometry={geometry}
          material={material}
          frustumCulled={false}
        />
      ))}
    </group>
  )
}
