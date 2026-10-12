import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, type MutableRefObject } from 'react'
import { Color, DoubleSide, ShaderMaterial, Vector2 } from 'three'
import type { AtmosphereState } from '../core/atmosphere'
import type { EnvironmentSnapshot } from '../core/simulation'
import type { QualityProfile } from '../core/quality'
import { cloudFieldChunk } from './cloudShaders'

export function GroundMist({ quality, atmosphereRef, snapshotRef, visible, reducedMotion }: {
  quality: QualityProfile; atmosphereRef: MutableRefObject<AtmosphereState>; snapshotRef: MutableRefObject<EnvironmentSnapshot>; visible: boolean; reducedMotion: boolean
}) {
  const material = useMemo(() => new ShaderMaterial({
    transparent: true, side: DoubleSide, depthWrite: false,
    uniforms: { uColor: { value: new Color() }, uOpacity: { value: 0 }, uDrift: { value: new Vector2() } },
    vertexShader: `varying vec2 vUv; varying vec3 vWorld; void main() { vUv = uv; vec4 world = modelMatrix * vec4(position,1.0); vWorld = world.xyz; gl_Position = projectionMatrix * viewMatrix * world; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform vec2 uDrift;
      varying vec2 vUv; varying vec3 vWorld;
      ${cloudFieldChunk}
      void main() {
        float wisps = cloudNoise(vWorld.xz * .07 + uDrift) * .7 + cloudNoise(vWorld.xz * .19 - uDrift * .5) * .3;
        float edge = smoothstep(0.0,.12,vUv.x) * smoothstep(1.0,.88,vUv.x);
        float height = sin(vUv.y * 3.14159);
        float alpha = smoothstep(.3,.8,wisps) * height * height * edge * uOpacity;
        gl_FragColor = vec4(uColor,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }), [])
  useEffect(() => () => material.dispose(), [material])
  useFrame(() => {
    if (!visible) return
    const state = atmosphereRef.current, snapshot = snapshotRef.current
    const dawn = Math.exp(-Math.pow((snapshot.dayPhase - .25) * 18, 2))
    material.uniforms.uColor.value.copy(state.fogColor)
    material.uniforms.uOpacity.value = Math.min(.32, snapshot.weather.fog * .24 + snapshot.weather.rain * .08 + dawn * .07)
    material.uniforms.uDrift.value.set(...snapshot.weather.windDirection).normalize().multiplyScalar(snapshot.elapsed * .006 * (reducedMotion ? .25 : 1))
  })
  return <group name="low-meadow-mist">{Array.from({ length: quality.cloudLayers + 1 }, (_, layer) => <mesh key={layer} position={[0, .9 + layer * .2, -8 - layer * 8]} material={material} frustumCulled={false}><planeGeometry args={[68, 2.4]} /></mesh>)}</group>
}
