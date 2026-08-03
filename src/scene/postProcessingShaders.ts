export type BloomEmissionSource = 'ordinary' | 'sun' | 'moon' | 'firefly'

export function getBloomEmissionScale(
  enabled: boolean,
  source: BloomEmissionSource,
) {
  if (!enabled) return 1
  if (source === 'sun') return 1.35
  if (source === 'moon') return 1.12
  if (source === 'firefly') return 1.5
  return 1
}

export const meadowGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    varying vec2 vUv;

    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      vec3 graded = pow(max(source.rgb, vec3(0.0)), vec3(0.985));
      float distanceFromCenter = length(vUv - 0.5) * 1.4142;
      float vignette = 1.0 - smoothstep(0.55, 1.0, distanceFromCenter) * uVignette;
      gl_FragColor = vec4(graded * vignette, source.a);
    }
  `,
} as const
