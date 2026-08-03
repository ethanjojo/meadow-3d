export interface CloudLayerProfile {
  noiseScale: number
  detailScale: number
  driftScale: number
  height: number
  depth: number
  width: number
  opacityScale: number
}

const CLOUD_LAYER_PROFILES: readonly CloudLayerProfile[] = [
  {
    noiseScale: 3.1,
    detailScale: 8.4,
    driftScale: 1,
    height: 18,
    depth: -28,
    width: 118,
    opacityScale: 1,
  },
  {
    noiseScale: 3.7,
    detailScale: 9.6,
    driftScale: 0.72,
    height: 21.5,
    depth: -33,
    width: 134,
    opacityScale: 0.82,
  },
  {
    noiseScale: 4.4,
    detailScale: 11.1,
    driftScale: 0.48,
    height: 25,
    depth: -38,
    width: 150,
    opacityScale: 0.68,
  },
]

export function getCloudLayerProfile(index: number) {
  const safeIndex = Math.min(
    CLOUD_LAYER_PROFILES.length - 1,
    Math.max(0, Math.floor(index)),
  )
  return CLOUD_LAYER_PROFILES[safeIndex]
}

export const cloudVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const cloudFragmentShader = /* glsl */ `
  uniform vec3 uCloudLightColor;
  uniform vec3 uCloudShadowColor;
  uniform float uCloudLightIntensity;
  uniform float uSolarScatter;
  uniform float uLunarAmbient;
  uniform float uCloudCover;
  uniform float uStorm;
  uniform float uTime;
  uniform vec2 uWind;
  uniform float uNoiseScale;
  uniform float uDetailScale;
  uniform float uOpacityScale;
  varying vec2 vUv;

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    float a = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
    float b = fract(sin(dot(cell + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
    float c = fract(sin(dot(cell + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
    float d = fract(sin(dot(cell + vec2(1.0), vec2(127.1, 311.7))) * 43758.5453);
    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
  }

  float cloudDensity(vec2 uv, vec2 drift) {
    float broad = noise(uv * uNoiseScale + drift);
    float detail = noise(uv * uDetailScale - drift * 1.7);
    return broad * 0.7 + detail * 0.3;
  }

  void main() {
    vec2 drift = normalize(uWind + vec2(0.0001)) * uTime;
    float density = cloudDensity(vUv, drift);
    float densityX = cloudDensity(vUv + vec2(0.008, 0.0), drift);
    float densityY = cloudDensity(vUv + vec2(0.0, 0.008), drift);
    float threshold = 0.82 - uCloudCover * 0.56;
    float cloud = smoothstep(threshold, threshold + 0.22, density);
    vec2 densityNormal = normalize(
      vec2(density - densityX, density - densityY) + vec2(0.0001)
    );
    float rim = smoothstep(0.0, 0.2, cloud) * (1.0 - smoothstep(0.55, 1.0, cloud));
    float sunEdge = max(dot(densityNormal, normalize(vec2(-0.72, 0.42))), 0.0);
    float moonEdge = max(dot(densityNormal, normalize(vec2(0.58, 0.64))), 0.0);
    float horizonDepth = smoothstep(0.0, 0.65, vUv.y);

    vec3 shadowColor = mix(
      uCloudShadowColor,
      vec3(0.12, 0.14, 0.18),
      uStorm * 0.62
    );
    vec3 lightColor = uCloudLightColor * uCloudLightIntensity;
    vec3 color = mix(shadowColor, lightColor, density * 0.72 + 0.18);
    color += vec3(1.0, 0.42, 0.15) *
      rim * sunEdge * uSolarScatter * 0.42;
    color += vec3(0.35, 0.52, 0.78) *
      rim * moonEdge * uLunarAmbient * 0.32;
    color = mix(color, uCloudLightColor * 0.68, (1.0 - horizonDepth) * 0.32);

    vec2 edgeDistance = min(vUv, 1.0 - vUv);
    float edge = smoothstep(0.0, 0.16, min(edgeDistance.x, edgeDistance.y));
    float alpha = cloud * edge * uOpacityScale *
      (0.16 + uCloudCover * 0.3 + uStorm * 0.1);
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
