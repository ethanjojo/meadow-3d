import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, type MutableRefObject } from 'react'
import {
  Color,
  DoubleSide,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three'
import type { AtmosphereState } from '../core/atmosphere'
import { createFlowerLayout } from '../core/grassLayout'
import type { SeasonAppearance } from '../core/season'
import type { EnvironmentSnapshot } from '../core/simulation'
import { syncGrassAtmosphereUniforms } from './grassAtmosphere'
import { cloudShadowChunk } from './grassShaders'
import { createFlowerBatches, FLOWER_HEAD_HEIGHT } from './flowerGeometry'

interface FlowersProps {
  count: number
  detailed: boolean
  reducedMotion: boolean
  snapshotRef: MutableRefObject<EnvironmentSnapshot>
  seasonRef: MutableRefObject<SeasonAppearance>
  atmosphereRef: MutableRefObject<AtmosphereState>
  effectsRef: MutableRefObject<{ stormFlash: number }>
}

const FLOWER_VERTEX_SHADER = /* glsl */ `
  attribute vec3 instanceOffset;
  attribute float instanceScale, instancePhase, instanceYaw, instanceColorVariation, flowerPart;
  uniform float uTime, uWindStrength, uSnowCoverage, uMotion;
  uniform vec2 uWindDirection;
  varying vec2 vFlowerUv, vWorldXZ;
  varying float vViewDepth, vVariation, vPart;
  varying vec3 vFlowerNormal;
  mat2 rotate2d(float angle) {
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  }
  void main() {
    float phase = uTime * (.7 + uWindStrength * .6) + instancePhase;
    float sway = (sin(phase) * .055 + sin(phase * 2.7 + 1.3) * .02) * (.25 + uWindStrength) * uMotion;
    vec2 wind = normalize(uWindDirection + vec2(.0001));
    vec3 local = position;
    vec3 surfaceNormal = normal;
    if (flowerPart > 1.5) {
      float tilt = sin(instancePhase * 1.7) * .42 + sin(phase + .7) * .04 * uMotion;
      local.yz = rotate2d(tilt) * (local.yz - vec2(${FLOWER_HEAD_HEIGHT}, 0.0)) + vec2(${FLOWER_HEAD_HEIGHT}, 0.0);
      surfaceNormal.yz = rotate2d(tilt) * surfaceNormal.yz;
    }
    float height = max(0.0, local.y / ${FLOWER_HEAD_HEIGHT});
    float bend = sway + sin(instancePhase) * .04;
    local.xz += wind * bend * height * height;
    surfaceNormal.y -= dot(surfaceNormal.xz, wind) * bend * 2.0 * height / ${FLOWER_HEAD_HEIGHT};
    local.xz = rotate2d(instanceYaw) * local.xz;
    surfaceNormal.xz = rotate2d(instanceYaw) * surfaceNormal.xz;
    float shrink = max(.04, 1.0 - uSnowCoverage * .96);
    float clearance = mix(.12, 1.0, smoothstep(1.2, 5.2, distance(cameraPosition.xz, instanceOffset.xz)));
    float speciesScale = mix(1.0, .78, step(.68, instanceColorVariation));
    vec3 scale = vec3(1.0, clearance, 1.0) * instanceScale * shrink * speciesScale;
    local *= scale;
    vec4 world = modelMatrix * vec4(local + instanceOffset, 1.0);
    vec4 view = viewMatrix * world;
    gl_Position = projectionMatrix * view;
    vWorldXZ = world.xz;
    vFlowerNormal = normalize(mat3(modelMatrix) * (surfaceNormal / scale));
    vFlowerUv = uv;
    vViewDepth = -view.z;
    vVariation = instanceColorVariation;
    vPart = flowerPart;
  }
`

const FLOWER_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uGrassBase, uDryColor, uSunColor, uMoonColor, uSkyColor, uGroundLightColor;
  uniform vec3 uSunDirection, uMoonDirection, uFogColor;
  uniform float uDryness, uFrost, uSkyLightIntensity, uSunIntensity, uMoonIntensity;
  uniform float uFogDensity, uStormFlash, uCloudPhase, uShadowCover, uShadowStrength;
  uniform vec2 uWindDirection;
  varying vec2 vFlowerUv, vWorldXZ;
  varying float vViewDepth, vVariation, vPart;
  varying vec3 vFlowerNormal;
  ${cloudShadowChunk}
  void main() {
    float petal = step(1.5, vPart) * (1.0 - step(2.5, vPart));
    float center = step(2.5, vPart);
    float yellow = step(.68, vVariation);
    vec3 stem = uGrassBase * mix(.78, 1.1, vFlowerUv.y);
    vec3 petals = mix(vec3(.91,.88,.79), vec3(.96,.63,.055), yellow);
    petals *= .93 + .07 * vFlowerUv.y;
    // Gentle central vein and rounded-tip shading on the actual curved petals.
    petals *= 1.0 - .06 * abs(vFlowerUv.x - .5) * 2.0;
    petals = mix(petals, uDryColor * 1.1, uDryness * .55);
    vec3 pollen = mix(vec3(.88,.53,.055), vec3(.69,.38,.025), yellow);
    float grain = sin(vFlowerUv.x * 100.0) * sin(vFlowerUv.y * 40.0);
    pollen *= .96 + grain * .035;
    vec3 albedo = mix(stem, petals, petal);
    albedo = mix(albedo, pollen, center);
    albedo = mix(albedo, vec3(.9,.94,.98), uFrost * .25);
    vec3 n = normalize(vFlowerNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    float sunFacing = max(dot(n, uSunDirection), 0.0);
    float moonFacing = max(dot(n, uMoonDirection), 0.0);
    float backlight = max(dot(-n, uSunDirection), 0.0);
    vec3 hemisphere = mix(uGroundLightColor, uSkyColor, smoothstep(-.4, 1.0, n.y));
    vec3 light = hemisphere * uSkyLightIntensity + uSunColor * sunFacing * uSunIntensity * .62
      + uMoonColor * moonFacing * uMoonIntensity * .55;
    float cloudShade = cloudShadowFactor(vWorldXZ, uWindDirection * uCloudPhase, uShadowCover);
    float transmission = backlight * petal * (.12 + .12 * abs(vFlowerUv.x - .5) * 2.0);
    light += uSunColor * transmission * uSunIntensity;
    light *= 1.0 - cloudShade * uShadowStrength * .42;
    vec3 lit = albedo * light + vec3(1.0) * uStormFlash * .14;
    float fog = 1.0 - exp(-uFogDensity * uFogDensity * vViewDepth * vViewDepth);
    gl_FragColor = vec4(mix(lit, uFogColor, fog), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function createFlowerMaterial() {
  return new ShaderMaterial({
    vertexShader: FLOWER_VERTEX_SHADER,
    fragmentShader: FLOWER_FRAGMENT_SHADER,
    side: DoubleSide,
    toneMapped: true,
    uniforms: {
      uTime: { value: 0 },
      uMotion: { value: 1 },
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
      uStormFlash: { value: 0 }, uCloudPhase: { value: 0 },
      uShadowCover: { value: 0 },
      uShadowStrength: { value: 0 },
    },
  })
}

export function Flowers({
  count,
  detailed,
  reducedMotion,
  snapshotRef,
  seasonRef,
  atmosphereRef,
  effectsRef,
}: FlowersProps) {
  const camera = useThree(state => state.camera)
  const batches = useMemo(() => createFlowerBatches(createFlowerLayout(count, 9_461), camera.position, detailed), [count, camera, detailed])
  const material = useMemo(createFlowerMaterial, [])

  useEffect(() => () => batches.forEach(batch => batch.geometry.dispose()), [batches])
  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    const snapshot = snapshotRef.current
    const season = seasonRef.current
    const atmosphere = atmosphereRef.current
    const { uniforms } = material
    uniforms.uTime.value = snapshot.elapsed
    uniforms.uMotion.value = reducedMotion ? .25 : 1
    uniforms.uCloudPhase.value = atmosphereRef.current.cloudPhase
    uniforms.uWindStrength.value = snapshot.weather.windStrength
    uniforms.uWindDirection.value
      .set(...snapshot.weather.windDirection)
      .normalize()
    uniforms.uStormFlash.value = effectsRef.current.stormFlash
    uniforms.uGrassBase.value.copy(season.grassColor)
    uniforms.uDryness.value = season.dryness
    uniforms.uFrost.value = season.frost
    uniforms.uSnowCoverage.value = atmosphere.snowCover
    uniforms.uShadowCover.value = snapshot.weather.cloudCover
    uniforms.uShadowStrength.value =
      Math.min(1, atmosphere.sunIntensity / 1.2) *
      snapshot.weather.cloudCover ** 0.85
    syncGrassAtmosphereUniforms(uniforms, atmosphere)
  })

  return (
    <group>
      {batches.map(batch => <mesh key={batch.key} geometry={batch.geometry} material={material} frustumCulled={false} />)}
    </group>
  )
}
