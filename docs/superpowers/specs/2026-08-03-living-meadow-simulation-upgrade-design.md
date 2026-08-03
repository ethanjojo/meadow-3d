# Living Meadow — Simulation Upgrade Design

## Goal

Upgrade the existing full-screen meadow into a calmer, denser, and more physically believable living wallpaper. The result must preserve the passive experience while adding fixed-camera composition, visibly richer grass, synchronized celestial bodies and weather, rare night-sky events, and a compact settings panel with smooth manual overrides.

The supplied “Swaying grass” Steam background is the visual reference for composition and grass density. The implementation must keep the existing procedural day, season, sound, adaptive-quality, reduced-motion, and WebGL fallback foundations.

This document is an incremental replacement for the camera, grass-density, atmosphere, weather, and first-release scope sections of the 2026-08-02 design. Where the two documents differ, this upgrade specification takes precedence.

## Experience Principles

- The meadow is an ambient experience, not a game or a navigable world.
- The camera is completely fixed. Pointer movement and authored camera oscillation are removed.
- The horizon is low and calm, leaving a broad sky while dense grass fills the foreground.
- Environmental changes are continuous. Manual choices and the automatic clock never cause hard cuts.
- Effects remain restrained: a rare shooting star or distant lightning flash should feel discovered rather than scheduled entertainment.
- The settings interface stays hidden until requested and never competes with the scene.

## Visual Composition

The camera sits low among the grass and looks slightly above the horizon. Its position, field of view, and look target remain constant during normal use. The grass line should occupy approximately the lower half of a landscape viewport, with foreground blades reaching higher irregularly. The ground surface must not be visibly exposed in ordinary spring, summer, or autumn views.

Grass is rendered as three coordinated depth layers:

1. A detailed foreground with the widest range of blade height, lean, hue, stiffness, and response delay.
2. A dense middle field with reduced geometry but enough overlap to hide the terrain.
3. A lightweight horizon layer that creates a continuous fine silhouette and prevents visible gaps.

The base color remains natural and season-dependent. Blade tips receive subtle direct light, while lower sections stay darker to preserve depth. Wetness, frost, and snow alter highlights and roughness rather than acting only as color overlays.

The sky remains visually simple. Clouds form slow, broad layers rather than dramatic volumetric towers. Morning mist sits near the horizon, summer fireflies appear sparingly near the grass after dusk, and dew produces brief low-angle highlights after clear nights.

## Grass and Wind Model

Grass continues to use instanced geometry and GPU deformation. Full rigid-body physics for individual blades is explicitly out of scope because it would make performance scale with blade count on the CPU.

Each instance receives deterministic height, width, yaw, lean, stiffness, bend phase, and color variation. The vertex shader combines:

- broad directional flow;
- a low-frequency spatial wind field;
- traveling gust fronts that move across the meadow;
- smaller local turbulence;
- height-weighted bending so roots remain anchored;
- stiffness-weighted response and delayed recovery.

Weather supplies the target mean wind and gust range. Fog is nearly still, fair weather uses gentle waves, rain brings intermittent gusts, and storms produce longer directional fronts. The wind field is shared by grass and weather particles so rain, snow, pollen, and blade motion agree spatially.

The simulation is physically inspired rather than scientifically exact. Its acceptance criterion is coherent visible cause and effect at stable frame pacing.

## Celestial and Atmospheric System

The sun and moon become visible scene objects instead of relying only on directional lights or a shader highlight. Both follow the shared daily phase:

- The sun has a defined disc, soft halo, warm low-elevation color, and stronger white daylight overhead.
- The moon follows the opposite arc, has a cool disc and halo, and contributes restrained directional light at night.
- Each body fades below the horizon without popping.

Stars use varied size and brightness with slow, low-amplitude twinkling. Their opacity responds to daylight, moonlight, cloud cover, and fog. Shooting stars use a small reusable pool and deterministic scheduling. They occur only at night, remain rare, cross a short part of the sky, and leave a brief fading trail.

Atmospheric state owns sky gradient, horizon haze, cloud opacity and speed, fog density and color, exposure, and celestial visibility. All of these derive from the same blended simulation snapshot.

## Weather Model

The selectable weather states are clear, cloudy, fog, rain, storm, and snow. In automatic mode, weather continues to vary procedurally within season-appropriate limits. Manual selection temporarily fixes the target weather until the visitor returns to Auto.

Weather is a coordinated environment state, not merely a particle preset:

- **Clear:** low cloud and fog cover, gentle wind, stronger sun or stars, possible morning dew.
- **Cloudy:** broad cloud layer, lower contrast, softened shadows, moderate wind.
- **Fog:** dense horizon haze, very low wind, muted celestial bodies and stars.
- **Rain:** overcast light, visible precipitation, darker wet grass, periodic gusts.
- **Storm:** heavy cloud cover, stronger gust fronts, rain, rare distant light flashes, no close thunderbolt effect.
- **Snow:** cold diffuse light, snow particles, frost or snow accumulation, season-compatible grass color.

Weather transitions use continuous blending. Particle systems may cross-fade, while lighting, clouds, fog, wetness, snow coverage, and wind interpolate over the same transition window.

## Time, Seasons, and Manual Overrides

The application exposes two modes:

- **Auto:** the existing continuous day, season, and weather simulation advances normally.
- **Manual:** user-selected time, season, and weather become targets for smooth interpolation.

Time is controlled by a continuous dawn-to-night slider. Seasons are spring, summer, autumn, and winter. Weather uses the six named presets. Entering Manual never snaps the scene. Returning to Auto blends from the current visible state to the still-running automatic clock, so the natural cycle does not restart and there is no discontinuity.

Manual overrides affect presentation only. Adaptive quality, visibility pausing, audio lifecycle, and WebGL fallback remain independent.

## Settings Interface

A compact settings button sits in the lower-right control cluster beside the sound control. It uses the existing translucent glass treatment. Activating it opens a small keyboard-accessible panel containing:

- Auto / Manual mode control;
- time-of-day slider with human-readable state text;
- four season choices;
- six weather choices.

The panel closes through the settings button, Escape, or an outside click. On narrow screens it remains inside the safe viewport and avoids covering the central horizon. Control labels remain code-native and readable, with clear focus, selected, hover, and disabled states. In Auto mode, manual controls display the current state but are disabled until Manual is selected.

No wind-strength slider is included. Wind remains an environmental consequence of the chosen weather, preserving coherence and keeping the interface simple.

## Architecture and Boundaries

### Simulation controller

Owns automatic clock sampling, manual targets, transition progress, and the final blended `NatureSnapshot` consumed by the scene. It exposes React state only for low-frequency settings and labels; frame-level interpolation stays in refs and the render loop.

### Scene composition

`NatureScene` remains composition glue. It forwards the shared snapshot to atmosphere, meadow, weather, and audio without duplicating transition logic.

### Meadow renderer

Owns depth-layer grass geometry, deterministic blade variation, terrain occlusion, and shader uniforms. It accepts quality budgets and the shared simulation snapshot.

### Atmosphere renderer

Owns sky, fog, clouds, celestial discs, lights, stars, and shooting stars. It derives every visible value from the shared snapshot and weather blend.

### Weather renderer

Owns pooled precipitation, pollen, snow, fireflies, and low-cost distant storm flashes. Particle direction reads the same wind vector used by grass.

### Settings UI

Owns accessible controls and user intent. It emits typed simulation settings but contains no rendering math.

### Quality controller

Retains the existing adaptive tiers. Each tier defines budgets for grass layers, clouds, stars, shooting-star trails, particles, shadows, and device pixel ratio without changing camera composition or simulation time.

## Data Flow

The automatic clock continuously produces time, season, base weather, and wind. Manual controls produce optional target values. The simulation controller blends these inputs into one stable snapshot. Meadow, atmosphere, weather, and ambient audio consume that snapshot during the render loop. The settings panel receives throttled descriptive values for labels without causing per-frame React renders.

Page visibility pauses expensive visual and audio work. On resume, the automatic clock continues from elapsed time while visual interpolation clamps large frame deltas.

## Performance Strategy

- Preserve instancing and shader deformation for grass.
- Use one material per compatible grass layer and reuse typed buffers.
- Hide terrain through layered density and horizon coverage rather than excessive polygon count everywhere.
- Pool shooting stars and weather particles; never allocate them per frame.
- Use procedural or low-cost shader cloud layers rather than mandatory volumetric ray marching.
- Keep frame-level state out of React renders.
- Scale grass counts, particle counts, shadow resolution, cloud detail, and DPR by the existing quality tier.
- Target stable 60 FPS on a modern desktop and stable 30 FPS on weak integrated hardware.

## Accessibility and Error Handling

The fixed camera removes motion that could cause discomfort. `prefers-reduced-motion` further reduces rapid particle travel, shooting-star frequency, lightning flashes, and fast weather transitions without freezing the living grass completely.

All settings are operable by keyboard, have visible focus, and expose selected states to assistive technology. Sound remains muted by default. Existing WebGL detection, scene error boundary, static fallback, and non-fatal audio behavior remain in place.

Invalid persisted or programmatic settings fall back to Auto. Simulation inputs are clamped before reaching shaders. Optional cloud, particle, or audio failures must leave the core meadow usable.

## Verification

Automated unit tests cover:

- manual-to-auto blending without discontinuities;
- time wrapping and season selection;
- weather preset interpolation and wind ranges;
- deterministic shooting-star scheduling;
- grass layer budgets and deterministic layout;
- reduced-motion and adaptive-quality reductions.

Component tests cover settings visibility, keyboard dismissal, Auto / Manual behavior, disabled controls, accessible names, sound coexistence, and fallback rendering.

Browser validation covers page identity, meaningful canvas and controls, absence of framework overlays and console errors, settings interactions, manual time/season/weather changes, return to Auto, desktop and mobile layout, and reduced-motion behavior. Visual checks compare the implementation against the supplied reference for fixed composition, horizon height, foreground density, hidden terrain, calm sky, and control unobtrusiveness. Separate checks capture daylight, night with moon and stars, rain, and winter snow.

## Scope

Included:

- fixed low camera;
- layered dense grass with spatial wind waves;
- visible sun and moon;
- varied stars and rare shooting stars;
- coordinated clouds, fog, wetness, precipitation, storm flashes, frost, and snow;
- restrained dew and summer fireflies;
- Auto / Manual settings for time, season, and weather;
- smooth override and return transitions;
- adaptive quality, accessibility, audio, and fallback preservation.

Not included:

- free camera movement or navigation;
- per-blade CPU rigid-body simulation;
- mandatory WebGPU or volumetric ray-marched clouds;
- user accounts or server persistence;
- wind-strength, cloud-detail, or graphics-advanced controls;
- animals, buildings, gameplay objectives, or close lightning strikes.

## Acceptance Criteria

1. The camera remains visually fixed and ignores pointer movement.
2. Ordinary non-winter views do not expose the terrain through grass gaps in the main desktop composition.
3. Wind produces traveling spatial waves with visible variation in blade response.
4. Sun and moon are visible, follow the daily arc, and blend across the horizon without popping.
5. Stars react to atmosphere and at least one rare deterministic shooting-star path can be exercised in tests.
6. Each weather preset coherently changes light, atmosphere, wind, surface response, and applicable particles.
7. Manual time, season, and weather controls transition without hard cuts.
8. Returning to Auto rejoins the continuously running natural clock without a visible jump.
9. Settings remain unobtrusive, keyboard-accessible, and usable on narrow mobile viewports.
10. Quality reductions preserve the fixed composition and recognizable weather state.
11. The app retains its working sound control, reduced-motion behavior, visibility pausing, and WebGL fallback.
12. Browser validation shows no relevant console errors or framework error overlay in the tested states.
