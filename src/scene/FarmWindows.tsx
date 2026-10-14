import { DEFAULT_CLOCK } from '../core/natureClock'
import type { SceneSettings } from '../core/sceneSettings'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, type MutableRefObject } from 'react'
import { Color, MeshStandardMaterial, ShaderMaterial } from 'three'
import { FARM_WINDOWS, getFarmWindowLight } from '../core/farm'
import type { EnvironmentSnapshot } from '../core/simulation'

function createWindowGlow(spill: boolean) {
  return new ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uColor: { value: new Color(1,.43,.12) }, uIntensity: { value: 0 }, uSpill: { value: spill ? 1 : 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uIntensity, uSpill; uniform vec3 uColor;
      void main() {
        vec2 p = (vUv - vec2(.5, mix(.5,.85,uSpill))) * vec2(2.0, mix(2.0,1.5,uSpill));
        float edge = max(abs(p.x), abs(p.y));
        float falloff = exp(-dot(p,p) * 3.5) * (1.0 - smoothstep(.65,1.0,edge));
        falloff *= smoothstep(0.0,.12,vUv.y) * (1.0 - smoothstep(.9,1.0,vUv.y));
        gl_FragColor = vec4(uColor, falloff * uIntensity * mix(.17,.13,uSpill));
        #include <colorspace_fragment>
      }
    `,
  })
}

export function FarmWindows({ sceneSettings, snapshotRef, enabled }: { sceneSettings: SceneSettings; snapshotRef: MutableRefObject<EnvironmentSnapshot>; enabled: boolean }) {
  const windows = useMemo(() => FARM_WINDOWS.map(window => ({
    ...window,
    glass: new MeshStandardMaterial({ color: '#221e1a', emissive: '#ffb75b', emissiveIntensity: 0, roughness: .55 }),
    halo: createWindowGlow(false),
    spill: createWindowGlow(true),
  })), [])
  useEffect(() => () => windows.forEach(window => {
    window.glass.dispose()
    window.halo.dispose()
    window.spill.dispose()
  }), [windows])
  useFrame(() => {
    windows.forEach((window, index) => {
      const light = enabled ? getFarmWindowLight(snapshotRef.current.dayPhase, index, sceneSettings, Math.floor(snapshotRef.current.dayCycle ?? snapshotRef.current.autoElapsed / DEFAULT_CLOCK.dayDuration)) : 0
      window.glass.emissive.setRGB(1, .7 - sceneSettings.farmLightWarmth * .454, .2 - sceneSettings.farmLightWarmth * .19)
      window.halo.uniforms.uColor.value.setRGB(1, .7 - sceneSettings.farmLightWarmth * .54, .24 - sceneSettings.farmLightWarmth * .24)
      window.spill.uniforms.uColor.value.copy(window.halo.uniforms.uColor.value)
      window.glass.emissiveIntensity = light * 2.2
      window.halo.uniforms.uIntensity.value = light
      window.spill.uniforms.uIntensity.value = light
    })
  })
  return <group name="farm-window-lights">
    {windows.map((window, index) => <group key={index}>
      <mesh position={[window.x, window.y, 4.09]} material={window.glass}>
        <boxGeometry args={[window.width, window.height, .08]} />
      </mesh>
      <mesh position={[window.x, window.y, 4.27]} material={window.halo}>
        <planeGeometry args={[window.width * 2.3, window.height * 2.3]} />
      </mesh>
      <mesh position={[window.x, window.y - window.height / 2 - .5, 4.055]} material={window.spill}>
        <planeGeometry args={[window.width * 2, 1.25]} />
      </mesh>
    </group>)}
  </group>
}
