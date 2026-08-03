import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { getFixedCameraFraming } from '../../src/core/cameraFraming'
import { getCelestialArcPoint } from '../../src/core/celestial'
import { projectCelestialPoint } from '../../src/scene/celestialProjection'

describe('projectCelestialPoint', () => {
  it.each([
    ['desktop', 1280, 720],
    ['mobile', 390, 844],
  ])('preserves normalized arc coordinates in the %s camera', (
    _name,
    width,
    height,
  ) => {
    const aspect = width / height
    const camera = new PerspectiveCamera(46, aspect, 0.1, 180)
    const framing = getFixedCameraFraming(aspect)
    camera.position.set(...framing.position)
    camera.lookAt(...framing.target)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    const output = new Vector3()

    for (const dayPhase of [0.25, 0.5, 0.75]) {
      const point = getCelestialArcPoint('sun', dayPhase, aspect)
      const world = projectCelestialPoint(camera, point, 88, output)
      const ndc = world.clone().project(camera)

      expect(world).toBe(output)
      expect(ndc.x).toBeCloseTo(point.x, 2)
      expect(ndc.y).toBeCloseTo(point.y, 2)
      expect(ndc.z).toBeGreaterThan(0)
      expect(ndc.z).toBeLessThan(1)
    }
  })
})
