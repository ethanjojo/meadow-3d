import { describe, expect, it } from 'vitest'
import {
  getBloomEmissionScale,
  meadowGradeShader,
} from '../../src/scene/postProcessingShaders'

describe('meadow postprocessing shader', () => {
  it('keeps grading exposure-neutral and applies only a subtle vignette', () => {
    expect(meadowGradeShader.uniforms.uVignette.value).toBe(0)
    expect(meadowGradeShader.fragmentShader).toContain(
      'pow(max(source.rgb, vec3(0.0)), vec3(0.985))',
    )
    expect(meadowGradeShader.fragmentShader).toContain(
      'smoothstep(0.55, 1.0, distanceFromCenter) * uVignette',
    )
  })

  it('raises only intentional light sources above the bloom threshold', () => {
    expect(getBloomEmissionScale(false, 'sun')).toBe(1)
    expect(getBloomEmissionScale(true, 'ordinary')).toBe(1)
    expect(getBloomEmissionScale(true, 'sun')).toBeGreaterThan(1.05)
    expect(getBloomEmissionScale(true, 'moon')).toBeGreaterThan(1.05)
    expect(getBloomEmissionScale(true, 'firefly')).toBeGreaterThan(1.05)
  })
})
