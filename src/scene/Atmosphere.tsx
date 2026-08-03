import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  ShaderMaterial,
  Vector3,
} from 'three'
import type { AtmosphereState } from '../core/atmosphere'
import type { CelestialPresentation } from '../core/celestial'
import type { QualityProfile } from '../core/quality'
import type { EnvironmentSnapshot } from '../core/simulation'
import type { WeatherEffects } from '../core/weather'
import { CelestialBodies } from './CelestialBodies'
import { CloudLayer } from './CloudLayer'
import { ShootingStars } from './ShootingStars'

interface AtmosphereProps {
  quality: QualityProfile
  snapshotRef: MutableRefObject<EnvironmentSnapshot>
  atmosphereRef: MutableRefObject<AtmosphereState>
  celestialPresentationRef: MutableRefObject<CelestialPresentation>
  effectsRef: MutableRefObject<WeatherEffects>
  reducedMotion: boolean
  visible: boolean
}

const skyVertexShader = /* glsl */ `
  varying vec3 vWorldDirection;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldDirection = normalize(worldPosition.xyz - cameraPosition);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const skyFragmentShader = /* glsl */ `
  uniform vec3 uTopColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uSunDirection;
  uniform float uSunGlow;
  varying vec3 vWorldDirection;

  void main() {
    float height = smoothstep(-0.13, 0.72, vWorldDirection.y);
    vec3 color = mix(uHorizonColor, uTopColor, height);
    float sunHalo = pow(max(dot(vWorldDirection, normalize(uSunDirection)), 0.0), 18.0);
    color += vec3(1.0, 0.77, 0.46) * sunHalo * uSunGlow * 0.25;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const starVertexShader = /* glsl */ `
  attribute float size;
  attribute float brightness;
  attribute float phase;
  uniform float uTime;
  varying float vBrightness;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    float twinkle = 0.88 + sin(uTime * 0.7 + phase) * 0.12;
    vBrightness = brightness * twinkle;
    gl_PointSize = size * (150.0 / max(1.0, -viewPosition.z));
    gl_Position = projectionMatrix * viewPosition;
  }
`

const starFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vBrightness;

  void main() {
    float radius = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = (1.0 - smoothstep(0.28, 1.0, radius)) * vBrightness * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`

function createStars(count: number) {
  const geometry = new BufferGeometry()
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const brightness = new Float32Array(count)
  const phases = new Float32Array(count)
  let state = 9_823
  const random = () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 4_294_967_296
  }

  for (let index = 0; index < count; index += 1) {
    const azimuth = random() * Math.PI * 2
    const elevation = 0.08 + random() * (Math.PI / 2 - 0.08)
    const radius = 82 + random() * 7
    const offset = index * 3
    positions[offset] = Math.cos(azimuth) * Math.cos(elevation) * radius
    positions[offset + 1] = Math.sin(elevation) * radius
    positions[offset + 2] = Math.sin(azimuth) * Math.cos(elevation) * radius
    sizes[index] = 1.35 + random() * 2.15
    brightness[index] = 0.55 + random() * 0.45
    phases[index] = random() * Math.PI * 2
  }

  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('size', new BufferAttribute(sizes, 1))
  geometry.setAttribute('brightness', new BufferAttribute(brightness, 1))
  geometry.setAttribute('phase', new BufferAttribute(phases, 1))
  return geometry
}

export function Atmosphere({
  quality,
  snapshotRef,
  atmosphereRef,
  celestialPresentationRef,
  effectsRef,
  reducedMotion,
  visible,
}: AtmosphereProps) {
  const { gl } = useThree()
  const sunRef = useRef<DirectionalLight>(null)
  const moonRef = useRef<DirectionalLight>(null)
  const hemisphereRef = useRef<HemisphereLight>(null)
  const fogRef = useRef<FogExp2>(null)
  const starsGeometry = useMemo(
    () => createStars(quality.starCount),
    [quality.starCount],
  )
  const starsMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: starVertexShader,
        fragmentShader: starFragmentShader,
        uniforms: {
          uColor: { value: new Color('#dbe7ec') },
          uOpacity: { value: 0 },
          uTime: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  const skyMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: skyVertexShader,
        fragmentShader: skyFragmentShader,
        side: BackSide,
        depthWrite: false,
        uniforms: {
          uTopColor: { value: new Color('#071423') },
          uHorizonColor: { value: new Color('#1b3041') },
          uSunDirection: { value: new Vector3(0.4, 0.8, -0.3).normalize() },
          uSunGlow: { value: 0 },
        },
      }),
    [],
  )

  useEffect(() => {
    const shadowSize = quality.shadowSize
    if (sunRef.current && shadowSize > 0) {
      sunRef.current.shadow.mapSize.set(shadowSize, shadowSize)
      sunRef.current.shadow.camera.near = 1
      sunRef.current.shadow.camera.far = 130
      sunRef.current.shadow.camera.left = -24
      sunRef.current.shadow.camera.right = 24
      sunRef.current.shadow.camera.top = 24
      sunRef.current.shadow.camera.bottom = -24
    }
  }, [quality.shadowSize])

  useEffect(
    () => () => {
      starsGeometry.dispose()
      starsMaterial.dispose()
      skyMaterial.dispose()
    },
    [skyMaterial, starsGeometry, starsMaterial],
  )

  useFrame(() => {
    if (!visible) return

    const snapshot = snapshotRef.current
    const state = atmosphereRef.current
    const effects = effectsRef.current
    const sunDirection = state.celestial.sun.direction
    const moonDirection = state.celestial.moon.direction

    skyMaterial.uniforms.uTopColor.value.copy(state.skyTop)
    skyMaterial.uniforms.uHorizonColor.value.copy(state.skyHorizon)
    skyMaterial.uniforms.uSunDirection.value.set(...sunDirection)
    skyMaterial.uniforms.uSunGlow.value = state.sunHalo
    starsMaterial.uniforms.uOpacity.value = state.starOpacity
    starsMaterial.uniforms.uTime.value = snapshot.autoElapsed
    gl.toneMappingExposure = state.exposure + effects.stormFlash * 0.06

    if (fogRef.current) {
      fogRef.current.color.copy(state.fogColor)
      fogRef.current.density = state.fogDensity
    }
    if (hemisphereRef.current) {
      hemisphereRef.current.color.copy(state.skyLightColor)
      hemisphereRef.current.groundColor.copy(state.groundLightColor)
      hemisphereRef.current.intensity = state.skyLightIntensity
    }
    if (sunRef.current) {
      sunRef.current.position.set(...sunDirection).multiplyScalar(78)
      sunRef.current.intensity = state.sunIntensity + effects.stormFlash * 0.22
      sunRef.current.color.copy(state.sunColor)
    }
    if (moonRef.current) {
      moonRef.current.position.set(...moonDirection).multiplyScalar(78)
      moonRef.current.intensity = state.moonIntensity
      moonRef.current.color.copy(state.moonColor)
    }
  })

  return (
    <>
      <fogExp2 ref={fogRef} attach="fog" args={['#9fb4ac', 0.009]} />
      <hemisphereLight
        ref={hemisphereRef}
        args={['#b8d3df', '#263a2d', 0.7]}
      />
      <directionalLight
        ref={sunRef}
        castShadow={quality.shadowSize > 0}
        color="#fff2cf"
        intensity={1.4}
      />
      <directionalLight ref={moonRef} color="#8ba8cf" intensity={0.18} />
      <mesh scale={115} frustumCulled={false}>
        <sphereGeometry args={[1, 48, 24]} />
        <primitive object={skyMaterial} attach="material" />
      </mesh>
      <points geometry={starsGeometry} material={starsMaterial} frustumCulled={false} />
      <CelestialBodies
        quality={quality}
        atmosphereRef={atmosphereRef}
        celestialPresentationRef={celestialPresentationRef}
        visible={visible}
      />
      <CloudLayer
        quality={quality}
        snapshotRef={snapshotRef}
        atmosphereRef={atmosphereRef}
        visible={visible}
      />
      <ShootingStars
        quality={quality}
        snapshotRef={snapshotRef}
        atmosphereRef={atmosphereRef}
        reducedMotion={reducedMotion}
        visible={visible}
      />
    </>
  )
}
