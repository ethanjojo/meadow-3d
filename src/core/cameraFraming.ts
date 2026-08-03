import { PerspectiveCamera, Vector3 } from 'three'

export interface FixedCameraFraming {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
}

const HORIZON_SAMPLE = new Vector3(0, 0, -120)
const HORIZON_PROJECTION = new Vector3()

export function getFixedCameraFraming(_aspect: number): FixedCameraFraming {
  return {
    position: [0, 1.08, 5.4],
    target: [0, 0.66, -5],
  }
}

export function measureGroundHorizon(camera: PerspectiveCamera) {
  const ndcY = HORIZON_PROJECTION.copy(HORIZON_SAMPLE).project(camera).y
  return (1 - ndcY) * 0.5
}

export function measureWorldPointViewportY(
  camera: PerspectiveCamera,
  worldHeight: number,
  worldDepth: number,
) {
  const ndcY = HORIZON_PROJECTION
    .set(0, worldHeight, worldDepth)
    .project(camera).y
  return (1 - ndcY) * 0.5
}
