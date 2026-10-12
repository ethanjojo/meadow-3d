import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import {
  CircleGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  MeshStandardMaterial,
  ShaderMaterial,
  Sphere,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
} from 'three'
import type { AtmosphereState } from '../core/atmosphere'
import {
  createGrassLayerLayout,
  getGrassBendLimit,
  getGrassLayerBudgets,
  GRASS_LAYER_SEGMENTS,
  grassLayerUsesAtlas,
  terrainHeight,
  type GrassLayerKind,
} from '../core/grassLayout'
import type { QualityProfile } from '../core/quality'
import type { SeasonAppearance } from '../core/season'
import type { EnvironmentSnapshot } from '../core/simulation'
import type { WeatherEffects } from '../core/weather'
import { syncGrassAtmosphereUniforms } from './grassAtmosphere'
import { Flowers } from './Flowers'
import {
  cloudShadowChunk,
  getGrassShaderDefines,
  grassFragmentShader,
  grassVertexShader,
} from './grassShaders'
import {
  createGrassTextureFallbacks,
  createGroundDetailTexture,
  loadGrassTextures,
  type GrassTextureSet,
} from './grassTextures'

interface MeadowProps {
  flowerCount: number
  quality: QualityProfile
  snapshotRef: MutableRefObject<EnvironmentSnapshot>
  seasonRef: MutableRefObject<SeasonAppearance>
  atmosphereRef: MutableRefObject<AtmosphereState>
  effectsRef: MutableRefObject<WeatherEffects>
  reducedMotion: boolean
}

interface GrassLayerDefinition {
  kind: GrassLayerKind
  seed: number
  fade: number
}

const MEADOW_RADIUS = 48
const SNOW_COLOR = new Color('#e7ece8')
const DRY_COLOR = new Color('#a68a4b')
const GUST_ORIGIN = new Vector2(-18, 4)
const GRASS_LAYERS: readonly GrassLayerDefinition[] = [
  { kind: 'foreground', seed: 4_219, fade: 1 },
  { kind: 'middle', seed: 7_913, fade: 0.94 },
  { kind: 'horizon', seed: 12_247, fade: 0.82 },
]

function createBladeGeometry(
  count: number,
  kind: GrassLayerKind,
  seed: number,
) {
  const segmentCount = GRASS_LAYER_SEGMENTS[kind]
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let row = 0; row <= segmentCount; row += 1) {
    const height = row / segmentCount
    const halfWidth = Math.max(0.0012, 0.024 * Math.pow(1 - height, 1.35))
    positions.push(
      -halfWidth,
      height,
      0,
      halfWidth,
      height,
      0,
      0,
      height,
      -halfWidth,
      0,
      height,
      halfWidth,
    )
    uvs.push(0, height, 1, height, 0, height, 1, height)

    if (row < segmentCount) {
      const current = row * 4
      const next = current + 4
      indices.push(
        current,
        current + 1,
        next,
        current + 1,
        next + 1,
        next,
        current + 2,
        current + 3,
        next + 2,
        current + 3,
        next + 3,
        next + 2,
      )
    }
  }

  const layout = createGrassLayerLayout(count, kind, seed)
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
    'instanceStiffness',
    new InstancedBufferAttribute(layout.stiffness, 1),
  )
  geometry.setAttribute(
    'instanceYaw',
    new InstancedBufferAttribute(layout.yaw, 1),
  )
  geometry.setAttribute(
    'instanceWidth',
    new InstancedBufferAttribute(layout.widths, 1),
  )
  geometry.setAttribute(
    'instanceLean',
    new InstancedBufferAttribute(layout.leans, 1),
  )
  geometry.setAttribute(
    'instanceColorVariation',
    new InstancedBufferAttribute(layout.colorVariation, 1),
  )
  geometry.setAttribute(
    'instanceAtlasCell',
    new InstancedBufferAttribute(layout.atlasCells, 1),
  )
  geometry.instanceCount = count
  geometry.boundingSphere = new Sphere(new Vector3(0, 0, -14), 44)
  return geometry
}

function createGroundGeometry() {
  const geometry = new CircleGeometry(MEADOW_RADIUS, 128)
  const positions = geometry.getAttribute('position')

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index)
    const localY = positions.getY(index)
    positions.setZ(index, terrainHeight(x, -localY))
  }

  positions.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

function createGrassMaterial(
  layerFade: number,
  colorAtlas: Texture,
  surfaceAtlas: Texture,
  useTransmission: boolean,
  detailedLighting: boolean,
) {
  return new ShaderMaterial({
    vertexShader: grassVertexShader,
    fragmentShader: grassFragmentShader,
    defines: getGrassShaderDefines(detailedLighting),
    side: DoubleSide,
    toneMapped: true,
    uniforms: {
      uTime: { value: 0 },
      uWindStrength: { value: 0.5 },
      uWindDirection: { value: new Vector2(1, 0) },
      uGustOrigin: { value: GUST_ORIGIN.clone() },
      uGustSpeed: { value: 1.8 },
      uBendLimit: { value: getGrassBendLimit(0.5, false) },
      uFlutterStrength: { value: 0.012 },
      uGrassBase: { value: new Color('#4d7f32') },
      uGrassTip: { value: new Color('#83a84e') },
      uDryColor: { value: DRY_COLOR.clone() },
      uSnowColor: { value: SNOW_COLOR.clone() },
      uSunColor: { value: new Color('#fff0c0') },
      uMoonColor: { value: new Color('#8ba8cf') },
      uSkyColor: { value: new Color('#adc7d0') },
      uGroundLightColor: { value: new Color('#40552b') },
      uSunDirection: { value: new Vector3(0.4, 0.8, 0.2).normalize() },
      uMoonDirection: { value: new Vector3(-0.4, 0.8, -0.2).normalize() },
      uFogColor: { value: new Color('#aab8a6') },
      uDryness: { value: 0 },
      uWetness: { value: 0 },
      uFrost: { value: 0 },
      uSnowCoverage: { value: 0 },
      uLayerFade: { value: layerFade },
      uFogDensity: { value: 0.009 },
      uSkyLightIntensity: { value: 0.7 },
      uSunIntensity: { value: 1.4 },
      uMoonIntensity: { value: 0.18 },
      uStormFlash: { value: 0 }, uCloudPhase: { value: 0 },
      uGrassColorAtlas: { value: colorAtlas },
      uGrassSurfaceAtlas: { value: surfaceAtlas },
      uUseAtlas: { value: 0 },
      uUseTransmission: { value: useTransmission ? 1 : 0 },
      uShadowCover: { value: 0 },
      uShadowStrength: { value: 0 },
    },
  })
}

export function Meadow({
  flowerCount,
  quality,
  snapshotRef,
  seasonRef,
  atmosphereRef,
  effectsRef,
  reducedMotion,
}: MeadowProps) {
  const { gl } = useThree()
  const terrainMaterialRef = useRef<MeshStandardMaterial>(null)
  const fallbackTextures = useMemo(createGrassTextureFallbacks, [])
  const textureLoader = useMemo(() => new TextureLoader(), [])
  const layers = useMemo(() => {
    const budgets = getGrassLayerBudgets(quality.grassBlades)

    return GRASS_LAYERS.map((layer) => ({
      ...layer,
      geometry: createBladeGeometry(budgets[layer.kind], layer.kind, layer.seed),
      material: createGrassMaterial(
        layer.fade,
        fallbackTextures.color,
        fallbackTextures.surface,
        quality.grassTransmission && grassLayerUsesAtlas(layer.kind),
        quality.grassAtlas && grassLayerUsesAtlas(layer.kind),
      ),
    }))
  }, [
    fallbackTextures,
    quality.grassAtlas,
    quality.grassBlades,
    quality.grassTransmission,
  ])
  const groundGeometry = useMemo(createGroundGeometry, [])
  const groundTexture = useMemo(
    () => createGroundDetailTexture(gl.capabilities.getMaxAnisotropy()),
    [gl],
  )
  const groundRimUniform = useMemo(
    () => ({ value: new Color('#aab8a6') }),
    [],
  )
  const groundCloudUniforms = useMemo(
    () => ({
      time: { value: 0 },
      wind: { value: new Vector2(1, 0) },
      cover: { value: 0 },
      strength: { value: 0 },
    }),
    [],
  )

  useEffect(
    () => () => {
      for (const layer of layers) {
        layer.geometry.dispose()
        layer.material.dispose()
      }
    },
    [layers],
  )
  useEffect(() => () => groundGeometry.dispose(), [groundGeometry])
  useEffect(() => () => groundTexture.dispose(), [groundTexture])
  useEffect(
    () => () => {
      fallbackTextures.color.dispose()
      fallbackTextures.surface.dispose()
    },
    [fallbackTextures],
  )

  useEffect(() => {
    if (!quality.grassAtlas) return
    const foreground = layers.find(({ kind }) => grassLayerUsesAtlas(kind))
    if (!foreground) return
    let installedTextures: GrassTextureSet | null = null
    const stopLoading = loadGrassTextures(
      textureLoader,
      gl.capabilities.getMaxAnisotropy(),
      (textures) => {
        installedTextures = textures
        const { uniforms } = foreground.material
        uniforms.uGrassColorAtlas.value = textures.color
        uniforms.uGrassSurfaceAtlas.value = textures.surface
        uniforms.uUseAtlas.value = textures.detailed ? 1 : 0
        uniforms.uUseTransmission.value =
          textures.detailed && quality.grassTransmission ? 1 : 0
      },
    )

    return () => {
      stopLoading()
      if (installedTextures && !installedTextures.detailed) {
        installedTextures.color.dispose()
        installedTextures.surface.dispose()
      }
    }
  }, [gl, layers, quality.grassAtlas, quality.grassTransmission, textureLoader])

  useFrame(() => {
    const snapshot = snapshotRef.current
    const season = seasonRef.current
    const atmosphere = atmosphereRef.current
    const effects = effectsRef.current
    const wetness = Math.max(snapshot.weather.wetness, effects.dew * 0.45)
    const windStrength = snapshot.weather.windStrength
    const bendLimit = getGrassBendLimit(windStrength, reducedMotion)
    const flutterStrength =
      (reducedMotion ? 0.005 : 0.014) * (0.3 + windStrength * 0.7)

    for (const layer of layers) {
      const { uniforms } = layer.material
      uniforms.uTime.value = snapshot.elapsed
      uniforms.uWindStrength.value = windStrength
      uniforms.uWindDirection.value
        .set(...snapshot.weather.windDirection)
        .normalize()
      uniforms.uGustSpeed.value = 1.2 + windStrength * 2.8
      uniforms.uBendLimit.value = bendLimit
      uniforms.uFlutterStrength.value = flutterStrength
      uniforms.uStormFlash.value = effects.stormFlash
      uniforms.uCloudPhase.value = atmosphere.cloudPhase
      uniforms.uGrassBase.value.copy(season.grassColor)
      uniforms.uGrassTip.value.copy(season.tipColor)
      uniforms.uDryness.value = season.dryness
      uniforms.uWetness.value = wetness
      uniforms.uFrost.value = season.frost
      uniforms.uSnowCoverage.value = atmosphere.snowCover
      syncGrassAtmosphereUniforms(uniforms, atmosphere)
    }

    groundRimUniform.value.copy(atmosphere.fogColor)

    const shadowCover = snapshot.weather.cloudCover
    const shadowStrength =
      Math.min(1, atmosphere.sunIntensity / 1.2) * shadowCover ** 0.85
    for (const layer of layers) {
      layer.material.uniforms.uShadowCover.value = shadowCover
      layer.material.uniforms.uShadowStrength.value = shadowStrength
    }
    groundCloudUniforms.cover.value = shadowCover
    groundCloudUniforms.strength.value = shadowStrength
    groundCloudUniforms.time.value = atmosphere.cloudPhase
    groundCloudUniforms.wind.value
      .set(...snapshot.weather.windDirection)
      .normalize()

    if (terrainMaterialRef.current) {
      terrainMaterialRef.current.color
        .copy(season.groundColor)
        .multiplyScalar(1 - wetness * 0.24)
        .lerp(SNOW_COLOR, atmosphere.snowCover * 0.88)
      terrainMaterialRef.current.emissive
        .copy(terrainMaterialRef.current.color)
        .multiplyScalar(0.26)
      terrainMaterialRef.current.emissiveIntensity =
        (0.55 + (1 - Math.min(1, atmosphere.sunIntensity / 1.3)) * 0.35) *
        (1 - atmosphere.goldenHour * 0.5)
      terrainMaterialRef.current.roughness =
        0.95 - season.frost * 0.18 - wetness * 0.08
    }
  })

  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={-0.025}
        receiveShadow={quality.shadowSize > 0}
      >
        <primitive object={groundGeometry} attach="geometry" />
        <meshStandardMaterial
          ref={terrainMaterialRef}
          map={groundTexture}
          color="#40552b"
          emissive="#132017"
          emissiveIntensity={0.65}
          roughness={0.95}
          onBeforeCompile={(shader) => {
            shader.uniforms.uRimFadeColor = groundRimUniform
            shader.uniforms.uShadowCover = groundCloudUniforms.cover
            shader.uniforms.uShadowStrength = groundCloudUniforms.strength
            shader.uniforms.uShadowTime = groundCloudUniforms.time
            shader.uniforms.uShadowWind = groundCloudUniforms.wind
            shader.vertexShader = shader.vertexShader
              .replace(
                '#include <common>',
                '#include <common>\nvarying float vRimFade;\nvarying vec2 vGroundWorldXZ;',
              )
              .replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
    vec4 groundWorldPosition = modelMatrix * vec4(position, 1.0);
    vRimFade = smoothstep(34.0, 47.0, length(groundWorldPosition.xz));
    vGroundWorldXZ = groundWorldPosition.xz;`,
              )
            shader.fragmentShader = shader.fragmentShader
              .replace(
                '#include <common>',
                `#include <common>
varying float vRimFade;
varying vec2 vGroundWorldXZ;
uniform vec3 uRimFadeColor;
uniform float uShadowCover;
uniform float uShadowStrength;
uniform float uShadowTime;
uniform vec2 uShadowWind;
${cloudShadowChunk}`,
              )
              .replace(
                '#include <map_fragment>',
                `#include <map_fragment>
    diffuseColor.rgb = mix(diffuseColor.rgb, uRimFadeColor, vRimFade);
    float groundCloudShade = cloudShadowFactor(
      vGroundWorldXZ,
      uShadowWind * uShadowTime,
      uShadowCover
    );
    diffuseColor.rgb *= 1.0 - groundCloudShade * uShadowStrength * 0.5;`,
              )
              .replace(
                '#include <emissivemap_fragment>',
                `#include <emissivemap_fragment>
    totalEmissiveRadiance *= 1.0 - vRimFade * 0.85;`,
              )
          }}
        />
      </mesh>
      {layers.map((layer) => (
        <mesh
          key={layer.kind}
          geometry={layer.geometry}
          material={layer.material}
          castShadow={quality.shadowSize > 0 && layer.kind === 'foreground'}
          receiveShadow={false}
          frustumCulled={false}
        />
      ))}
      <Flowers
        count={flowerCount}
        detailed={quality.flowerDetail}
        reducedMotion={reducedMotion}
        snapshotRef={snapshotRef}
        seasonRef={seasonRef}
        atmosphereRef={atmosphereRef}
        effectsRef={effectsRef}
      />
    </group>
  )
}
