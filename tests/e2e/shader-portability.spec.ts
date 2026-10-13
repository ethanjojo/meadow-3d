import { expect, test } from '@playwright/test'

test('renders continuous clouds across texture seams and celestial zenith', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('/?__e2eEffects=0')
  await expect(page.locator('canvas')).toBeVisible()
  const samples = await page.evaluate(async () => {
    const shaderPath = '/src/scene/cloudShaders.ts'
    const noisePath = '/src/scene/cloudNoise.tsx'
    const { cloudFieldChunk } = await import(shaderPath)
    const { createCloudNoiseData, CLOUD_NOISE_SIZE } = await import(noisePath)
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 64
    const gl = canvas.getContext('webgl2')
    if (!gl) throw new Error('WebGL2 is required for GPU portability verification')
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader compilation failed')
      return shader
    }
    const vertex = compile(gl.VERTEX_SHADER, `#version 300 es
      void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`)
    const fragment = compile(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      #define texture2D texture
      ${cloudFieldChunk}
      uniform vec2 drift;
      uniform vec3 lightDirection;
      uniform bool edgeOnly;
      out vec4 color;
      void main() {
        vec2 p = vec2(gl_FragCoord.x / 512.0 * 8.0 - 4.0, gl_FragCoord.y / 64.0 * 2.0 - 1.0);
        float density = cloudDensity(p / .035, drift, .9);
        float value = edgeOnly ? cloudLightEdge(p / .035, density, lightDirection, drift, .9) : density;
        color = vec4(vec3(value), 1.0);
      }`)
    const program = gl.createProgram()!
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Shader linking failed')
    gl.useProgram(program)
    const texture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CLOUD_NOISE_SIZE, CLOUD_NOISE_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, createCloudNoiseData())
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.uniform1i(gl.getUniformLocation(program, 'uCloudNoise'), 0)
    const results = []
    for (const drift of [[0, 0], [19.25, -35.75], [127.99, 127.99]]) {
      gl.uniform2fv(gl.getUniformLocation(program, 'drift'), drift)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      const pixels = new Uint8Array(canvas.width * canvas.height * 4)
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      let maximum = 0, minimum = 255, jump = 0
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4
          maximum = Math.max(maximum, pixels[i])
          minimum = Math.min(minimum, pixels[i])
          if (x > 0) jump = Math.max(jump, Math.abs(pixels[i] - pixels[i - 4]))
        }
      }
      results.push({ maximum, minimum, jump, error: gl.getError() })
    }
    gl.uniform2fv(gl.getUniformLocation(program, 'drift'), [0, 0])
    gl.uniform1i(gl.getUniformLocation(program, 'edgeOnly'), 1)
    const zenithFrames: Uint8Array[] = []
    for (const x of [-.001, 0, .001]) {
      gl.uniform3fv(gl.getUniformLocation(program, 'lightDirection'), [x, Math.sqrt(1 - x * x), 0])
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      const pixels = new Uint8Array(canvas.width * canvas.height * 4)
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      zenithFrames.push(pixels)
    }
    let zenithJump = 0, zenithEdge = 0
    for (let i = 0; i < zenithFrames[0].length; i += 4) {
      zenithJump = Math.max(zenithJump, Math.abs(zenithFrames[0][i] - zenithFrames[2][i]))
      zenithEdge = Math.max(zenithEdge, zenithFrames[1][i])
    }
    const zenithError = gl.getError()
    gl.deleteTexture(texture)
    gl.deleteProgram(program)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return { field: results, zenithJump, zenithEdge, zenithError }
  })
  for (const sample of samples.field) {
    expect(sample.error).toBe(0)
    expect(sample.maximum).toBeGreaterThan(240)
    expect(sample.minimum).toBeLessThan(20)
    expect(sample.jump).toBeLessThan(64)
  }
  expect(samples.zenithError).toBe(0)
  expect(samples.zenithEdge).toBe(0)
  expect(samples.zenithJump).toBeLessThan(4)
  expect(errors).toEqual([])
})
