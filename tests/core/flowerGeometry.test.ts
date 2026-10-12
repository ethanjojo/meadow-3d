import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { createFlowerLayout } from '../../src/core/grassLayout'
import { createFlowerBatches, createFlowerGeometry } from '../../src/scene/flowerGeometry'

describe('volumetric flowers', () => {
  it('builds curved petals, raised centers and finite surface normals within a bounded triangle budget', () => {
    const layout = createFlowerLayout(1, 91)
    for (const species of ['daisy', 'buttercup'] as const) {
      const geometry = createFlowerGeometry(layout, [0], species, true)
      const position = geometry.getAttribute('position')
      const part = geometry.getAttribute('flowerPart')
      const normal = geometry.getAttribute('normal')
      const petalHeights: number[] = []
      const centerHeights: number[] = []
      for (let index = 0; index < position.count; index += 1) {
        expect(Number.isFinite(normal.getX(index) + normal.getY(index) + normal.getZ(index))).toBe(true)
        if (part.getX(index) === 2) petalHeights.push(position.getY(index))
        if (part.getX(index) === 3) centerHeights.push(position.getY(index))
      }
      expect(Math.max(...petalHeights) - Math.min(...petalHeights)).toBeGreaterThan(.008)
      expect(Math.max(...centerHeights) - Math.min(...centerHeights)).toBeGreaterThan(.01)
      expect(geometry.index!.count / 3).toBeLessThan(400)
      geometry.dispose()
    }
  })

  it('renders every plant once and reduces detail for distance and low quality', () => {
    const layout = createFlowerLayout(720, 9461)
    const camera = new Vector3(0, 1.08, 5.4)
    const high = createFlowerBatches(layout, camera, true)
    const low = createFlowerBatches(layout, camera, false)
    for (const batches of [high, low]) {
      expect(batches.reduce((sum, batch) => sum + batch.geometry.instanceCount, 0)).toBe(720)
      const offsets = batches.flatMap(batch => Array.from(batch.geometry.getAttribute('instanceOffset').array))
      expect(offsets).toHaveLength(layout.offsets.length)
    }
    expect(high.some(batch => batch.key.endsWith('near'))).toBe(true)
    expect(high.some(batch => batch.key.endsWith('far'))).toBe(true)
    expect(low.every(batch => batch.key.endsWith('far'))).toBe(true)
    const triangles = (batches: typeof high) => batches.reduce((sum, batch) => sum + batch.geometry.index!.count / 3 * batch.geometry.instanceCount, 0)
    expect(triangles(low)).toBeLessThan(triangles(high))
    ;[...high, ...low].forEach(batch => batch.geometry.dispose())
  })
})
