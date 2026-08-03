import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { Vector3 } from 'three'

const CAMERA_POSITION = new Vector3(0, 1.08, 5.4)
const CAMERA_TARGET = new Vector3(0, 0.78, -5)

export function FixedCamera() {
  const camera = useThree((state) => state.camera)

  useLayoutEffect(() => {
    camera.position.copy(CAMERA_POSITION)
    camera.lookAt(CAMERA_TARGET)
    camera.updateProjectionMatrix()
  }, [camera])

  return null
}
