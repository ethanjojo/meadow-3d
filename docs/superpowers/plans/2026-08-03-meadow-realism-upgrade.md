# Meadow Realism Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing living meadow physically and visually more credible by fixing foreground blade deformation, replacing accelerated manual-time changes with three-second state transitions, moving celestial bodies along a camera-relative left-to-right arc behind the field, and adding restrained hybrid materials and postprocessing.

**Architecture:** A pure environment-transition runtime will preserve independent source and target snapshots plus normalized mix progress while the automatic clock keeps running. NatureScene will derive and blend source/target season, atmosphere, weather-effects, audio, and celestial presentation states once per frame; GPU shaders will consume the resolved refs without per-frame allocation. Foreground grass alone receives atlas detail, while a focused Three.js addon composer applies threshold bloom and a small grade/vignette pass on supported quality tiers.

**Tech Stack:** React 19, TypeScript, Vite 6, React Three Fiber, Three.js 0.179.1, GLSL, Vitest, Testing Library, Playwright, local PNG texture assets.

## Global Constraints

- Manual environment transitions have a fixed `3.0` second duration and must finish within `2.8–3.2` seconds in browser tests.
- Automatic time continues at normal speed during manual mode and transition playback.
- Foreground scale is `0.85–1.55`, lean is `-0.12–0.12`, and stiffness is `0.45–0.92`.
- Middle scale is `0.68–1.30`, lean is `-0.16–0.16`, and stiffness is `0.32–0.88`.
- Horizon scale is `0.48–0.90`, lean is `-0.14–0.14`, and stiffness is `0.38–0.92`.
- Calm bend is capped at 18 degrees; storm bend is capped at 32 degrees.
- The lower 35–40% of every blade remains visually anchored.
- Celestial horizontal arc position spans `-0.9–0.9` of safe visible width and adapts below aspect ratio `1.0`.
- A time delta up to one quarter-day uses a short same-body arc; larger or day/night deltas use horizon-swap choreography.
- Celestial discs remain behind clouds, terrain, and grass and use depth testing with depth writing disabled.
- The foreground atlases have eight cells and no dimension above 1024 px.
- High and medium may use postprocessing; low renders directly with no composer.
- Do not add SSAO, depth of field, motion blur, chromatic aberration, lens dirt, camera movement, or advanced graphics controls.
- Preserve adaptive quality, reduced motion, settings, sound, WebGL fallback, hidden terrain, and fixed composition.
- Do not allocate arrays, vectors, colors, materials, geometries, or render targets during ordinary frame updates.

## File Map

- `src/core/simulation.ts` — source/target transition runtime and displayed snapshot.
- `src/core/season.ts` — allocation-free blending of two seasonal appearances.
- `src/core/atmosphere.ts` — allocation-free blending of complete lighting and atmosphere states.
- `src/core/weather.ts` — allocation-free blending of derived weather effects.
- `src/core/celestial.ts` — normalized left-to-right arcs and manual-transition choreography.
- `src/core/grassLayout.ts` — layer profiles, correlated stiffness, atlas-cell selection, and shader-testable deformation helpers.
- `src/core/quality.ts` — material and postprocessing feature flags per quality tier.
- `src/audio/ambientAudio.ts` — direct source/target audio cross-fade.
- `src/scene/NatureScene.tsx` — frame orchestration and shared resolved refs.
- `src/scene/CelestialBodies.tsx` — camera-relative projection, depth-correct discs, and transition presentation.
- `src/scene/celestialProjection.ts` — reusable camera-basis projection helper.
- `src/scene/Meadow.tsx` — layer material setup, texture loading, and new uniforms.
- `src/scene/grassShaders.ts` — root-locked curvature, atlas sampling, transmission, contact shading, and storm light.
- `src/scene/grassAtmosphere.ts` — all shared light/fog/storm uniforms.
- `src/scene/grassTextures.ts` — safe async atlas loading and procedural fallback textures.
- `src/scene/PostProcessing.tsx` — quality-aware composer lifecycle and rendering.
- `src/scene/postProcessingShaders.ts` — color-grade and vignette shader pass.
- `src/assets/grass-blades-color.png` — eight-cell foreground color/opacity atlas.
- `src/assets/grass-blades-surface.png` — matching roughness/transmission/vein atlas.
- `tests/core/*.test.ts` — pure transition, celestial, grass, atmosphere, weather, quality, and audio tests.
- `tests/e2e/meadow.spec.ts` — browser interaction, canvas, console, responsive, reduced-motion, and visual-state coverage.

---

### Task 1: Deterministic Three-Second Environment Runtime

**Files:**
- Modify: `src/core/simulation.ts`
- Modify: `src/core/weather.ts`
- Modify: `tests/core/simulation.test.ts`
- Modify: `tests/core/simulation.integration.test.ts`
- Modify: `tests/core/weather.test.ts`

**Interfaces:**
- Consumes: `sampleNatureClock(elapsedSeconds)` and existing `SimulationSettings`/`EnvironmentSnapshot`.
- Produces: `ENVIRONMENT_TRANSITION_DURATION`, `EnvironmentTransitionFrame`, `createEnvironmentTransition(auto, settings)`, and `stepEnvironmentTransition(frame, auto, settings, deltaSeconds)`.

- [ ] **Step 1: Replace damping tests with explicit transition-runtime tests**

Add tests that assert the exact lifecycle and clock behavior:

```ts
const manual = {
  mode: 'manual' as const,
  dayPhase: 0.82,
  seasonIndex: 3 as const,
  weather: 'snow' as const,
}
const auto0 = sampleNatureClock(90)
let frame = createEnvironmentTransition(auto0, DEFAULT_SIMULATION_SETTINGS)
frame = stepEnvironmentTransition(frame, auto0, manual, 0)

expect(frame.active).toBe(true)
expect(frame.progress).toBe(0)
expect(frame.source.dayPhase).toBeCloseTo(auto0.dayPhase)
expect(frame.target.dayPhase).toBe(manual.dayPhase)

for (let tick = 1; tick <= 90; tick += 1) {
  frame = stepEnvironmentTransition(
    frame,
    sampleNatureClock(90 + tick / 60),
    manual,
    1 / 60,
  )
}
expect(frame.progress).toBeCloseTo(0.5)
expect(frame.snapshot.autoElapsed).toBeCloseTo(91.5)

for (let tick = 91; tick <= 180; tick += 1) {
  frame = stepEnvironmentTransition(
    frame,
    sampleNatureClock(90 + tick / 60),
    manual,
    1 / 60,
  )
}
expect(frame.progress).toBe(1)
expect(frame.active).toBe(false)
expect(frame.snapshot.dayPhase).toBeCloseTo(manual.dayPhase)
expect(frame.snapshot.autoElapsed).toBeCloseTo(93)
```

Add a retarget test that changes snow to storm at 1.5 seconds and asserts the new `source` equals the prior displayed `snapshot`. Add an Auto-return test that advances automatic elapsed while manual and asserts the Auto target uses the latest sample rather than the sample from when manual mode began.

Assert that every settings retarget increments `revision` exactly once and ordinary frame steps leave it unchanged. Presentation layers use this revision to freeze the exact currently displayed colors and effects before accepting a new target.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm test -- tests/core/simulation.test.ts tests/core/simulation.integration.test.ts`

Expected: FAIL because the transition-frame exports do not exist and the old damping behavior cannot satisfy fixed progress.

- [ ] **Step 3: Implement the transition frame and stable retargeting**

Add this public shape and make settings identity explicit:

```ts
export const ENVIRONMENT_TRANSITION_DURATION = 3

export interface EnvironmentTransitionFrame {
  source: EnvironmentSnapshot
  target: EnvironmentSnapshot
  snapshot: EnvironmentSnapshot
  progress: number
  elapsed: number
  active: boolean
  settingsKey: string
  revision: number
}

function getSettingsKey(settings: SimulationSettings) {
  return `${settings.mode}:${settings.dayPhase}:${settings.seasonIndex}:${settings.weather}`
}

function easeInOut(amount: number) {
  const value = clamp(amount, 0, 1)
  return value * value * (3 - 2 * value)
}
```

`createEnvironmentTransition` returns a settled frame whose source, target, and snapshot all equal the current requested state. `stepEnvironmentTransition` must:

```ts
const delta = Number.isFinite(deltaSeconds) ? clamp(deltaSeconds, 0, 0.5) : 0
const requested = createEnvironmentSnapshot(auto, settings)
const nextKey = getSettingsKey(settings)

if (nextKey !== frame.settingsKey) {
  return {
    source: frame.snapshot,
    target: requested,
    snapshot: frame.snapshot,
    progress: 0,
    elapsed: 0,
    active: true,
    settingsKey: nextKey,
    revision: frame.revision + 1,
  }
}
```

While active, advance elapsed, update an Auto target from the latest `auto` sample, resolve a displayed snapshot with `mixCircular` for wrapped phases and `blendWeather` for weather, and always copy `auto.elapsed` into `snapshot.autoElapsed`. At completion, set `source`, `target`, and `snapshot` to the resolved target with `progress: 1` and `active: false`. While settled in Auto, follow the latest automatic snapshot directly; while settled in Manual, keep manual visual targets but refresh automatic elapsed metadata.

Extend `createEnvironmentSnapshot`, `getWeatherProfile`, `blendWeather`, and `getAutomaticWeather` with optional reusable output targets. Automatic weather blends directly from immutable `WEATHER_PROFILES` into the supplied target rather than creating two temporary profiles. The transition frame owns its requested/snapshot weather objects and mutates them during ordinary frame steps. Allocation is allowed when settings revision changes, but stable frame updates must reuse the existing frame and nested weather arrays.

Keep the old exponential `stepEnvironment` export temporarily so the existing NatureScene remains buildable in this commit. Remove it in Task 2 after the scene call site moves to `stepEnvironmentTransition`.

- [ ] **Step 4: Run transition tests and the full unit suite**

Run: `npm test -- tests/core/simulation.test.ts tests/core/simulation.integration.test.ts`

Expected: PASS for fixed duration over 180 ordinary frames, retargeting, the `0.5` second stall cap, and live Auto return.

Run: `npm test`

Expected: PASS with only integration call sites scheduled for Task 2 still compiling against their current mocks.

- [ ] **Step 5: Commit the runtime**

```bash
git add src/core/simulation.ts src/core/weather.ts tests/core/simulation.test.ts tests/core/simulation.integration.test.ts tests/core/weather.test.ts
git commit -m "feat: add deterministic environment transitions"
```

---

### Task 2: Direct Source/Target Appearance and Audio Blending

**Files:**
- Modify: `src/core/season.ts`
- Modify: `src/core/atmosphere.ts`
- Modify: `src/core/weather.ts`
- Modify: `src/audio/ambientAudio.ts`
- Modify: `src/scene/NatureScene.tsx`
- Modify: `src/App.tsx`
- Modify: `tests/core/season.test.ts`
- Modify: `tests/core/atmosphere.test.ts`
- Modify: `tests/core/weather.test.ts`
- Modify: `tests/core/ambientAudio.test.ts`
- Modify: `tests/components/App.test.tsx`

**Interfaces:**
- Consumes: `EnvironmentTransitionFrame` from Task 1.
- Produces: `blendSeasonAppearance`, `blendAtmosphere`, `blendWeatherEffects`, `deriveAmbientAudioMixFromFrame`, and a NatureScene callback carrying the full transition frame.

- [ ] **Step 1: Add failing allocation-free blend tests**

For each core state, create source/target values, pass a reusable target, and assert midpoint values plus object identity:

```ts
const output = getSeasonAppearance(spring)
const result = blendSeasonAppearance(
  getSeasonAppearance(spring),
  getSeasonAppearance(winter),
  0.5,
  output,
)

expect(result).toBe(output)
expect(result.snowCoverage).toBeCloseTo(
  (getSeasonAppearance(spring).snowCoverage +
    getSeasonAppearance(winter).snowCoverage) / 2,
)
```

Atmosphere tests must cover color lerp, fog density, exposure, hemisphere ground light, sun/moon intensity, and storm-neutral base values. Weather-effects tests must cover precipitation, dew, fireflies, and storm flash. Audio tests must assert that a day-to-night frame at `progress: 0.5` contains both day and night gain rather than selecting an intermediate accelerated clock phase.

- [ ] **Step 2: Run the four focused suites and verify failure**

Run: `npm test -- tests/core/season.test.ts tests/core/atmosphere.test.ts tests/core/weather.test.ts tests/core/ambientAudio.test.ts`

Expected: FAIL because the blend helpers and frame-aware audio function do not exist.

- [ ] **Step 3: Implement reusable state blend helpers**

Each helper clamps amount once and mutates the supplied target. Color fields use `.copy(source).lerp(target, amount)`; numeric fields use `source + (target - source) * amount`; discrete labels select source below `0.5` and target at or above `0.5`. Extend `getSeasonAppearance(snapshot, target?)` so its three Color instances and result object can be reused instead of recreated per frame.

Use these exact signatures:

```ts
export function blendSeasonAppearance(
  source: SeasonAppearance,
  target: SeasonAppearance,
  amount: number,
  output: SeasonAppearance,
): SeasonAppearance

export function blendAtmosphere(
  source: AtmosphereState,
  target: AtmosphereState,
  amount: number,
  output: AtmosphereState,
): AtmosphereState

export function blendWeatherEffects(
  source: WeatherEffects,
  target: WeatherEffects,
  amount: number,
  output: WeatherEffects,
): WeatherEffects
```

Blend atmosphere celestial directions component-wise and normalize them only for lighting uniforms; visible disc placement will be replaced in Tasks 3–4.

- [ ] **Step 4: Integrate two-endpoint derivation in NatureScene**

Replace the single snapshot step with one `EnvironmentTransitionFrame` ref. Allocate frozen-source/target/result refs once for season, atmosphere, and weather effects. Before stepping, the resolved result refs represent the exact currently displayed frame. After stepping, compare `frame.revision` with `lastResolvedRevisionRef.current`; on a revision change, copy the current resolved result values into the frozen-source refs and keep them unchanged until that transition completes. This prevents a slider retarget from re-deriving an intermediate clock phase and producing a color jump.

On the initial settled frame and after a transition completes, derive the frozen source from `frame.source`. During an active transition, derive only the moving target, then blend from the frozen resolved source. The frame loop uses this shape:

```ts
transitionRef.current = stepEnvironmentTransition(
  transitionRef.current,
  autoSnapshot,
  simulationSettings,
  safeDelta,
)
const frame = transitionRef.current

if (frame.revision !== lastResolvedRevisionRef.current) {
  blendSeasonAppearance(
    seasonRef.current,
    seasonRef.current,
    0,
    sourceSeasonRef.current,
  )
  blendAtmosphere(
    atmosphereRef.current,
    atmosphereRef.current,
    0,
    sourceAtmosphereRef.current,
  )
  blendWeatherEffects(
    effectsRef.current,
    effectsRef.current,
    0,
    sourceEffectsRef.current,
  )
  lastResolvedRevisionRef.current = frame.revision
} else if (!frame.active) {
  getSeasonAppearance(frame.source, sourceSeasonRef.current)
  getAtmosphere(frame.source, sourceSeasonRef.current, sourceAtmosphereRef.current)
  deriveWeatherEffects(sourceEffectsInput, sourceEffectsRef.current)
}
getSeasonAppearance(frame.target, targetSeasonRef.current)
blendSeasonAppearance(
  sourceSeasonRef.current,
  targetSeasonRef.current,
  frame.progress,
  seasonRef.current,
)

getAtmosphere(frame.target, targetSeasonRef.current, targetAtmosphereRef.current)
blendAtmosphere(
  sourceAtmosphereRef.current,
  targetAtmosphereRef.current,
  frame.progress,
  atmosphereRef.current,
)
```

Derive and blend target weather effects explicitly:

```ts
targetEffectsInput.elapsed = frame.target.elapsed
targetEffectsInput.dayPhase = frame.target.dayPhase
targetEffectsInput.seasonPosition = frame.target.seasonPosition
targetEffectsInput.weather = frame.target.weather
targetEffectsInput.reducedMotion = reducedMotion
deriveWeatherEffects(targetEffectsInput, targetEffectsRef.current)
blendWeatherEffects(
  sourceEffectsRef.current,
  targetEffectsRef.current,
  frame.progress,
  effectsRef.current,
)
```

Set `snapshotRef.current = frame.snapshot`. Remove the temporary old `stepEnvironment` export after the call site changes.

Change `onNatureSample` to receive `EnvironmentTransitionFrame`; App passes `frame` to audio and stores a low-frequency immutable copy of `frame.snapshot`, `frame.active`, `frame.progress`, and `frame.revision` for settings labels. Expose `data-transition-active`, `data-transition-progress`, `data-auto-elapsed`, and `data-transition-revision` on the main experience element for deterministic E2E assertions. Update the App component mock test to emit this frame shape. The 4 Hz sample allocation is permitted because it is outside the ordinary frame update path.

- [ ] **Step 5: Cross-fade audio from the same frame**

Add:

```ts
export function deriveAmbientAudioMixFromFrame(
  frame: EnvironmentTransitionFrame,
): AmbientAudioMix {
  const source = deriveAmbientAudioMix(frame.source)
  const target = deriveAmbientAudioMix(frame.target)
  const amount = frame.progress
  return {
    chirpLayer: amount < 0.5 ? source.chirpLayer : target.chirpLayer,
    windGain: source.windGain + (target.windGain - source.windGain) * amount,
    windFrequency:
      source.windFrequency + (target.windFrequency - source.windFrequency) * amount,
    rainGain: source.rainGain + (target.rainGain - source.rainGain) * amount,
    dayGain: source.dayGain + (target.dayGain - source.dayGain) * amount,
    nightGain: source.nightGain + (target.nightGain - source.nightGain) * amount,
  }
}
```

Change `AmbientAudioController.setNature` to accept `EnvironmentTransitionFrame` and use this mix. The controller stores its last applied `AmbientAudioMix` and last revision; when revision changes, that last applied mix becomes the frozen audio source so rapid retargeting cannot jump. Keep the current Web Audio `setTargetAtTime` smoothing constants.

- [ ] **Step 6: Verify all blending and integration tests**

Run: `npm test -- tests/core/season.test.ts tests/core/atmosphere.test.ts tests/core/weather.test.ts tests/core/ambientAudio.test.ts tests/core/simulation.integration.test.ts`

Expected: PASS with midpoint colors/effects/audio and no object replacement.

Run: `npm run lint`

Expected: PASS with all call sites using `EnvironmentTransitionFrame`.

- [ ] **Step 7: Commit appearance blending**

```bash
git add src/core/simulation.ts src/core/season.ts src/core/atmosphere.ts src/core/weather.ts src/audio/ambientAudio.ts src/scene/NatureScene.tsx src/App.tsx tests/components/App.test.tsx tests/core/season.test.ts tests/core/atmosphere.test.ts tests/core/weather.test.ts tests/core/ambientAudio.test.ts
git commit -m "feat: crossfade complete environment states"
```

---

### Task 3: Left-to-Right Celestial Arc and Choreography

**Files:**
- Modify: `src/core/celestial.ts`
- Modify: `tests/core/celestial.test.ts`

**Interfaces:**
- Consumes: source/target day phases and transition progress from `EnvironmentTransitionFrame`.
- Produces: `CelestialArcPoint`, `CelestialPresentation`, `getCelestialArcPoint`, and `getCelestialPresentation`.

- [ ] **Step 1: Add failing arc and transition tests**

Cover sun positions at sunrise/noon/sunset and complementary moon positions:

```ts
const sunrise = getCelestialArcPoint('sun', 0.25, 16 / 9)
const noon = getCelestialArcPoint('sun', 0.5, 16 / 9)
const sunset = getCelestialArcPoint('sun', 0.75, 16 / 9)

expect(sunrise.x).toBeCloseTo(-0.9)
expect(sunrise.y).toBeLessThan(0.05)
expect(noon.x).toBeCloseTo(0)
expect(noon.y).toBeGreaterThan(0.55)
expect(sunset.x).toBeCloseTo(0.9)
expect(sunset.y).toBeLessThan(0.05)
```

Add a portrait test asserting a lower peak than landscape. Add a four-hour same-body transition asserting one visible sun traveling a short arc. Add a noon-to-midnight transition asserting the outgoing sun reaches a horizon while the moon begins at the opposite horizon. Add reduced-motion coverage asserting lower travel distance and a stronger opacity cross-fade.

- [ ] **Step 2: Run the celestial suite and verify failure**

Run: `npm test -- tests/core/celestial.test.ts`

Expected: FAIL because camera-safe arcs and transition presentation do not exist.

- [ ] **Step 3: Implement normalized arc points**

Add exact presentation types:

```ts
export type CelestialBodyKind = 'sun' | 'moon'

export interface CelestialArcPoint {
  x: number
  y: number
  opacity: number
  scaleY: number
}

export interface CelestialPresentation {
  sun: CelestialArcPoint
  moon: CelestialArcPoint
}
```

For the sun, map day phase `0.25–0.75` to arc progress `0–1`. For the moon, wrap phase so `0.75–1.25` maps to `0–1`. Compute `x = -0.9 + progress * 1.8`, `y = -0.04 + sin(progress * PI) * peak`, where `peak` is `0.68` in landscape and linearly falls to `0.52` by aspect `0.46`. Fade opacity through a narrow horizon band and set `scaleY` from `0.92` at the horizon to `1` above it.

- [ ] **Step 4: Implement small-arc and horizon-swap choreography**

`getCelestialPresentation(sourceDayPhase, targetDayPhase, amount, aspect, reducedMotion, output, frozenSource?)` must reuse `output`. Use circular phase distance. If distance is `<= 0.25` and source/target share the same visible body, interpolate its two arc points with eased amount.

Otherwise split eased progress into outgoing and incoming halves. Move the outgoing point toward its nearest horizon and fade it; move the incoming body from its opposite horizon toward its target point and fade it in. Reduced motion multiplies travel by `0.35` while keeping opacity progress unchanged.

When `frozenSource` is supplied after a settings revision, use its current sun/moon points as the exact start instead of recomputing the source from an interpolated numeric day phase. Add a retarget test that copies the presentation at 40% progress, requests a new target, and asserts both body positions and opacity are continuous at new progress `0`.

- [ ] **Step 5: Verify celestial tests**

Run: `npm test -- tests/core/celestial.test.ts`

Expected: PASS for landscape, portrait, small changes, horizon swaps, and reduced motion while preserving shooting-star tests.

- [ ] **Step 6: Commit celestial choreography**

```bash
git add src/core/celestial.ts tests/core/celestial.test.ts
git commit -m "feat: add camera-safe celestial arcs"
```

---

### Task 4: Depth-Correct Celestial Rendering

**Files:**
- Create: `src/scene/celestialProjection.ts`
- Create: `tests/core/celestialProjection.test.ts`
- Modify: `src/scene/CelestialBodies.tsx`
- Modify: `src/scene/Atmosphere.tsx`
- Modify: `src/scene/NatureScene.tsx`
- Modify: `tests/e2e/meadow.spec.ts`

**Interfaces:**
- Consumes: `CelestialPresentation` from Task 3 and blended `AtmosphereState` from Task 2.
- Produces: `projectCelestialPoint(camera, point, distance, output)` and a shared `celestialPresentationRef` rendered behind meadow geometry.

- [ ] **Step 1: Add failing camera-projection tests**

Create PerspectiveCamera tests at `1280x720` and `390x844`. Project sunrise, noon, and sunset points, then project resulting world points back to NDC:

```ts
const world = projectCelestialPoint(camera, point, 88, new Vector3())
const ndc = world.clone().project(camera)
expect(ndc.x).toBeCloseTo(point.x, 2)
expect(ndc.y).toBeCloseTo(point.y, 2)
expect(ndc.z).toBeGreaterThan(0)
expect(ndc.z).toBeLessThan(1)
```

- [ ] **Step 2: Run the projection test and verify failure**

Run: `npm test -- tests/core/celestialProjection.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement allocation-free camera-basis projection**

Use the PerspectiveCamera FOV and aspect to derive the visible plane at `distance`:

```ts
const halfHeight = Math.tan((camera.fov * Math.PI) / 360) * distance
const halfWidth = halfHeight * camera.aspect
camera.getWorldDirection(forward)
right.set(1, 0, 0).applyQuaternion(camera.quaternion)
up.set(0, 1, 0).applyQuaternion(camera.quaternion)
return output
  .copy(camera.position)
  .addScaledVector(forward, distance)
  .addScaledVector(right, point.x * halfWidth)
  .addScaledVector(up, point.y * halfHeight)
```

Keep scratch vectors module-local and never allocate them in frame updates.

- [ ] **Step 4: Wire presentation state through the scene**

NatureScene allocates resolved and frozen-source `CelestialPresentation` refs. When `frame.revision` changes, copy the current resolved presentation into the frozen source before calculating the new target. It then updates the resolved presentation after stepping the environment transition:

```ts
getCelestialPresentation(
  frame.source.dayPhase,
  frame.target.dayPhase,
  frame.progress,
  size.width / size.height,
  reducedMotion,
  celestialPresentationRef.current,
  frozenCelestialSourceRef.current,
)
```

Read `size.width` and `size.height` from `useThree`. Pass the ref through Atmosphere to CelestialBodies. CelestialBodies projects each point at distance `88`, copies camera quaternion to discs/halos, uses presentation opacity multiplied by blended atmosphere visibility/halo, and updates vertical scale from `scaleY`.

Change disc and halo materials to `depthTest: true`, `depthWrite: false`. Keep the rendering sequence sky, discs, clouds, then ordinary scene geometry. Do not disable grass depth writing.

- [ ] **Step 5: Add deterministic browser assertions**

Extend the existing development-only environment hook so E2E can set source/target day phase and transition progress. Add canvas screenshots for sunrise, sunset, and day/night swap. Assert projected body centers fall in left, right, and horizon-safe regions. Sample a narrow overlap region and assert foreground grass pixels remain visible over the disc.

The production build must not expose the deterministic test hook.

- [ ] **Step 6: Run projection, celestial, E2E, and build checks**

Run: `npm test -- tests/core/celestialProjection.test.ts tests/core/celestial.test.ts`

Expected: PASS.

Run: `npm run test:e2e -- --grep "celestial|sunrise|sunset"`

Expected: PASS on desktop and mobile with no page errors.

Run: `npm run build`

Expected: PASS and no deterministic celestial hook text in `dist/assets`.

- [ ] **Step 7: Commit depth-correct bodies**

```bash
git add src/scene/celestialProjection.ts tests/core/celestialProjection.test.ts src/scene/CelestialBodies.tsx src/scene/Atmosphere.tsx src/scene/NatureScene.tsx tests/e2e/meadow.spec.ts
git commit -m "feat: render celestial bodies behind the meadow"
```

---

### Task 5: Root-Locked Layered Grass Curvature

**Files:**
- Modify: `src/core/grassLayout.ts`
- Modify: `src/scene/grassShaders.ts`
- Modify: `src/scene/Meadow.tsx`
- Modify: `tests/core/grassLayout.test.ts`

**Interfaces:**
- Consumes: existing layer kinds, weather wind state, and reduced-motion flag.
- Produces: `GRASS_LAYER_PROFILES`, `getGrassRootInfluence`, `getGrassBendLimit`, `getGrassClearance`, correlated layout stiffness, and shader uniforms `uBendLimit`/`uFlutterStrength`.

- [ ] **Step 1: Add failing profile and deformation-helper tests**

Assert every exact Global Constraints range. For 4096 foreground blades, calculate correlation between scale and stiffness and require it to exceed `0.25`. Add:

```ts
expect(getGrassRootInfluence(0)).toBe(0)
expect(getGrassRootInfluence(0.35)).toBeLessThan(0.02)
expect(getGrassRootInfluence(1)).toBe(1)
expect(getGrassBendLimit(0, false)).toBeCloseTo((18 * Math.PI) / 180)
expect(getGrassBendLimit(1, false)).toBeCloseTo((32 * Math.PI) / 180)
expect(getGrassBendLimit(1, true)).toBeLessThan(getGrassBendLimit(1, false))

const close = getGrassClearance(1)
const clear = getGrassClearance(9)
expect(close.height * close.lean * close.wind).toBeLessThan(
  clear.height * clear.lean * clear.wind,
)
```

- [ ] **Step 2: Run grass tests and verify failure**

Run: `npm test -- tests/core/grassLayout.test.ts`

Expected: FAIL because profiles/helpers are missing and current stiffness is uncorrelated.

- [ ] **Step 3: Implement profiles and correlated stiffness**

Export immutable profiles with the exact ranges. Generate scale first, normalize it inside the layer range, then compute stiffness from `minimum + random * span * 0.65 + normalizedScale * span * 0.35`, clamped to the profile maximum. Generate lean from the profile range.

Implement root influence with `smoothstep(0.38, 1, height) ** 2`, bend limit by interpolating 18–32 degrees from wind strength and multiplying by `0.55` in reduced-motion mode, and clearance with the current `smoothstep(1.6, 8, distance)` applied to height, lean, and wind.

- [ ] **Step 4: Replace scale-multiplied displacement with bounded curvature**

In the vertex shader:

```glsl
float rootInfluence = pow(smoothstep(0.38, 1.0, heightRatio), 2.0);
float flexibility = 1.0 - instanceStiffness * 0.62;
float targetAngle = clamp(waveSignal * flexibility, -uBendLimit, uBendLimit);
float curvatureAngle = targetAngle * rootInfluence * clearanceWind;
vec2 bendOffset = windDirection * sin(curvatureAngle) * heightRatio;
localPosition.xz += bendOffset;
localPosition.y *= max(0.72, cos(curvatureAngle));
localPosition.x += instanceLean * rootInfluence * clearanceLean;
```

Keep broad wave and gust-front inputs, but change the gust envelope to a soft leading edge and a recovery tail twice as wide as the leading edge. Add low-amplitude tip flutter multiplied by `uFlutterStrength`, root influence, wind strength, and inverse stiffness. Do not multiply bend angle or lean by `instanceScale`.

Meadow computes `uBendLimit` and `uFlutterStrength` once per layer per frame from wind and reduced motion. Pass `reducedMotion` into Meadow from NatureScene.

- [ ] **Step 5: Verify grass tests, lint, and focused E2E horizon coverage**

Run: `npm test -- tests/core/grassLayout.test.ts`

Expected: PASS for ranges, correlation, root lock, bend caps, and clearance.

Run: `npm run lint`

Expected: PASS.

Run: `npm run test:e2e -- --grep "horizon|meadow"`

Expected: PASS with terrain still fully hidden.

- [ ] **Step 6: Commit grass physics**

```bash
git add src/core/grassLayout.ts src/scene/grassShaders.ts src/scene/Meadow.tsx src/scene/NatureScene.tsx tests/core/grassLayout.test.ts
git commit -m "feat: anchor grass with bounded wind curvature"
```

---

### Task 6: Hybrid Foreground Blade Atlases

**Files:**
- Create: `src/assets/grass-blades-color.png`
- Create: `src/assets/grass-blades-surface.png`
- Create: `src/scene/grassTextures.ts`
- Create: `tests/core/grassTextures.test.ts`
- Modify: `src/core/grassLayout.ts`
- Modify: `src/core/quality.ts`
- Modify: `src/scene/Meadow.tsx`
- Modify: `src/scene/grassShaders.ts`
- Modify: `tests/core/grassLayout.test.ts`
- Modify: `tests/core/quality.test.ts`

**Interfaces:**
- Consumes: foreground layer profile and the existing quality profiles.
- Produces: deterministic `atlasCells`, quality flags `grassAtlas`/`grassTransmission`, `createGrassTextureFallbacks`, `loadGrassTextures`, safe 1×1 fallback textures, and foreground-only atlas uniforms.

- [ ] **Step 1: Generate and inspect the eight-cell atlas assets**

Use the `imagegen` skill for the color atlas with this art direction:

```text
A precise 4 by 2 texture atlas containing eight isolated realistic meadow-grass blades, one blade centered in each equal cell, transparent background, straight rooted base, varied natural pointed tips and slight edge irregularity, subtle longitudinal veins, neutral fresh green suitable for later seasonal tinting, flat diffuse lighting, no cast shadows, no labels, no border, no overlap between cells, seamless cell alignment, square 1024 by 1024 PNG.
```

Use the accepted color atlas as the referenced image for a matching surface atlas. Preserve silhouettes and cell placement exactly. Encode roughness in red, thickness/transmission in green, vein modulation in blue, and the matching silhouette in alpha. Inspect both images at original detail and reject assets whose cells overlap, whose roots are not aligned, whose silhouettes differ between atlases, or whose backgrounds are opaque.

- [ ] **Step 2: Add failing deterministic-cell and fallback tests**

Extend GrassLayerLayout with `atlasCells: Float32Array`. Assert every cell is an integer from 0–7, deterministic for a seed, and only foreground geometry enables the atlas.

Add `grassAtlas` and `grassTransmission` to every quality profile. Assert high uses `true/true`, medium uses `true/false`, and low uses `false/false`.

In `grassTextures.test.ts`, verify the fallback factory returns color and surface DataTextures whose dimensions are `1×1`, whose wrap mode is ClampToEdge, and whose color-space assignments distinguish color from data.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `npm test -- tests/core/grassLayout.test.ts tests/core/grassTextures.test.ts tests/core/quality.test.ts`

Expected: FAIL because atlas cells and texture helpers do not exist.

- [ ] **Step 4: Implement safe texture loading**

`grassTextures.ts` imports both asset URLs, creates reusable fallback DataTextures, and exports:

```ts
export interface GrassTextureSet {
  color: Texture
  surface: Texture
  detailed: boolean
}

export function createGrassTextureFallbacks(): GrassTextureSet

export function loadGrassTextures(
  loader: TextureLoader,
  maximumAnisotropy: number,
  onReady: (textures: GrassTextureSet) => void,
): () => void
```

Start both loads, configure color as `SRGBColorSpace` and surface as `NoColorSpace`, set anisotropy to `Math.min(8, Math.max(1, maximumAnisotropy))`, and call `onReady` only while not cancelled. Meadow passes `gl.capabilities.getMaxAnisotropy()` as the second argument. If either request fails, call `onReady` with fallbacks and `detailed: false`. The returned cleanup sets a cancelled flag and disposes only successfully loaded owned textures.

- [ ] **Step 5: Add atlas attributes and foreground shader sampling**

Add `instanceAtlasCell` to grass geometry. Meadow enables atlas sampling only when `quality.grassAtlas` is true and enables transmitted light only when `quality.grassTransmission` is true. Pass atlas UV from the vertex shader using four columns and two rows:

```glsl
float atlasColumn = mod(instanceAtlasCell, 4.0);
float atlasRow = floor(instanceAtlasCell / 4.0);
vAtlasUv = vec2(
  (atlasColumn + uv.x) / 4.0,
  (1.0 - atlasRow + uv.y) / 2.0
);
```

The asset contract places each blade root at the bottom of its cell, so this UV mapping is fixed. In the fragment shader, sample only when `uUseAtlas > 0.5`, discard color alpha below `0.28`, seasonally tint the neutral albedo, read roughness/transmission/vein channels, and add backlight only when the sun is behind the blade normal. Middle and horizon materials bind fallbacks and set `uUseAtlas = 0`.

Add a lower-blade contact factor based on `vHeight`, layer fade, and view depth. Do not darken alpha edges or add screen-space outlines.

- [ ] **Step 6: Verify texture tests, build asset inclusion, and browser fallback**

Run: `npm test -- tests/core/grassLayout.test.ts tests/core/grassTextures.test.ts tests/core/quality.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS with both hashed PNG assets in `dist/assets`.

Temporarily force the texture loader error branch in a focused component test and assert the canvas remains mounted with the procedural material; remove the force before commit and retain the mocked unit test.

- [ ] **Step 7: Commit hybrid materials**

```bash
git add src/assets/grass-blades-color.png src/assets/grass-blades-surface.png src/scene/grassTextures.ts src/scene/Meadow.tsx src/scene/grassShaders.ts src/core/grassLayout.ts src/core/quality.ts tests/core/grassTextures.test.ts tests/core/grassLayout.test.ts tests/core/quality.test.ts
git commit -m "feat: add hybrid foreground grass materials"
```

---

### Task 7: Shared Lighting and Restrained Postprocessing

**Files:**
- Create: `src/scene/PostProcessing.tsx`
- Create: `src/scene/postProcessingShaders.ts`
- Modify: `src/core/atmosphere.ts`
- Modify: `src/core/quality.ts`
- Modify: `src/scene/Atmosphere.tsx`
- Modify: `src/scene/Meadow.tsx`
- Modify: `src/scene/grassAtmosphere.ts`
- Modify: `src/scene/grassShaders.ts`
- Modify: `src/scene/NatureScene.tsx`
- Modify: `tests/core/atmosphere.test.ts`
- Modify: `tests/core/quality.test.ts`

**Interfaces:**
- Consumes: blended atmosphere/effects refs and quality tier.
- Produces: complete grass-light uniforms, postprocessing quality fields, and a self-contained `PostProcessing` component using Three.js addon passes.

- [ ] **Step 1: Add failing lighting and quality-profile tests**

Assert grass uniform synchronization includes hemisphere sky/ground color, hemisphere intensity, sun/moon intensity, and `sunIntensity + stormFlash * 0.22` during lightning. Extend quality tests with exact policy:

```ts
expect(QUALITY_PROFILES.high.postprocessing).toBe(true)
expect(QUALITY_PROFILES.high.bloomStrength).toBeGreaterThan(0)
expect(QUALITY_PROFILES.high.grassAtlas).toBe(true)
expect(QUALITY_PROFILES.medium.postprocessing).toBe(true)
expect(QUALITY_PROFILES.medium.bloomResolutionScale).toBeLessThan(1)
expect(QUALITY_PROFILES.low.postprocessing).toBe(false)
expect(QUALITY_PROFILES.low.grassAtlas).toBe(false)
expect(QUALITY_PROFILES.low.bloomStrength).toBe(0)
```

- [ ] **Step 2: Run atmosphere and quality tests and verify failure**

Run: `npm test -- tests/core/atmosphere.test.ts tests/core/quality.test.ts`

Expected: FAIL because the complete light terms and quality fields do not exist.

- [ ] **Step 3: Complete the shared grass-light contract**

Add uniforms `uGroundLightColor`, `uSkyLightIntensity`, `uSunIntensity`, `uMoonIntensity`, and `uStormFlash`. `syncGrassAtmosphereUniforms` copies every blended atmosphere value; Meadow separately passes `effects.stormFlash`. The fragment shader computes sky/ground hemispheric fill from the blade normal, then adds intensity-scaled sun/moon terms and a short neutral storm flash. Preserve fog after lighting and multiply its density contribution by `mix(1.12, 0.92, vHeight)` so lower and distant grass merges into horizon haze before exposed tips.

- [ ] **Step 4: Add explicit quality fields**

Add `bloomStrength`, `bloomResolutionScale`, and `vignetteStrength` to every profile. Use high values `0.22`, `1`, `0.055`; medium values `0.14`, `0.6`, `0.045`; low values `0`, `0`, `0`. Preserve the `grassAtlas` and `grassTransmission` fields introduced in Task 6.

- [ ] **Step 5: Implement the composer without a new dependency**

`PostProcessing.tsx` imports `EffectComposer`, `RenderPass`, `UnrealBloomPass`, and `ShaderPass` from `three/examples/jsm/postprocessing`. It obtains `gl`, `scene`, `camera`, and `size` from R3F. NatureScene mounts the component only when `quality.postprocessing` is true, so low quality never registers a priority render callback. Once mounted, it creates passes once, sizes the composer only when viewport, DPR, or quality changes, and renders in `useFrame` at priority `1`.

Use bloom threshold `1.05`, radius `0.32`, and profile strength. `postProcessingShaders.ts` exports a pass with exposure-neutral color balance and vignette:

```glsl
vec4 source = texture2D(tDiffuse, vUv);
vec3 graded = pow(max(source.rgb, vec3(0.0)), vec3(0.985));
float distanceFromCenter = length(vUv - 0.5) * 1.4142;
float vignette = 1.0 - smoothstep(0.55, 1.0, distanceFromCenter) * uVignette;
gl_FragColor = vec4(graded * vignette, source.a);
```

Wrap composer construction in a local try/catch. On failure, dispose partial resources and mark the feature unavailable for that mount. Because the component's priority-1 frame callback has already taken over rendering, that callback must call `gl.render(scene, camera)` whenever no composer is available. Dispose composer and passes on unmount.

- [ ] **Step 6: Integrate bright-source thresholds**

Keep ordinary sky and grass below bloom threshold. Set only sun disc/halo, moon halo, fireflies, wet specular contributions, and lightning to emissive values above `1.05` on high/medium. Pass quality into the relevant scene materials. Render PostProcessing as the final child of NatureScene.

- [ ] **Step 7: Verify unit, build, and quality behavior**

Run: `npm test -- tests/core/atmosphere.test.ts tests/core/quality.test.ts`

Expected: PASS.

Run: `npm run lint`

Expected: PASS with Three addon types resolved.

Run: `npm run build`

Expected: PASS without a new package dependency.

- [ ] **Step 8: Commit lighting and postprocessing**

```bash
git add src/scene/PostProcessing.tsx src/scene/postProcessingShaders.ts src/core/atmosphere.ts src/core/quality.ts src/scene/Atmosphere.tsx src/scene/Meadow.tsx src/scene/grassAtmosphere.ts src/scene/grassShaders.ts src/scene/NatureScene.tsx tests/core/atmosphere.test.ts tests/core/quality.test.ts
git commit -m "feat: add restrained meadow postprocessing"
```

---

### Task 8: Full Integration, Visual Regression, and Performance Handoff

**Files:**
- Modify: `tests/e2e/meadow.spec.ts`
- Modify: `src/App.tsx` only if final test-state attributes need exposure
- Modify: `docs/superpowers/specs/2026-08-03-meadow-realism-upgrade-design.md` only for verified implementation notes that do not change approved behavior

**Interfaces:**
- Consumes: all completed tasks.
- Produces: verified desktop/mobile experience, visual evidence, clean build, and final implementation commit.

- [ ] **Step 1: Add complete browser acceptance scenarios**

Add focused tests for:

```ts
test('completes a manual environment crossfade without accelerating auto time', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Nastavení prostředí' }).click()
  await page.getByRole('radio', { name: 'Ručně' }).check()
  const before = await page.getByRole('main', { name: 'Živá louka' })
    .getAttribute('data-auto-elapsed')
  await page.getByRole('radio', { name: 'Zima' }).check()
  await page.getByRole('radio', { name: 'Sněžení' }).check()
  await expect(page.getByRole('main', { name: 'Živá louka' }))
    .toHaveAttribute('data-transition-active', 'false', { timeout: 3_400 })
  const after = await page.getByRole('main', { name: 'Živá louka' })
    .getAttribute('data-auto-elapsed')
  expect(Number(after) - Number(before)).toBeGreaterThan(2.5)
  expect(Number(after) - Number(before)).toBeLessThan(4.5)
})
```

Also cover left sunrise, right sunset, day/night horizon swap, celestial occlusion, fixed camera, dense foreground, reduced motion, rain alignment, storm lighting on grass, snow, settings bounds, sound toggle, texture fallback, and high-to-low quality fallback. Capture page errors for every visual scenario.

- [ ] **Step 2: Run new E2E tests and fix only demonstrated integration gaps**

Run: `npm run test:e2e`

Expected: PASS for every desktop and mobile project. If a scenario fails, first capture its screenshot/trace, identify the responsible task boundary, add the narrowest missing unit assertion, then make one scoped fix.

- [ ] **Step 3: Perform browser visual inspection against the reference**

Use the in-app browser on the stable local dev server. Inspect and save screenshots at desktop landscape and mobile portrait for:

- spring daylight with settings closed;
- sunrise with the sun partly behind grass;
- sunset on the right horizon;
- moonlit clear night with stars;
- rain with wet foreground highlights;
- storm flash affecting sky and grass together;
- winter snow;
- settings open at minimum supported width and short height.

Compare the daylight composition to the supplied “Swaying grass” reference at original detail. Confirm hidden terrain, fixed horizon, consistent foreground/middle deformation, calm open sky, subtle controls, no glowing grass outlines, and no obvious atlas repetition.

- [ ] **Step 4: Run complete verification from a clean working tree state**

Run: `npm test`

Expected: all unit/component suites pass.

Run: `npm run lint`

Expected: exit code 0.

Run: `npm run build`

Expected: exit code 0 with hashed atlas assets and no development test hook.

Run: `npm run test:e2e`

Expected: every desktop/mobile test passes.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 5: Commit final integration evidence and fixes**

```bash
git add tests/e2e/meadow.spec.ts src/App.tsx docs/superpowers/specs/2026-08-03-meadow-realism-upgrade-design.md
git commit -m "test: verify meadow realism upgrade"
```

- [ ] **Step 6: Leave the verified web experience open**

Start or reuse the approved Vite dev server, reload the final local page in the in-app browser, confirm the current URL/title and an empty error console, then finalize that single tab as the deliverable. Leave settings closed so the user first sees the full passive experience.
