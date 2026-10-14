import { expect, test } from '@playwright/test'

test('compiles all aurora layers and draws evolving curtains with zero light when hidden', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }))
  await page.goto('/?__e2eEffects=0')
  const result = await page.evaluate(async () => {
    const path = '/src/scene/auroraShaders.ts'
    const { auroraFragmentShader } = await import(path)
    const compositionPath = '/src/core/auroraComposition.ts'
    const { getAuroraComposition } = await import(compositionPath)
    const noisePath = '/src/scene/cloudNoise.tsx'
    const { createCloudNoiseData, CLOUD_NOISE_SIZE } = await import(noisePath)
    const canvas = document.createElement('canvas')
    canvas.width = 128; canvas.height = 64
    const gl = canvas.getContext('webgl2')!
    if (!gl) throw new Error('WebGL2 required')
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source); gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Compile failure')
      return shader
    }
    const vertex = compile(gl.VERTEX_SHADER, `#version 300 es
      out vec3 vDirection;
      void main() {
        vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
        vDirection = vec3((p.x - 0.5) * 1.7, p.y * 1.3 + 0.01, -1.0);
        gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
      }`)
    const texture = gl.createTexture()!
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CLOUD_NOISE_SIZE, CLOUD_NOISE_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, createCloudNoiseData())
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    const results = []
    for (const layers of [1, 2, 3]) {
      const fragment = compile(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      #define AURORA_LAYERS ${layers}
      out vec4 color;
      ${auroraFragmentShader.replace('varying vec3', 'in vec3').replaceAll('texture2D', 'texture').replace('gl_FragColor', 'color').replace('#include <colorspace_fragment>', '')}`)
      const program = gl.createProgram()!
      gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Link failure')
      gl.useProgram(program); gl.viewport(0, 0, 128, 64)
      const noiseUniform = gl.getUniformLocation(program, 'uCloudNoise')
      if (noiseUniform === null) throw new Error('Shared noise sampler must be active')
      gl.uniform1i(noiseUniform, 0)
      const setComposition = (occurrence: number) => {
        const composition = getAuroraComposition(42, occurrence)
        gl.uniform4fv(gl.getUniformLocation(program, 'uLayout'), composition.layout)
        gl.uniform4fv(gl.getUniformLocation(program, 'uCurtains[0]'), composition.curtains.flat())
        gl.uniform4fv(gl.getUniformLocation(program, 'uCurtainStyles[0]'), composition.styles.flat())
      }
      setComposition(1)
      const draw = (opacity: number, time: number) => {
        gl.uniform1f(gl.getUniformLocation(program, 'uOpacity'), opacity)
        gl.uniform1f(gl.getUniformLocation(program, 'uTime'), time)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
        const pixels = new Uint8Array(128 * 64 * 4)
        gl.readPixels(0, 0, 128, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
        return pixels.filter((_, index) => index % 4 !== 3)
      }
      const off = draw(0, 0), first = draw(1, 0), later = draw(1, 60)
      setComposition(2)
      const next = draw(1, 0)
      results.push({ layers, off: Math.max(...off), peak: Math.max(...first), difference: first.reduce((sum, value, index) => sum + Math.abs(value - later[index]), 0), compositionDifference: first.reduce((sum, value, index) => sum + Math.abs(value - next[index]), 0), error: gl.getError() })
      gl.deleteProgram(program); gl.deleteShader(fragment)
    }
    gl.deleteShader(vertex); gl.deleteTexture(texture)
    return results
  })
  expect(result.map(sample => sample.layers)).toEqual([1, 2, 3])
  for (const sample of result) {
    expect(sample.off).toBe(0)
    expect(sample.peak).toBeGreaterThan(25)
    expect(sample.difference).toBeGreaterThan(1000)
    expect(sample.compositionDifference).toBeGreaterThan(1000)
    expect(sample.error).toBe(0)
  }
})
