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
  PointsMaterial,
  ShaderMaterial,
  Vector3,
} from 'three'
import { getAtmosphere } from '../core/atmosphere'
import type { NatureSnapshot } from '../core/natureClock'
import type { QualityProfile } from '../core/quality'
import type { SeasonAppearance } from '../core/season'

interface AtmosphereProps {
  quality: QualityProfile
  snapshotRef: MutableRefObject<NatureSnapshot>
  seasonRef: MutableRefObject<SeasonAppearance>
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
    float sunDisc = pow(max(dot(vWorldDirection, normalize(uSunDirection)), 0.0), 850.0);
    float sunHalo = pow(max(dot(vWorldDirection, normalize(uSunDirection)), 0.0), 18.0);
    color += vec3(1.0, 0.77, 0.46) * sunHalo * uSunGlow * 0.25;
    color += vec3(1.0, 0.91, 0.68) * sunDisc * uSunGlow * 2.2;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function createStars() {
  const geometry = new BufferGeometry()
  const positions = new Float32Array(1_800 * 3)
  let state = 9_823
  const random = () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 4_294_967_296
  }

  for (let index = 0; index < 1_800; index += 1) {
    const azimuth = random() * Math.PI * 2
    const elevation = 0.08 + random() * (Math.PI / 2 - 0.08)
    const radius = 82 + random() * 7
    const offset = index * 3
    positions[offset] = Math.cos(azimuth) * Math.cos(elevation) * radius
    positions[offset + 1] = Math.sin(elevation) * radius
    positions[offset + 2] = Math.sin(azimuth) * Math.cos(elevation) * radius
  }

  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  return geometry
}

export function Atmosphere({
  quality,
  snapshotRef,
  seasonRef,
  visible,
}: AtmosphereProps) {
  const { gl } = useThree()
  const sunRef = useRef<DirectionalLight>(null)
  const moonRef = useRef<DirectionalLight>(null)
  const fogRef = useRef<FogExp2>(null)
  const starsGeometry = useMemo(createStars, [])
  const starsMaterial = useMemo(
    () =>
      new PointsMaterial({
        color: '#dbe7ec',
        size: 0.24,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
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
    const state = getAtmosphere(snapshot, seasonRef.current)
    const orbitAngle = snapshot.dayPhase * Math.PI * 2 - Math.PI / 2
    const sunX = Math.sin(orbitAngle) * 18
    const sunY = Math.sin(orbitAngle) * 78
    const sunZ = -Math.cos(orbitAngle) * 78

    skyMaterial.uniforms.uTopColor.value.copy(state.skyTop)
    skyMaterial.uniforms.uHorizonColor.value.copy(state.skyHorizon)
    skyMaterial.uniforms.uSunDirection.value.set(sunX, sunY, sunZ).normalize()
    skyMaterial.uniforms.uSunGlow.value = state.sunIntensity
    starsMaterial.opacity = state.starOpacity
    gl.toneMappingExposure = state.exposure

    if (fogRef.current) {
      fogRef.current.color.copy(state.fogColor)
      fogRef.current.density = state.fogDensity
    }
    if (sunRef.current) {
      sunRef.current.position.set(sunX, sunY, sunZ)
      sunRef.current.intensity = state.sunIntensity
      sunRef.current.color.set(state.sunElevation < 0.35 ? '#ffd09a' : '#fff2cf')
    }
    if (moonRef.current) {
      moonRef.current.position.set(-sunX, -sunY, -sunZ)
      moonRef.current.intensity = state.moonIntensity
    }
  })

  return (
    <>
      <fogExp2 ref={fogRef} attach="fog" args={['#9fb4ac', 0.009]} />
      <hemisphereLight args={['#b8d3df', '#263a2d', 0.7]} />
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
    </>
  )
}
