import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { AdditiveBlending, BackSide, Mesh, ShaderMaterial } from 'three'
import { advanceAuroraOpacity, getAuroraVisibility } from '../core/aurora'
import { advanceAuroraComposition, createAuroraCompositionState, type AuroraCompositionState } from '../core/auroraComposition'
import type { AtmosphereState } from '../core/atmosphere'
import { getCelestialAppearance } from '../core/celestialAppearance'
import type { SceneSettings } from '../core/sceneSettings'
import type { QualityProfile } from '../core/quality'
import type { EnvironmentSnapshot } from '../core/simulation'
import { auroraFragmentShader, auroraVertexShader } from './auroraShaders'
import { useCloudNoise } from './cloudNoise'

interface AuroraProps {
  sceneSettings: SceneSettings; quality: QualityProfile
  snapshotRef: MutableRefObject<EnvironmentSnapshot>; atmosphereRef: MutableRefObject<AtmosphereState>
  visible: boolean; reducedMotion: boolean; previewUntil: number
}
export function Aurora({ sceneSettings, quality, snapshotRef, atmosphereRef, visible, reducedMotion, previewUntil }: AuroraProps) {
  const meshRef = useRef<Mesh>(null)
  const noiseTexture = useCloudNoise()
  const opacity = useRef(0), motion = useRef(0)
  const composition = useRef<AuroraCompositionState | null>(null)
  if (!composition.current) composition.current = createAuroraCompositionState(Math.random() * 1000)
  const material = useMemo(() => new ShaderMaterial({
    vertexShader: auroraVertexShader, fragmentShader: auroraFragmentShader,
    defines: { AURORA_LAYERS: quality.auroraLayers },
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uCloudNoise: { value: noiseTexture },
      uLayout: { value: composition.current!.current.layout },
      uCurtains: { value: composition.current!.current.curtains.flat() }, uCurtainStyles: { value: composition.current!.current.styles.flat() } },
    side: BackSide, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false,
  }), [quality.auroraLayers, noiseTexture])
  useEffect(() => () => material.dispose(), [material])
  useFrame((_, delta) => {
    if (!visible) return
    const snapshot = snapshotRef.current, atmosphere = atmosphereRef.current
    const preview = Date.now() < previewUntil
    const appearance = getCelestialAppearance(snapshot.elapsed, atmosphere.sunElevation, snapshot.weather.fog, snapshot.weather.cloudCover)
    const phase = sceneSettings.moonPhaseMode === 'fixed' ? sceneSettings.moonPhase * Math.PI * 2 : appearance.moonPhase
    const moon = (.5 + .5 * Math.cos(phase)) * atmosphere.moonVisibility * Math.min(1, sceneSettings.moonBrightness)
    const target = getAuroraVisibility({
      mode: sceneSettings.auroraMode, night: (-atmosphere.sunElevation - .45) / .4,
      seasonPosition: snapshot.seasonPosition, rain: snapshot.weather.rain, storm: snapshot.weather.storm,
      fog: snapshot.weather.fog, moon, elapsed: snapshot.autoElapsed, frequency: sceneSettings.auroraFrequency, preview,
    }) * (preview ? Math.max(.8, sceneSettings.auroraBrightness) : sceneSettings.auroraBrightness)
    // Fade and drift keep their timing at low FPS; cap only long resume gaps.
    const frameSeconds = Math.min(delta, 1)
    const arrangement = advanceAuroraComposition(composition.current!, target > .0001, preview ? previewUntil : 0, opacity.current, frameSeconds)
    material.uniforms.uLayout.value = arrangement.layout
    material.uniforms.uCurtains.value = arrangement.curtains.flat()
    material.uniforms.uCurtainStyles.value = arrangement.styles.flat()
    opacity.current = advanceAuroraOpacity(opacity.current, target, frameSeconds)
    if (!sceneSettings.timePaused && !reducedMotion) motion.current += frameSeconds * sceneSettings.auroraSpeed
    material.uniforms.uTime.value = motion.current
    material.uniforms.uOpacity.value = opacity.current
    if (meshRef.current) meshRef.current.visible = opacity.current > .001
    if (import.meta.env.DEV) Object.assign(window, { __livingMeadowAurora: { opacity: opacity.current, target, preview, time: motion.current, layers: quality.auroraLayers, occurrence: composition.current!.occurrence, layout: [...arrangement.layout] } })
  })
  return <mesh ref={meshRef} name="aurora-sky" renderOrder={2} scale={108} material={material} frustumCulled={false}>
    <sphereGeometry args={[1, 40, 20]} />
  </mesh>
}
