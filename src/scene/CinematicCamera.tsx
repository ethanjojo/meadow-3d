import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { MathUtils, Vector3 } from 'three'

interface CinematicCameraProps {
  reducedMotion: boolean
  visible: boolean
}

const LOOK_TARGET = new Vector3(0, 0.72, -4)

export function CinematicCamera({
  reducedMotion,
  visible,
}: CinematicCameraProps) {
  const smoothedLook = useRef(LOOK_TARGET.clone())

  useFrame(({ camera, clock, pointer }, delta) => {
    if (!visible) return

    const elapsed = clock.getElapsedTime()
    const motionScale = reducedMotion ? 0.15 : 1
    const pointerX = reducedMotion ? 0 : MathUtils.clamp(pointer.x, -1, 1) * 0.12
    const pointerY = reducedMotion ? 0 : MathUtils.clamp(pointer.y, -1, 1) * 0.055
    const targetX =
      Math.sin((elapsed / 24) * Math.PI * 2) * 0.35 * motionScale + pointerX
    const targetY =
      1.15 + Math.sin((elapsed / 13) * Math.PI * 2) * 0.035 * motionScale + pointerY

    camera.position.x = MathUtils.damp(camera.position.x, targetX, 1.25, delta)
    camera.position.y = MathUtils.damp(camera.position.y, targetY, 1.1, delta)
    camera.position.z = MathUtils.damp(camera.position.z, 5.4, 1.4, delta)

    smoothedLook.current.x = MathUtils.damp(
      smoothedLook.current.x,
      pointerX * 0.38,
      1.2,
      delta,
    )
    smoothedLook.current.y = MathUtils.damp(
      smoothedLook.current.y,
      LOOK_TARGET.y + pointerY * 0.24,
      1.2,
      delta,
    )
    camera.lookAt(smoothedLook.current)
  })

  return null
}
