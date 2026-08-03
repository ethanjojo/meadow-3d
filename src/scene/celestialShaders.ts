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
  uniform float uOpacity;
  uniform sampler2D uMoonSurface;
  uniform float uUseSurface;
  uniform float uLunarAmbient;
  varying vec2 vUv;

  void main() {
    vec2 disc = (vUv - 0.5) * 2.0;
    float radius = length(disc);
    float alpha = 1.0 - smoothstep(0.9, 1.0, radius);
    float sphereZ = sqrt(max(0.0, 1.0 - dot(disc, disc)));
    vec3 surfaceNormal = normalize(vec3(disc, sphereZ));
    float lunarLight = max(
      dot(surfaceNormal, normalize(vec3(-0.28, 0.18, 0.94))),
      0.0
    );
    float sampledAlbedo = texture2D(uMoonSurface, vUv).r;
    float analyticAlbedo =
      0.68 + sin(vUv.x * 34.0) * sin(vUv.y * 29.0) * 0.045;
    float albedo = mix(analyticAlbedo, sampledAlbedo, uUseSurface);
    vec3 moonColor = vec3(0.7, 0.8, 0.96) * albedo;
    float illumination =
      mix(0.34, 1.0, lunarLight) + uLunarAmbient * 0.28;
    gl_FragColor = vec4(moonColor * illumination, alpha * uOpacity);
  }
`
