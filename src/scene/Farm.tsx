import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { BoxGeometry, BufferGeometry, ExtrudeGeometry, MeshStandardMaterial, Shape } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { FARM } from '../core/farm'
import { terrainHeight } from '../core/grassLayout'
import type { AtmosphereState } from '../core/atmosphere'
import type { EnvironmentSnapshot } from '../core/simulation'
import type { WeatherEffects } from '../core/weather'

type Surface = 'red' | 'siding' | 'trim' | 'roof' | 'seam' | 'dark' | 'stone' | 'yard'
const COLORS: Record<Surface, string> = {
  red: '#8f2524', siding: '#a3332d', trim: '#eee6cc', roof: '#aeb6b1',
  seam: '#828e89', dark: '#221e1a', stone: '#837666', yard: '#877c55',
}

function buildFarm() {
  const parts: Record<Surface, BufferGeometry[]> = {
    red: [], siding: [], trim: [], roof: [], seam: [], dark: [], stone: [], yard: [],
  }
  const add = (surface: Surface, geometry: BufferGeometry) => {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry
    if (flat !== geometry) geometry.dispose()
    flat.deleteAttribute('uv')
    parts[surface].push(flat)
  }
  const box = (surface: Surface, size: [number, number, number], position: [number, number, number], angle = 0) => {
    add(surface, new BoxGeometry(...size).rotateZ(angle).translate(...position))
  }
  const beam = (surface: Surface, a: [number, number], b: [number, number], z: number, thickness = 0.09, depth = 0.08) => {
    box(surface, [Math.hypot(b[0] - a[0], b[1] - a[1]), thickness, depth],
      [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z], Math.atan2(b[1] - a[1], b[0] - a[0]))
  }
  const outline: [number, number][] = [[-3, 0], [3, 0], [3, 3.4], [1.85, 5.15], [0, 5.95], [-1.85, 5.15], [-3, 3.4]]
  const shape = new Shape()
  outline.forEach(([x, y], index) => index ? shape.lineTo(x, y) : shape.moveTo(x, y))
  shape.closePath()
  add('red', new ExtrudeGeometry(shape, { depth: 8, bevelEnabled: false, steps: 1 }).translate(0, 0, -4))
  box('stone', [6.1, 0.25, 8.1], [0, 0.1, 0])
  // Thin horizontal clapboards leave a fine shadow line between each course.
  for (let y = 0.32; y < 5.9; y += 0.16) {
    const halfWidth = y <= 3.4 ? 3 : y <= 5.15 ? 3 - (y - 3.4) * 1.15 / 1.75 : (5.95 - y) * 1.85 / 0.8
    for (const z of [-4.018, 4.018]) box('siding', [halfWidth * 2, 0.135, 0.025], [0, y, z])
    if (y < 3.4) for (const x of [-3.018, 3.018]) box('siding', [0.025, 0.135, 8], [x, y, 0])
  }
  const roof: [number, number][] = [[-3.24, 3.36], [-1.97, 5.23], [0, 6.08], [1.97, 5.23], [3.24, 3.36]]
  for (let i = 0; i < roof.length - 1; i++) {
    beam('roof', roof[i], roof[i + 1], 0, 0.13, 8.5)
    for (let z = -4.1; z <= 4.15; z += 0.42) beam('seam', [roof[i][0], roof[i][1] + 0.08], [roof[i + 1][0], roof[i + 1][1] + 0.08], z, 0.025, 0.028)
    for (const z of [-4.28, 4.28]) beam('trim', roof[i], roof[i + 1], z, 0.15, 0.13)
  }
  for (const x of [-3.04, 3.04]) {
    for (const z of [-4.04, 4.04]) box('trim', [0.15, 3.45, 0.15], [x, 1.76, z])
    box('trim', [0.16, 0.14, 8.45], [x, 3.42, 0])
  }
  const frame = (x: number, y: number, width: number, height: number, z: number) => {
    for (const edge of [-1, 1]) {
      box('trim', [0.1, height + 0.1, 0.09], [x + edge * width / 2, y, z])
      box('trim', [width + 0.1, 0.1, 0.09], [x, y + edge * height / 2, z])
    }
  }
  box('dark', [2.85, 2.85, 0.06], [0, 1.62, 4.07])
  for (const x of [-0.7, 0.7]) {
    box('red', [1.33, 2.65, 0.07], [x, 1.59, 4.13])
    frame(x, 1.59, 1.33, 2.65, 4.19)
    beam('trim', [x - 0.59, 0.34], [x + 0.59, 2.84], 4.25)
    beam('trim', [x + 0.59, 0.34], [x - 0.59, 2.84], 4.25)
    box('dark', [0.055, 0.2, 0.06], [x + (x < 0 ? 0.48 : -0.48), 1.52, 4.3])
  }
  box('trim', [3.16, 0.16, 0.18], [0, 3.07, 4.17])
  box('dark', [1.15, 1.15, 0.08], [0, 4.55, 4.09])
  frame(0, 4.55, 1.2, 1.2, 4.18)
  box('trim', [0.06, 1.15, 0.08], [0, 4.55, 4.2])
  box('trim', [1.15, 0.06, 0.08], [0, 4.55, 4.2])
  for (const x of [-2.2, 2.2]) {
    box('dark', [0.65, 0.85, 0.05], [x, 1.92, 4.09])
    frame(x, 1.92, 0.7, 0.9, 4.17)
  }
  // A small fenced yard anchors the barn in the meadow.
  box('yard', [9.9, 0.05, 2.1], [0, 0.08, 5.25])
  for (const x of [-5, -3.3, -1.6, 1.6, 3.3, 5]) {
    box('trim', [0.14, 1.35, 0.14], [x, 0.68, 6.3])
  }
  for (const side of [-1, 1]) {
    for (const y of [0.42, 0.83, 1.18]) box('trim', [3.4, 0.09, 0.1], [side * 3.3, y, 6.3])
    for (const z of [4.6, 2.9, 1.2, -0.5, -2.2, -3.9]) box('trim', [0.14, 1.35, 0.14], [side * 5, 0.68, z])
    for (const y of [0.42, 0.83, 1.18]) box('trim', [0.1, 0.09, 10.2], [side * 5, y, 1.2])
  }
  return (Object.keys(parts) as Surface[]).map(surface => {
    const geometry = mergeGeometries(parts[surface])!
    parts[surface].forEach(part => part.dispose())
    return { surface, geometry }
  })
}

export function Farm({ atmosphereRef, snapshotRef, effectsRef }: { atmosphereRef: MutableRefObject<AtmosphereState>; snapshotRef: MutableRefObject<EnvironmentSnapshot>; effectsRef: MutableRefObject<WeatherEffects> }) {
  const meshes = useMemo(buildFarm, [])
  const materials = useRef<(MeshStandardMaterial | null)[]>([])
  const snowUniform = useMemo(() => ({ value: 0 }), [])
  useEffect(() => () => meshes.forEach(mesh => mesh.geometry.dispose()), [meshes])
  useFrame(() => {
    // Match the meadow ground's soft ambient fill; keep the night silhouette dim.
    const atmosphere = atmosphereRef.current
    const fill = 0.025 + Math.min(1, atmosphere.sunIntensity / 1.8) * 0.42 * (1 - atmosphere.goldenHour * .65)
    snowUniform.value = atmosphereRef.current.snowCover
    materials.current.forEach((material, index) => {
      if (!material) return
      material.emissiveIntensity = fill * (1 - snowUniform.value * .7) + effectsRef.current.stormFlash * .3
      material.roughness = (meshes[index].surface === 'roof' ? .63 : .92) - snapshotRef.current.weather.wetness * .12
    })
  })
  return (
    <group name="farm-barn" position={[FARM.x, terrainHeight(FARM.x, FARM.z) - 0.04, FARM.z]} rotation-y={FARM.rotation} scale={FARM.scale}>
      {meshes.map(({ surface, geometry }, index) => (
        <mesh key={surface} geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial ref={material => { materials.current[index] = material }} color={COLORS[surface]} emissive={COLORS[surface]} emissiveIntensity={0.25} roughness={surface === 'roof' ? 0.63 : 0.92}
            onBeforeCompile={shader => {
              shader.uniforms.uSnowCover = snowUniform
              shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vSnowExposure;').replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvSnowExposure = smoothstep(0.32, 0.85, normal.y);')
              shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSnowCover; varying float vSnowExposure;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.92, 0.95), vSnowExposure * uSnowCover);')
            }} />
        </mesh>
      ))}
    </group>
  )
}
