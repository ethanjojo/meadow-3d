import type { SceneSettings } from '../core/sceneSettings'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, DirectionalLight, Mesh, ShaderMaterial, Vector3 } from 'three'
import { getStormEvent } from '../core/sceneEffects'
import { hashLattice } from '../core/noise'
import type { EnvironmentSnapshot } from '../core/simulation'
import type { WeatherEffects } from '../core/weather'
import type { QualityProfile } from '../core/quality'

type Segment = { ax: number; ay: number; bx: number; by: number; width: number }
function buildSegments(id: number, x: number, branches: number): Segment[] {
  const points = Array.from({ length: 15 }, (_, i) => ({ x: x + (i ? Math.sin(i * .65 + id) * .055 + (hashLattice(id * 31 + i, 921) - .5) * .07 : 0), y: .82 - i * .055 }))
  const segments: Segment[] = []
  for (let i = 1; i < points.length; i++) segments.push({ ax: points[i-1].x, ay: points[i-1].y, bx: points[i].x, by: points[i].y, width: .006 })
  for (let branch = 0; branch < branches; branch++) {
    const root = points[3 + branch % 9]
    let x = root.x, y = root.y
    const direction = hashLattice(id, branch + 924) > .5 ? 1 : -1
    for (let i = 0; i < 4; i++) {
      const nx = x + direction * (.025 + hashLattice(id + i, branch + 932) * .05)
      const ny = y - .025 - hashLattice(id + i, branch + 935) * .04
      segments.push({ ax: x, ay: y, bx: nx, by: ny, width: .0028 * (1 - i * .15) })
      x = nx; y = ny
    }
  }
  return segments
}

export function Lightning({ sceneSettings, stormDistanceKm, snapshotRef, effectsRef, quality, visible }: {
  sceneSettings: SceneSettings; stormDistanceKm?: number; snapshotRef: MutableRefObject<EnvironmentSnapshot>; effectsRef: MutableRefObject<WeatherEffects>; quality: QualityProfile; visible: boolean
}) {
  const meshRef = useRef<Mesh>(null), lightRef = useRef<DirectionalLight>(null)
  const lastEvent = useRef(-1), segmentsRef = useRef<Segment[]>([])
  const branchCount = quality.cloudLayers * 2
  const geometry = useMemo(() => {
    const geometry = new BufferGeometry()
    const count = (14 + branchCount * 4) * 6
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(count * 2), 2))
    return geometry
  }, [branchCount])
  const material = useMemo(() => new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false,
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform float uOpacity; varying vec2 vUv; void main() { float d=abs(vUv.y-.5)*2.0; float glow=exp(-d*d*5.0); float core=exp(-d*d*80.0); gl_FragColor=vec4(vec3(.64,.77,1.0)+core*.8, (glow*.35+core)*uOpacity); }',
  }), [])
  const point = useMemo(() => new Vector3(), [])
  useEffect(() => {
    lastEvent.current = -1
    segmentsRef.current = []
    return () => geometry.dispose()
  }, [geometry])
  useEffect(() => () => material.dispose(), [material])
  useFrame(({ camera, size }) => {
    if (!visible) return
    const event = getStormEvent(snapshotRef.current.elapsed, { interval: sceneSettings.lightningInterval, distanceKm: stormDistanceKm })
    const flash = effectsRef.current.stormFlash
    if (lightRef.current) {
      lightRef.current.intensity = flash * 2.5
      lightRef.current.position.set(event.x * 55, 45, -40)
    }
    if (meshRef.current) meshRef.current.visible = sceneSettings.groundLightning && event.kind === 'ground' && flash > .001
    material.uniforms.uOpacity.value = flash * 1.4
    if (flash <= .001 || event.kind !== 'ground') return
    if (lastEvent.current !== event.id || !segmentsRef.current.length) {
      segmentsRef.current = buildSegments(event.id, event.x, branchCount)
      lastEvent.current = event.id
    }
    const positions = geometry.getAttribute('position') as BufferAttribute, uv = geometry.getAttribute('uv') as BufferAttribute
    let vertex = 0
    for (const segment of segmentsRef.current) {
      const dx = segment.bx-segment.ax, dy = segment.by-segment.ay, length = Math.hypot(dx,dy)
      const px = -dy / length * segment.width / (size.width/size.height), py = dx / length * segment.width
      for (const [end, sign] of [[0,-1],[1,-1],[0,1],[0,1],[1,-1],[1,1]]) {
        point.set((end ? segment.bx : segment.ax) + px * sign, (end ? segment.by : segment.ay) + py * sign, .997).unproject(camera)
        positions.setXYZ(vertex, point.x, point.y, point.z)
        uv.setXY(vertex, end, sign > 0 ? 1 : 0)
        vertex++
      }
    }
    positions.needsUpdate = true; uv.needsUpdate = true
  })
  return <><mesh name="lightning-bolt" ref={meshRef} geometry={geometry} material={material} frustumCulled={false} visible={false} renderOrder={4} /><directionalLight ref={lightRef} color="#b5ceff" intensity={0} /></>
}
