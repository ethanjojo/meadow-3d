import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import {
  AdditiveBlending,
  Color,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  Vector3,
} from 'three'
import type { AtmosphereState } from '../core/atmosphere'

interface CelestialBodiesProps {
  atmosphereRef: MutableRefObject<AtmosphereState>
  visible: boolean
}

const haloVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const haloFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float radius = length(vUv - 0.5) * 2.0;
    float alpha = (1.0 - smoothstep(0.05, 1.0, radius)) * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`

function createHaloMaterial(color: string) {
  return new ShaderMaterial({
    vertexShader: haloVertexShader,
    fragmentShader: haloFragmentShader,
    uniforms: {
      uColor: { value: new Color(color) },
      uOpacity: { value: 0 },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  })
}

export function CelestialBodies({
  atmosphereRef,
  visible,
}: CelestialBodiesProps) {
  const sunDiscRef = useRef<Mesh>(null)
  const sunHaloRef = useRef<Mesh>(null)
  const moonDiscRef = useRef<Mesh>(null)
  const moonHaloRef = useRef<Mesh>(null)
  const position = useMemo(() => new Vector3(), [])
  const materials = useMemo(
    () => ({
      sunDisc: new MeshBasicMaterial({
        color: '#fff0bd',
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
      sunHalo: createHaloMaterial('#ffc77a'),
      moonDisc: new MeshBasicMaterial({
        color: '#dbe8ff',
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
      moonHalo: createHaloMaterial('#9cbce8'),
    }),
    [],
  )

  useEffect(
    () => () => {
      materials.sunDisc.dispose()
      materials.sunHalo.dispose()
      materials.moonDisc.dispose()
      materials.moonHalo.dispose()
    },
    [materials],
  )

  useFrame(({ camera }) => {
    if (!visible) return

    const atmosphere = atmosphereRef.current
    const bodies = [
      [sunDiscRef.current, sunHaloRef.current, atmosphere.celestial.sun.direction],
      [moonDiscRef.current, moonHaloRef.current, atmosphere.celestial.moon.direction],
    ] as const

    for (const [disc, halo, direction] of bodies) {
      position.set(...direction).multiplyScalar(92)
      disc?.position.copy(position)
      halo?.position.copy(position)
      disc?.quaternion.copy(camera.quaternion)
      halo?.quaternion.copy(camera.quaternion)
    }

    materials.sunDisc.opacity = atmosphere.sunVisibility
    materials.sunHalo.uniforms.uOpacity.value = atmosphere.sunHalo * 0.62
    materials.moonDisc.opacity = atmosphere.moonVisibility * 0.92
    materials.moonHalo.uniforms.uOpacity.value = atmosphere.moonHalo * 0.42
  })

  return (
    <group renderOrder={1}>
      <mesh ref={sunHaloRef} material={materials.sunHalo} frustumCulled={false}>
        <circleGeometry args={[5.6, 40]} />
      </mesh>
      <mesh ref={sunDiscRef} material={materials.sunDisc} frustumCulled={false}>
        <circleGeometry args={[1.75, 40]} />
      </mesh>
      <mesh ref={moonHaloRef} material={materials.moonHalo} frustumCulled={false}>
        <circleGeometry args={[3.5, 40]} />
      </mesh>
      <mesh ref={moonDiscRef} material={materials.moonDisc} frustumCulled={false}>
        <circleGeometry args={[1.1, 40]} />
      </mesh>
    </group>
  )
}
