import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NearestFilter, NoColorSpace, RepeatWrapping } from 'three'
import { CLOUD_NOISE_SIZE, createCloudNoiseData, createCloudNoiseTexture } from '../../src/scene/cloudNoise'

describe('portable GPU calculations', () => {
  it('generates repeatable nondegenerate noise without GPU transcendental functions', () => {
    const data = createCloudNoiseData()
    expect(data).toEqual(createCloudNoiseData())
    expect(data).not.toEqual(createCloudNoiseData(1))
    expect(data).toHaveLength(CLOUD_NOISE_SIZE ** 2 * 4)
    expect(new Set(data).size).toBe(256)
    expect(data.reduce((sum, value) => sum + value, 0) / data.length).toBeGreaterThan(120)
    expect(data.reduce((sum, value) => sum + value, 0) / data.length).toBeLessThan(135)
  })
  it('uploads noise as ungraded nearest-filtered repeating data', () => {
    const texture = createCloudNoiseTexture()
    expect(texture.colorSpace).toBe(NoColorSpace)
    expect(texture.wrapS).toBe(RepeatWrapping)
    expect(texture.wrapT).toBe(RepeatWrapping)
    expect(texture.minFilter).toBe(NearestFilter)
    expect(texture.magFilter).toBe(NearestFilter)
    expect(texture.generateMipmaps).toBe(false)
    expect(texture.version).toBeGreaterThan(0)
    texture.dispose()
  })
  it('keeps constant smoothstep bounds ordered and uses multiplication for squares', () => {
    const folder = resolve('src/scene')
    for (const file of readdirSync(folder).filter(name => /\.tsx?$/.test(name))) {
      const source = readFileSync(resolve(folder, file), 'utf8')
      for (const match of source.matchAll(/smoothstep\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,/g)) {
        expect(Number(match[1]), `${file}: ${match[0]}`).toBeLessThan(Number(match[2]))
      }
      expect(source, file).not.toMatch(/\bpow\([^\n;]*,\s*2\.0\s*\)/)
    }
  })
})
