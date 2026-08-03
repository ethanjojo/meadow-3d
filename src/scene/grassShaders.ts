export const grassVertexShader = /* glsl */ `
  attribute vec3 instanceOffset;
  attribute float instanceScale;
  attribute float instancePhase;
  attribute float instanceStiffness;
  attribute float instanceYaw;
  attribute float instanceWidth;
  attribute float instanceLean;
  attribute float instanceColorVariation;

  uniform float uTime;
  uniform float uWindStrength;
  uniform vec2 uWindDirection;
  uniform vec2 uGustOrigin;
  uniform float uGustSpeed;

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
    float tipInfluence = heightRatio * heightRatio * heightRatio;
    float cameraDistance = distance(cameraPosition.xz, instanceOffset.xz);
    float cameraClearance = smoothstep(1.6, 8.0, cameraDistance);
    vec3 localPosition = position;
    localPosition.y *= instanceScale * mix(0.15, 1.0, cameraClearance);
    localPosition.xz *= instanceWidth;
    localPosition.xz = rotate2d(instanceYaw) * localPosition.xz;

    vec2 windDirection = normalize(uWindDirection + vec2(0.0001));
    vec2 relativePosition = instanceOffset.xz - uGustOrigin;
    float flowPosition = dot(relativePosition, windDirection);
    float broadWave = sin(
      flowPosition * 0.16 - uTime * (0.42 + uWindStrength * 0.42) + instancePhase
    );
    float gustPosition = mod(flowPosition - uTime * uGustSpeed + 36.0, 72.0) - 36.0;
    float gustFront =
      smoothstep(-5.5, -0.8, gustPosition) *
      (1.0 - smoothstep(0.8, 6.5, gustPosition));
    float crossWave = sin(
      dot(relativePosition, vec2(-windDirection.y, windDirection.x)) * 0.28 +
      uTime * 0.31 +
      instancePhase * 0.7
    );
    float flexibility = 1.0 - instanceStiffness * 0.62;
    float bend =
      (broadWave * 0.42 + gustFront * (0.48 + crossWave * 0.18)) *
      (0.11 + uWindStrength * 0.56) *
      flexibility;

    localPosition.x += instanceLean * tipInfluence * instanceScale;
    localPosition.xz += windDirection * bend * tipInfluence * instanceScale;

    vec4 worldPosition = modelMatrix * vec4(localPosition + instanceOffset, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * viewPosition;

    vHeight = heightRatio;
    vVariation = instanceColorVariation;
    vViewDepth = -viewPosition.z;
    vBladeNormal = normalize(vec3(
      -windDirection.x * bend * 0.5 - instanceLean * 0.24,
      1.0,
      -windDirection.y * bend * 0.5
    ));
  }
`

export const grassFragmentShader = /* glsl */ `
  uniform vec3 uGrassBase;
  uniform vec3 uGrassTip;
  uniform vec3 uDryColor;
  uniform vec3 uSnowColor;
  uniform vec3 uSunColor;
  uniform vec3 uMoonColor;
  uniform vec3 uSkyColor;
  uniform vec3 uSunDirection;
  uniform vec3 uMoonDirection;
  uniform vec3 uFogColor;
  uniform float uDryness;
  uniform float uWetness;
  uniform float uFrost;
  uniform float uSnowCoverage;
  uniform float uLayerFade;
  uniform float uFogDensity;

  varying float vHeight;
  varying float vVariation;
  varying float vViewDepth;
  varying vec3 vBladeNormal;

  void main() {
    vec3 freshColor = mix(uGrassBase, uGrassTip, smoothstep(0.05, 1.0, vHeight));
    vec3 grassColor = mix(freshColor, uDryColor, uDryness * (0.35 + vHeight * 0.65));
    grassColor *= mix(0.86, 1.1, vVariation);

    float lowerBlade = 1.0 - smoothstep(0.12, 0.82, vHeight);
    float wetDarkening = uWetness * (0.16 + lowerBlade * 0.28);
    grassColor *= 1.0 - wetDarkening;

    float frost = uFrost * smoothstep(0.62, 0.98, vHeight);
    float snow = uSnowCoverage * smoothstep(0.42, 0.96, vHeight);
    grassColor = mix(grassColor, uSnowColor * 0.88, frost * 0.48);
    grassColor = mix(grassColor, uSnowColor, snow);

    vec3 normal = normalize(vBladeNormal);
    float sunFacing = max(dot(normal, normalize(uSunDirection)), 0.0);
    float moonFacing = max(dot(normal, normalize(uMoonDirection)), 0.0);
    float skyFacing = normal.y * 0.5 + 0.5;
    vec3 light =
      uSkyColor * (0.38 + skyFacing * 0.34) +
      uSunColor * sunFacing * 0.72 +
      uMoonColor * moonFacing * 0.48;
    vec3 litColor = grassColor * light;
    float wetHighlight = uWetness * pow(sunFacing, 18.0) * (0.18 + lowerBlade * 0.32);
    litColor += uSunColor * wetHighlight;

    float fogAmount = 1.0 - exp(
      -uFogDensity * uFogDensity * vViewDepth * vViewDepth
    );
    fogAmount = mix(fogAmount, 1.0, 1.0 - uLayerFade);
    gl_FragColor = vec4(mix(litColor, uFogColor, fogAmount), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
