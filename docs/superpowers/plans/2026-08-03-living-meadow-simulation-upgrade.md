# Living Meadow Simulation Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current meadow into a fixed-camera, densely layered living wallpaper with coherent wind and weather physics, visible celestial bodies, rare shooting stars, and smooth Auto / Manual environment controls.

**Architecture:** A pure simulation layer will blend the continuously running nature clock with manual targets and publish one `EnvironmentSnapshot`. React owns only low-frequency control state; frame-level interpolation remains in refs and Three.js uniforms. Focused scene components render layered grass, celestial bodies, cloud cover, stars, and pooled weather effects from that shared snapshot while the existing adaptive-quality system controls budgets.

**Tech Stack:** React 19, TypeScript, Vite 6, React Three Fiber, Three.js 0.179, GLSL, Vitest, Testing Library, Playwright, in-app Browser QA.

## Global Constraints

- The camera must remain completely fixed and ignore pointer movement.
- The supplied “Swaying grass” image is the composition and density reference.
- Manual changes and return to Auto must blend without hard cuts.
- The natural Auto clock must continue running while Manual mode is active.
- Weather must coordinate light, fog, clouds, wind, surface response, and applicable particles.
- Full per-blade CPU rigid-body simulation, mandatory WebGPU, and ray-marched volumetric clouds are out of scope.
- Sound stays muted by default; adaptive quality, reduced motion, page-visibility pausing, the error boundary, and the static WebGL fallback must remain working.
- The settings panel must be keyboard-accessible and remain inside a 320 px-wide viewport.
- Use no new runtime dependency unless the existing Three.js and React Three Fiber APIs cannot implement a required effect.

---

## File Structure

- `src/core/simulation.ts`: typed Auto / Manual settings, persistence validation, circular interpolation, and the pure frame-step function.
- `src/core/weather.ts`: weather preset profiles and derived atmospheric, surface, particle, and wind values.
- `src/core/celestial.ts`: deterministic celestial positions and shooting-star scheduling.
- `src/core/grassLayout.ts`: deterministic multi-layer blade variation and depth budgets.
- `src/core/quality.ts`: render budgets for grass layers, clouds, stars, trails, and particles.
- `src/components/EnvironmentSettings.tsx`: accessible settings button, popover, mode, time, season, and weather controls.
- `src/scene/FixedCamera.tsx`: one-time camera placement and look target with no frame-loop motion.
- `src/scene/Meadow.tsx` and `src/scene/grassShaders.ts`: layered grass geometry and coherent spatial wind deformation.
- `src/scene/CelestialBodies.tsx`: visible sun and moon discs and halos.
- `src/scene/CloudLayer.tsx`: low-cost procedural cloud planes tied to weather.
- `src/scene/ShootingStars.tsx`: pooled deterministic night-sky trails.
- `src/scene/Atmosphere.tsx`: scene lighting, sky, fog, stars, and composition of atmospheric helpers.
- `src/scene/WeatherParticles.tsx`: rain, snow, pollen, fireflies, wetness support, and distant storm flashes.
- `src/scene/NatureScene.tsx`: environment-frame orchestration and shared refs.
- `src/App.tsx` and `src/styles.css`: application state, settings placement, responsive glass UI, and Canvas camera configuration.

---

### Task 1: Shared Simulation and Weather State

**Files:**
- Create: `src/core/simulation.ts`
- Modify: `src/core/weather.ts`
- Test: `tests/core/simulation.test.ts`
- Test: `tests/core/weather.test.ts`

**Interfaces:**
- Consumes: `NatureSnapshot`, `SeasonIndex`, and `sampleNatureClock()` from `src/core/natureClock.ts`.
- Produces: `SimulationMode`, `WeatherPreset`, `SimulationSettings`, `WeatherState`, `EnvironmentSnapshot`, `DEFAULT_SIMULATION_SETTINGS`, `getWeatherProfile(preset)`, `blendWeather(from, to, amount)`, `parseSimulationSettings(value)`, `createEnvironmentSnapshot(auto, settings)`, and `stepEnvironment(current, auto, settings, deltaSeconds)`.

- [ ] **Step 1: Write failing tests for settings validation and smooth Auto / Manual blending**

```ts
import { describe, expect, it } from 'vitest'
import { sampleNatureClock } from '../../src/core/natureClock'
import {
  DEFAULT_SIMULATION_SETTINGS,
  createEnvironmentSnapshot,
  parseSimulationSettings,
  stepEnvironment,
} from '../../src/core/simulation'

describe('environment simulation', () => {
  it('rejects invalid persisted controls', () => {
    expect(parseSimulationSettings({ mode: 'broken' })).toEqual(
      DEFAULT_SIMULATION_SETTINGS,
    )
  })

  it('moves toward manual targets without snapping', () => {
    const auto = sampleNatureClock(90)
    const current = createEnvironmentSnapshot(auto, DEFAULT_SIMULATION_SETTINGS)
    const manual = {
      mode: 'manual' as const,
      dayPhase: 0,
      seasonIndex: 3 as const,
      weather: 'snow' as const,
    }
    const next = stepEnvironment(current, auto, manual, 1 / 60)

    expect(next.dayPhase).not.toBe(current.dayPhase)
    expect(next.dayPhase).not.toBe(manual.dayPhase)
    expect(next.weather.snow).toBeGreaterThan(current.weather.snow)
    expect(next.weather.snow).toBeLessThan(1)
  })

  it('rejoins the still-running auto clock through interpolation', () => {
    const oldAuto = sampleNatureClock(20)
    const current = createEnvironmentSnapshot(oldAuto, {
      mode: 'manual', dayPhase: 0.75, seasonIndex: 2, weather: 'storm',
    })
    const liveAuto = sampleNatureClock(140)
    const next = stepEnvironment(
      current,
      liveAuto,
      DEFAULT_SIMULATION_SETTINGS,
      1 / 60,
    )

    expect(next.dayPhase).not.toBe(liveAuto.dayPhase)
    expect(next.autoElapsed).toBe(liveAuto.elapsed)
  })
})
```

- [ ] **Step 2: Run the new test and confirm the missing module failure**

Run: `npm test -- --run tests/core/simulation.test.ts`

Expected: FAIL because `src/core/simulation.ts` does not exist.

- [ ] **Step 3: Implement typed weather profiles and the pure simulation step**

Use these public types and values:

```ts
export type SimulationMode = 'auto' | 'manual'
export type WeatherPreset = 'clear' | 'cloudy' | 'fog' | 'rain' | 'storm' | 'snow'

export interface SimulationSettings {
  mode: SimulationMode
  dayPhase: number
  seasonIndex: SeasonIndex
  weather: WeatherPreset
}

export interface WeatherState {
  preset: WeatherPreset
  cloudCover: number
  fog: number
  rain: number
  snow: number
  storm: number
  wetness: number
  fireflies: number
  dew: number
  windStrength: number
  windDirection: readonly [number, number]
}

export interface EnvironmentSnapshot extends NatureSnapshot {
  autoElapsed: number
  seasonPosition: number
  weather: WeatherState
}

export const DEFAULT_SIMULATION_SETTINGS: SimulationSettings = {
  mode: 'auto',
  dayPhase: 0.31,
  seasonIndex: 0,
  weather: 'clear',
}
```

In `src/core/weather.ts`, define a `WEATHER_PROFILES` record for all six presets with normalized numeric fields matching the specification. Export `getAutomaticWeather(snapshot, season)` and `blendWeather(from, to, amount)`. In `src/core/simulation.ts`, validate every persisted field, use shortest-path circular interpolation for day phase and season position, clamp `deltaSeconds` to `0.1`, and use exponential damping with a 2.5-second visual transition.

- [ ] **Step 4: Extend weather tests with preset coherence**

```ts
it('makes storms darker, wetter, and windier than clear weather', () => {
  const clear = getWeatherProfile('clear')
  const storm = getWeatherProfile('storm')
  expect(storm.cloudCover).toBeGreaterThan(clear.cloudCover)
  expect(storm.wetness).toBeGreaterThan(clear.wetness)
  expect(storm.windStrength).toBeGreaterThan(clear.windStrength)
})

it('blends every numeric weather channel continuously', () => {
  const mixed = blendWeather(
    getWeatherProfile('clear'),
    getWeatherProfile('snow'),
    0.5,
  )
  expect(mixed.snow).toBeGreaterThan(0)
  expect(mixed.snow).toBeLessThan(1)
  expect(mixed.cloudCover).toBeGreaterThan(0)
  expect(mixed.cloudCover).toBeLessThan(1)
})
```

- [ ] **Step 5: Run core simulation and weather tests**

Run: `npm test -- --run tests/core/simulation.test.ts tests/core/weather.test.ts tests/core/natureClock.test.ts tests/core/season.test.ts`

Expected: PASS with zero failed tests.

- [ ] **Step 6: Commit the simulation layer**

```bash
git add src/core/simulation.ts src/core/weather.ts tests/core/simulation.test.ts tests/core/weather.test.ts
git commit -m "feat: add controllable environment simulation"
```

---

### Task 2: Accessible Environment Settings

**Files:**
- Create: `src/components/EnvironmentSettings.tsx`
- Create: `tests/components/EnvironmentSettings.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `tests/components/App.test.tsx`

**Interfaces:**
- Consumes: `SimulationSettings`, `WeatherPreset`, and `DEFAULT_SIMULATION_SETTINGS` from `src/core/simulation.ts`.
- Produces: `EnvironmentSettings({ value, onChange })` and App-owned `simulationSettings` passed to `NatureScene`.

- [ ] **Step 1: Write failing interaction tests for the settings popover**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EnvironmentSettings } from '../../src/components/EnvironmentSettings'
import { DEFAULT_SIMULATION_SETTINGS } from '../../src/core/simulation'

describe('EnvironmentSettings', () => {
  it('opens, enables manual controls, and emits a weather choice', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <EnvironmentSettings value={DEFAULT_SIMULATION_SETTINGS} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /nastavení prostředí/i }))
    expect(screen.getByRole('dialog', { name: /nastavení prostředí/i })).toBeVisible()
    expect(screen.getByLabelText(/čas dne/i)).toBeDisabled()

    fireEvent.click(screen.getByRole('radio', { name: /ručně/i }))
    const manual = { ...DEFAULT_SIMULATION_SETTINGS, mode: 'manual' as const }
    expect(onChange).toHaveBeenLastCalledWith(manual)

    rerender(<EnvironmentSettings value={manual} onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /bouřka/i }))
    expect(onChange).toHaveBeenLastCalledWith({ ...manual, weather: 'storm' })
  })

  it('closes on Escape and restores focus to the trigger', () => {
    render(<EnvironmentSettings value={DEFAULT_SIMULATION_SETTINGS} onChange={() => {}} />)
    const trigger = screen.getByRole('button', { name: /nastavení prostředí/i })
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
```

- [ ] **Step 2: Run the component test and confirm the missing component failure**

Run: `npm test -- --run tests/components/EnvironmentSettings.test.tsx`

Expected: FAIL because `EnvironmentSettings.tsx` does not exist.

- [ ] **Step 3: Implement the settings component with native accessible controls**

Use this public signature:

```tsx
interface EnvironmentSettingsProps {
  value: SimulationSettings
  onChange: (next: SimulationSettings) => void
}

export function EnvironmentSettings({ value, onChange }: EnvironmentSettingsProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const manual = value.mode === 'manual'

  const update = <Key extends keyof SimulationSettings>(
    key: Key,
    next: SimulationSettings[Key],
  ) => onChange({ ...value, [key]: next })

  return (
    <div className="environment-settings">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Nastavení prostředí"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <SettingsIcon />
      </button>
      {open ? (
        <section role="dialog" aria-label="Nastavení prostředí" className="environment-panel">
          <fieldset>
            <legend>Režim</legend>
            {(['auto', 'manual'] as const).map((mode) => (
              <label key={mode}>
                <input
                  type="radio"
                  name="mode"
                  checked={value.mode === mode}
                  onChange={() => update('mode', mode)}
                />
                {mode === 'auto' ? 'Auto' : 'Ručně'}
              </label>
            ))}
          </fieldset>
          <label>
            Čas dne
            <input
              aria-label="Čas dne"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={value.dayPhase}
              disabled={!manual}
              onChange={(event) => update('dayPhase', Number(event.currentTarget.value))}
            />
          </label>
          <SeasonChoices value={value.seasonIndex} disabled={!manual} onChange={(seasonIndex) => update('seasonIndex', seasonIndex)} />
          <WeatherChoices value={value.weather} disabled={!manual} onChange={(weather) => update('weather', weather)} />
        </section>
      ) : null}
    </div>
  )
}
```

Implement `SettingsIcon`, `SeasonChoices`, and `WeatherChoices` in the same file as focused private components. Their option arrays must contain the exact typed values and Czech labels listed below; each choice renders a native radio input so keyboard selection and assistive state work without custom key handling.

Use Czech UI labels: `Nastavení prostředí`, `Auto`, `Ručně`, `Čas dne`, `Jaro`, `Léto`, `Podzim`, `Zima`, `Jasno`, `Oblačno`, `Mlha`, `Déšť`, `Bouřka`, and `Sněžení`. Implement outside-click and Escape dismissal with focus restoration. Disable time, season, and weather controls in Auto.

- [ ] **Step 4: Integrate settings state and safe persistence into App**

Initialize with `parseSimulationSettings(JSON.parse(localStorage.getItem('living-meadow:environment') ?? 'null'))`, guard malformed JSON, and persist only after user changes. Pass `simulationSettings` into `NatureScene`. Place `EnvironmentSettings` and `SoundToggle` in the same `.experience-controls` cluster.

- [ ] **Step 5: Add the compact responsive glass UI**

In `src/styles.css`, make `.experience-controls` a flex row, anchor `.environment-panel` above the controls, cap it with `width: min(22rem, calc(100vw - 2 * var(--space-edge)))`, and keep it inside safe-area insets. Add visible focus, checked, hover, disabled, and 320 px layout states using the existing glass tokens rather than a separate card design.

- [ ] **Step 6: Run component tests**

Run: `npm test -- --run tests/components/EnvironmentSettings.test.tsx tests/components/App.test.tsx tests/components/SoundToggle.test.tsx`

Expected: PASS with the settings trigger and existing sound behavior both present.

- [ ] **Step 7: Commit the settings UI**

```bash
git add src/components/EnvironmentSettings.tsx src/App.tsx src/styles.css tests/components/EnvironmentSettings.test.tsx tests/components/App.test.tsx
git commit -m "feat: add environment settings panel"
```

---

### Task 3: Fixed Camera and Dense Layered Grass

**Files:**
- Create: `src/scene/FixedCamera.tsx`
- Delete: `src/scene/CinematicCamera.tsx`
- Modify: `src/core/grassLayout.ts`
- Modify: `src/core/quality.ts`
- Modify: `src/scene/Meadow.tsx`
- Modify: `src/scene/grassShaders.ts`
- Modify: `src/scene/NatureScene.tsx`
- Modify: `src/App.tsx`
- Test: `tests/core/grassLayout.test.ts`
- Test: `tests/core/quality.test.ts`

**Interfaces:**
- Consumes: `EnvironmentSnapshot` and the extended `QualityProfile`.
- Produces: `GrassLayerKind`, `GrassLayerLayout`, `createGrassLayerLayout(count, kind, seed)`, `getGrassLayerBudgets(total)`, `GRASS_LAYER_RATIOS`, and `FixedCamera`.

- [ ] **Step 1: Write failing tests for layer density and blade variation**

```ts
it('allocates all blades across foreground, middle, and horizon layers', () => {
  const budgets = getGrassLayerBudgets(1000)
  expect(budgets.foreground + budgets.middle + budgets.horizon).toBe(1000)
  expect(budgets.horizon).toBeGreaterThan(budgets.foreground)
})

it('creates deterministic width, lean, and color variation', () => {
  const first = createGrassLayerLayout(64, 'foreground', 42)
  const second = createGrassLayerLayout(64, 'foreground', 42)
  expect(Array.from(first.widths)).toEqual(Array.from(second.widths))
  expect(first.leans).toHaveLength(64)
  expect(first.colorVariation).toHaveLength(64)
  expect(Math.max(...first.scales)).toBeGreaterThan(1.2)
})
```

- [ ] **Step 2: Run grass and quality tests and confirm the new exports fail**

Run: `npm test -- --run tests/core/grassLayout.test.ts tests/core/quality.test.ts`

Expected: FAIL because `getGrassLayerBudgets` and `createGrassLayerLayout` are not exported.

- [ ] **Step 3: Extend quality profiles with explicit atmospheric budgets**

Keep `grassBlades` as the total budget and add:

```ts
low: {
  grassBlades: 18_000,
  particles: 400,
  shadowSize: 0,
  maxDpr: 1,
  postprocessing: false,
  cloudLayers: 1,
  starCount: 700,
  shootingStarPool: 1,
}
medium: {
  grassBlades: 48_000,
  particles: 1_000,
  shadowSize: 1024,
  maxDpr: 1.5,
  postprocessing: false,
  cloudLayers: 2,
  starCount: 1_300,
  shootingStarPool: 2,
}
high: {
  grassBlades: 90_000,
  particles: 2_200,
  shadowSize: 2048,
  maxDpr: 2,
  postprocessing: true,
  cloudLayers: 3,
  starCount: 2_000,
  shootingStarPool: 3,
}
```

Raise grass totals only after browser profiling proves stable; first gain density by narrowing distribution to the visible frustum and increasing layer overlap.

- [ ] **Step 4: Implement deterministic layer layouts**

Add `widths`, `leans`, and `colorVariation` typed arrays. Use foreground depth `z = 5.0…-4.5`, middle depth `z = -3.5…-16`, and horizon depth `z = -14…-34`, with x spread expanding by depth so blades cover the camera frustum rather than a full unused circle. Keep `terrainHeight(x, z)` for root placement. Allocate approximately 22% foreground, 33% middle, and 45% horizon blades.

- [ ] **Step 5: Replace per-frame camera motion with one-time placement**

```tsx
const CAMERA_POSITION = new Vector3(0, 1.08, 5.4)
const CAMERA_TARGET = new Vector3(0, 0.78, -5)

export function FixedCamera() {
  const camera = useThree((state) => state.camera)
  useLayoutEffect(() => {
    camera.position.copy(CAMERA_POSITION)
    camera.lookAt(CAMERA_TARGET)
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}
```

Remove pointer and elapsed-time camera updates. Set the Canvas camera FOV to `46` and use the same position as `FixedCamera`.

- [ ] **Step 6: Render three grass layers and upgrade shader deformation**

Create one instanced geometry per layer and share a shader-material factory. Add instance attributes `instanceWidth`, `instanceLean`, and `instanceColorVariation`. Add uniforms `uWindDirection`, `uGustOrigin`, `uGustSpeed`, `uWetness`, and `uLayerFade`. The vertex shader must anchor roots, bend tips cubically, project broad flow along `uWindDirection`, and move a smooth gust front across world position. The fragment shader must darken wet lower blades, sharpen wet highlights, and preserve frost and snow at tips.

- [ ] **Step 7: Run unit tests, type checking, and build**

Run: `npm test -- --run tests/core/grassLayout.test.ts tests/core/quality.test.ts`

Run: `npm run lint`

Run: `npm run build`

Expected: all three commands exit with code 0.

- [ ] **Step 8: Commit the fixed composition and grass renderer**

```bash
git add src/scene/FixedCamera.tsx src/scene/CinematicCamera.tsx src/core/grassLayout.ts src/core/quality.ts src/scene/Meadow.tsx src/scene/grassShaders.ts src/scene/NatureScene.tsx src/App.tsx tests/core/grassLayout.test.ts tests/core/quality.test.ts
git commit -m "feat: densify meadow with fixed camera"
```

---

### Task 4: Visible Sun, Moon, Clouds, and Shooting Stars

**Files:**
- Create: `src/core/celestial.ts`
- Create: `src/scene/CelestialBodies.tsx`
- Create: `src/scene/CloudLayer.tsx`
- Create: `src/scene/ShootingStars.tsx`
- Modify: `src/core/atmosphere.ts`
- Modify: `src/scene/Atmosphere.tsx`
- Test: `tests/core/celestial.test.ts`
- Test: `tests/core/atmosphere.test.ts`

**Interfaces:**
- Consumes: `EnvironmentSnapshot`, `WeatherState`, and `QualityProfile`.
- Produces: `getCelestialState(dayPhase)`, `getShootingStarState(elapsed, seed, slot)`, visible atmospheric helper components, and extended `AtmosphereState` cloud/celestial fields.

- [ ] **Step 1: Write failing deterministic celestial tests**

```ts
import { describe, expect, it } from 'vitest'
import { getCelestialState, getShootingStarState } from '../../src/core/celestial'

describe('celestial state', () => {
  it('places moon opposite the sun and hides bodies below the horizon', () => {
    const noon = getCelestialState(0.5)
    const midnight = getCelestialState(0)
    expect(noon.sun.visibility).toBeGreaterThan(0.9)
    expect(noon.moon.visibility).toBeLessThan(0.05)
    expect(midnight.moon.visibility).toBeGreaterThan(0.9)
  })

  it('schedules rare repeatable shooting stars', () => {
    const first = getShootingStarState(420, 731, 0)
    const second = getShootingStarState(420, 731, 0)
    expect(second).toEqual(first)
    expect(first.progress).toBeGreaterThanOrEqual(0)
    expect(first.progress).toBeLessThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run the celestial test and confirm the missing module failure**

Run: `npm test -- --run tests/core/celestial.test.ts`

Expected: FAIL because `src/core/celestial.ts` does not exist.

- [ ] **Step 3: Implement pure celestial positions and rare event scheduling**

Represent each celestial body as `{ direction: readonly [number, number, number], visibility: number, halo: number }`. Use the existing solar angle convention. Schedule shooting stars in deterministic windows no more frequent than roughly once per 45–120 simulated seconds, return `active`, `progress`, `start`, `direction`, and `brightness`, and suppress brightness outside night.

- [ ] **Step 4: Implement visible sun and moon discs**

Use camera-facing circle meshes at a large fixed radius with transparent additive materials. The sun disc is warm with a larger soft halo; the moon disc is cooler and smaller. Update positions and opacity from `getCelestialState()` each frame. Keep directional lights in `Atmosphere.tsx` synchronized to the same directions.

- [ ] **Step 5: Add procedural cloud layers**

Render one to three large transparent planes according to `quality.cloudLayers`. Use a shader with two scrolling noise scales, edge-softened alpha, and uniforms for `uCloudCover`, `uStorm`, `uTime`, and shared wind direction. Clouds must reduce star, sun-halo, and moon-halo visibility through atmosphere state rather than covering them with an unrelated opaque overlay.

- [ ] **Step 6: Add varied twinkling stars and pooled shooting-star trails**

Give star geometry deterministic `size`, `brightness`, and `phase` attributes. Replace uniform `PointsMaterial` with a small shader that twinkles at low amplitude. Render `quality.shootingStarPool` reusable line or ribbon trails, update from `getShootingStarState()`, and reduce frequency and trail speed when reduced motion is active.

- [ ] **Step 7: Run celestial, atmosphere, lint, and build checks**

Run: `npm test -- --run tests/core/celestial.test.ts tests/core/atmosphere.test.ts`

Run: `npm run lint`

Run: `npm run build`

Expected: all commands exit with code 0.

- [ ] **Step 8: Commit the atmospheric scene**

```bash
git add src/core/celestial.ts src/core/atmosphere.ts src/scene/CelestialBodies.tsx src/scene/CloudLayer.tsx src/scene/ShootingStars.tsx src/scene/Atmosphere.tsx tests/core/celestial.test.ts tests/core/atmosphere.test.ts
git commit -m "feat: add living celestial atmosphere"
```

---

### Task 5: Coordinated Weather, Fireflies, Dew, and Storm Light

**Files:**
- Modify: `src/scene/WeatherParticles.tsx`
- Modify: `src/scene/Meadow.tsx`
- Modify: `src/scene/Atmosphere.tsx`
- Modify: `src/audio/ambientAudio.ts`
- Modify: `tests/core/weather.test.ts`
- Test: `tests/components/NatureScene.test.tsx`

**Interfaces:**
- Consumes: `EnvironmentSnapshot.weather`, shared wind direction, season appearance, reduced-motion state, and quality particle budget.
- Produces: `deriveWeatherEffects({ dayPhase, seasonPosition, weather, reducedMotion })`, coherent rain, snow, pollen, firefly, wetness, dew, and distant storm-light rendering plus environment-driven audio.

- [ ] **Step 1: Add failing tests for seasonal fireflies, dew, and reduced-motion storm behavior**

```ts
it('allows fireflies only on calm summer nights', () => {
  const summerNight = deriveWeatherEffects({
    dayPhase: 0,
    seasonPosition: 1,
    weather: getWeatherProfile('clear'),
    reducedMotion: false,
  })
  const winterNight = deriveWeatherEffects({
    dayPhase: 0,
    seasonPosition: 3,
    weather: getWeatherProfile('clear'),
    reducedMotion: false,
  })
  expect(summerNight.fireflies).toBeGreaterThan(0)
  expect(winterNight.fireflies).toBe(0)
})

it('suppresses fast storm flashes for reduced motion', () => {
  const effects = deriveWeatherEffects({
    dayPhase: 0.4,
    seasonPosition: 1,
    weather: getWeatherProfile('storm'),
    reducedMotion: true,
  })
  expect(effects.stormFlash).toBe(0)
})
```

- [ ] **Step 2: Run weather tests and confirm the missing derivation export**

Run: `npm test -- --run tests/core/weather.test.ts`

Expected: FAIL because `deriveWeatherEffects` is not exported.

- [ ] **Step 3: Implement coherent weather-effect derivation**

Add `deriveWeatherEffects({ dayPhase, seasonPosition, weather, reducedMotion })` returning normalized `pollen`, `rain`, `snow`, `fireflies`, `dew`, and `stormFlash`. Gate fireflies to summer nights with clear or lightly cloudy weather. Gate dew to clear dawn after low precipitation. Generate distant storm flashes from deterministic elapsed-time pulses and set them to zero for reduced motion.

- [ ] **Step 4: Upgrade pooled particles to share the wind vector**

Add firefly material kind `3`, wind uniforms `uWindDirection`, and weather-specific fall speeds. Rain streaks lean along the shared wind vector, snow drifts with its slower turbulence, pollen rises lightly, and fireflies stay below roughly two meters with pulsing emissive opacity. Reuse one geometry buffer and materials; do not allocate inside `useFrame`.

- [ ] **Step 5: Apply surface and lighting consequences**

Feed `weather.wetness` and derived dew into grass shader uniforms. Use wetness to darken grass and increase narrow highlights. Feed `stormFlash` into atmosphere light intensity with a low-amplitude distant flash. Blend fog density, exposure, and sky saturation using weather state. Pass the environment snapshot to ambient audio so rain, wind, and night layers track the selected weather.

- [ ] **Step 6: Add a component-level shared-state test**

Mock React Three Fiber and render `NatureScene` with a manual storm setting. Assert that Atmosphere, Meadow, and WeatherParticles receive the same `snapshotRef` object and that `FixedCamera` is rendered instead of `CinematicCamera`.

- [ ] **Step 7: Run weather, component, lint, and build checks**

Run: `npm test -- --run tests/core/weather.test.ts tests/components/NatureScene.test.tsx`

Run: `npm run lint`

Run: `npm run build`

Expected: all commands exit with code 0.

- [ ] **Step 8: Commit coordinated environmental effects**

```bash
git add src/core/weather.ts src/scene/WeatherParticles.tsx src/scene/Meadow.tsx src/scene/Atmosphere.tsx src/audio/ambientAudio.ts tests/core/weather.test.ts tests/components/NatureScene.test.tsx
git commit -m "feat: coordinate meadow weather effects"
```

---

### Task 6: End-to-End Settings and State Integration

**Files:**
- Modify: `src/scene/NatureScene.tsx`
- Modify: `src/App.tsx`
- Modify: `tests/components/App.test.tsx`
- Modify: `tests/e2e/meadow.spec.ts`

**Interfaces:**
- Consumes: `SimulationSettings`, `stepEnvironment()`, `EnvironmentSettings`, and all scene components from Tasks 1–5.
- Produces: the complete user path `open settings -> Manual -> choose time/season/weather -> observe state -> Auto -> smooth rejoin`.

- [ ] **Step 1: Add a failing App integration test for persisted manual settings**

```tsx
it('loads valid environment settings and rejects malformed storage', () => {
  localStorage.setItem('living-meadow:environment', JSON.stringify({
    mode: 'manual', dayPhase: 0, seasonIndex: 3, weather: 'snow',
  }))
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /nastavení prostředí/i }))
  expect(screen.getByRole('radio', { name: /ručně/i })).toBeChecked()
  expect(screen.getByRole('radio', { name: /zima/i })).toBeChecked()
  expect(screen.getByRole('radio', { name: /sněžení/i })).toBeChecked()
})
```

- [ ] **Step 2: Run the App test and confirm the integration fails**

Run: `npm test -- --run tests/components/App.test.tsx`

Expected: FAIL until App initializes and passes validated settings correctly.

- [ ] **Step 3: Complete NatureScene orchestration**

Accept `simulationSettings: SimulationSettings`. Keep the continuously increasing automatic elapsed value. On each visible frame, sample the auto clock, call `stepEnvironment(snapshotRef.current, auto, simulationSettings, safeDelta)`, update season appearance, notify audio at the existing throttled cadence, and keep rendering state inside refs. Do not restart elapsed time when the mode changes.

- [ ] **Step 4: Add stable DOM state hooks for browser verification**

Expose descriptive values on the main element without making them visually prominent:

```tsx
<main
  className="experience"
  aria-label="Živá louka"
  data-simulation-mode={simulationSettings.mode}
  data-weather={simulationSettings.weather}
  data-season={simulationSettings.seasonIndex}
>
```

These attributes support deterministic interaction verification while visual transitions remain canvas-based.

- [ ] **Step 5: Extend the Playwright test through the complete settings flow**

```ts
test('manually controls the environment and returns to auto', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /nastavení prostředí/i }).click()
  await page.getByRole('radio', { name: /ručně/i }).click()
  await page.getByRole('radio', { name: /zima/i }).click()
  await page.getByRole('radio', { name: /sněžení/i }).click()
  await expect(page.getByRole('main', { name: 'Živá louka' })).toHaveAttribute('data-weather', 'snow')
  await page.getByRole('radio', { name: /^auto$/i }).click()
  await expect(page.getByRole('main', { name: 'Živá louka' })).toHaveAttribute('data-simulation-mode', 'auto')
})
```

- [ ] **Step 6: Run all automated checks**

Run: `npm test`

Run: `npm run lint`

Run: `npm run build`

Run: `npm run test:e2e`

Expected: every command exits with code 0 and Playwright reports zero failed tests.

- [ ] **Step 7: Commit full scene integration**

```bash
git add src/scene/NatureScene.tsx src/App.tsx tests/components/App.test.tsx tests/e2e/meadow.spec.ts
git commit -m "feat: integrate manual meadow controls"
```

---

### Task 7: Browser Fidelity, Responsive QA, and Final Polish

**Files:**
- Modify as evidence requires: `src/styles.css`, `src/scene/Meadow.tsx`, `src/scene/grassShaders.ts`, `src/scene/Atmosphere.tsx`, `src/scene/CelestialBodies.tsx`, `src/scene/CloudLayer.tsx`, `src/scene/ShootingStars.tsx`, `src/scene/WeatherParticles.tsx`
- Do not commit temporary screenshots or browser traces.

**Interfaces:**
- Consumes: the running app at `http://127.0.0.1:5173/`, the supplied reference image, and the complete settings workflow.
- Produces: verified desktop, mobile, day, night, rain, and winter states with a written mismatch ledger and no relevant console errors.

- [ ] **Step 1: Start the exact local development target**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite reports `http://127.0.0.1:5173/` ready.

- [ ] **Step 2: Run the required in-app Browser smoke checks**

Define the flow as: `app loads -> settings open -> Manual winter snow -> Auto -> visible scene and controls remain healthy`.

Use the Browser plugin to verify URL/title, a meaningful DOM snapshot, no framework overlay, no relevant warning/error logs, and interaction state after each settings choice. Capture a current desktop screenshot before visual adjustments.

- [ ] **Step 3: Compare the reference and implementation with view_image**

Inspect the supplied reference image and the latest browser screenshot. Record and fix concrete differences for at least: fixed horizon height, foreground blade overlap, hidden ground, blade height/width variation, calm sky balance, control unobtrusiveness, sun/moon legibility, cloud softness, and night-star restraint.

- [ ] **Step 4: Exercise and capture representative visual states**

Use Manual mode to inspect and capture:

- summer daylight with clear weather;
- night with moon, stars, and an exercisable deterministic shooting-star window;
- rainy or stormy weather with aligned grass and precipitation wind;
- winter with snow and frost.

For each state, check clipping, terrain gaps, lighting discontinuities, particle direction, excessive glow, and unreadable controls. Fix code and reload the same Browser tab after each adjustment.

- [ ] **Step 5: Verify responsive and reduced-motion behavior**

Check the current desktop viewport and a mobile viewport around 390 x 844. Confirm the settings panel remains inside the safe viewport, the central horizon is not permanently covered, Escape and outside-click dismissal work, focus is visible, and no horizontal scroll appears. Emulate reduced motion and confirm camera remains fixed, lightning is suppressed, shooting stars are slower or rarer, and the grass still moves gently.

- [ ] **Step 6: Re-run full verification after the final visual edit**

Run: `npm test`

Run: `npm run lint`

Run: `npm run build`

Run: `npm run test:e2e`

Expected: all commands exit with code 0 using fresh output.

- [ ] **Step 7: Capture the final Browser evidence and inspect both images again**

Capture the final desktop implementation screenshot, run `view_image` on it and the supplied reference in the same QA pass, confirm no remaining material mismatch in the acceptance criteria, and keep the Browser tab visible for the user.

- [ ] **Step 8: Commit final fidelity fixes**

```bash
git add src tests
git commit -m "test: verify upgraded living meadow"
```

Do not include temporary screenshots, browser traces, or unrelated files in this commit.
