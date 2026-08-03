export interface SolarDiscAppearance {
  warmth: number
  hardDisc: number
  haloScale: number
  discScale: number
}

export function getSolarDiscAppearance(
  elevation: number,
  scatter: number,
  target: SolarDiscAppearance = {
    warmth: 0,
    hardDisc: 0,
    haloScale: 0,
    discScale: 0,
  },
): SolarDiscAppearance {
  const low = Math.min(
    1,
    Math.max(0, 1 - Math.max(0, elevation) / 0.42),
  )
  target.warmth = Math.max(low, scatter * 0.85)
  target.hardDisc = 1 - low * 0.34
  target.haloScale = 1 + low * 0.75
  target.discScale = 1 + low * 0.04
  return target
}

export const celestialDiscVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const sunDiscFragmentShader = /* glsl */ `
  uniform float uOpacity;
  uniform float uWarmth;
  uniform float uHardDisc;
  uniform float uEmissionScale;
  varying vec2 vUv;

  void main() {
    float radius = length(vUv - 0.5) * 2.0;
    float limb = smoothstep(1.0, 0.82, radius);
    float softEdge = 1.0 - smoothstep(0.78, 1.0, radius);
    vec3 noonColor = vec3(1.0, 0.94, 0.72);
    vec3 horizonColor = vec3(1.0, 0.42, 0.12);
    vec3 color = mix(noonColor, horizonColor, uWarmth);
    float intensity = mix(0.72, 1.0, uHardDisc) * mix(softEdge, limb, uHardDisc);
    gl_FragColor = vec4(color * uEmissionScale * intensity, limb * uOpacity);
  }
`

export const moonDiscFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float radius = length(vUv - 0.5) * 2.0;
    float alpha = 1.0 - smoothstep(0.9, 1.0, radius);
    gl_FragColor = vec4(uColor, alpha * uOpacity);
  }
`
