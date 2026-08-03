import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { getFixedCameraFraming } from '../core/cameraFraming'

export function FixedCamera() {
  const camera = useThree((state) => state.camera)
  const aspect = useThree(
    (state) => state.size.width / Math.max(1, state.size.height),
  )

  useLayoutEffect(() => {
    const framing = getFixedCameraFraming(aspect)
    camera.position.set(...framing.position)
    camera.lookAt(...framing.target)
    camera.updateProjectionMatrix()
  }, [aspect, camera])

  return null
}
