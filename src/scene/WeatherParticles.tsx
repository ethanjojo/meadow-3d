import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import {
  AdditiveBlending,
  NormalBlending,
  Object3D,
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
  fireflyDensity: number
  quality: QualityProfile
  snapshotRef: MutableRefObject<EnvironmentSnapshot>
  seasonRef: MutableRefObject<SeasonAppearance>
  effectsRef: MutableRefObject<WeatherEffects>
  reducedMotion: boolean
  visible: boolean
  atmosphereRef: MutableRefObject<import('../core/atmosphere').AtmosphereState>
}

const particleVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uKind;
  uniform float uPointSize;
  uniform float uWindStrength;
  uniform float uFallSpeed;
  uniform float uDensity;
  uniform float uMotion;
  uniform vec2 uWindDirection;
  uniform vec3 uRainStreakOrientation;
  attribute float aSeed;
  varying float vFade;
  varying float vPulse;
  varying float vRainAngle;
  varying float vStretch;
  varying float vSeed;

  void main() {
    vec3 animated = position;
    float fade = smoothstep(-2.0, 1.0, animated.y) * smoothstep(13.0, 9.0, animated.y);
    float sizeFactor = 0.55 + aSeed * 0.9;
    float pulse = 1.0;
    vStretch = 1.0;
    vSeed = aSeed;
    float time = uTime * uMotion;

    if (uKind < 0.5) {
      animated.y = mod(position.y + time * uFallSpeed, 3.6) - 0.25;
      animated.xz += uWindDirection * uWindStrength * 0.18;
      animated.x += sin(position.y * 1.7 + time * 0.38 + position.z) * (0.18 + uWindStrength * 0.32);
      animated.y += sin(position.x * 0.5 + time * 0.62) * 0.22;
    } else if (uKind < 1.5) {
      float gate = step(aSeed, uDensity);
      animated.y = mod(position.y + 3.0 - time * uFallSpeed * (0.85 + aSeed * 0.3), 15.0) - 2.0;
      animated.xz += uWindDirection * uWindStrength * ${RAIN_STREAK_WIND_DRIFT.toFixed(2)} * (12.0 - animated.y) / ${RAIN_STREAK_FALL_DISTANCE.toFixed(1)};
      fade *= gate;
      sizeFactor = 0.45 + aSeed * 1.25;
      vStretch = 1.2 + aSeed * 1.6 + uWindStrength * 0.7;
    } else if (uKind < 2.5) {
      float gate = step(fract(aSeed * 7.31), uDensity);
      animated.y = mod(position.y + 3.0 - time * uFallSpeed * (0.72 + aSeed * 0.56), 15.0) - 2.0;
      animated.xz += uWindDirection * uWindStrength * (14.0 - animated.y) * 0.2;
      animated.x += sin(time * (0.32 + aSeed * 0.26) + position.y * 1.6 + aSeed * 40.0) *
        (0.45 + uWindStrength * 0.4) * (0.7 + aSeed * 0.6);
      animated.z += cos(time * (0.24 + aSeed * 0.2) + position.x + aSeed * 17.0) *
        (0.28 + uWindStrength * 0.22) * (0.7 + aSeed * 0.6);
      fade *= gate;
      sizeFactor = 0.45 + aSeed * aSeed * 1.55;
    } else if (uKind < 3.5) {
      animated.xz *= 0.8;
      animated.y = mod(position.y, 1.5) + 0.2;
      float speed = 0.16 + aSeed * 0.28;
      float hover = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(time * 0.13 + aSeed * 80.0), 2.0);
      animated.x += (sin(time * speed + aSeed * 41.0) * 0.55 + sin(time * speed * 0.37 + position.z) * 0.6) * hover;
      animated.z += (cos(time * speed * 0.8 + aSeed * 32.0) * 0.5 + sin(time * speed * 0.29) * 0.4) * hover;
      animated.y += sin(time * speed * 0.62 + aSeed * 19.0) * 0.22;
      float cycle = fract(time / (4.0 + aSeed * 5.0) + aSeed * 17.0);
      float duration = 0.12 + fract(aSeed * 9.31) * 0.18;
      pulse = smoothstep(0.0, duration * 0.4, cycle) * (1.0 - smoothstep(duration * 0.5, duration, cycle));
      fade *= step(fract(aSeed * 37.7), uDensity);
    } else {
      float cycle = fract(time * (1.4 + aSeed * 1.6) + aSeed * 23.7);
      animated.y = sin(position.x * 0.09) * 0.13 + sin(position.z * 0.13) * 0.08 + sin((position.x + position.z) * 0.04) * 0.03 + 0.035;
      animated.x += uWindDirection.x * uWindStrength * cycle * 0.06;
      animated.z += uWindDirection.y * uWindStrength * cycle * 0.06;
      fade = step(fract(aSeed * 4.77), uDensity);
      pulse = (1.0 - cycle) * (1.0 - cycle);
      sizeFactor = 0.5 + cycle * 2.1;
    }

    vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
    if (uKind > 0.5 && uKind < 2.5) {
      float ground = sin(animated.x * 0.09) * 0.13 + sin(animated.z * 0.13) * 0.08;
      fade *= smoothstep(ground - 0.1, ground + 0.4, animated.y) * smoothstep(14.0, 11.0, animated.y);
    }
    if (uKind > 1.5 && uKind < 2.5) fade *= exp(-max(0.0, -viewPosition.z) * 0.027);
    vec4 projectedStreakOrientation = projectionMatrix * viewMatrix * vec4(uRainStreakOrientation, 0.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = uPointSize * sizeFactor * clamp(18.0 / -viewPosition.z, 0.45, 2.2);
    vFade = fade;
    vPulse = pulse;
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
  varying float vStretch;
  varying float vSeed;

  void main() {
    vec2 centered = gl_PointCoord - 0.5;
    float shape;
    if (uKind > 0.5 && uKind < 1.5) {
      float cosine = cos(vRainAngle);
      float sine = sin(vRainAngle);
      vec2 oriented = mat2(cosine, sine, -sine, cosine) * centered;
      shape = exp(-pow(oriented.x * 23.0, 2.0)) *
        (1.0 - smoothstep(0.34, 0.5, abs(oriented.y))) * (0.45 + 0.55 * vSeed);
    } else if (uKind > 3.5) {
      float radius = length(centered * vec2(1.0, 2.8));
      float ring = smoothstep(0.48, 0.4, radius) * smoothstep(0.3, 0.39, radius);
      shape = ring;
    } else if (uKind > 2.5 && uKind < 3.5) {
      float radius = length(centered);
      shape = exp(-radius * radius * 18.0) * 0.28 + exp(-radius * radius * 150.0);
    } else if (uKind > 1.5 && uKind < 2.5) {
      float angle = atan(centered.y, centered.x) + vSeed * 13.0;
      float radius = length(centered);
      shape = (1.0 - smoothstep(0.16, 0.43, radius)) * (0.85 + 0.15 * cos(angle * 6.0));
    } else {
      shape = smoothstep(0.5, 0.08, length(centered));
    }
    if (shape < 0.02) discard;
    gl_FragColor = vec4(uColor, shape * uOpacity * vFade * vPulse);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function createParticleGeometry(count: number, clustered = false) {
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
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
    seeds[index] = random()
    if (clustered) {
      const cluster = index % 5
      positions[offset] = -10 + cluster * 4.8 + (random() - .5) * 5
      positions[offset + 1] = random() * 1.4 + .15
      positions[offset + 2] = -2 - (cluster % 3) * 3.5 + (random() - .5) * 4
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
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
    blending: kind === 3 ? AdditiveBlending : NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uKind: { value: kind },
      uPointSize: { value: size },
      uWindStrength: { value: 0.5 },
      uFallSpeed: { value: fallSpeed },
      uDensity: { value: 1 },
      uMotion: { value: 1 },
      uWindDirection: { value: new Vector2(0.86, 0.5).normalize() },
      uRainStreakOrientation: { value: new Vector3(0, -1, 0) },
      uColor: { value: new Color(color).multiplyScalar(emissionScale) },
      uOpacity: { value: 0 },
    },
  })
}

export function WeatherParticles({
  fireflyDensity,
  quality,
  snapshotRef,
  seasonRef,
  effectsRef,
  reducedMotion,
  visible,
  atmosphereRef,
}: WeatherParticlesProps) {
  const pointsRef = useRef<Array<Object3D | null>>([])
  const geometry = useMemo(
    () => createParticleGeometry(quality.particles),
    [quality.particles],
  )
  const fireflyCount = Math.floor(quality.particles * .2)
  const fireflyGeometry = useMemo(() => createParticleGeometry(fireflyCount, true), [fireflyCount])
  const materials = useMemo(
    () => [
      createParticleMaterial(0, '#d8c279', 1.2, 0.08),
      createParticleMaterial(1, '#bdd0df', 6.2, 8),
      createParticleMaterial(2, '#edf4f2', 5.6, 0.7),
      createParticleMaterial(
        3,
        '#d9ed72',
        3.8,
        0,
        getBloomEmissionScale(quality.postprocessing, 'firefly'),
      ),
      createParticleMaterial(4, '#cfe0ea', 3.4, 0),
    ],
    [quality.postprocessing],
  )

  useEffect(() => {
    geometry.setDrawRange(
      0,
      reducedMotion ? Math.floor(quality.particles * 0.25) : quality.particles,
    )
    fireflyGeometry.setDrawRange(0, reducedMotion ? Math.floor(fireflyCount * .25) : fireflyCount)
  }, [geometry, fireflyGeometry, fireflyCount, quality.particles, reducedMotion])

  useEffect(
    () => () => {
      geometry.dispose()
      fireflyGeometry.dispose()
      for (const material of materials) material.dispose()
    },
    [geometry, fireflyGeometry, materials],
  )

  useFrame(() => {
    if (!visible) return

    const snapshot = snapshotRef.current
    const effects = effectsRef.current

    for (let index = 0; index < materials.length; index += 1) {
      materials[index].uniforms.uTime.value = snapshot.elapsed
      materials[index].uniforms.uMotion.value = reducedMotion ? .25 : 1
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
    materials[1].uniforms.uDensity.value = effects.rain
    materials[2].uniforms.uOpacity.value = effects.snow
    materials[2].uniforms.uDensity.value = 0.35 + effects.snow * 0.65
    materials[3].uniforms.uOpacity.value = effects.fireflies * .9
    materials[3].uniforms.uDensity.value = Math.min(.8, 70 / Math.max(1, fireflyCount)) * fireflyDensity
    materials[2].uniforms.uColor.value.set('#edf4f2').multiplyScalar(.35 + Math.min(1, atmosphereRef.current.sunIntensity / 1.8) * .65)
    materials[4].uniforms.uOpacity.value = effects.rain * 0.38
    materials[4].uniforms.uDensity.value = effects.rain
    for (let index = 0; index < materials.length; index++) {
      if (pointsRef.current[index]) pointsRef.current[index]!.visible = materials[index].uniforms.uOpacity.value > .001
    }
  })

  return (
    <group>
      {materials.map((material, index) => (
        <points
          key={index}
          ref={points => { pointsRef.current[index] = points }}
          geometry={index === 3 ? fireflyGeometry : geometry}
          material={material}
          frustumCulled={false}
        />
      ))}
    </group>
  )
}
