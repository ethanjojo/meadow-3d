import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import {
  AdditiveBlending,
  Color,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  ShaderMaterial,
  Vector3,
} from 'three'
import type { AtmosphereState } from '../core/atmosphere'
import type { QualityProfile } from '../core/quality'
import type {
  CelestialArcPoint,
  CelestialPresentation,
} from '../core/celestial'
import { projectCelestialPoint } from './celestialProjection'
import { getBloomEmissionScale } from './postProcessingShaders'

interface CelestialBodiesProps {
  quality: QualityProfile
  atmosphereRef: MutableRefObject<AtmosphereState>
  celestialPresentationRef: MutableRefObject<CelestialPresentation>
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

function createHaloMaterial(color: string, emissionScale: number) {
  return new ShaderMaterial({
    vertexShader: haloVertexShader,
    fragmentShader: haloFragmentShader,
    uniforms: {
      uColor: { value: new Color(color).multiplyScalar(emissionScale) },
      uOpacity: { value: 0 },
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  })
}

function placeBody(
  camera: PerspectiveCamera,
  point: CelestialArcPoint,
  disc: Mesh | null,
  halo: Mesh | null,
  position: Vector3,
) {
  projectCelestialPoint(camera, point, 88, position)
  if (disc) {
    disc.position.copy(position)
    disc.quaternion.copy(camera.quaternion)
    disc.scale.set(1, point.scaleY, 1)
  }
  if (halo) {
    halo.position.copy(position)
    halo.quaternion.copy(camera.quaternion)
    halo.scale.set(1, point.scaleY, 1)
  }
}

export function CelestialBodies({
  quality,
  atmosphereRef,
  celestialPresentationRef,
  visible,
}: CelestialBodiesProps) {
  const sunDiscRef = useRef<Mesh>(null)
  const sunHaloRef = useRef<Mesh>(null)
  const moonDiscRef = useRef<Mesh>(null)
  const moonHaloRef = useRef<Mesh>(null)
  const position = useMemo(() => new Vector3(), [])
  const bloomEnabled = quality.postprocessing
  const materials = useMemo(
    () => ({
      sunDisc: new MeshBasicMaterial({
        color: new Color('#fff0bd').multiplyScalar(
          getBloomEmissionScale(bloomEnabled, 'sun'),
        ),
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
      sunHalo: createHaloMaterial(
        '#ffc77a',
        getBloomEmissionScale(bloomEnabled, 'sun'),
      ),
      moonDisc: new MeshBasicMaterial({
        color: '#e8f2ff',
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
      moonHalo: createHaloMaterial(
        '#a9c6f0',
        getBloomEmissionScale(bloomEnabled, 'moon'),
      ),
    }),
    [bloomEnabled],
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
    if (!visible || !(camera instanceof PerspectiveCamera)) return

    const atmosphere = atmosphereRef.current
    const presentation = celestialPresentationRef.current
    placeBody(
      camera,
      presentation.sun,
      sunDiscRef.current,
      sunHaloRef.current,
      position,
    )
    placeBody(
      camera,
      presentation.moon,
      moonDiscRef.current,
      moonHaloRef.current,
      position,
    )

    materials.sunDisc.opacity =
      presentation.sun.opacity * atmosphere.sunVisibility
    materials.sunHalo.uniforms.uOpacity.value =
      presentation.sun.opacity * atmosphere.sunHalo * 0.62
    materials.moonDisc.opacity =
      presentation.moon.opacity * atmosphere.moonVisibility
    materials.moonHalo.uniforms.uOpacity.value =
      presentation.moon.opacity * atmosphere.moonHalo * 0.58
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
        <circleGeometry args={[4.3, 40]} />
      </mesh>
      <mesh ref={moonDiscRef} material={materials.moonDisc} frustumCulled={false}>
        <circleGeometry args={[1.1, 40]} />
      </mesh>
    </group>
  )
}
