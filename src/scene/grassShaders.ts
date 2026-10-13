import { cloudFieldChunk } from './cloudShaders'

export function getGrassShaderDefines(detailedLighting: boolean) {
  return detailedLighting ? {} : { SIMPLE_GRASS_LIGHTING: 1 }
}

export const cloudShadowChunk = /* glsl */ `
  ${cloudFieldChunk}
  float cloudShadowFactor(vec2 worldXZ, vec2 drift, float cover) {
    return cloudDensity(worldXZ, drift, cover);
  }
`
export const grassVertexShader = /* glsl */ `
  attribute vec3 instanceOffset;
  attribute float instanceScale;
  attribute float instancePhase;
  attribute float instanceStiffness;
  attribute float instanceYaw;
  attribute float instanceWidth;
  attribute float instanceLean;
  attribute float instanceColorVariation;
  attribute float instanceAtlasCell;

  uniform float uTime;
  uniform float uWindStrength;
  uniform vec2 uWindDirection;
  uniform vec2 uGustOrigin;
  uniform float uGustSpeed;
  uniform float uBendLimit;
  uniform float uFlutterStrength;

  varying float vHeight;
  varying float vVariation;
  varying float vViewDepth;
  varying vec3 vBladeNormal;
  varying vec2 vAtlasUv;
  varying vec2 vWorldXZ;

  mat2 rotate2d(float angle) {
    float sine = sin(angle);
    float cosine = cos(angle);
    return mat2(cosine, -sine, sine, cosine);
  }

  void main() {
    float heightRatio = clamp(position.y, 0.0, 1.0);
    float rootFade = smoothstep(0.38, 1.0, heightRatio);
    float rootInfluence = rootFade * rootFade;
    float cameraDistance = distance(cameraPosition.xz, instanceOffset.xz);
    float cameraClearance = smoothstep(1.6, 8.0, cameraDistance);
    float clearanceHeight = mix(0.15, 1.0, cameraClearance);
    float clearanceLean = cameraClearance;
    float clearanceWind = cameraClearance;
    vec3 localPosition = position;
    localPosition.y *= instanceScale * clearanceHeight;
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
      smoothstep(-4.0, 0.0, gustPosition) *
      (1.0 - smoothstep(0.0, 8.0, gustPosition));
    float crossWave = sin(
      dot(relativePosition, vec2(-windDirection.y, windDirection.x)) * 0.28 +
      uTime * 0.31 +
      instancePhase * 0.7
    );
    float flexibility = 1.0 - instanceStiffness * 0.62;
    float waveSignal =
      (broadWave * 0.42 + gustFront * (0.48 + crossWave * 0.18)) *
      (0.11 + uWindStrength * 0.56);
    float targetAngle = clamp(waveSignal * flexibility, -uBendLimit, uBendLimit);
    float flutter =
      sin(uTime * 5.2 + instancePhase * 2.3 + flowPosition * 0.37) *
      uFlutterStrength *
      (0.16 + uWindStrength * 0.84) *
      (1.0 - instanceStiffness);
    targetAngle = clamp(targetAngle + flutter, -uBendLimit, uBendLimit);
    float curvatureAngle = targetAngle * rootInfluence * clearanceWind;
    vec2 bendOffset = windDirection * sin(curvatureAngle) * heightRatio * heightRatio;

    localPosition.xz += bendOffset;
    localPosition.y *= max(0.72, cos(curvatureAngle));
    localPosition.x += instanceLean * rootInfluence * clearanceLean;

    vec4 worldPosition = modelMatrix * vec4(localPosition + instanceOffset, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * viewPosition;
    vWorldXZ = worldPosition.xz;

    vHeight = heightRatio;
    vVariation = instanceColorVariation;
    vViewDepth = -viewPosition.z;
    float atlasColumn = mod(instanceAtlasCell, 4.0);
    float atlasRow = floor(instanceAtlasCell / 4.0);
    vAtlasUv = vec2(
      (atlasColumn + uv.x) / 4.0,
      (1.0 - atlasRow + uv.y) / 2.0
    );
    vBladeNormal = normalize(vec3(
      -windDirection.x * curvatureAngle * 0.5 - instanceLean * 0.24,
      1.0,
      -windDirection.y * curvatureAngle * 0.5
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
  uniform vec3 uGroundLightColor;
  uniform vec3 uSunDirection;
  uniform vec3 uMoonDirection;
  uniform vec3 uFogColor;
  uniform float uDryness;
  uniform float uWetness;
  uniform float uFrost;
  uniform float uSnowCoverage;
  uniform float uLayerFade;
  uniform float uFogDensity;
  uniform float uSkyLightIntensity;
  uniform float uSunIntensity;
  uniform float uMoonIntensity;
  uniform float uStormFlash;
  uniform float uCloudPhase;
  uniform sampler2D uGrassColorAtlas;
  uniform sampler2D uGrassSurfaceAtlas;
  uniform float uUseAtlas;
  uniform float uUseTransmission;
  uniform float uShadowCover;
  uniform float uShadowStrength;
  uniform float uTime;
  uniform vec2 uWindDirection;

  varying float vHeight;
  varying float vVariation;
  varying float vViewDepth;
  varying vec3 vBladeNormal;
  varying vec2 vAtlasUv;
  varying vec2 vWorldXZ;

  ${cloudShadowChunk}

  void main() {
    vec4 atlasColor = vec4(1.0);
    vec4 surfaceData = vec4(1.0, 0.5, 0.5, 1.0);
    #ifndef SIMPLE_GRASS_LIGHTING
    if (uUseAtlas > 0.5) {
      atlasColor = texture2D(uGrassColorAtlas, vAtlasUv);
      surfaceData = texture2D(uGrassSurfaceAtlas, vAtlasUv);
      if (atlasColor.a < 0.28) discard;
    }
    #endif
    vec3 freshColor = mix(uGrassBase, uGrassTip, smoothstep(0.05, 1.0, vHeight));
    vec3 grassColor = mix(freshColor, uDryColor, uDryness * (0.35 + vHeight * 0.65));
    #ifndef SIMPLE_GRASS_LIGHTING
    float atlasLuminance = max(
      dot(atlasColor.rgb, vec3(0.2126, 0.7152, 0.0722)),
      0.18
    );
    vec3 atlasDetail = clamp(atlasColor.rgb / atlasLuminance, 0.72, 1.28);
    grassColor *= mix(vec3(1.0), atlasDetail, uUseAtlas * 0.34);
    grassColor *= mix(1.0, mix(0.92, 1.08, surfaceData.b), uUseAtlas);
    #endif
    grassColor *= mix(0.86, 1.1, vVariation);

    float distanceSoften = smoothstep(14.0, 32.0, vViewDepth);
    float colorTone = dot(grassColor, vec3(0.2126, 0.7152, 0.0722));
    grassColor = mix(grassColor, vec3(colorTone), distanceSoften * 0.5);

    float lowerBlade = 1.0 - smoothstep(0.12, 0.82, vHeight);
    float wetDarkening = uWetness * (0.16 + lowerBlade * 0.28);
    grassColor *= 1.0 - wetDarkening;

    float frost = uFrost * smoothstep(0.62, 0.98, vHeight);
    float snow = uSnowCoverage * smoothstep(0.42, 0.96, vHeight);
    grassColor = mix(grassColor, uSnowColor * 0.88, frost * 0.48);
    grassColor = mix(grassColor, uSnowColor, snow);

    vec3 normal = normalize(vBladeNormal);
    float sunFacing = max(dot(normal, uSunDirection), 0.0);
    float moonFacing = max(dot(normal, uMoonDirection), 0.0);
    float skyFacing = normal.y * 0.5 + 0.5;
    vec3 hemisphereFill =
      mix(uGroundLightColor, uSkyColor, skyFacing) * uSkyLightIntensity;
    vec3 light =
      hemisphereFill +
      uSunColor * sunFacing * uSunIntensity * 0.72 +
      uMoonColor * moonFacing * uMoonIntensity * 0.6;
    float cloudShade = cloudShadowFactor(
      vWorldXZ,
      uWindDirection * uCloudPhase,
      uShadowCover
    );
    light *= 1.0 - cloudShade * uShadowStrength * 0.42;
    vec3 litColor = grassColor * light;
    #ifndef SIMPLE_GRASS_LIGHTING
    float roughness = mix(1.0, surfaceData.r, uUseAtlas);
    float wetHighlight =
      uWetness *
      pow(sunFacing, mix(14.0, 24.0, roughness)) *
      (0.18 + lowerBlade * 0.32);
    litColor += uSunColor * wetHighlight * uSunIntensity;
    float backlight = max(dot(-normal, uSunDirection), 0.0);
    float transmission =
      uUseTransmission *
      surfaceData.g *
      backlight *
      smoothstep(0.16, 0.92, vHeight);
    litColor += uSunColor * transmission * uSunIntensity * 0.16;
    #endif
    litColor += vec3(1.0) * uStormFlash * (0.16 + vHeight * 0.08);

    float contactDepth = 1.0 - smoothstep(5.0, 26.0, vViewDepth);
    float rootContact =
      (1.0 - smoothstep(0.08, 0.58, vHeight)) *
      mix(0.12, 0.3, uLayerFade) *
      mix(0.55, 1.0, contactDepth);
    litColor *= 1.0 - rootContact;

    float bladeFogDensity = uFogDensity * mix(1.12, 0.92, vHeight);
    float fogAmount = 1.0 - exp(
      -bladeFogDensity * bladeFogDensity * vViewDepth * vViewDepth
    );
    fogAmount += distanceSoften * (1.0 - fogAmount) * 0.3;
    fogAmount = mix(fogAmount, 1.0, 1.0 - uLayerFade);
    gl_FragColor = vec4(mix(litColor, uFogColor, fogAmount), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
