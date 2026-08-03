import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  Vector3,
} from 'three'
import type { AtmosphereState } from '../core/atmosphere'
import { getShootingStarState } from '../core/celestial'
import type { QualityProfile } from '../core/quality'
import type { EnvironmentSnapshot } from '../core/simulation'

interface ShootingStarsProps {
  quality: QualityProfile
  snapshotRef: MutableRefObject<EnvironmentSnapshot>
  atmosphereRef: MutableRefObject<AtmosphereState>
  reducedMotion: boolean
  visible: boolean
}

function createTrailGeometry() {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(6), 3))
  return geometry
}

export function ShootingStars({
  quality,
  snapshotRef,
  atmosphereRef,
  reducedMotion,
  visible,
}: ShootingStarsProps) {
  const trailsRef = useRef<Array<LineSegments | null>>([])
  const trails = useMemo(
    () =>
      Array.from({ length: quality.shootingStarPool }, (_, slot) => ({
        geometry: createTrailGeometry(),
        material: new LineBasicMaterial({
          color: slot % 2 === 0 ? '#d9efff' : '#fff2d5',
          transparent: true,
          opacity: 0,
          depthTest: false,
          depthWrite: false,
          blending: AdditiveBlending,
          toneMapped: false,
        }),
      })),
    [quality.shootingStarPool],
  )
  const head = useMemo(() => new Vector3(), [])
  const tail = useMemo(() => new Vector3(), [])

  useEffect(
    () => () => {
      for (const trail of trails) {
        trail.geometry.dispose()
        trail.material.dispose()
      }
    },
    [trails],
  )

  useFrame(() => {
    if (!visible) return

    const snapshot = snapshotRef.current
    const atmosphere = atmosphereRef.current
    const elapsed = snapshot.autoElapsed * (reducedMotion ? 0.45 : 1)

    trails.forEach((trail, slot) => {
      const state = getShootingStarState(elapsed, 731, slot, atmosphere.starOpacity)
      const line = trailsRef.current[slot]
      const positions = trail.geometry.getAttribute('position') as BufferAttribute
      const tailProgress = Math.max(0, state.progress - (reducedMotion ? 0.22 : 0.38))

      head
        .set(
          state.start[0] + state.direction[0] * state.progress,
          state.start[1] + state.direction[1] * state.progress,
          state.start[2] + state.direction[2] * state.progress,
        )
        .normalize()
        .multiplyScalar(76)
      tail
        .set(
          state.start[0] + state.direction[0] * tailProgress,
          state.start[1] + state.direction[1] * tailProgress,
          state.start[2] + state.direction[2] * tailProgress,
        )
        .normalize()
        .multiplyScalar(76)

      positions.setXYZ(0, tail.x, tail.y, tail.z)
      positions.setXYZ(1, head.x, head.y, head.z)
      positions.needsUpdate = true
      trail.material.opacity = state.brightness * 0.9
      if (line) line.visible = state.active && state.brightness > 0.002
    })
  })

  return (
    <group renderOrder={2}>
      {trails.map((trail, slot) => (
        <lineSegments
          key={slot}
          ref={(line) => {
            trailsRef.current[slot] = line
          }}
          geometry={trail.geometry}
          material={trail.material}
          visible={false}
          frustumCulled={false}
        />
      ))}
    </group>
  )
}
