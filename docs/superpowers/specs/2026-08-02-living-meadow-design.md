# Living Meadow — Design Specification

## Goal

Create a full-screen, passive 3D nature experience centered on a realistic meadow. The scene should feel alive without behaving like a game: grass moves in varied wind waves, the camera drifts slowly, daylight changes continuously, and the landscape transitions gradually through all four seasons.

The first release targets desktop browsers and prioritizes visual fidelity. It must remain usable on weaker devices through automatic quality scaling and provide a static fallback when WebGL is unavailable.

## Experience

The visitor enters directly into the scene with no landing-page chrome. A low, cinematic camera sits among the grass and moves subtly enough to create depth without demanding input. Cursor movement may add restrained parallax, but the visitor cannot freely navigate.

Time advances automatically through dawn, day, sunset, night, and back to dawn. Seasons advance on a slower independent clock. Every visible property blends continuously; there are no abrupt swaps between sky states, vegetation colors, or weather presets.

Audio is an optional enhancement. Ambient wind, grass, birds, and nighttime insects remain muted until the visitor enables sound, in line with browser autoplay restrictions.

## Visual Direction

- The foreground is dense, varied grass with small differences in height, lean, hue, and stiffness.
- The middle distance becomes progressively less detailed and blends into atmospheric haze.
- The horizon stays simple so grass, light, and sky remain the focus.
- Lighting is natural rather than stylized: warm low-angle light at dawn and sunset, cooler moonlight at night, and season-dependent color temperature.
- Pollen and small airborne particles appear sparingly in suitable daylight.
- Rain, mist, frost, and snow support the seasonal state without turning the experience into a weather simulator.

## Technical Approach

Use React with Vite for the application shell and React Three Fiber on top of Three.js for rendering. The page contains one full-viewport canvas and a minimal HTML overlay for loading, sound control, accessibility messaging, and the static fallback.

Grass uses instanced blade geometry so the scene can draw many blades with few draw calls. A custom vertex shader computes bending from layered wind fields, per-blade stiffness, and a spring-like return motion. The fragment shader varies blade color and responds to the shared lighting and seasonal state.

The implementation uses WebGL rather than making WebGPU mandatory. This preserves broad browser support while keeping the expensive grass deformation on the GPU.

## Components and Boundaries

### Application shell

Owns the canvas, loading state, sound control, fallback presentation, and page-level accessibility behavior. It does not contain rendering math.

### Nature clock

Produces normalized, continuous values for time of day, seasonal progress, weather intensity, and wind intensity. All visual systems read the same state so their transitions stay synchronized. The clock uses elapsed time rather than accumulating frame-by-frame deltas, preventing visible jumps after a suspended tab resumes.

### Meadow

Creates terrain and grass instances, assigns deterministic variation, and sends time, wind, and seasonal values to the grass shader. Blade density and shadow participation are quality-level inputs rather than hard-coded values.

### Wind field

Combines a broad directional flow, slower traveling gusts, and small local turbulence. It exposes compact shader parameters rather than simulating each blade on the CPU. This creates waves across the meadow while keeping performance predictable.

### Atmosphere

Controls sky color, sun, moon, stars, fog, and scene illumination from the nature clock. Sun and moon positions follow the daily phase. Stars fade by brightness rather than switching on or off.

### Seasonal appearance

Maps seasonal progress to grass color, dryness, ground tint, frost or snow coverage, atmospheric haze, and relevant particles. Adjacent season profiles are blended continuously.

### Weather and particles

Renders restrained rain, snow, mist, and pollen based on seasonal eligibility and weather intensity. Weather is decorative and deterministic enough to avoid distracting rapid changes.

### Camera rig

Provides a low cinematic composition, slow authored drift, subtle breathing motion, and limited pointer parallax. Pointer influence is clamped and reduced when the visitor requests reduced motion.

### Quality controller

Chooses an initial quality tier from device capability and pixel ratio, then samples sustained frame rate. It may reduce grass density, shadow quality, particle count, render scale, and post-processing. Changes happen conservatively to avoid oscillation.

## Data Flow

The render loop samples elapsed time and updates the nature clock. The clock publishes the daily phase, seasonal phase, and weather/wind values. The meadow, atmosphere, particles, lighting, and audio each derive their local presentation from those shared values. The quality controller independently adjusts rendering budgets but never changes the logical time or composition.

No server or persistent user account is required. A local preference may remember whether sound was enabled and an optional quality override.

## Performance Strategy

- Use instancing and shader deformation for grass.
- Reuse geometries, materials, and typed buffers.
- Limit real-time shadows to the elements that materially improve depth.
- Use distance-based detail reduction and atmospheric fog to hide the transition.
- Cap device pixel ratio and render scale according to the active quality tier.
- Pause expensive animation and audio while the document is hidden.
- Avoid per-frame React state updates; animated values stay inside the render loop and shader uniforms.

The target is a stable 60 frames per second on a modern desktop at the default quality tier. The controller may target 30 frames per second on weaker hardware rather than allowing unstable frame pacing.

## Accessibility and Fallbacks

The experience respects `prefers-reduced-motion` by reducing camera drift, pointer parallax, rapid particles, and the apparent speed of environmental change. Sound starts muted and has a keyboard-accessible control with a visible label.

If WebGL initialization fails, the application displays a polished static meadow image with a short compatibility message. Loading failures show the same fallback rather than an empty canvas.

## Error Handling

- Catch canvas initialization failures at the application boundary.
- Treat optional texture or audio failures as non-fatal and continue with procedural or silent alternatives.
- Clamp large elapsed-time changes after tab suspension so visual transitions resume smoothly.
- Fall back to a lower quality tier if the renderer reports resource pressure or sustained low performance.

## Verification

Automated tests cover nature-clock interpolation, season wrapping, quality-tier decisions, reduced-motion behavior, and visibility pause/resume logic. Component tests verify loading, fallback, and accessible sound controls.

Browser-level checks verify that the scene loads, remains responsive, and survives context or asset failure. Visual snapshots cover dawn, noon, sunset, night, and each seasonal midpoint. Manual performance checks cover a modern desktop, a weaker integrated GPU profile, multiple viewport sizes, and background-tab restoration.

## First-Release Scope

Included:

- Full-screen meadow and simple terrain
- Realistic instanced grass with layered GPU wind
- Cinematic passive camera and restrained cursor parallax
- Procedural day/night lighting and sky
- Sun, moon, stars, fog, and atmospheric color
- Continuous spring, summer, autumn, and winter transitions
- Season-aware pollen, rain, mist, frost, and snow
- Optional ambient sound
- Automatic quality scaling, reduced-motion support, and static fallback

Not included:

- Free movement or game controls
- Characters, animals, buildings, or interactive objectives
- Server-side persistence or accounts
- Scientific fluid simulation for wind
- Mandatory WebGPU features

## Acceptance Criteria

1. Opening the page enters the meadow directly and fills the viewport.
2. Grass shows spatially varied gusts and returns naturally instead of repeating one uniform sway.
3. Day, night, and seasonal states blend without visible jumps or asset swaps.
4. Camera motion stays calm, passive, and subordinate to the landscape.
5. The scene adapts rendering cost when sustained performance falls below its target.
6. Reduced-motion and muted-by-default audio behavior work without preventing access to the full visual scene.
7. Missing WebGL or optional assets produce a deliberate fallback rather than a broken or blank page.
