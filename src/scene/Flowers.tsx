import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, type MutableRefObject } from 'react'
import {
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  ShaderMaterial,
  Sphere,
  Vector2,
  Vector3,
} from 'three'
import type { AtmosphereState } from '../core/atmosphere'
import { createFlowerLayout } from '../core/grassLayout'
import type { SeasonAppearance } from '../core/season'
import type { EnvironmentSnapshot } from '../core/simulation'
import { syncGrassAtmosphereUniforms } from './grassAtmosphere'
import { cloudShadowChunk } from './grassShaders'

interface FlowersProps {
  count: number
  snapshotRef: MutableRefObject<EnvironmentSnapshot>
  seasonRef: MutableRefObject<SeasonAppearance>
  atmosphereRef: MutableRefObject<AtmosphereState>
  effectsRef: MutableRefObject<{ stormFlash: number }>
}

const FLOWER_VERTEX_SHADER = /* glsl */ `
  attribute vec3 instanceOffset;
  attribute float instanceScale;
  attribute float instancePhase;
  attribute float instanceYaw;
  attribute float instanceColorVariation;

  uniform float uTime;
  uniform float uWindStrength;
  uniform vec2 uWindDirection;
  uniform float uSnowCoverage;

  varying vec2 vFlowerUv;
  varying float vViewDepth;
  varying float vVariation;
  varying vec3 vFlowerNormal;
  varying vec2 vWorldXZ;

  mat2 rotate2d(float angle) {
    float sine = sin(angle);
    float cosine = cos(angle);
    return mat2(cosine, -sine, sine, cosine);
  }

  void main() {
    float swayPhase = uTime * (0.7 + uWindStrength * 0.6) + instancePhase;
    float swayAngle =
      sin(swayPhase) * 0.055 +
      sin(swayPhase * 2.7 + 1.3) * 0.02;
    swayAngle *= 0.25 + uWindStrength;
    vec2 windDirection = normalize(uWindDirection + vec2(0.0001));
    float bendCurve = pow(clamp(uv.y, 0.0, 1.0), 1.5);
    float snowShrink = max(0.08, 1.0 - uSnowCoverage * 0.92);

    vec3 localPosition = position;
    localPosition.xz *= instanceScale * snowShrink;
    localPosition.xz = rotate2d(instanceYaw) * localPosition.xz;
    localPosition.y *= instanceScale * snowShrink;
    localPosition.xz += windDirection * sin(swayAngle) * bendCurve;

    vec4 worldPosition = modelMatrix * vec4(localPosition + instanceOffset, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * viewPosition;
    vWorldXZ = worldPosition.xz;

    vFlowerUv = uv;
    vViewDepth = -viewPosition.z;
    vVariation = instanceColorVariation;
    vFlowerNormal = normalize(vec3(
      -windDirection.x * swayAngle * 0.8,
      1.0,
      -windDirection.y * swayAngle * 0.8
    ));
  }
`

const FLOWER_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uGrassBase;
  uniform vec3 uDryColor;
  uniform vec3 uSunColor;
  uniform vec3 uMoonColor;
  uniform vec3 uSkyColor;
  uniform vec3 uGroundLightColor;
  uniform vec3 uSunDirection;
  uniform vec3 uMoonDirection;
  uniform vec3 uFogColor;
  uniform float uDryness;
  uniform float uFrost;
  uniform float uSkyLightIntensity;
  uniform float uSunIntensity;
  uniform float uMoonIntensity;
  uniform float uFogDensity;
  uniform float uStormFlash;
  uniform float uTime;
  uniform vec2 uWindDirection;
  uniform float uShadowCover;
  uniform float uShadowStrength;

  varying vec2 vFlowerUv;
  varying float vViewDepth;
  varying float vVariation;
  varying vec3 vFlowerNormal;
  varying vec2 vWorldXZ;

  ${cloudShadowChunk}

  void main() {
    vec2 headOffset = vec2(
      (vFlowerUv.x - 0.5) * 0.18,
      vFlowerUv.y - 0.78
    );
    float headDist = length(headOffset);
    float petalMask = 1.0 - smoothstep(0.048, 0.056, headDist);
    float centerMask = 1.0 - smoothstep(0.018, 0.026, headDist);

    vec3 stemColor = uGrassBase * mix(0.5, 0.92, vFlowerUv.y);
    vec3 petalColor = mix(
      vec3(0.97, 0.96, 0.93),
      vec3(0.88, 0.84, 0.95),
      vVariation
    );
    petalColor *= 0.92 + vVariation * 0.12;
    petalColor = mix(petalColor, uDryColor * 1.15, uDryness * 0.55);
    petalColor = mix(petalColor, vec3(0.95, 0.97, 1.0), uFrost * 0.35);
    vec3 centerColor = mix(
      vec3(0.94, 0.77, 0.28),
      uDryColor * 0.9,
      uDryness * 0.4
    );
    vec3 headColor = mix(petalColor, centerColor, centerMask);
    vec3 albedo = mix(stemColor, headColor, petalMask);
    albedo *= 1.0 - (1.0 - smoothstep(0.0, 0.25, vFlowerUv.y)) * 0.35;

    vec3 normal = normalize(vFlowerNormal);
    float sunFacing = max(dot(normal, uSunDirection), 0.0);
    float moonFacing = max(dot(normal, uMoonDirection), 0.0);
    float backlight = max(dot(-normal, uSunDirection), 0.0);
    vec3 hemisphereFill =
      mix(uGroundLightColor, uSkyColor, 0.75) * uSkyLightIntensity;
    vec3 light =
      hemisphereFill +
      uSunColor * sunFacing * uSunIntensity * 0.62 +
      uSunColor * backlight * uSunIntensity * 0.1 +
      uMoonColor * moonFacing * uMoonIntensity * 0.55;
    float cloudShade = cloudShadowFactor(
      vWorldXZ,
      uWindDirection * uTime * 0.02,
      uShadowCover
    );
    light *= 1.0 - cloudShade * uShadowStrength * 0.42;
    vec3 litColor = albedo * light;
    litColor += vec3(1.0) * uStormFlash * 0.14;

    float fogAmount = 1.0 - exp(
      -uFogDensity * uFogDensity * vViewDepth * vViewDepth
    );
    gl_FragColor = vec4(mix(litColor, uFogColor, fogAmount), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function createFlowerGeometry(count: number, seed: number) {
  const halfWidth = 0.09
  const positions = [
    -halfWidth, 0, 0,
    halfWidth, 0, 0,
    -halfWidth, 1, 0,
    halfWidth, 1, 0,
    0, 0, -halfWidth,
    0, 0, halfWidth,
    0, 1, -halfWidth,
    0, 1, halfWidth,
  ]
  const uvs = [0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1]
  const indices = [
    0, 1, 2,
    1, 3, 2,
    4, 5, 6,
    5, 7, 6,
  ]

  const layout = createFlowerLayout(count, seed)
  const geometry = new InstancedBufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.setAttribute(
    'instanceOffset',
    new InstancedBufferAttribute(layout.offsets, 3),
  )
  geometry.setAttribute(
    'instanceScale',
    new InstancedBufferAttribute(layout.scales, 1),
  )
  geometry.setAttribute(
    'instancePhase',
    new InstancedBufferAttribute(layout.phases, 1),
  )
  geometry.setAttribute(
    'instanceYaw',
    new InstancedBufferAttribute(layout.yaws, 1),
  )
  geometry.setAttribute(
    'instanceColorVariation',
    new InstancedBufferAttribute(layout.colorVariation, 1),
  )
  geometry.instanceCount = count
  geometry.boundingSphere = new Sphere(new Vector3(0, 0, 0), 12)
  return geometry
}

function createFlowerMaterial() {
  return new ShaderMaterial({
    vertexShader: FLOWER_VERTEX_SHADER,
    fragmentShader: FLOWER_FRAGMENT_SHADER,
    side: DoubleSide,
    toneMapped: true,
    uniforms: {
      uTime: { value: 0 },
      uWindStrength: { value: 0.5 },
      uWindDirection: { value: new Vector2(1, 0) },
      uSnowCoverage: { value: 0 },
      uGrassBase: { value: new Color('#4d7f32') },
      uDryColor: { value: new Color('#a68a4b') },
      uSunColor: { value: new Color('#fff0c0') },
      uMoonColor: { value: new Color('#8ba8cf') },
      uSkyColor: { value: new Color('#adc7d0') },
      uGroundLightColor: { value: new Color('#40552b') },
      uSunDirection: { value: new Vector3(0.4, 0.8, 0.2).normalize() },
      uMoonDirection: { value: new Vector3(-0.4, 0.8, -0.2).normalize() },
      uFogColor: { value: new Color('#aab8a6') },
      uDryness: { value: 0 },
      uFrost: { value: 0 },
      uSkyLightIntensity: { value: 0.7 },
      uSunIntensity: { value: 1.4 },
      uMoonIntensity: { value: 0.18 },
      uFogDensity: { value: 0.009 },
      uStormFlash: { value: 0 },
      uShadowCover: { value: 0 },
      uShadowStrength: { value: 0 },
    },
  })
}

export function Flowers({
  count,
  snapshotRef,
  seasonRef,
  atmosphereRef,
  effectsRef,
}: FlowersProps) {
  const geometry = useMemo(() => createFlowerGeometry(count, 9_461), [count])
  const material = useMemo(createFlowerMaterial, [])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(() => {
    const snapshot = snapshotRef.current
    const season = seasonRef.current
    const atmosphere = atmosphereRef.current
    const { uniforms } = material
    uniforms.uTime.value = snapshot.elapsed
    uniforms.uWindStrength.value = snapshot.weather.windStrength
    uniforms.uWindDirection.value
      .set(...snapshot.weather.windDirection)
      .normalize()
    uniforms.uStormFlash.value = effectsRef.current.stormFlash
    uniforms.uGrassBase.value.copy(season.grassColor)
    uniforms.uDryness.value = season.dryness
    uniforms.uFrost.value = season.frost
    uniforms.uSnowCoverage.value = Math.max(
      season.snowCoverage,
      snapshot.weather.snow * 0.72,
    )
    uniforms.uShadowCover.value = snapshot.weather.cloudCover
    uniforms.uShadowStrength.value =
      Math.min(1, atmosphere.sunIntensity / 1.2) *
      snapshot.weather.cloudCover ** 0.85
    syncGrassAtmosphereUniforms(uniforms, atmosphere)
  })

  return (
    <mesh
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={1}
    />
  )
}
