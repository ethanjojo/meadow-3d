import { useFrame } from '@react-three/fiber'
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
  Vector2,
  Vector3,
} from 'three'
import type { AtmosphereState } from '../core/atmosphere'
import {
  createGrassLayerLayout,
  getGrassLayerBudgets,
  terrainHeight,
  type GrassLayerKind,
} from '../core/grassLayout'
import type { QualityProfile } from '../core/quality'
import type { SeasonAppearance } from '../core/season'
import type { EnvironmentSnapshot } from '../core/simulation'
import type { WeatherEffects } from '../core/weather'
import { syncGrassAtmosphereUniforms } from './grassAtmosphere'
import { grassFragmentShader, grassVertexShader } from './grassShaders'

interface MeadowProps {
  quality: QualityProfile
  snapshotRef: MutableRefObject<EnvironmentSnapshot>
  seasonRef: MutableRefObject<SeasonAppearance>
  atmosphereRef: MutableRefObject<AtmosphereState>
  effectsRef: MutableRefObject<WeatherEffects>
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
  const segmentCount = 5
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

function createGrassMaterial(layerFade: number) {
  return new ShaderMaterial({
    vertexShader: grassVertexShader,
    fragmentShader: grassFragmentShader,
    side: DoubleSide,
    toneMapped: true,
    uniforms: {
      uTime: { value: 0 },
      uWindStrength: { value: 0.5 },
      uWindDirection: { value: new Vector2(1, 0) },
      uGustOrigin: { value: GUST_ORIGIN.clone() },
      uGustSpeed: { value: 1.8 },
      uGrassBase: { value: new Color('#4d7f32') },
      uGrassTip: { value: new Color('#83a84e') },
      uDryColor: { value: DRY_COLOR.clone() },
      uSnowColor: { value: SNOW_COLOR.clone() },
      uSunColor: { value: new Color('#fff0c0') },
      uMoonColor: { value: new Color('#8ba8cf') },
      uSkyColor: { value: new Color('#adc7d0') },
      uSunDirection: { value: new Vector3(0.4, 0.8, 0.2).normalize() },
      uMoonDirection: { value: new Vector3(-0.4, 0.8, -0.2).normalize() },
      uFogColor: { value: new Color('#aab8a6') },
      uDryness: { value: 0 },
      uWetness: { value: 0 },
      uFrost: { value: 0 },
      uSnowCoverage: { value: 0 },
      uLayerFade: { value: layerFade },
      uFogDensity: { value: 0.009 },
    },
  })
}

export function Meadow({
  quality,
  snapshotRef,
  seasonRef,
  atmosphereRef,
  effectsRef,
}: MeadowProps) {
  const terrainMaterialRef = useRef<MeshStandardMaterial>(null)
  const layers = useMemo(() => {
    const budgets = getGrassLayerBudgets(quality.grassBlades)

    return GRASS_LAYERS.map((layer) => ({
      ...layer,
      geometry: createBladeGeometry(budgets[layer.kind], layer.kind, layer.seed),
      material: createGrassMaterial(layer.fade),
    }))
  }, [quality.grassBlades])
  const groundGeometry = useMemo(createGroundGeometry, [])

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

  useFrame(() => {
    const snapshot = snapshotRef.current
    const season = seasonRef.current
    const atmosphere = atmosphereRef.current
    const effects = effectsRef.current
    const wetness = Math.max(snapshot.weather.wetness, effects.dew * 0.45)

    for (const layer of layers) {
      const { uniforms } = layer.material
      uniforms.uTime.value = snapshot.elapsed
      uniforms.uWindStrength.value = snapshot.weather.windStrength
      uniforms.uWindDirection.value
        .set(...snapshot.weather.windDirection)
        .normalize()
      uniforms.uGustSpeed.value = 1.2 + snapshot.weather.windStrength * 2.8
      uniforms.uGrassBase.value.copy(season.grassColor)
      uniforms.uGrassTip.value.copy(season.tipColor)
      uniforms.uDryness.value = season.dryness
      uniforms.uWetness.value = wetness
      uniforms.uFrost.value = season.frost
      uniforms.uSnowCoverage.value = Math.max(
        season.snowCoverage,
        snapshot.weather.snow * 0.72,
      )
      syncGrassAtmosphereUniforms(uniforms, atmosphere)
    }

    if (terrainMaterialRef.current) {
      terrainMaterialRef.current.color
        .copy(season.groundColor)
        .multiplyScalar(1 - wetness * 0.24)
        .lerp(SNOW_COLOR, season.snowCoverage * 0.82)
      terrainMaterialRef.current.emissive
        .copy(terrainMaterialRef.current.color)
        .multiplyScalar(0.26)
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
          color="#40552b"
          emissive="#132017"
          emissiveIntensity={0.65}
          roughness={0.95}
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
    </group>
  )
}
