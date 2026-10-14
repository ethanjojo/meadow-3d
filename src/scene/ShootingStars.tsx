import type { SceneSettings } from '../core/sceneSettings'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Mesh, ShaderMaterial, Vector2, Vector3 } from 'three'
import type { AtmosphereState } from '../core/atmosphere'
import { getShootingStarState, projectShootingStarTrail } from '../core/celestial'
import type { QualityProfile } from '../core/quality'
import type { EnvironmentSnapshot } from '../core/simulation'
import { cloudFieldChunk } from './cloudShaders'
import { useCloudNoise } from './cloudNoise'

interface ShootingStarsProps {
  sceneSettings: SceneSettings
  quality: QualityProfile; snapshotRef: MutableRefObject<EnvironmentSnapshot>; atmosphereRef: MutableRefObject<AtmosphereState>; reducedMotion: boolean; visible: boolean
}

export function ShootingStars({ sceneSettings, quality, snapshotRef, atmosphereRef, reducedMotion, visible }: ShootingStarsProps) {
  const cloudNoise = useCloudNoise()
  const refs = useRef<Array<Mesh | null>>([])
  const trails = useMemo(() => Array.from({ length: quality.shootingStarPool }, (_, slot) => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(12), 3))
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0,0, 0,1, 1,0, 1,1]), 2))
    geometry.setIndex([0,2,1, 1,2,3])
    const material = new ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, toneMapped: false,
      uniforms: { uCloudNoise: { value: cloudNoise }, uColor: { value: new Color(slot % 2 ? '#fff1d7' : '#d5eaff') }, uOpacity: { value: 0 }, uCover: { value: 0 }, uDrift: { value: new Vector2() } },
      vertexShader: `varying vec2 vUv; varying vec3 vDirection; void main() { vUv = uv; vec4 world = modelMatrix * vec4(position,1.0); vDirection = world.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * world; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity, uCover; uniform vec2 uDrift;
        varying vec2 vUv; varying vec3 vDirection;
        ${cloudFieldChunk}
        void main() {
          float across = (vUv.y - .5) * 2.0;
          float taper = .12 + vUv.x * .88;
          float ribbonDistance = across / taper * 2.8;
          float ribbon = exp(-ribbonDistance * ribbonDistance) * sqrt(max(vUv.x, 0.0));
          float headDistance = (vUv.x - .98) * 25.0;
          float head = exp(-headDistance * headDistance - across * across * 18.0);
          float clear = 1.0 - cloudDensity(cloudSkyPoint(normalize(vDirection)),uDrift,uCover);
          gl_FragColor = vec4(uColor * (1.2 + head * 1.2), min(1.0, (ribbon * 1.1 + head) * uOpacity * clear));
          #include <colorspace_fragment>
        }
      `,
    })
    return { geometry, material }
  }), [quality.shootingStarPool, cloudNoise])
  const point = useMemo(() => new Vector3(), [])
  const projected = useMemo(() => ({ head: [0,0,0] as [number,number,number], tail: [0,0,0] as [number,number,number] }), [])
  const forced = useMemo(() => {
    if (!import.meta.env.DEV) return null
    const raw = new URLSearchParams(window.location.search).get('__e2eMeteor')
    return raw !== null && Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : null
  }, [])
  useEffect(() => () => trails.forEach(trail => { trail.geometry.dispose(); trail.material.dispose() }), [trails])
  useFrame(({ camera, size }) => {
    if (!visible) return
    const snapshot = snapshotRef.current, atmosphere = atmosphereRef.current
    const elapsed = forced ?? snapshot.autoElapsed
    for (let slot = 0; slot < trails.length; slot++) {
      let state = getShootingStarState(elapsed, 731, slot, atmosphere.starOpacity, sceneSettings.meteorInterval)
      // Reuse each allocated trail for all logical lanes on lower quality tiers.
      for (let lane = slot + trails.length; lane < 3 && !state.active; lane += trails.length) {
        state = getShootingStarState(elapsed, 731, lane, atmosphere.starOpacity, sceneSettings.meteorInterval)
      }
      const trail = trails[slot]
      if (refs.current[slot]) refs.current[slot]!.visible = state.active && state.brightness > .002
      if (!state.active) continue
      projectShootingStarTrail(state, reducedMotion, projected, sceneSettings.meteorTrail)
      const dx = projected.head[0] - projected.tail[0], dy = projected.head[1] - projected.tail[1]
      const length = Math.hypot(dx,dy) || 1
      const px = -dy / length * .006 / (size.width / size.height), py = dx / length * .006
      const positions = trail.geometry.getAttribute('position') as BufferAttribute
      for (let vertex = 0; vertex < 4; vertex++) {
        const p = vertex < 2 ? projected.tail : projected.head
        const sign = vertex % 2 ? 1 : -1
        point.set(p[0] + px * sign, p[1] + py * sign, .8).unproject(camera)
        positions.setXYZ(vertex,point.x,point.y,point.z)
      }
      positions.needsUpdate = true
      trail.material.uniforms.uOpacity.value = state.brightness * sceneSettings.meteorBrightness * (reducedMotion ? .45 : 1.25)
      trail.material.uniforms.uCover.value = snapshot.weather.cloudCover
      trail.material.uniforms.uDrift.value.set(...snapshot.weather.windDirection).normalize().multiplyScalar(atmosphere.cloudPhase)
    }
  })
  return <group renderOrder={2} name="meteor-trails">{trails.map((trail, slot) => <mesh key={slot} ref={mesh => { refs.current[slot] = mesh }} geometry={trail.geometry} material={trail.material} frustumCulled={false} visible={false} />)}</group>
}
