import { cloudFieldChunk } from './cloudShaders'

export const auroraVertexShader = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vDirection = world.xyz - cameraPosition;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`
export const auroraFragmentShader = /* glsl */ `
  uniform float uTime, uOpacity;
  uniform vec4 uLayout;
  uniform vec4 uCurtains[3], uCurtainStyles[3];
  ${cloudFieldChunk}
  varying vec3 vDirection;
  float auroraFold(float distance, float width, float extent, float lobe) {
    float normalizedDistance = distance / width;
    float crease = exp(-normalizedDistance * normalizedDistance);
    // A luminous edge bounds a filled sheet on one side. A one-sided shoulder
    // with variable extent avoids making the fold read as a glowing tube.
    float wing = smoothstep(-width * 0.65, width * 0.75, distance)
      * exp(-max(distance, 0.0) / (extent * 1.1))
      * (1.0 - smoothstep(extent * 0.45, extent, distance));
    return crease * 0.55 + wing * (0.48 + lobe * 0.27);
  }
  void main() {
    vec3 ray = normalize(vDirection);
    float azimuth = atan(ray.x, -ray.z);
    float elevation = atan(ray.y, length(ray.xz));
    float edge = 1.0 - smoothstep(0.85, 1.6, abs(azimuth));
    vec3 light = vec3(0.0);
    for (int i = 0; i < AURORA_LAYERS; i++) {
      float layer = float(i);
      float t = uTime * (0.085 + layer * 0.009);
      float phase = layer * 1.73 + uLayout.w;
      float drift = sin(uTime * 0.009) * 0.17 + sin(uTime * 0.004) * 0.06;
      vec2 sky = vec2(azimuth + drift - uLayout.x, elevation - 0.28);
      float turn = uLayout.y;
      sky = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * sky;
      sky.y = (sky.y + 0.28) / uLayout.z;
      // Height participates in the domain warp: folds bend and open as they rise,
      // rather than stretching a horizontal pattern into vertical columns.
      vec2 noisePoint = sky * vec2(3.7, 7.0) + vec2(t * 0.15, -t * 0.11 + layer * 17.0);
      float bend = cloudNoise(noisePoint);
      float billow = cloudNoise(noisePoint * 1.65 + vec2(31.0, 11.0));
      vec2 q = sky + vec2((bend - 0.5) * 0.055, (billow - 0.5) * 0.035);
      float patches = cloudNoise(q * vec2(8.5, 10.2) + vec2(-t * 0.21 + 7.0, t * 0.17 + phase));

      // Generated curtains share one rotation but have independent profiles.
      // Ordered centres and bounded bends prevent the creases forming a knot.
      float sheet = 0.0;
      for (int j = 0; j < 3; j++) {
        vec4 path = uCurtains[j];
        vec4 style = uCurtainStyles[j];
        float localPhase = phase + style.y;
        float flex = smoothstep(0.06, 0.48, q.y);
        float twist = sin(q.y * (8.0 + float(j)) - uTime * (0.075 + float(j) * 0.009) + localPhase)
          * (0.023 + 0.010 * sin(uTime * 0.047 + localPhase)) * flex;
        float curve = path.x + (q.y - 0.28) * path.y
          + sin(q.y * (4.5 + float(j)) + localPhase - uTime * 0.024) * path.w
          + twist + layer * 0.018;
        float breath = sin(q.y * 5.0 - uTime * 0.083 + localPhase);
        float width = style.x * (0.8 + billow * 0.5) * (1.0 + breath * 0.18);
        float extent = style.z * (0.75 + bend * 0.35 + smoothstep(0.1, 0.4, q.y) * 0.25)
          * (1.0 + breath * 0.14);
        float height = path.z + layer * 0.035;
        float fade = smoothstep(0.025, 0.11, q.y)
          * (1.0 - smoothstep(height * 0.53, height, q.y));
        float side = mod(float(j), 2.0) * 2.0 - 1.0;
        sheet += auroraFold((q.x - curve) * side, width, extent, patches)
          * fade * style.w * 0.84;
      }
      float openings = smoothstep(0.19, 0.63, patches + bend * 0.12);
      sheet *= 0.30 + openings * 0.70;
      float horizonFade = smoothstep(0.015, 0.075, elevation);
      float upper = smoothstep(0.13, 0.43, q.y);
      vec3 tint = mix(vec3(0.08, 0.68, 0.28), vec3(0.06, 0.53, 0.49), upper);
      float violet = smoothstep(0.32, 0.65, q.y) * smoothstep(0.63, 0.86, patches) * 0.62;
      tint = mix(tint, vec3(0.34, 0.18, 0.48), violet);
      light += tint * sheet * horizonFade * (0.50 / (1.0 + layer * 0.60));
    }
    gl_FragColor = vec4(light * edge * uOpacity, 1.0);
    #include <colorspace_fragment>
  }
`
