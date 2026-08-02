# Living Meadow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Build a full-screen, passive 3D meadow whose GPU-animated grass, sky, weather, daylight, and four seasons blend continuously while adapting visual quality to the device.

**Architecture:** A React and Vite shell hosts one React Three Fiber canvas. Pure TypeScript modules calculate nature time, seasonal appearance, atmosphere, seeded grass layout, and quality decisions; render components consume those values inside the frame loop without per-frame React state. WebGL failures and optional audio failures degrade to a deliberate static experience.

**Tech Stack:** TypeScript, React, Vite, Three.js, React Three Fiber, Drei, Vitest, Testing Library, Playwright, GLSL shaders, Web Audio API

## Global Constraints

- Target desktop browsers first and prioritize visual fidelity.
- Target stable 60 FPS on a modern desktop; prefer stable 30 FPS on weaker hardware over unstable frame pacing.
- Use WebGL as the required renderer; do not require WebGPU.
- Do not add free movement, game controls, characters, animals, buildings, objectives, accounts, or server persistence.
- Keep sound muted until the visitor explicitly enables it.
- Respect prefers-reduced-motion.
- Pause expensive animation and audio while the document is hidden.
- Blend all daily, seasonal, and weather transitions continuously.
- Keep animated values out of per-frame React state.

## File Map

- package.json — scripts and runtime/development dependencies.
- index.html — Vite document entry and metadata.
- src/main.tsx — React entry point.
- src/App.tsx — application shell, WebGL capability choice, fallback, and controls.
- src/styles.css — full-screen layout, loading state, fallback, and control styling.
- src/test/setup.ts — DOM test matchers and browser API stubs.
- src/core/natureClock.ts — deterministic daily, seasonal, wind, and weather time model.
- src/core/season.ts — continuous seasonal color and surface interpolation.
- src/core/quality.ts — quality profiles and hysteresis-based tier decisions.
- src/core/grassLayout.ts — deterministic grass instance attributes.
- src/core/atmosphere.ts — light, fog, and celestial values derived from time and season.
- src/scene/NatureScene.tsx — shared frame loop and scene composition.
- src/scene/Meadow.tsx — terrain and instanced grass draw call.
- src/scene/grassShaders.ts — complete vertex and fragment shader sources.
- src/scene/Atmosphere.tsx — sky, sun/moon lights, stars, and fog updates.
- src/scene/WeatherParticles.tsx — pollen, rain, and snow point systems.
- src/scene/CinematicCamera.tsx — slow drift and restrained pointer parallax.
- src/audio/ambientAudio.ts — procedural wind and season-aware ambient synthesis.
- src/hooks/usePageVisibility.ts — document visibility state.
- src/components/SoundToggle.tsx — accessible sound control.
- src/components/StaticFallback.tsx — non-WebGL and fatal-load fallback.
- public/fallback-meadow.svg — static full-screen meadow artwork.
- tests/core/*.test.ts — pure model tests.
- tests/components/*.test.tsx — shell, controls, and fallback tests.
- tests/e2e/meadow.spec.ts — browser-level loading, accessibility, and WebGL smoke checks.
- playwright.config.ts — browser test configuration.

---

### Task 1: Application shell and test harness

**Files:**
- Create: package.json
- Create: tsconfig.json
- Create: tsconfig.node.json
- Create: vite.config.ts
- Create: index.html
- Create: src/main.tsx
- Create: src/App.tsx
- Create: src/styles.css
- Create: src/test/setup.ts
- Create: src/components/StaticFallback.tsx
- Create: public/fallback-meadow.svg
- Create: tests/components/App.test.tsx

**Interfaces:**
- Produces: App(): JSX.Element
- Produces: StaticFallback(props: { reason?: string }): JSX.Element
- Consumes: no project-local interfaces

- [ ] **Step 1: Initialize dependencies and scripts**

Create package.json with scripts that keep unit, type, build, and browser checks separate:

~~~json
{
  "name": "living-meadow",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "tsc -b --pretty false"
  },
  "dependencies": {
    "@react-three/drei": "latest",
    "@react-three/fiber": "latest",
    "react": "latest",
    "react-dom": "latest",
    "three": "latest"
  },
  "devDependencies": {
    "@playwright/test": "latest",
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "@types/three": "latest",
    "@vitejs/plugin-react": "latest",
    "jsdom": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest"
  }
}
~~~

Run: npm install

Expected: package-lock.json is created and npm exits successfully.

- [ ] **Step 2: Write the failing shell test**

Create tests/components/App.test.tsx:

~~~tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../../src/App'

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="nature-canvas">{children}</div>
  ),
}))

describe('App', () => {
  it('renders a full-screen nature experience with an accessible title', () => {
    render(<App />)
    expect(screen.getByRole('main', { name: /živá louka/i })).toBeInTheDocument()
    expect(screen.getByTestId('nature-canvas')).toBeInTheDocument()
  })
})
~~~

- [ ] **Step 3: Run the shell test and verify the failure**

Run: npm test -- tests/components/App.test.tsx

Expected: FAIL because src/App.tsx and the Vitest configuration do not exist.

- [ ] **Step 4: Implement the minimal shell and configuration**

Configure Vite with React and Vitest using the jsdom environment and src/test/setup.ts. Implement App as a main element labelled "Živá louka" containing a Canvas with a neutral background. Implement StaticFallback as a figure containing fallback-meadow.svg and a Czech compatibility message. Add global CSS that removes margins, fills 100dvh, uses overflow hidden, and positions controls over the canvas. Create a layered SVG fallback with a sky gradient, low sun, distant hills, and foreground grass silhouettes.

The initial App body is:

~~~tsx
import { Canvas } from '@react-three/fiber'
import './styles.css'

export function App() {
  return (
    <main className="experience" aria-label="Živá louka">
      <Canvas data-testid="nature-canvas" camera={{ position: [0, 1.1, 5], fov: 48 }}>
        <color attach="background" args={['#9fcce5']} />
      </Canvas>
    </main>
  )
}
~~~

- [ ] **Step 5: Run unit, type, and production checks**

Run: npm test -- tests/components/App.test.tsx

Expected: PASS with one shell test.

Run: npm run lint

Expected: PASS with no TypeScript errors.

Run: npm run build

Expected: PASS and dist/index.html is emitted.

- [ ] **Step 6: Commit the shell**

~~~bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts index.html src public/fallback-meadow.svg tests/components/App.test.tsx
git commit -m "feat: scaffold living meadow experience"
~~~

### Task 2: Deterministic nature clock

**Files:**
- Create: src/core/natureClock.ts
- Create: tests/core/natureClock.test.ts

**Interfaces:**
- Produces: NatureClockConfig, NatureSnapshot, sampleNatureClock(elapsedSeconds, config)
- Consumes: no project-local interfaces

- [ ] **Step 1: Write failing clock tests**

Create tests/core/natureClock.test.ts:

~~~ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_CLOCK, sampleNatureClock } from '../../src/core/natureClock'

describe('sampleNatureClock', () => {
  it('wraps daily and seasonal phases without discontinuity', () => {
    expect(sampleNatureClock(0, DEFAULT_CLOCK).dayPhase).toBeCloseTo(0)
    expect(sampleNatureClock(DEFAULT_CLOCK.dayDuration, DEFAULT_CLOCK).dayPhase).toBeCloseTo(0)
    expect(sampleNatureClock(DEFAULT_CLOCK.seasonDuration * 4, DEFAULT_CLOCK).seasonPhase).toBeCloseTo(0)
  })

  it('reports adjacent seasons and a normalized blend', () => {
    const sample = sampleNatureClock(DEFAULT_CLOCK.seasonDuration * 1.25, DEFAULT_CLOCK)
    expect(sample.seasonIndex).toBe(1)
    expect(sample.nextSeasonIndex).toBe(2)
    expect(sample.seasonBlend).toBeCloseTo(0.25)
  })

  it('keeps weather and wind in bounded ranges', () => {
    for (let second = 0; second < 1000; second += 7) {
      const sample = sampleNatureClock(second, DEFAULT_CLOCK)
      expect(sample.windStrength).toBeGreaterThanOrEqual(0)
      expect(sample.windStrength).toBeLessThanOrEqual(1)
      expect(sample.weatherIntensity).toBeGreaterThanOrEqual(0)
      expect(sample.weatherIntensity).toBeLessThanOrEqual(1)
    }
  })
})
~~~

- [ ] **Step 2: Verify the clock tests fail**

Run: npm test -- tests/core/natureClock.test.ts

Expected: FAIL because src/core/natureClock.ts does not exist.

- [ ] **Step 3: Implement the pure clock**

Create these exact public types and functions:

~~~ts
export type SeasonIndex = 0 | 1 | 2 | 3

export interface NatureClockConfig {
  dayDuration: number
  seasonDuration: number
  seed: number
}

export interface NatureSnapshot {
  elapsed: number
  dayPhase: number
  seasonPhase: number
  seasonIndex: SeasonIndex
  nextSeasonIndex: SeasonIndex
  seasonBlend: number
  windStrength: number
  weatherIntensity: number
}

export const DEFAULT_CLOCK: NatureClockConfig = {
  dayDuration: 180,
  seasonDuration: 360,
  seed: 7.31,
}

const fract = (value: number) => value - Math.floor(value)
const smooth01 = (value: number) => value * value * (3 - 2 * value)

export function sampleNatureClock(
  elapsedSeconds: number,
  config: NatureClockConfig = DEFAULT_CLOCK,
): NatureSnapshot {
  const elapsed = Math.max(0, elapsedSeconds)
  const dayPhase = fract(elapsed / config.dayDuration)
  const seasonCycle = elapsed / config.seasonDuration
  const seasonPhase = fract(seasonCycle / 4)
  const seasonIndex = (Math.floor(seasonCycle) % 4) as SeasonIndex
  const seasonBlend = smooth01(fract(seasonCycle))
  const nextSeasonIndex = ((seasonIndex + 1) % 4) as SeasonIndex
  const broadWind = 0.5 + 0.5 * Math.sin(elapsed * 0.071 + config.seed)
  const gust = 0.5 + 0.5 * Math.sin(elapsed * 0.193 + Math.sin(elapsed * 0.037))
  const weather = 0.5 + 0.5 * Math.sin(elapsed * 0.013 + config.seed * 2)

  return {
    elapsed,
    dayPhase,
    seasonPhase,
    seasonIndex,
    nextSeasonIndex,
    seasonBlend,
    windStrength: Math.min(1, Math.max(0, broadWind * 0.65 + gust * 0.35)),
    weatherIntensity: smooth01(weather),
  }
}
~~~

- [ ] **Step 4: Run the clock tests**

Run: npm test -- tests/core/natureClock.test.ts

Expected: PASS with three clock behaviors.

- [ ] **Step 5: Commit the nature clock**

~~~bash
git add src/core/natureClock.ts tests/core/natureClock.test.ts
git commit -m "feat: add continuous nature clock"
~~~

### Task 3: Seasonal appearance and atmosphere models

**Files:**
- Create: src/core/season.ts
- Create: src/core/atmosphere.ts
- Create: tests/core/season.test.ts
- Create: tests/core/atmosphere.test.ts

**Interfaces:**
- Consumes: NatureSnapshot and SeasonIndex from src/core/natureClock.ts
- Produces: getSeasonAppearance(snapshot): SeasonAppearance
- Produces: getAtmosphere(snapshot, season): AtmosphereState

- [ ] **Step 1: Write failing season and atmosphere tests**

Test exact seasonal midpoint colors and continuity at the winter-to-spring wrap:

~~~ts
import { describe, expect, it } from 'vitest'
import { Color } from 'three'
import { getSeasonAppearance } from '../../src/core/season'
import { sampleNatureClock, DEFAULT_CLOCK } from '../../src/core/natureClock'

describe('getSeasonAppearance', () => {
  it('blends summer grass toward autumn', () => {
    const snapshot = sampleNatureClock(DEFAULT_CLOCK.seasonDuration * 1.5)
    const appearance = getSeasonAppearance(snapshot)
    expect(appearance.grassColor).toBeInstanceOf(Color)
    expect(appearance.dryness).toBeGreaterThan(0.2)
    expect(appearance.dryness).toBeLessThan(0.8)
  })

  it('wraps winter to spring without an invalid blend', () => {
    const snapshot = sampleNatureClock(DEFAULT_CLOCK.seasonDuration * 3.99)
    const appearance = getSeasonAppearance(snapshot)
    expect(appearance.snowCoverage).toBeGreaterThanOrEqual(0)
    expect(appearance.snowCoverage).toBeLessThanOrEqual(1)
  })
})
~~~

Create tests/core/atmosphere.test.ts with samples at dayPhase 0, 0.25, 0.5, and 0.75. Assert sun elevation is highest at noon, starOpacity exceeds 0.8 at midnight, starOpacity is below 0.05 at noon, and fog density remains between 0.002 and 0.04.

- [ ] **Step 2: Verify both model tests fail**

Run: npm test -- tests/core/season.test.ts tests/core/atmosphere.test.ts

Expected: FAIL because the model modules do not exist.

- [ ] **Step 3: Implement season interpolation**

Define SeasonAppearance with grassColor, groundColor, tipColor as Three Color values and dryness, snowCoverage, frost, pollen, rainBias, snowBias as normalized numbers. Use four frozen profiles:

~~~ts
const PROFILES = [
  { grass: '#4d7f32', ground: '#40552b', tip: '#83a84e', dryness: 0.05, snow: 0, frost: 0.05, pollen: 0.8, rain: 0.65, snowBias: 0 },
  { grass: '#58772f', ground: '#51452a', tip: '#9a9d45', dryness: 0.25, snow: 0, frost: 0, pollen: 0.45, rain: 0.35, snowBias: 0 },
  { grass: '#806a32', ground: '#5b4328', tip: '#b18745', dryness: 0.72, snow: 0, frost: 0.15, pollen: 0.08, rain: 0.55, snowBias: 0.05 },
  { grass: '#72806f', ground: '#4c514a', tip: '#d6ded9', dryness: 0.55, snow: 0.78, frost: 0.9, pollen: 0, rain: 0.2, snowBias: 0.85 }
] as const
~~~

Interpolate current and next profiles using snapshot.seasonBlend. Clamp every scalar output to [0, 1].

- [ ] **Step 4: Implement atmosphere derivation**

Define AtmosphereState with skyTop, skyHorizon, fogColor as Color values plus sunElevation, sunAzimuth, sunIntensity, moonIntensity, starOpacity, fogDensity, and exposure. Calculate solarAngle as dayPhase * Math.PI * 2 - Math.PI / 2. Use sin(solarAngle) for elevation and smoothstep bands for daylight and stars. Increase fog modestly from seasonal frost and weather intensity; cap it at 0.04.

- [ ] **Step 5: Run the model tests**

Run: npm test -- tests/core/season.test.ts tests/core/atmosphere.test.ts

Expected: PASS for seasonal interpolation, wrap behavior, celestial phases, and fog bounds.

- [ ] **Step 6: Commit the visual models**

~~~bash
git add src/core/season.ts src/core/atmosphere.ts tests/core/season.test.ts tests/core/atmosphere.test.ts
git commit -m "feat: derive seasons and atmosphere"
~~~

### Task 4: Adaptive quality controller

**Files:**
- Create: src/core/quality.ts
- Create: tests/core/quality.test.ts

**Interfaces:**
- Produces: QualityTier = 'low' | 'medium' | 'high'
- Produces: QualityProfile = (typeof QUALITY_PROFILES)[QualityTier]
- Produces: QUALITY_PROFILES: Record<QualityTier, QualityProfile>
- Produces: selectInitialQuality(capabilities): QualityTier
- Produces: evaluateQuality(current, samples): QualityTier
- Consumes: no project-local interfaces

- [ ] **Step 1: Write failing quality decisions**

~~~ts
import { describe, expect, it } from 'vitest'
import { evaluateQuality, selectInitialQuality } from '../../src/core/quality'

describe('quality selection', () => {
  it('starts reduced-motion and low-core devices conservatively', () => {
    expect(selectInitialQuality({ logicalCores: 2, devicePixelRatio: 3, reducedMotion: true })).toBe('low')
  })

  it('allows a modern desktop to start high', () => {
    expect(selectInitialQuality({ logicalCores: 10, devicePixelRatio: 2, reducedMotion: false })).toBe('high')
  })

  it('drops one tier after sustained low frame rate', () => {
    expect(evaluateQuality('high', Array(120).fill(41))).toBe('medium')
    expect(evaluateQuality('medium', Array(120).fill(24))).toBe('low')
  })

  it('does not oscillate on a short frame-rate dip', () => {
    expect(evaluateQuality('high', [60, 60, 34, 58, 60])).toBe('high')
  })
})
~~~

- [ ] **Step 2: Verify quality tests fail**

Run: npm test -- tests/core/quality.test.ts

Expected: FAIL because src/core/quality.ts does not exist.

- [ ] **Step 3: Implement profiles and hysteresis**

Use these budgets:

~~~ts
export const QUALITY_PROFILES = {
  low: { grassBlades: 18000, particles: 400, shadowSize: 0, maxDpr: 1, postprocessing: false },
  medium: { grassBlades: 48000, particles: 1000, shadowSize: 1024, maxDpr: 1.5, postprocessing: false },
  high: { grassBlades: 90000, particles: 2200, shadowSize: 2048, maxDpr: 2, postprocessing: true },
} as const

export type QualityTier = keyof typeof QUALITY_PROFILES
export type QualityProfile = (typeof QUALITY_PROFILES)[QualityTier]
~~~

selectInitialQuality returns low for reduced motion or at most four cores, high for at least eight cores and DPR at most 2, and medium otherwise. evaluateQuality keeps the current tier until it receives at least 90 samples; it drops exactly one tier if the average is below 48 on high or below 27 on medium. It upgrades only after 300 samples averaging at least 58, which prevents oscillation.

- [ ] **Step 4: Run quality tests**

Run: npm test -- tests/core/quality.test.ts

Expected: PASS with four quality behaviors.

- [ ] **Step 5: Commit adaptive quality**

~~~bash
git add src/core/quality.ts tests/core/quality.test.ts
git commit -m "feat: add adaptive rendering quality"
~~~

### Task 5: Instanced grass and GPU wind

**Files:**
- Create: src/core/grassLayout.ts
- Create: tests/core/grassLayout.test.ts
- Create: src/scene/grassShaders.ts
- Create: src/scene/Meadow.tsx

**Interfaces:**
- Consumes: QualityProfile from src/core/quality.ts
- Consumes: NatureSnapshot from src/core/natureClock.ts
- Consumes: SeasonAppearance from src/core/season.ts
- Produces: createGrassLayout(count, radius, seed): GrassLayout
- Produces: Meadow(props: { quality: QualityProfile; snapshotRef: MutableRefObject<NatureSnapshot>; seasonRef: MutableRefObject<SeasonAppearance> }): JSX.Element

- [ ] **Step 1: Write failing deterministic-layout tests**

~~~ts
import { describe, expect, it } from 'vitest'
import { createGrassLayout } from '../../src/core/grassLayout'

describe('createGrassLayout', () => {
  it('is deterministic and keeps blades inside the meadow radius', () => {
    const first = createGrassLayout(128, 24, 42)
    const second = createGrassLayout(128, 24, 42)
    expect(Array.from(first.offsets)).toEqual(Array.from(second.offsets))
    expect(first.offsets).toHaveLength(128 * 3)
    for (let index = 0; index < first.offsets.length; index += 3) {
      const x = first.offsets[index]
      const z = first.offsets[index + 2]
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(24)
    }
  })

  it('keeps scale, phase, and stiffness normalized', () => {
    const layout = createGrassLayout(32, 10, 5)
    for (const value of layout.scales) expect(value).toBeGreaterThan(0)
    for (const value of layout.phases) expect(value).toBeGreaterThanOrEqual(0)
    for (const value of layout.stiffness) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})
~~~

- [ ] **Step 2: Verify layout tests fail**

Run: npm test -- tests/core/grassLayout.test.ts

Expected: FAIL because createGrassLayout does not exist.

- [ ] **Step 3: Implement seeded grass attributes**

Create GrassLayout with Float32Array fields offsets, scales, phases, stiffness, and yaw. Use a Mulberry32 seeded generator. Distribute blades uniformly over a disc with radius = meadowRadius * sqrt(random), angle = random * 2π. Use scale = 0.65 + random * 0.75 and clamp stiffness to [0.15, 0.95].

- [ ] **Step 4: Run layout tests**

Run: npm test -- tests/core/grassLayout.test.ts

Expected: PASS with deterministic bounded data.

- [ ] **Step 5: Implement grass shaders**

The vertex shader must:

- read instanceOffset, instanceScale, instancePhase, instanceStiffness, and instanceYaw attributes;
- calculate heightRatio from the blade vertex y coordinate;
- combine a broad sine wave, a diagonal traveling gust, and two higher-frequency turbulence waves;
- multiply bend by heightRatio squared so roots remain fixed;
- rotate local vertices by instanceYaw before applying world offset;
- expose heightRatio and a deterministic color variation to the fragment shader.

The fragment shader must:

- mix uGrassBase, uGrassTip, and uDryColor by height and uDryness;
- add subtle per-instance hue/value variation;
- apply simple hemispheric light using uSunColor, uSkyColor, and uSunDirection;
- mix toward uFogColor with smoothstep over view-space distance;
- use tone-mapping and color-space shader chunks.

Use ShaderMaterial with DoubleSide and alphaTest 0.35. Avoid transparent blending for grass.

- [ ] **Step 6: Implement Meadow**

Create one tapered blade geometry with four vertical segments and instanced attributes from createGrassLayout. Render a slightly undulating circular ground mesh below it. In useFrame, update only shader uniforms from snapshotRef and seasonRef. Dispose custom geometry and material when the component unmounts.

- [ ] **Step 7: Run all model tests and build**

Run: npm test

Expected: PASS for shell, clock, season, atmosphere, quality, and grass layout.

Run: npm run build

Expected: PASS with the grass shader included in the production bundle.

- [ ] **Step 8: Commit the meadow renderer**

~~~bash
git add src/core/grassLayout.ts src/scene/grassShaders.ts src/scene/Meadow.tsx tests/core/grassLayout.test.ts
git commit -m "feat: render wind-swept instanced grass"
~~~

### Task 6: Sky, celestial light, and cinematic camera

**Files:**
- Create: src/scene/Atmosphere.tsx
- Create: src/scene/CinematicCamera.tsx
- Create: src/hooks/usePageVisibility.ts
- Create: tests/components/usePageVisibility.test.tsx

**Interfaces:**
- Consumes: MutableRefObject<NatureSnapshot>
- Consumes: MutableRefObject<SeasonAppearance>
- Consumes: QualityProfile
- Produces: Atmosphere, CinematicCamera, and usePageVisibility()

- [ ] **Step 1: Write the failing visibility test**

Render a probe component that prints String(usePageVisibility()). Change document.visibilityState through a configurable getter, dispatch visibilitychange, and assert the probe changes from "true" to "false" and back.

- [ ] **Step 2: Verify the visibility test fails**

Run: npm test -- tests/components/usePageVisibility.test.tsx

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement visibility tracking**

usePageVisibility returns document.visibilityState === 'visible', subscribes to visibilitychange in an effect, and removes the listener on cleanup.

- [ ] **Step 4: Implement Atmosphere**

Use a large BackSide sphere whose ShaderMaterial blends skyTop and skyHorizon by normalized world-space height. Add one directional sun light, one low-intensity directional moon light, hemisphere light, and a deterministic Points star field. On each visible frame:

- derive AtmosphereState with getAtmosphere;
- set sky, fog, exposure, and light uniforms;
- place sun and moon on opposite points of a radius-80 arc;
- fade star material opacity from AtmosphereState.starOpacity;
- disable shadow updates for the low quality profile.

- [ ] **Step 5: Implement CinematicCamera**

Start the camera at [0, 1.15, 5.4] looking toward [0, 0.75, -4]. Apply a 24-second sideways drift no larger than 0.35 meters, a 13-second vertical breathing movement no larger than 0.035 meters, and pointer parallax no larger than 0.12 meters. When reduced motion is true, retain only 15 percent of the drift and disable pointer parallax. Smooth all targets with frame-rate-independent damping.

- [ ] **Step 6: Run tests and build**

Run: npm test

Expected: PASS including visibility behavior.

Run: npm run build

Expected: PASS with no invalid Three.js object properties.

- [ ] **Step 7: Commit atmosphere and camera**

~~~bash
git add src/scene/Atmosphere.tsx src/scene/CinematicCamera.tsx src/hooks/usePageVisibility.ts tests/components/usePageVisibility.test.tsx
git commit -m "feat: add living sky and cinematic camera"
~~~

### Task 7: Seasonal weather and shared scene loop

**Files:**
- Create: src/scene/WeatherParticles.tsx
- Create: src/scene/NatureScene.tsx
- Modify: src/App.tsx
- Create: tests/components/NatureScene.test.tsx

**Interfaces:**
- Consumes: sampleNatureClock, getSeasonAppearance, QualityProfile
- Produces: NatureScene(props: { qualityTier: QualityTier; reducedMotion: boolean; visible: boolean }): JSX.Element
- Produces: WeatherParticles with season-aware pollen, rain, and snow

- [ ] **Step 1: Write the failing composition test**

Mock Meadow, Atmosphere, WeatherParticles, and CinematicCamera as labelled group elements. Render NatureScene and assert all four labels appear exactly once, proving one composition root owns the visual layers.

- [ ] **Step 2: Verify the composition test fails**

Run: npm test -- tests/components/NatureScene.test.tsx

Expected: FAIL because NatureScene does not exist.

- [ ] **Step 3: Implement WeatherParticles**

Allocate one deterministic particle position buffer up to quality.particles. Render three Points groups sharing positions but using separate materials:

- pollen opacity = season.pollen * (1 - weatherIntensity * 0.8) * daylight;
- rain opacity = season.rainBias * weatherIntensity;
- snow opacity = season.snowBias * weatherIntensity.

Move pollen with slow curl-like trigonometric offsets, rain downward at 8 meters per second with wrapping, and snow downward at 0.7 meters per second with side-to-side drift. Skip particle updates when visible is false. Reduced motion lowers active draw range to 25 percent.

- [ ] **Step 4: Implement the shared frame loop**

NatureScene owns refs initialized from sampleNatureClock(0) and getSeasonAppearance(initialSnapshot). Its single useFrame callback computes activeElapsed from performance time while excluding hidden-tab duration, then mutates both refs. Compose Atmosphere, Meadow, WeatherParticles, and CinematicCamera below one group. Do not call a React state setter from useFrame.

- [ ] **Step 5: Connect NatureScene to App**

Select an initial quality tier from navigator.hardwareConcurrency, window.devicePixelRatio, and matchMedia('(prefers-reduced-motion: reduce)'). Pass the profile maxDpr to Canvas, enable shadows only outside low quality, add Suspense with a visible Czech loading label, and render NatureScene inside the canvas.

- [ ] **Step 6: Run composition, unit, and build checks**

Run: npm test -- tests/components/NatureScene.test.tsx

Expected: PASS with all visual layers composed once.

Run: npm test

Expected: PASS for the entire unit suite.

Run: npm run build

Expected: PASS and produce the integrated visual scene.

- [ ] **Step 7: Commit the integrated seasons and weather**

~~~bash
git add src/scene/WeatherParticles.tsx src/scene/NatureScene.tsx src/App.tsx tests/components/NatureScene.test.tsx
git commit -m "feat: integrate seasons and weather"
~~~

### Task 8: Adaptive runtime quality

**Files:**
- Create: src/hooks/useAdaptiveQuality.ts
- Create: tests/components/useAdaptiveQuality.test.tsx
- Modify: src/scene/NatureScene.tsx
- Modify: src/App.tsx

**Interfaces:**
- Consumes: evaluateQuality, selectInitialQuality, QualityTier
- Produces: useAdaptiveQuality(): { tier: QualityTier; recordFrame(deltaSeconds: number): void }

- [ ] **Step 1: Write the failing adaptive hook test**

Use renderHook with fake timers. Record 120 frames at 1/40 second from an initial high tier and assert the tier becomes medium. Record only five slow frames in a fresh hook and assert it remains high.

- [ ] **Step 2: Verify the hook test fails**

Run: npm test -- tests/components/useAdaptiveQuality.test.tsx

Expected: FAIL because useAdaptiveQuality does not exist.

- [ ] **Step 3: Implement bounded frame sampling**

Store frame samples in a ref, convert deltaSeconds to FPS with a minimum delta of 1/240, and evaluate at 120-frame intervals. Set React state only when evaluateQuality returns a different tier. Clear samples after evaluation and wait at least ten seconds before allowing another tier change.

- [ ] **Step 4: Connect runtime quality**

App owns useAdaptiveQuality and passes tier to NatureScene. NatureScene calls recordFrame from its existing useFrame loop. When tier changes, grass and particle counts remount using the new immutable profile, while logical nature time continues from elapsed time.

- [ ] **Step 5: Run adaptive tests and build**

Run: npm test -- tests/components/useAdaptiveQuality.test.tsx tests/core/quality.test.ts

Expected: PASS for initial and sustained-performance decisions.

Run: npm run build

Expected: PASS.

- [ ] **Step 6: Commit runtime adaptation**

~~~bash
git add src/hooks/useAdaptiveQuality.ts src/scene/NatureScene.tsx src/App.tsx tests/components/useAdaptiveQuality.test.tsx
git commit -m "feat: adapt meadow quality at runtime"
~~~

### Task 9: Optional procedural ambience and robust fallback

**Files:**
- Create: src/audio/ambientAudio.ts
- Create: src/components/SoundToggle.tsx
- Create: tests/components/SoundToggle.test.tsx
- Modify: src/App.tsx
- Modify: src/components/StaticFallback.tsx

**Interfaces:**
- Produces: createAmbientAudio(): AmbientAudioController
- Produces: AmbientAudioController.start(), setNature(snapshot), suspend(), resume(), dispose()
- Produces: SoundToggle(props: { enabled: boolean; onChange(enabled: boolean): void })
- Modifies: NatureScene props to include onNatureSample?: (snapshot: NatureSnapshot) => void
- Consumes: NatureSnapshot and page visibility

- [ ] **Step 1: Write failing sound-control tests**

~~~tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SoundToggle } from '../../src/components/SoundToggle'

describe('SoundToggle', () => {
  it('starts muted and exposes its state accessibly', () => {
    render(<SoundToggle enabled={false} onChange={() => undefined} />)
    expect(screen.getByRole('button', { name: /zapnout zvuk/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('requests sound after a visitor gesture', () => {
    const onChange = vi.fn()
    render(<SoundToggle enabled={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})
~~~

- [ ] **Step 2: Verify sound tests fail**

Run: npm test -- tests/components/SoundToggle.test.tsx

Expected: FAIL because SoundToggle does not exist.

- [ ] **Step 3: Implement the control and procedural audio**

SoundToggle is a labelled button with aria-pressed and text "Zapnout zvuk" or "Vypnout zvuk". createAmbientAudio creates AudioContext only inside start(), routes white noise through a low-pass filter and slow gain modulation for wind, and schedules sparse filtered oscillator chirps during daylight or softer high-frequency insect pulses at night. setNature adjusts filter frequency and gain from windStrength, dayPhase, and seasonIndex. dispose stops nodes, clears schedulers, and closes the context. If AudioContext creation or resume rejects, return a silent controller and keep the visual experience running.

- [ ] **Step 4: Connect sound, persistence, and visibility**

App defaults sound to false even if localStorage contains an older value. After an explicit visitor click, store the chosen state under living-meadow:sound, create or resume the controller, and update it from the NatureScene clock through an onNatureSample callback limited to four calls per second. Suspend on hidden pages and resume only when sound is enabled.

- [ ] **Step 5: Add a WebGL capability boundary**

Before rendering Canvas, test for webgl2 then webgl context availability on a temporary canvas. Wrap the canvas in a React error boundary. Both an unavailable context and a caught render error display StaticFallback with fallback-meadow.svg and the message "Tvoje zařízení tuto 3D scénu nezvládlo, ale louka může zůstat s tebou."

- [ ] **Step 6: Run component tests and production build**

Run: npm test -- tests/components/SoundToggle.test.tsx tests/components/App.test.tsx

Expected: PASS for muted state, gesture activation, shell, and fallback.

Run: npm run build

Expected: PASS.

- [ ] **Step 7: Commit audio and fallback**

~~~bash
git add src/audio/ambientAudio.ts src/components/SoundToggle.tsx src/components/StaticFallback.tsx src/App.tsx tests/components/SoundToggle.test.tsx tests/components/App.test.tsx
git commit -m "feat: add optional ambience and fallback"
~~~

### Task 10: Browser verification, polish, and delivery

**Files:**
- Create: playwright.config.ts
- Create: tests/e2e/meadow.spec.ts
- Modify: src/styles.css
- Modify: index.html
- Create: README.md

**Interfaces:**
- Consumes: completed application
- Produces: repeatable browser smoke tests and operating documentation

- [ ] **Step 1: Write the browser smoke test**

Create Playwright configuration with webServer.command = 'npm run dev -- --host 127.0.0.1', webServer.url = 'http://127.0.0.1:5173', reuseExistingServer = true, and one Chromium desktop project.

Create tests/e2e/meadow.spec.ts:

~~~ts
import { expect, test } from '@playwright/test'

test('loads the meadow without page errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('main', { name: 'Živá louka' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zapnout zvuk' })).toBeVisible()
  await page.waitForTimeout(2000)
  expect(errors).toEqual([])
})

test('respects reduced motion and remains usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('main', { name: 'Živá louka' })).toBeVisible()
  await page.getByRole('button', { name: 'Zapnout zvuk' }).focus()
  await expect(page.getByRole('button', { name: 'Zapnout zvuk' })).toBeFocused()
})
~~~

- [ ] **Step 2: Install the browser and run the failing smoke test**

Run: npx playwright install chromium

Expected: Chromium installs successfully.

Run: npm run test:e2e

Expected: the first run identifies any remaining canvas, accessibility, or runtime integration issue.

- [ ] **Step 3: Fix only observed browser failures and finish presentation**

For each observed failure, add a focused regression assertion to meadow.spec.ts before changing source. Finish CSS with a subtle loading fade, a high-contrast keyboard focus ring, a translucent sound button placed clear of the main horizon, safe-area insets, and a no-animation reduced-motion block. Add Czech title, description, theme-color, and color-scheme metadata to index.html.

- [ ] **Step 4: Document commands and controls**

README.md must state:

- npm install installs dependencies;
- npm run dev starts the local experience;
- npm test runs unit/component tests;
- npm run test:e2e runs Chromium smoke tests;
- npm run build verifies and produces dist;
- the scene is passive, sound starts muted, and quality adapts automatically;
- reduced-motion changes camera and particles but not access to the day/season cycle.

- [ ] **Step 5: Run the complete verification suite**

Run: npm test

Expected: all unit and component tests pass.

Run: npm run lint

Expected: TypeScript exits successfully with no diagnostics.

Run: npm run build

Expected: production build succeeds.

Run: npm run test:e2e

Expected: both Chromium tests pass with no page errors.

- [ ] **Step 6: Perform visual and performance checks**

Run: npm run dev

Inspect at 1440×900 and 390×844. Use browser performance tooling for at least 30 seconds on high and low tiers. Confirm no obvious transition jumps, grass roots remain fixed, horizon fog hides the grass boundary, tab switching does not fast-forward, reduced motion is visibly calmer, sound never starts before a gesture, and sustained frame pacing matches the active 60/30 FPS target.

- [ ] **Step 7: Commit delivery polish**

~~~bash
git add playwright.config.ts tests/e2e/meadow.spec.ts src/styles.css index.html README.md
git commit -m "test: verify and document living meadow"
~~~

## Final Acceptance

- [ ] Every acceptance criterion in docs/superpowers/specs/2026-08-02-living-meadow-design.md is represented by a passing automated check or a named manual check above.
- [ ] git status --short contains no task-created uncommitted files.
- [ ] npm test, npm run lint, npm run build, and npm run test:e2e all exit successfully.
- [ ] The app opens directly into the meadow, remains passive, and preserves graceful fallback behavior.
