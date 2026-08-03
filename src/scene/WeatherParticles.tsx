import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, type MutableRefObject } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three'
import type { QualityProfile } from '../core/quality'
import type { SeasonAppearance } from '../core/season'
import type { EnvironmentSnapshot } from '../core/simulation'
import {
  RAIN_STREAK_FALL_DISTANCE,
  RAIN_STREAK_WIND_DRIFT,
  deriveRainStreakOrientation,
  type WeatherEffects,
} from '../core/weather'
import { getBloomEmissionScale } from './postProcessingShaders'

interface WeatherParticlesProps {
  quality: QualityProfile
  snapshotRef: MutableRefObject<EnvironmentSnapshot>
  seasonRef: MutableRefObject<SeasonAppearance>
  effectsRef: MutableRefObject<WeatherEffects>
  reducedMotion: boolean
  visible: boolean
}

const particleVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uKind;
  uniform float uPointSize;
  uniform float uWindStrength;
  uniform float uFallSpeed;
  uniform vec2 uWindDirection;
  uniform vec3 uRainStreakOrientation;
  varying float vFade;
  varying float vPulse;
  varying float vRainAngle;

  void main() {
    vec3 animated = position;
    if (uKind < 0.5) {
      animated.y = mod(position.y + uTime * uFallSpeed, 3.6) - 0.25;
      animated.xz += uWindDirection * uWindStrength * 0.18;
      animated.x += sin(position.y * 1.7 + uTime * 0.38 + position.z) * (0.18 + uWindStrength * 0.32);
      animated.y += sin(position.x * 0.5 + uTime * 0.62) * 0.22;
    } else if (uKind < 1.5) {
      animated.y = mod(position.y + 3.0 - uTime * uFallSpeed, 15.0) - 2.0;
      animated.xz += uWindDirection * uWindStrength * ${RAIN_STREAK_WIND_DRIFT.toFixed(2)} * (12.0 - animated.y) / ${RAIN_STREAK_FALL_DISTANCE.toFixed(1)};
    } else if (uKind < 2.5) {
      animated.y = mod(position.y + 3.0 - uTime * uFallSpeed, 15.0) - 2.0;
      animated.xz += uWindDirection * uWindStrength * 0.24;
      animated.x += sin(uTime * 0.42 + position.y * 1.6) * (0.45 + uWindStrength * 0.4);
      animated.z += cos(uTime * 0.31 + position.x) * 0.28;
    } else {
      animated.y = mod(position.y, 1.85) + 0.12;
      animated.x += sin(uTime * 0.54 + position.z * 1.8) * 0.36;
      animated.z += cos(uTime * 0.47 + position.x * 1.4) * 0.3;
    }

    vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
    vec4 projectedStreakOrientation = projectionMatrix * viewMatrix * vec4(uRainStreakOrientation, 0.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = uPointSize * clamp(18.0 / -viewPosition.z, 0.45, 2.2);
    vFade = smoothstep(-2.0, 1.0, animated.y) * smoothstep(13.0, 9.0, animated.y);
    vPulse = uKind > 2.5 ? 0.52 + 0.48 * sin(uTime * 2.1 + position.x * 3.7 + position.z) : 1.0;
    vRainAngle = uKind > 0.5 && uKind < 1.5
      ? atan(projectedStreakOrientation.x, -projectedStreakOrientation.y)
      : 0.0;
  }
`

const particleFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uKind;
  varying float vFade;
  varying float vPulse;
  varying float vRainAngle;

  void main() {
    vec2 centered = gl_PointCoord - 0.5;
    float shape;
    if (uKind > 0.5 && uKind < 1.5) {
      float cosine = cos(vRainAngle);
      float sine = sin(vRainAngle);
      vec2 oriented = mat2(cosine, sine, -sine, cosine) * centered;
      shape = smoothstep(0.22, 0.04, abs(oriented.x)) * smoothstep(0.5, 0.02, abs(oriented.y));
    } else {
      shape = smoothstep(0.5, 0.08, length(centered));
    }
    if (shape < 0.02) discard;
    gl_FragColor = vec4(uColor, shape * uOpacity * vFade * vPulse);
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

function createParticleMaterial(
  kind: number,
  color: string,
  size: number,
  fallSpeed: number,
  emissionScale = 1,
) {
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
      uWindStrength: { value: 0.5 },
      uFallSpeed: { value: fallSpeed },
      uWindDirection: { value: new Vector2(0.86, 0.5).normalize() },
      uRainStreakOrientation: { value: new Vector3(0, -1, 0) },
      uColor: { value: new Color(color).multiplyScalar(emissionScale) },
      uOpacity: { value: 0 },
    },
  })
}

export function WeatherParticles({
  quality,
  snapshotRef,
  seasonRef,
  effectsRef,
  reducedMotion,
  visible,
}: WeatherParticlesProps) {
  const geometry = useMemo(
    () => createParticleGeometry(quality.particles),
    [quality.particles],
  )
  const materials = useMemo(
    () => [
      createParticleMaterial(0, '#d8c279', 1.2, 0.08),
      createParticleMaterial(1, '#a8cce2', 4.6, 8),
      createParticleMaterial(2, '#edf4f2', 5.6, 0.7),
      createParticleMaterial(
        3,
        '#d9ed72',
        3.8,
        0,
        getBloomEmissionScale(quality.postprocessing, 'firefly'),
      ),
    ],
    [quality.postprocessing],
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
    const effects = effectsRef.current

    for (let index = 0; index < materials.length; index += 1) {
      materials[index].uniforms.uTime.value = snapshot.elapsed
      materials[index].uniforms.uWindStrength.value = snapshot.weather.windStrength
      materials[index].uniforms.uWindDirection.value
        .set(...snapshot.weather.windDirection)
        .normalize()
    }
    deriveRainStreakOrientation(
      snapshot.weather.windDirection,
      snapshot.weather.windStrength,
      materials[1].uniforms.uRainStreakOrientation.value,
    )
    materials[0].uniforms.uOpacity.value = effects.pollen * seasonRef.current.pollen
    materials[1].uniforms.uOpacity.value = effects.rain
    materials[2].uniforms.uOpacity.value = effects.snow
    materials[3].uniforms.uOpacity.value = effects.fireflies
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
