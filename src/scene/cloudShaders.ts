/** One world-space cloud field for sky coverage, stellar occlusion and ground shadows. */
export const cloudFieldChunk = /* glsl */ `
  uniform highp sampler2D uCloudNoise;
  vec4 cloudRandom(vec2 p) {
    return texture2D(uCloudNoise, (mod(floor(p), 128.0) + 0.5) / 128.0);
  }
  float cloudHash(vec2 p) { return cloudRandom(p).r; }
  float cloudNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(cloudHash(i), cloudHash(i + vec2(1, 0)), f.x),
      mix(cloudHash(i + vec2(0, 1)), cloudHash(i + vec2(1)), f.x), f.y);
  }
  float cloudDensity(vec2 worldXZ, vec2 drift, float cover) {
    vec2 p = worldXZ * 0.035 + drift;
    vec2 base = floor(p);
    float density = 0.0;
    float detail = cloudNoise(p * 7.0) * 0.09;
    // Include all neighboring puffs, so switching cells never drops a visible edge.
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        vec2 cell = base + vec2(float(x),float(y));
        vec4 random = cloudRandom(cell + vec2(3, 11));
        float seed = random.r;
        float gate = smoothstep(seed - 0.06,seed + 0.06,0.12 + cover * 0.88);
        vec2 center = cell + 0.35 + random.gb * 0.3;
        vec2 d = p - center;
        float radius = 0.25 + seed * 0.17 + cover * 0.3;
        float puff = min(length(d), min(length(d - vec2(.18,.11)), length(d + vec2(.17,-.05))));
        float body = 1.0 - smoothstep(radius * .52, radius, puff + detail);
        density = max(density, body * gate);
      }
    }
    return density;
  }
  vec2 cloudSkyPoint(vec3 direction) {
    // A curved layer avoids aliasing and infinitely compressed bands at the horizon.
    return direction.xz * (36.0 / max(direction.y + 0.35, 0.25));
  }
`
