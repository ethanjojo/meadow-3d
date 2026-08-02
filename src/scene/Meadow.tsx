import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import {
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  MeshStandardMaterial,
  ShaderMaterial,
  Sphere,
  Vector3,
} from 'three'
import { createGrassLayout } from '../core/grassLayout'
import type { NatureSnapshot } from '../core/natureClock'
import type { QualityProfile } from '../core/quality'
import type { SeasonAppearance } from '../core/season'
import { grassFragmentShader, grassVertexShader } from './grassShaders'

interface MeadowProps {
  quality: QualityProfile
  snapshotRef: MutableRefObject<NatureSnapshot>
  seasonRef: MutableRefObject<SeasonAppearance>
}

const MEADOW_RADIUS = 32
const SNOW_COLOR = new Color('#e7ece8')
const DRY_COLOR = new Color('#a68a4b')

function createBladeGeometry(count: number) {
  const segmentCount = 5
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let row = 0; row <= segmentCount; row += 1) {
    const height = row / segmentCount
    const halfWidth = 0.042 * (1 - height * 0.88)
    positions.push(-halfWidth, height, 0, halfWidth, height, 0)
    uvs.push(0, height, 1, height)

    if (row < segmentCount) {
      const current = row * 2
      const next = current + 2
      indices.push(current, current + 1, next, current + 1, next + 1, next)
    }
  }

  const layout = createGrassLayout(count, MEADOW_RADIUS, 4_219)
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
  geometry.instanceCount = count
  geometry.boundingSphere = new Sphere(new Vector3(0, 0, 0), MEADOW_RADIUS + 3)
  return geometry
}

function createGrassMaterial() {
  return new ShaderMaterial({
    vertexShader: grassVertexShader,
    fragmentShader: grassFragmentShader,
    side: DoubleSide,
    toneMapped: true,
    uniforms: {
      uTime: { value: 0 },
      uWindStrength: { value: 0.5 },
      uGrassBase: { value: new Color('#4d7f32') },
      uGrassTip: { value: new Color('#83a84e') },
      uDryColor: { value: DRY_COLOR.clone() },
      uSnowColor: { value: SNOW_COLOR.clone() },
      uSunColor: { value: new Color('#fff0c0') },
      uSkyColor: { value: new Color('#adc7d0') },
      uSunDirection: { value: new Vector3(0.4, 0.8, 0.2).normalize() },
      uFogColor: { value: new Color('#aab8a6') },
      uDryness: { value: 0 },
      uSnowCoverage: { value: 0 },
      uFogNear: { value: 9 },
      uFogFar: { value: 42 },
    },
  })
}

export function Meadow({ quality, snapshotRef, seasonRef }: MeadowProps) {
  const terrainMaterialRef = useRef<MeshStandardMaterial>(null)
  const geometry = useMemo(
    () => createBladeGeometry(quality.grassBlades),
    [quality.grassBlades],
  )
  const material = useMemo(createGrassMaterial, [])

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
    const solarAngle = snapshot.dayPhase * Math.PI * 2 - Math.PI / 2
    const sunHeight = Math.sin(solarAngle)
    const daylight = Math.min(1, Math.max(0.08, sunHeight * 0.75 + 0.34))

    material.uniforms.uTime.value = snapshot.elapsed
    material.uniforms.uWindStrength.value = snapshot.windStrength
    material.uniforms.uGrassBase.value.copy(season.grassColor)
    material.uniforms.uGrassTip.value.copy(season.tipColor)
    material.uniforms.uDryness.value = season.dryness
    material.uniforms.uSnowCoverage.value = season.snowCoverage
    material.uniforms.uSunColor.value.setRGB(
      1.1 * daylight,
      0.92 * daylight,
      0.68 * daylight,
    )
    material.uniforms.uSkyColor.value.setRGB(
      0.44 + daylight * 0.34,
      0.54 + daylight * 0.28,
      0.64 + daylight * 0.22,
    )
    material.uniforms.uSunDirection.value
      .set(Math.cos(solarAngle), Math.max(0.08, sunHeight), -0.35)
      .normalize()

    if (terrainMaterialRef.current) {
      terrainMaterialRef.current.color
        .copy(season.groundColor)
        .lerp(SNOW_COLOR, season.snowCoverage * 0.82)
      terrainMaterialRef.current.roughness = 0.95 - season.frost * 0.18
    }
  })

  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={-0.025}
        receiveShadow={quality.shadowSize > 0}
      >
        <circleGeometry args={[MEADOW_RADIUS, 96]} />
        <meshStandardMaterial ref={terrainMaterialRef} color="#40552b" roughness={0.95} />
      </mesh>
      <mesh
        geometry={geometry}
        material={material}
        castShadow={quality.shadowSize > 0}
        receiveShadow={false}
        frustumCulled={false}
      />
    </group>
  )
}
