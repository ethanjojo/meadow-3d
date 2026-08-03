import { PerspectiveCamera, Vector3 } from 'three'
import type { CelestialArcPoint } from '../core/celestial'

const FORWARD = new Vector3()
const RIGHT = new Vector3()
const UP = new Vector3()

export function projectCelestialPoint(
  camera: PerspectiveCamera,
  point: CelestialArcPoint,
  distance: number,
  output: Vector3,
): Vector3 {
  const safeDistance = Number.isFinite(distance) ? Math.max(0, distance) : 0
  const halfHeight =
    Math.tan((camera.fov * Math.PI) / 360) * safeDistance
  const halfWidth = halfHeight * camera.aspect
  camera.getWorldDirection(FORWARD)
  RIGHT.set(1, 0, 0).applyQuaternion(camera.quaternion)
  UP.set(0, 1, 0).applyQuaternion(camera.quaternion)

  return output
    .copy(camera.position)
    .addScaledVector(FORWARD, safeDistance)
    .addScaledVector(RIGHT, point.x * halfWidth)
    .addScaledVector(UP, point.y * halfHeight)
}

export function getCelestialViewDirection(
  camera: PerspectiveCamera,
  point: CelestialArcPoint,
  output: Vector3,
) {
  return projectCelestialPoint(camera, point, 1, output)
    .sub(camera.position)
    .normalize()
}
