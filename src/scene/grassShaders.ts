export const grassVertexShader = /* glsl */ `
  attribute vec3 instanceOffset;
  attribute float instanceScale;
  attribute float instancePhase;
  attribute float instanceStiffness;
  attribute float instanceYaw;

  uniform float uTime;
  uniform float uWindStrength;

  varying float vHeight;
  varying float vVariation;
  varying float vViewDepth;
  varying vec3 vBladeNormal;

  mat2 rotate2d(float angle) {
    float sine = sin(angle);
    float cosine = cos(angle);
    return mat2(cosine, -sine, sine, cosine);
  }

  void main() {
    float heightRatio = clamp(position.y, 0.0, 1.0);
    float rootLock = heightRatio * heightRatio;
    vec3 localPosition = position;
    localPosition.y *= instanceScale;
    localPosition.x *= mix(0.82, 1.15, instanceScale - 0.65);
    localPosition.xz = rotate2d(instanceYaw) * localPosition.xz;

    float broadWave = sin(
      instanceOffset.x * 0.115 +
      instanceOffset.z * 0.062 +
      uTime * 0.72 +
      instancePhase
    );
    float travelingGust = sin(
      dot(instanceOffset.xz, vec2(0.075, 0.13)) -
      uTime * 0.47 +
      sin(instanceOffset.x * 0.035 + uTime * 0.13) * 1.8
    );
    float turbulence =
      sin(instanceOffset.x * 0.51 - uTime * 1.37 + instancePhase) * 0.55 +
      sin(instanceOffset.z * 0.67 + uTime * 1.11) * 0.45;
    float flexibility = 1.0 - instanceStiffness * 0.62;
    float bend =
      (broadWave * 0.34 + travelingGust * 0.5 + turbulence * 0.16) *
      (0.12 + uWindStrength * 0.58) *
      flexibility;

    localPosition.x += bend * rootLock * 0.42;
    localPosition.z += bend * rootLock * instanceScale;

    vec4 worldPosition = modelMatrix * vec4(localPosition + instanceOffset, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * viewPosition;

    vHeight = heightRatio;
    vVariation = fract(sin(dot(instanceOffset.xz, vec2(12.9898, 78.233))) * 43758.5453);
    vViewDepth = -viewPosition.z;
    vBladeNormal = normalize(vec3(-bend * 0.38, 1.0, 0.18));
  }
`

export const grassFragmentShader = /* glsl */ `
  uniform vec3 uGrassBase;
  uniform vec3 uGrassTip;
  uniform vec3 uDryColor;
  uniform vec3 uSnowColor;
  uniform vec3 uSunColor;
  uniform vec3 uSkyColor;
  uniform vec3 uSunDirection;
  uniform vec3 uFogColor;
  uniform float uDryness;
  uniform float uSnowCoverage;
  uniform float uFogNear;
  uniform float uFogFar;

  varying float vHeight;
  varying float vVariation;
  varying float vViewDepth;
  varying vec3 vBladeNormal;

  void main() {
    vec3 freshColor = mix(uGrassBase, uGrassTip, smoothstep(0.05, 1.0, vHeight));
    vec3 grassColor = mix(freshColor, uDryColor, uDryness * (0.35 + vHeight * 0.65));
    float snow = uSnowCoverage * smoothstep(0.42, 0.96, vHeight);
    grassColor = mix(grassColor, uSnowColor, snow);
    grassColor *= mix(0.88, 1.09, vVariation);

    vec3 normal = normalize(vBladeNormal);
    float sunFacing = max(dot(normal, normalize(uSunDirection)), 0.0);
    float skyFacing = normal.y * 0.5 + 0.5;
    vec3 light = uSkyColor * (0.38 + skyFacing * 0.34) + uSunColor * sunFacing * 0.72;
    vec3 litColor = grassColor * light;

    float fogAmount = smoothstep(uFogNear, uFogFar, vViewDepth);
    gl_FragColor = vec4(mix(litColor, uFogColor, fogAmount), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
