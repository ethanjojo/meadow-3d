import type { SceneSettings } from '../core/sceneSettings'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import {
  AdditiveBlending,
  Color,
  Mesh,
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
import type { EnvironmentSnapshot } from '../core/simulation'
import { getCelestialAppearance } from '../core/celestialAppearance'
import { celestialVertexShader, haloFragmentShader, sunFragmentShader, moonFragmentShader } from './celestialShaders'

interface CelestialBodiesProps {
  sceneSettings: SceneSettings
  quality: QualityProfile
  atmosphereRef: MutableRefObject<AtmosphereState>
  celestialPresentationRef: MutableRefObject<CelestialPresentation>
  visible: boolean
  snapshotRef: MutableRefObject<EnvironmentSnapshot>
}

function createHaloMaterial(color: string, emissionScale: number) {
  return new ShaderMaterial({
    vertexShader: celestialVertexShader,
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

export function CelestialBodies({ sceneSettings,
  quality,
  atmosphereRef,
  celestialPresentationRef,
  visible,
  snapshotRef,
}: CelestialBodiesProps) {
  const sunDiscRef = useRef<Mesh>(null)
  const sunHaloRef = useRef<Mesh>(null)
  const moonDiscRef = useRef<Mesh>(null)
  const moonHaloRef = useRef<Mesh>(null)
  const position = useMemo(() => new Vector3(), [])
  const bloomEnabled = quality.postprocessing && quality.bloomStrength > 0
  const materials = useMemo(
    () => ({
      sunDisc: new ShaderMaterial({
        vertexShader: celestialVertexShader, fragmentShader: sunFragmentShader,
        uniforms: {
          uOpacity: { value: 0 }, uWarmth: { value: 0 },
          uEmission: { value: getBloomEmissionScale(bloomEnabled, 'sun') },
          uCenter: { value: new Color('#fff7e4') }, uEdge: { value: new Color('#ffe5b0') },
          uLowCenter: { value: new Color('#ffdc9d') }, uLowEdge: { value: new Color('#ffa960') },
        },
        transparent: true, depthTest: true, depthWrite: false,
        blending: AdditiveBlending, toneMapped: false,
      }),
      sunHalo: createHaloMaterial(
        '#ffc77a',
        getBloomEmissionScale(bloomEnabled, 'sun'),
      ),
      moonDisc: new ShaderMaterial({
        vertexShader: celestialVertexShader, fragmentShader: moonFragmentShader,
        uniforms: { uBrightness: { value: 1 }, uEarthshine: { value: 1 }, uOpacity: { value: 0 }, uPhase: { value: .25 } },
        transparent: true, depthTest: true, depthWrite: false, toneMapped: false,
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
    const weather = snapshotRef.current.weather
    const appearance = getCelestialAppearance(snapshotRef.current.elapsed, atmosphere.sunElevation, weather.fog, weather.cloudCover)
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

    materials.sunDisc.uniforms.uOpacity.value =
      presentation.sun.opacity * atmosphere.sunVisibility
    materials.sunDisc.uniforms.uWarmth.value = appearance.sunWarmth
    materials.sunHalo.uniforms.uOpacity.value =
      presentation.sun.opacity * atmosphere.sunHalo * 0.48
    materials.moonDisc.uniforms.uPhase.value = sceneSettings.moonPhaseMode === 'fixed' ? sceneSettings.moonPhase * Math.PI * 2 : appearance.moonPhase
    materials.moonDisc.uniforms.uBrightness.value = sceneSettings.moonBrightness
    materials.moonDisc.uniforms.uEarthshine.value = sceneSettings.moonEarthshine
    materials.moonDisc.uniforms.uOpacity.value =
      presentation.moon.opacity * atmosphere.moonVisibility
    materials.moonHalo.uniforms.uOpacity.value =
      presentation.moon.opacity * atmosphere.moonHalo * appearance.moonHaloStrength
    moonHaloRef.current?.scale.multiplyScalar(appearance.moonHaloScale)
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
