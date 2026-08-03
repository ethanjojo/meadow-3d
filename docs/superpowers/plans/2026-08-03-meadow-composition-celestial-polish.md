# Meadow Composition and Celestial Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe the fixed meadow like the supplied Swaying grass reference, guarantee terrain-free foreground coverage with coherent wind motion, and add believable sunset, cloud, sun, and moon lighting without sacrificing adaptive quality.

**Architecture:** Pure core helpers will own fixed-camera framing, deterministic near-field coverage, grass motion/variation, and blended atmosphere terms. Existing R3F scene components will consume those values through the current reusable refs; focused shader modules will own clouds and celestial discs. The existing three-second environment transition remains the only state-change path.

**Tech Stack:** React 19, TypeScript, Three.js 0.179, React Three Fiber, GLSL shaders, Vitest, Playwright, Vite, built-in ImageGen for the committed moon asset.

## Global Constraints

- The visible grass horizon must remain between 43% and 47% of viewport height on supported desktop and mobile aspect ratios.
- The lower 55% of the frame must show no connected terrain patch in calm, reduced-motion, or maximum-storm bend states.
- The camera remains fixed: no mouse parallax, bob, free movement, or gameplay.
- Foreground median projected tip travel must be at least 90% of middle-layer travel at equal wind strength; roots remain visually stationary.
- Camera clearance retains at least 70% height, 70% wind response, and 60% rest lean.
- Sun and moon retain the existing left-to-right arcs and depth-tested grass occlusion.
- Clear-night open sky stays above 7% display luminance and representative foreground grass above 3%, while both remain materially darker than daytime.
- High/medium/low quality may reduce detail but may not move the horizon, expose terrain, freeze foreground wind, remove celestial occlusion, or make clear night black.
- No volumetric ray marching, SSAO, depth of field, motion blur, lens dirt, strong vignette, runtime texture downloads, or large new runtime dependency.
- Ordinary frame updates remain allocation-free; textures, vectors, colors, materials, geometries, and render targets are reused and disposed.
- Every implementation task follows TDD: add the focused failing assertion, confirm RED, implement the smallest complete behavior, confirm GREEN, then commit.

---

## File Structure

### New files

- `src/core/cameraFraming.ts` — fixed camera values and horizon-projection helper.
- `src/scene/cloudShaders.ts` — cloud layer profiles and GLSL, separate from React lifecycle code.
- `src/scene/celestialShaders.ts` — sun/moon disc shaders and allocation-free appearance helpers.
- `src/scene/celestialTextures.ts` — moon texture loading, analytic fallback, configuration, and cleanup.
- `src/assets/moon-surface.png` — committed 512×512 grayscale lunar surface.
- `tests/core/cameraFraming.test.ts` — desktop/mobile horizon invariant.
- `tests/core/cloudRendering.test.ts` — layer policy and shared lighting contract.
- `tests/core/celestialRendering.test.ts` — solar/lunar shader behavior and fallback loader.

### Existing files to modify

- `src/core/grassLayout.ts` — near-field distribution, clearance floors, structured spatial variation, motion estimate.
- `src/core/atmosphere.ts` — solar scatter, twilight, lunar ambient, and cloud-light terms.
- `src/scene/FixedCamera.tsx` — consume `cameraFraming` only.
- `src/scene/Meadow.tsx` — bind structured variation and revised clearance/motion uniforms.
- `src/scene/grassShaders.ts` — shared foreground wind, cluster variation, moon wet highlight.
- `src/scene/grassAtmosphere.ts` — synchronize new atmosphere light uniforms.
- `src/scene/CloudLayer.tsx` — lifecycle and uniform sync for focused cloud shader materials.
- `src/scene/CelestialBodies.tsx` — shader-based sun/moon discs and lunar texture fallback.
- `src/scene/Atmosphere.tsx` — pass shared scatter/light fields into sky and celestial rendering.
- `tests/core/grassLayout.test.ts` — coverage, clearance, movement, correlation.
- `tests/core/atmosphere.test.ts` — sunset/twilight/night fields and blending.
- `tests/core/quality.test.ts` — exact detail policy.
- `tests/core/celestialProjection.test.ts` — new fixed framing with unchanged arc projection.
- `tests/e2e/meadow.spec.ts` — coverage, horizon, sunset, twilight, moonlight, error capture.

---

### Task 1: Fixed Reference-Like Camera Framing

**Files:**
- Create: `src/core/cameraFraming.ts`
- Create: `tests/core/cameraFraming.test.ts`
- Modify: `src/scene/FixedCamera.tsx`
- Modify: `tests/core/celestialProjection.test.ts`

**Interfaces:**
- Consumes: viewport aspect ratio and the existing 46-degree perspective camera.
- Produces: `getFixedCameraFraming(aspect: number): FixedCameraFraming` and `measureGroundHorizon(camera: PerspectiveCamera): number`.

- [ ] **Step 1: Add the failing desktop/mobile horizon test**

```ts
import { describe, expect, it } from 'vitest'
import { PerspectiveCamera } from 'three'
import {
  getFixedCameraFraming,
  measureGroundHorizon,
} from '../../src/core/cameraFraming'

describe('fixed meadow framing', () => {
  it.each([
    ['desktop', 1280 / 720],
    ['mobile', 390 / 844],
  ])('keeps the %s horizon inside the reference band', (_name, aspect) => {
    const framing = getFixedCameraFraming(aspect)
    const camera = new PerspectiveCamera(46, aspect, 0.1, 180)
    camera.position.set(...framing.position)
    camera.lookAt(...framing.target)
    camera.updateMatrixWorld()

    expect(measureGroundHorizon(camera)).toBeGreaterThanOrEqual(0.43)
    expect(measureGroundHorizon(camera)).toBeLessThanOrEqual(0.47)
    expect(framing.position[1]).toBeLessThan(0.9)
  })
})
```

- [ ] **Step 2: Run the framing test and confirm RED**

Run: `npm test -- tests/core/cameraFraming.test.ts`

Expected: FAIL because `src/core/cameraFraming.ts` does not exist.

- [ ] **Step 3: Implement fixed framing and the projection helper**

```ts
import { PerspectiveCamera, Vector3 } from 'three'

export interface FixedCameraFraming {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
}

const HORIZON_SAMPLE = new Vector3(0, 0, -120)
const HORIZON_PROJECTION = new Vector3()

export function getFixedCameraFraming(_aspect: number): FixedCameraFraming {
  return {
    position: [0, 0.78, 5.4],
    target: [0, 0.36, -5],
  }
}

export function measureGroundHorizon(camera: PerspectiveCamera) {
  const ndcY = HORIZON_PROJECTION.copy(HORIZON_SAMPLE).project(camera).y
  return (1 - ndcY) * 0.5
}
```

Move the scratch vector out of the function so ordinary use does not allocate. If the initial numeric pair falls outside 43–47% for either tested aspect, adjust only the fixed Y position/target until both pass; do not add runtime animation.

- [ ] **Step 4: Make `FixedCamera` consume the pure framing**

```tsx
export function FixedCamera() {
  const camera = useThree((state) => state.camera)
  const aspect = useThree((state) => state.size.width / state.size.height)

  useLayoutEffect(() => {
    const framing = getFixedCameraFraming(aspect)
    camera.position.set(...framing.position)
    camera.lookAt(...framing.target)
    camera.updateProjectionMatrix()
  }, [aspect, camera])
  return null
}
```

Update `celestialProjection.test.ts` to build its camera with `getFixedCameraFraming(aspect)` while retaining the existing NDC arc assertions.

- [ ] **Step 5: Verify framing, projection, lint, and build**

Run: `npm test -- tests/core/cameraFraming.test.ts tests/core/celestialProjection.test.ts`

Expected: PASS.

Run: `npm run lint && npm run build`

Expected: exit 0.

- [ ] **Step 6: Commit the framing unit**

```bash
git add src/core/cameraFraming.ts src/scene/FixedCamera.tsx tests/core/cameraFraming.test.ts tests/core/celestialProjection.test.ts
git commit -m "feat: match the reference meadow framing"
```

---

### Task 2: Deterministic Near-Field Coverage and Safe Clearance

**Files:**
- Modify: `src/core/grassLayout.ts`
- Modify: `src/scene/Meadow.tsx`
- Modify: `src/scene/grassShaders.ts`
- Modify: `tests/core/grassLayout.test.ts`

**Interfaces:**
- Consumes: `GrassLayerKind`, total blade budget, deterministic seed, camera distance.
- Produces: revised `GRASS_LAYER_RATIOS`, `getGrassClearance(distance)`, and foreground roots no nearer than world Z `4.4` for the camera at Z `5.4`.

- [ ] **Step 1: Replace the old suppression assertion with coverage floors**

```ts
it('preserves near-camera height, lean, and wind while avoiding the near plane', () => {
  const close = getGrassClearance(0)
  expect(close.height).toBeGreaterThanOrEqual(0.7)
  expect(close.wind).toBeGreaterThanOrEqual(0.7)
  expect(close.lean).toBeGreaterThanOrEqual(0.6)

  const foreground = createGrassLayerLayout(8_192, 'foreground', 17)
  for (let index = 2; index < foreground.offsets.length; index += 3) {
    expect(foreground.offsets[index]).toBeLessThanOrEqual(4.4)
  }
})

it('reserves enough blades for overlapping foreground coverage', () => {
  expect(GRASS_LAYER_RATIOS.foreground).toBeGreaterThanOrEqual(0.28)
  expect(
    GRASS_LAYER_RATIOS.foreground +
      GRASS_LAYER_RATIOS.middle +
      GRASS_LAYER_RATIOS.horizon,
  ).toBe(1)
})
```

- [ ] **Step 2: Run the grass-layout test and confirm RED**

Run: `npm test -- tests/core/grassLayout.test.ts`

Expected: FAIL because close clearance is `{ height: 0.15, lean: 0, wind: 0 }` and the old foreground begins at Z `5`.

- [ ] **Step 3: Implement near-band and clearance floors**

Use these exact ratios and foreground band:

```ts
export const GRASS_LAYER_RATIOS = {
  foreground: 0.28,
  middle: 0.32,
  horizon: 0.4,
} as const

const LAYER_BANDS = {
  foreground: {
    near: 4.4,
    far: -4.5,
    nearHalfWidth: 1.6,
    farHalfWidth: 8.2,
  },
  middle: {
    near: -3.5,
    far: -16,
    nearHalfWidth: 7.2,
    farHalfWidth: 16,
  },
  horizon: {
    near: -14,
    far: -34,
    nearHalfWidth: 13.5,
    farHalfWidth: 28,
  },
} as const

export function getGrassClearance(distance: number) {
  const clearance = smoothstep(0.65, 5.5, Math.max(0, distance))
  return {
    height: 0.7 + clearance * 0.3,
    lean: 0.6 + clearance * 0.4,
    wind: 0.7 + clearance * 0.3,
  }
}
```

For foreground only, replace uniform depth sampling with `const depthProgress = random() ** 1.45` to concentrate roots toward the camera without making a hard sub-band boundary. Preserve deterministic X expansion and terrain height.

- [ ] **Step 4: Match the shader clearance curve**

Replace the current shader values with the same floors and distances:

```glsl
float cameraClearance = smoothstep(0.65, 5.5, cameraDistance);
float clearanceHeight = mix(0.70, 1.0, cameraClearance);
float clearanceLean = mix(0.60, 1.0, cameraClearance);
float clearanceWind = mix(0.70, 1.0, cameraClearance);
```

Do not change the root influence or bend limits in this task.

- [ ] **Step 5: Verify layout and real-canvas smoke behavior**

Run: `npm test -- tests/core/grassLayout.test.ts`

Expected: PASS.

Run: `npm run test:e2e -- --grep "loads the meadow|fixed grass horizon" --project=chromium-desktop`

Expected: PASS without page errors.

- [ ] **Step 6: Commit the coverage unit**

```bash
git add src/core/grassLayout.ts src/scene/Meadow.tsx src/scene/grassShaders.ts tests/core/grassLayout.test.ts
git commit -m "feat: guarantee near-field grass coverage"
```

---

### Task 3: Coherent Foreground Motion and Structured Variation

**Files:**
- Modify: `src/core/grassLayout.ts`
- Modify: `src/scene/Meadow.tsx`
- Modify: `src/scene/grassShaders.ts`
- Modify: `tests/core/grassLayout.test.ts`

**Interfaces:**
- Consumes: root `(x, z)`, instance seed, authored scale/stiffness, wind strength, clearance.
- Produces: `sampleGrassCluster(x: number, z: number, seed: number): GrassCluster`, `estimateGrassTipTravel(...)`, and attributes `clusterHue`, `clusterShape`.

- [ ] **Step 1: Add failing motion and local-correlation tests**

```ts
it('keeps representative foreground tip travel at least 90% of middle travel', () => {
  const foreground = estimateGrassTipTravel(1.2, 0.68, 0.7, 1)
  const middle = estimateGrassTipTravel(0.99, 0.6, 0.7, 1)
  expect(foreground / middle).toBeGreaterThanOrEqual(0.9)
})

it('creates deterministic locally correlated grass clusters', () => {
  const origin = sampleGrassCluster(2, -3, 731)
  const neighbor = sampleGrassCluster(2.2, -3.15, 731)
  const distant = sampleGrassCluster(18, -24, 731)
  expect(sampleGrassCluster(2, -3, 731)).toEqual(origin)
  expect(Math.abs(origin.hue - neighbor.hue)).toBeLessThan(0.08)
  expect(Math.abs(origin.hue - distant.hue)).toBeGreaterThan(0.005)
  expect(origin.shape).toBeGreaterThanOrEqual(0)
  expect(origin.shape).toBeLessThan(4)
})
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- tests/core/grassLayout.test.ts`

Expected: FAIL because both helpers and cluster attributes are absent.

- [ ] **Step 3: Implement allocation-free pure helpers**

```ts
export interface GrassCluster {
  hue: number
  height: number
  width: number
  stiffness: number
  dryness: number
  shape: number
}

function spatialWave(x: number, z: number, seed: number) {
  return (
    Math.sin(x * 0.19 + seed * 0.011) * 0.5 +
    Math.sin(z * 0.16 - seed * 0.007) * 0.3 +
    Math.sin((x + z) * 0.08 + seed * 0.003) * 0.2
  )
}

export function sampleGrassCluster(
  x: number,
  z: number,
  seed: number,
): GrassCluster {
  const field = spatialWave(x, z, seed)
  const normalized = Math.min(1, Math.max(0, field * 0.5 + 0.5))
  return {
    hue: (normalized - 0.5) * 0.12,
    height: 0.92 + normalized * 0.16,
    width: 0.9 + normalized * 0.2,
    stiffness: (normalized - 0.5) * 0.1,
    dryness: normalized * 0.12,
    shape: Math.min(3, Math.floor(normalized * 4)),
  }
}

export function estimateGrassTipTravel(
  scale: number,
  stiffness: number,
  windStrength: number,
  clearanceWind: number,
) {
  const bend = getGrassBendLimit(windStrength, false)
  const flexibility = 1 - stiffness * 0.62
  return scale * Math.sin(bend * flexibility * clearanceWind)
}
```

During layout creation, sample once per root and fold cluster height/width/stiffness into the existing arrays. Add `clusterHue` and `clusterShape` typed arrays to `GrassLayerLayout`; do not call the helper in `useFrame`.

- [ ] **Step 4: Bind cluster attributes and preserve shared wind phase**

Add `InstancedBufferAttribute`s in `Meadow` and shader inputs:

```glsl
attribute float instanceClusterHue;
attribute float instanceClusterShape;
varying float vClusterHue;
varying float vClusterShape;
```

Use `vClusterHue` as a small seasonal-palette modulation and `vClusterShape` to adjust taper/vein influence. Keep `broadWave`, `gustFront`, and `crossWave` based on shared world position; do not add a layer-specific time or direction.

- [ ] **Step 5: Verify motion, variation, and shader contracts**

Run: `npm test -- tests/core/grassLayout.test.ts`

Expected: PASS with deterministic arrays and the 90% motion ratio.

Run: `npm run lint && npm run build`

Expected: exit 0.

- [ ] **Step 6: Commit coherent grass behavior**

```bash
git add src/core/grassLayout.ts src/scene/Meadow.tsx src/scene/grassShaders.ts tests/core/grassLayout.test.ts
git commit -m "feat: unify foreground wind and grass variation"
```

---

### Task 4: Shared Sunset, Twilight, and Lunar Atmosphere Fields

**Files:**
- Modify: `src/core/atmosphere.ts`
- Modify: `src/scene/Atmosphere.tsx`
- Modify: `src/scene/grassAtmosphere.ts`
- Modify: `src/scene/grassShaders.ts`
- Modify: `tests/core/atmosphere.test.ts`
- Modify: `tests/core/simulation.integration.test.ts`

**Interfaces:**
- Consumes: blended environment snapshot, season appearance, celestial state.
- Produces new `AtmosphereState` fields: `solarScatter`, `twilight`, `lunarAmbient`, `cloudLightColor`, `cloudShadowColor`, `cloudLightIntensity`.

- [ ] **Step 1: Add failing atmosphere-state tests**

```ts
it('keeps sunset directional, twilight continuous, and clear night readable', () => {
  const sunset = sampleAtDayPhase(0.73, 'clear')
  const afterSunset = sampleAtDayPhase(0.77, 'clear')
  const night = sampleAtDayPhase(0, 'clear')

  expect(sunset.solarScatter).toBeGreaterThan(0.45)
  expect(afterSunset.twilight).toBeGreaterThan(0.15)
  expect(night.lunarAmbient).toBeGreaterThanOrEqual(0.12)
  expect(night.skyLightIntensity).toBeGreaterThanOrEqual(0.4)
  expect(night.moonIntensity).toBeGreaterThanOrEqual(0.28)
  expect(sunset.cloudLightColor.r).toBeGreaterThan(sunset.cloudLightColor.b)
})

it('blends every new atmosphere field into reusable storage', () => {
  const source = sampleAtDayPhase(0.73)
  const target = sampleAtDayPhase(0)
  const output = sampleAtDayPhase(0.5)
  const cloudColor = output.cloudLightColor
  blendAtmosphere(source, target, 0.5, output)
  expect(output.cloudLightColor).toBe(cloudColor)
  expect(output.solarScatter).toBeCloseTo(
    (source.solarScatter + target.solarScatter) / 2,
  )
  expect(output.lunarAmbient).toBeCloseTo(
    (source.lunarAmbient + target.lunarAmbient) / 2,
  )
})
```

- [ ] **Step 2: Run atmosphere tests and confirm RED**

Run: `npm test -- tests/core/atmosphere.test.ts tests/core/simulation.integration.test.ts`

Expected: FAIL because the new fields do not exist.

- [ ] **Step 3: Extend `AtmosphereState` and all reusable constructors/blenders**

Add three reusable colors to the state constructor and these scalar calculations:

```ts
const horizonProximity = 1 - smoothstep(0.02, 0.58, Math.abs(sunElevation))
const solarScatter = horizonProximity * celestial.sun.visibility
const twilight =
  smoothstep(-0.24, 0.02, sunElevation) *
  (1 - smoothstep(0.04, 0.35, sunElevation))
const lunarAmbient = (1 - daylight) * (0.12 + moonVisibility * 0.16)

state.solarScatter = solarScatter
state.twilight = twilight
state.lunarAmbient = lunarAmbient
state.cloudLightColor.copy(DAY_SKY_LIGHT).lerp(LOW_SUN, solarScatter * 0.82)
state.cloudShadowColor.copy(WEATHER_SKY).multiplyScalar(0.42 + daylight * 0.18)
state.cloudLightIntensity = 0.22 + daylight * 0.48 + lunarAmbient * 0.32
state.skyLightIntensity = clamp(
  0.4 + daylight * 0.3 + lunarAmbient * 0.16 -
    snapshot.weather.cloudCover * 0.08 - snapshot.weather.fog * 0.05,
  0.4,
  0.72,
)
```

Blend each scalar with `mix` and each color with `copy().lerp()`. Update all test fixtures that construct atmosphere uniforms.

- [ ] **Step 4: Consume shared fields in sky and grass**

Add `uSolarScatter`, `uTwilight`, and `uLunarAmbient` uniforms. The sky shader uses solar direction/azimuth to keep warm scatter local to the sun rather than making the full sky orange. Grass adds no independent sunset formula; it uses `sunColor`, `sunIntensity`, `moonIntensity`, and `lunarAmbient` from the shared state.

For wet grass, add a moon-facing highlight capped below the sun highlight:

```glsl
float moonWetHighlight =
  uWetness * pow(moonFacing, 18.0) * uMoonIntensity * 0.12;
litColor += uMoonColor * moonWetHighlight;
```

- [ ] **Step 5: Verify transition continuity and build**

Run: `npm test -- tests/core/atmosphere.test.ts tests/core/simulation.integration.test.ts`

Expected: PASS.

Run: `npm run lint && npm run build`

Expected: exit 0 with reusable Color identities preserved.

- [ ] **Step 6: Commit the atmosphere contract**

```bash
git add src/core/atmosphere.ts src/scene/Atmosphere.tsx src/scene/grassAtmosphere.ts src/scene/grassShaders.ts tests/core/atmosphere.test.ts tests/core/simulation.integration.test.ts
git commit -m "feat: share sunset and moonlight atmosphere"
```

---

### Task 5: Layered Cloud Depth and Shared Lighting

**Files:**
- Create: `src/scene/cloudShaders.ts`
- Create: `tests/core/cloudRendering.test.ts`
- Modify: `src/scene/CloudLayer.tsx`
- Test: `tests/core/quality.test.ts`

**Interfaces:**
- Consumes: `AtmosphereState.cloudLightColor`, `cloudShadowColor`, `cloudLightIntensity`, `solarScatter`, `lunarAmbient`, weather cover/storm, quality `cloudLayers`.
- Produces: `getCloudLayerProfile(index: number): CloudLayerProfile`, `cloudVertexShader`, `cloudFragmentShader`.

- [ ] **Step 1: Add failing cloud-profile and shader tests**

```ts
it('separates cloud layers by scale, height, drift, and parallax', () => {
  const first = getCloudLayerProfile(0)
  const second = getCloudLayerProfile(1)
  expect(first.noiseScale).not.toBe(second.noiseScale)
  expect(first.height).toBeLessThan(second.height)
  expect(first.driftScale).not.toBe(second.driftScale)
  expect(first.depth).toBeGreaterThan(second.depth)
})

it('uses shared sunset, moon, and storm lighting', () => {
  expect(cloudFragmentShader).toContain('uCloudLightColor')
  expect(cloudFragmentShader).toContain('uCloudShadowColor')
  expect(cloudFragmentShader).toContain('uSolarScatter')
  expect(cloudFragmentShader).toContain('uLunarAmbient')
  expect(cloudFragmentShader).toContain('uStorm')
})
```

- [ ] **Step 2: Run the cloud test and confirm RED**

Run: `npm test -- tests/core/cloudRendering.test.ts`

Expected: FAIL because `cloudShaders.ts` does not exist.

- [ ] **Step 3: Extract shaders and define exact layer profiles**

```ts
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
  { noiseScale: 3.1, detailScale: 8.4, driftScale: 1, height: 18, depth: -28, width: 118, opacityScale: 1 },
  { noiseScale: 3.7, detailScale: 9.6, driftScale: 0.72, height: 21.5, depth: -33, width: 134, opacityScale: 0.82 },
  { noiseScale: 4.4, detailScale: 11.1, driftScale: 0.48, height: 25, depth: -38, width: 150, opacityScale: 0.68 },
]

export function getCloudLayerProfile(index: number) {
  return CLOUD_LAYER_PROFILES[Math.min(2, Math.max(0, Math.floor(index)))]
}
```

Move the current vertex/noise code into this file. In the fragment shader, derive density normals from neighboring noise samples, use the shared light/shadow colors, add warm edging proportional to `uSolarScatter`, cool edging proportional to `uLunarAmbient`, and reduce contrast with `smoothstep(0.0, 0.65, vUv.y)` toward the horizon.

- [ ] **Step 4: Rebuild `CloudLayer` as lifecycle glue**

Create materials from `getCloudLayerProfile(layer)`. In `useFrame`, update existing uniform objects only:

```ts
uniforms.uCloudLightColor.value.copy(atmosphere.cloudLightColor)
uniforms.uCloudShadowColor.value.copy(atmosphere.cloudShadowColor)
uniforms.uCloudLightIntensity.value = atmosphere.cloudLightIntensity
uniforms.uSolarScatter.value = atmosphere.solarScatter
uniforms.uLunarAmbient.value = atmosphere.lunarAmbient
uniforms.uCloudCover.value = snapshot.weather.cloudCover
uniforms.uStorm.value = snapshot.weather.storm
```

Place planes from the profile values. Dispose all materials on quality change/unmount.

- [ ] **Step 5: Verify cloud policies across quality tiers**

Run: `npm test -- tests/core/cloudRendering.test.ts tests/core/quality.test.ts`

Expected: PASS with low/medium/high retaining exactly 1/2/3 cloud layers.

Run: `npm run test:e2e -- --grep "open daylight sky|page errors" --project=chromium-desktop`

Expected: PASS; clear sky does not become an opaque ceiling.

- [ ] **Step 6: Commit cloud depth**

```bash
git add src/scene/cloudShaders.ts src/scene/CloudLayer.tsx tests/core/cloudRendering.test.ts
git commit -m "feat: add layered atmospheric clouds"
```

---

### Task 6: Height-Dependent Solar Disc and Sunset Rendering

**Files:**
- Create: `src/scene/celestialShaders.ts`
- Create: `tests/core/celestialRendering.test.ts`
- Modify: `src/scene/CelestialBodies.tsx`
- Modify: `src/scene/Atmosphere.tsx`

**Interfaces:**
- Consumes: `sunElevation`, `solarScatter`, sun visibility/halo, bloom-enabled flag.
- Produces: `getSolarDiscAppearance(elevation: number, scatter: number, target?: SolarDiscAppearance): SolarDiscAppearance`, `celestialDiscVertexShader`, `sunDiscFragmentShader`, `moonDiscFragmentShader`.

- [ ] **Step 1: Add failing solar-appearance and shader tests**

```ts
it('softens and warms the low sun without enlarging the disc excessively', () => {
  const horizon = getSolarDiscAppearance(0.02, 0.95)
  const noon = getSolarDiscAppearance(1, 0)
  const reusable = { warmth: 0, hardDisc: 0, haloScale: 0, discScale: 0 }
  expect(getSolarDiscAppearance(0.2, 0.5, reusable)).toBe(reusable)
  expect(horizon.warmth).toBeGreaterThan(noon.warmth)
  expect(horizon.hardDisc).toBeLessThan(noon.hardDisc)
  expect(horizon.haloScale).toBeGreaterThan(noon.haloScale)
  expect(horizon.discScale).toBeLessThanOrEqual(1.04)
})

it('renders a soft solar limb and height-dependent extinction', () => {
  expect(sunDiscFragmentShader).toContain('smoothstep(1.0, 0.82, radius)')
  expect(sunDiscFragmentShader).toContain('uWarmth')
  expect(sunDiscFragmentShader).toContain('uHardDisc')
})
```

- [ ] **Step 2: Run the celestial-rendering test and confirm RED**

Run: `npm test -- tests/core/celestialRendering.test.ts`

Expected: FAIL because `celestialShaders.ts` does not exist.

- [ ] **Step 3: Implement pure solar appearance and disc shaders**

```ts
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
  const low = Math.min(1, Math.max(0, 1 - Math.max(0, elevation) / 0.42))
  target.warmth = Math.max(low, scatter * 0.85)
  target.hardDisc = 1 - low * 0.34
  target.haloScale = 1 + low * 0.75
  target.discScale = 1 + low * 0.04
  return target
}
```

The sun fragment shader computes radial limb alpha, mixes pale yellow-white with orange-red by `uWarmth`, and multiplies only the hard disc by `uHardDisc`. Keep emission above the existing bloom threshold only when postprocessing is enabled.

- [ ] **Step 4: Replace only the sun basic material**

`CelestialBodies` creates the sun `ShaderMaterial` once and stores one `SolarDiscAppearance` object in `useRef`. In `useFrame`, pass that object as the third argument to `getSolarDiscAppearance`, update uniforms, and apply `discScale` on top of the existing refractive `point.scaleY`. Keep `depthTest: true`, `depthWrite: false`, render order, arc projection, and grass occlusion.

- [ ] **Step 5: Verify sun unit, arc, occlusion, and build**

Run: `npm test -- tests/core/celestialRendering.test.ts tests/core/celestial.test.ts tests/core/celestialProjection.test.ts`

Expected: PASS.

Run: `npm run test:e2e -- --grep "celestial arcs" --project=chromium-desktop`

Expected: PASS for sunrise, right-side sunset, and grass overlap.

- [ ] **Step 6: Commit solar rendering**

```bash
git add src/scene/celestialShaders.ts src/scene/CelestialBodies.tsx src/scene/Atmosphere.tsx tests/core/celestialRendering.test.ts
git commit -m "feat: add atmospheric solar rendering"
```

---

### Task 7: Textured Moon and Analytic Fallback

**Files:**
- Create: `src/assets/moon-surface.png`
- Create: `src/scene/celestialTextures.ts`
- Modify: `src/scene/celestialShaders.ts`
- Modify: `src/scene/CelestialBodies.tsx`
- Modify: `tests/core/celestialRendering.test.ts`

**Interfaces:**
- Consumes: Three `TextureLoader`, local bundled asset URL, moon visibility/halo/light, quality tier.
- Produces: `loadMoonTexture(loader, onReady): () => void`, `createMoonTextureFallback(): DataTexture`, and moon shader uniforms `uMoonSurface`, `uUseSurface`, `uLunarAmbient`.

- [ ] **Step 1: Add failing success/failure/cleanup tests**

```ts
it('installs a detailed moon texture', () => {
  const requests: Array<{ ok: (texture: Texture) => void; fail: () => void }> = []
  const loader = {
    load: (_url: string, ok: (texture: Texture) => void, _p: unknown, fail: () => void) => {
      requests.push({ ok, fail })
      return new Texture()
    },
  } as unknown as TextureLoader
  const received: MoonTextureSet[] = []
  const cancel = loadMoonTexture(loader, (set) => received.push(set))
  requests[0].ok(new Texture())
  expect(received[0].detailed).toBe(true)
  cancel()
})

it('ignores texture completion after cancellation', () => {
  let resolve: ((texture: Texture) => void) | undefined
  const loader = {
    load: (_url: string, ok: (texture: Texture) => void) => {
      resolve = ok
      return new Texture()
    },
  } as unknown as TextureLoader
  const received: MoonTextureSet[] = []
  const cancel = loadMoonTexture(loader, (set) => received.push(set))
  cancel()
  resolve?.(new Texture())
  expect(received).toEqual([])
})

it('falls back to an analytic texture when loading fails', () => {
  let reject: (() => void) | undefined
  const loader = {
    load: (
      _url: string,
      _ok: (texture: Texture) => void,
      _progress: unknown,
      fail: (error: unknown) => void,
    ) => {
      reject = () => fail(new Error('missing moon texture'))
      return new Texture()
    },
  } as unknown as TextureLoader
  const received: MoonTextureSet[] = []
  const cancel = loadMoonTexture(loader, (set) => received.push(set))
  reject?.()
  expect(received).toHaveLength(1)
  expect(received[0].detailed).toBe(false)
  expect(received[0].texture).toBeInstanceOf(DataTexture)
  received[0].texture.dispose()
  cancel()
})
```

- [ ] **Step 2: Run the celestial-rendering test and confirm RED**

Run: `npm test -- tests/core/celestialRendering.test.ts`

Expected: FAIL because `celestialTextures.ts` and the moon asset do not exist.

- [ ] **Step 3: Generate and prepare the committed moon asset**

Use the `imagegen` skill and built-in ImageGen with this exact prompt:

> A square 1:1 orthographic grayscale albedo map of the full Moon, centered and filling 92 percent of the frame, scientifically plausible large maria and fine crater variation, soft natural contrast, evenly illuminated surface with no cast shadow, no glow, no stars, no text, no border, seamless dark-neutral corners suitable for sampling on a circular shader disc.

Save the accepted output as `src/assets/moon-surface.png`, convert to sRGB RGBA, and resize to exactly 512×512. Do not bake a halo, phase shadow, or colored light into the texture; the shader owns those effects.

- [ ] **Step 4: Implement loader and analytic fallback**

```ts
export interface MoonTextureSet {
  texture: Texture
  detailed: boolean
}

export function createMoonTextureFallback() {
  const data = new Uint8Array([178, 178, 178, 255])
  const texture = new DataTexture(data, 1, 1, RGBAFormat)
  texture.needsUpdate = true
  return texture
}

export function loadMoonTexture(
  loader: TextureLoader,
  onReady: (set: MoonTextureSet) => void,
) {
  let active = true
  loader.load(
    moonSurfaceUrl,
    (texture) => active && onReady({ texture, detailed: true }),
    undefined,
    () => active && onReady({ texture: createMoonTextureFallback(), detailed: false }),
  )
  return () => { active = false }
}
```

Configure the detailed texture with `SRGBColorSpace`, linear mipmap filtering, clamp wrapping, and anisotropy capped by renderer capability.

- [ ] **Step 5: Bind the moon shader without changing its arc**

The moon disc shader samples grayscale albedo only when `uUseSurface > 0.5`, applies a soft radial limb, and adds no emission except the configured cool moon response. `CelestialBodies` owns the fallback immediately, installs detailed texture asynchronously, and disposes the installed/fallback textures on replacement or unmount. The halo remains a separate depth-tested material and stays attenuated by fog/cloud state.

- [ ] **Step 6: Verify loader fallback, build asset hashing, and night smoke**

Run: `npm test -- tests/core/celestialRendering.test.ts`

Expected: PASS for success, failure, cancellation, and shader assertions.

Run: `npm run build`

Expected: PASS with a hashed `moon-surface-*.png` in `dist/assets`.

Run: `npm run test:e2e -- --grep "celestial arcs|page errors" --project=chromium-desktop`

Expected: PASS without changing arc placement or occlusion.

- [ ] **Step 7: Commit lunar rendering**

```bash
git add src/assets/moon-surface.png src/scene/celestialTextures.ts src/scene/celestialShaders.ts src/scene/CelestialBodies.tsx tests/core/celestialRendering.test.ts
git commit -m "feat: add readable moonlit nights"
```

---

### Task 8: Visual Coverage, Lighting Acceptance, and Final Handoff

**Files:**
- Modify: `tests/e2e/meadow.spec.ts`

**Interfaces:**
- Consumes: all completed framing, grass, atmosphere, cloud, sun, and moon units.
- Produces: verified desktop/mobile screenshots, clean production build, clean console, final commit, and open Auto-mode deliverable.

- [ ] **Step 1: Add screenshot analysis helpers and final acceptance cases**

Add a helper that decodes `page.screenshot()` in the page, scans each X column from top to bottom, and records the first sustained grass-like run. Use the median row across the middle 80% of columns:

```ts
expect(horizonFraction).toBeGreaterThanOrEqual(0.43)
expect(horizonFraction).toBeLessThanOrEqual(0.47)
```

Add manual-state cases for daylight clear, storm, sunset (`dayPhase: 0.72`), twilight (`0.78`), and moonlit night (`0`). Every visual case captures `pageerror` and asserts an empty array.

For the lower-frame coverage test, sample the lower 55% in 8×8 cells and reject any connected region of terrain-like flat color larger than 1.5% of the full frame. Also assert sufficient local luminance/edge variance so a flat green ground plane cannot pass as grass.

For moonlit night, use screenshot pixel luminance:

```ts
expect(night.openSkyLuminance).toBeGreaterThan(255 * 0.07)
expect(night.foregroundLuminance).toBeGreaterThan(255 * 0.03)
expect(night.openSkyLuminance).toBeLessThan(day.openSkyLuminance * 0.55)
expect(night.foregroundLuminance).toBeLessThan(day.foregroundLuminance * 0.6)
```

- [ ] **Step 2: Run the new visual cases against the completed unit-tested behavior**

Run: `npm run test:e2e -- --grep "reference composition|moonlit readability"`

Expected: PASS on both desktop and mobile projects. Task 8 adds acceptance evidence only; Tasks 1–7 already established RED/GREEN behavior for every production change.

- [ ] **Step 3: Run complete automated verification**

Run: `npm test`

Expected: all unit/component tests PASS.

Run: `npm run lint`

Expected: exit 0.

Run: `npm run build`

Expected: exit 0 with hashed grass and moon assets and no development query hooks in production output.

Run: `npm run test:e2e`

Expected: every desktop and mobile project PASS, including the existing sound, settings bounds, transitions, celestial arcs, occlusion, shooting stars, and the new composition/night tests.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 4: Perform in-app visual review against the supplied reference**

Inspect original-detail desktop landscape and mobile portrait states for calm daylight, strong wind, storm, sunset, twilight, clear moonlit night, cloudy moonlit night, and rain. Confirm:

- approximately 55% grass / 45% sky;
- no visible terrain or circular camera clearance;
- foreground and middle grass share the same arriving gust front;
- foreground roots do not slide;
- restrained spatial variation without patchwork;
- sunset affects sky, clouds, haze, and tips coherently;
- moon surface is readable, halo is subtle, and night remains dark but not crushed;
- no glowing grass outlines or obvious cloud-plane edges;
- settings are closed for the final state.

- [ ] **Step 5: Commit final acceptance evidence**

```bash
git add tests/e2e/meadow.spec.ts
git commit -m "test: verify reference meadow composition"
```

- [ ] **Step 6: Leave the verified page open**

Reuse the approved Vite server at `http://127.0.0.1:5174/`, select Auto mode, close settings, reload once, confirm title `Živá louka` and no fresh error/warning logs, then finalize that single tab as the deliverable.
