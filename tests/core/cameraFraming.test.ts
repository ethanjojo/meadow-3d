import { describe, expect, it } from 'vitest'
import { PerspectiveCamera } from 'three'
import {
  getFixedCameraFraming,
  measureGroundHorizon,
  measureWorldPointViewportY,
} from '../../src/core/cameraFraming'

describe('fixed meadow framing', () => {
  it.each([
    ['desktop', 1280 / 720],
    ['mobile', 390 / 844],
  ])('keeps the %s horizon inside the reference band', (_name, aspect) => {
    const framing = getFixedCameraFraming(aspect)
    const camera = new PerspectiveCamera(46, aspect, 0.1, 180)
    camera.position.set(...framing.position)
    camera.lookAt(...framing.target)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()

    expect(measureGroundHorizon(camera)).toBeGreaterThanOrEqual(0.43)
    expect(measureGroundHorizon(camera)).toBeLessThanOrEqual(0.47)
    const tallNearTip = measureWorldPointViewportY(camera, 1.08, 4.4)
    expect(tallNearTip).toBeGreaterThanOrEqual(0.43)
    expect(tallNearTip).toBeLessThanOrEqual(0.47)
  })
})
