# Meadow Realism Upgrade Design

**Date:** 2026-08-03

**Status:** Approved in conversation; awaiting written-spec review

**Scope:** Incremental upgrade of the existing living meadow

## 1. Objective

Increase the visual and physical credibility of the existing 3D meadow without changing its passive-wallpaper character or sacrificing the fixed low-camera composition. The upgrade focuses on three visible weaknesses:

1. foreground blades currently deform more dramatically than distant blades;
2. manual environment changes resemble a sped-up clock;
3. the sun and moon follow a mostly vertical world-space path and can appear in front of the grass.

The same release also adds a restrained realism pass: hybrid foreground blade textures, better transmitted light and contact shading, atmospheric perspective, selective bloom, explicit filmic tonemapping, and a nearly invisible vignette.

The supplied “Swaying grass” image remains the composition reference: a low fixed viewpoint, a dense field that fully hides the terrain, a calm open sky, and a simple horizon. The result should remain an experience rather than become a conventional application or game.

## 2. Goals

- Make foreground, middle, and horizon grass feel like the same field at different distances.
- Keep blade roots stable while allowing believable tip movement and traveling wind fronts.
- Replace accelerated-clock manual changes with a three-second transition between complete environment states.
- Move the sun and moon along a wide, camera-relative left-to-right arc.
- Ensure celestial bodies rise from behind the meadow and remain behind grass, clouds, and horizon haze.
- Improve close grass with a lightweight hybrid texture treatment while avoiding shimmering in distant layers.
- Add restrained postprocessing that improves light response without making the scene look stylized or game-like.
- Preserve adaptive quality, reduced-motion support, current controls, sound, WebGL fallback, and mobile usability.
- Keep frame-level work allocation-free and avoid adding a large postprocessing runtime dependency.

## 3. Non-goals

- Physically exact fluid simulation or per-blade rigid-body physics.
- Photogrammetry, scanned terrain, or full photographic billboards across the entire meadow.
- Screen-space ambient occlusion on every blade.
- Depth of field, motion blur, chromatic aberration, lens dirt, or conspicuous cinematic effects.
- New advanced graphics controls in the settings panel.
- Camera movement, free navigation, interaction with individual blades, or gameplay.
- A real astronomical ephemeris tied to geographic location.

## 4. Foreground Grass Physics

### 4.1 Layer-specific distributions

The three existing grass layers remain, but each layer receives a deliberate deformation profile rather than sharing the same random lean and stiffness ranges.

- **Foreground:** height scale `0.85–1.55`, lean `-0.12–0.12`, and stiffness `0.45–0.92`.
- **Middle:** height scale `0.68–1.30`, lean `-0.16–0.16`, and stiffness `0.32–0.88`.
- **Horizon:** height scale `0.48–0.90`, lean `-0.14–0.14`, and stiffness `0.38–0.92`.

Within each layer, stiffness is positively correlated with blade height. A long foreground blade therefore moves farther in world space because it is tall, but it does not bend through a larger angle simply because its scale is larger.

The current near-camera clearance rule must affect lean and wind deformation as well as visible height. Blades shortened close to the camera must not retain full-strength lateral movement.

### 4.2 Root lock and curvature

The shader will replace direct scale-multiplied lateral displacement with a bounded curvature model:

- the bottom 35–40% of each blade remains visually anchored;
- bend influence rises smoothly through the upper blade;
- calm-weather bend angle is capped near 18 degrees;
- storm bend angle is capped near 32 degrees;
- scale has only a weak effect on bend angle;
- initial lean is applied as a small rest curvature, not as a full-blade translation.

The existing broad wave, gust front, and cross-wave remain, but become inputs to a target bend angle. Stiffness controls both amplitude and recovery delay. Per-instance phase adds small timing variation without making neighboring blades move independently of the shared wind field.

### 4.3 Wind behavior

Wind continues to come from the shared weather state. Its visible motion consists of:

1. a slow low-frequency directional field across the whole meadow;
2. spatial gust fronts with a soft leading edge, peak, and slower recovery tail;
3. a low-amplitude local flutter limited mainly to blade tips.

Rain, snow, pollen, and grass continue to consume the same wind direction and strength. Reduced-motion mode lowers gust speed, maximum bend, and local flutter, but does not freeze the field.

## 5. Hybrid Blade Materials

### 5.1 Foreground atlas

Only the foreground layer uses detailed raster blade assets. The committed assets consist of two matching atlases with eight cells:

- a color/opacity atlas containing subtle blade color, irregular edges, tips, and fine veins;
- a packed surface atlas containing roughness, thickness/transmission, and vein modulation channels.

The atlas should be no larger than 1024 px on its longest side. Its variation must remain understated so repeated cells do not create a patchwork appearance. Instance selection is deterministic and seeded.

The middle and horizon layers retain low-frequency procedural color and simple silhouettes. This prevents alpha-cutout shimmer and excessive texture sampling in the distance.

### 5.2 Surface response

The grass shader combines the atlas with the existing seasonal palette rather than replacing seasonal color. It adds:

- darker, rough lower blades;
- subtle vein and edge variation in the foreground;
- thickness-based transmitted sunlight when backlit;
- darker wet grass with controlled high-angle highlights;
- frost and snow accumulation at tips and exposed edges;
- a density/root contact term that darkens the lower field.

The contact term is an authored grass-specific approximation, not SSAO. It is based on blade height, layer density, view depth, and distance from the terrain. It must not produce dark outlines around individual alpha edges.

## 6. Manual Environment Transitions

### 6.1 Separate transition state

Automatic time continues at its normal rate throughout manual mode. A manual selection creates a transition object with:

- the currently displayed source environment;
- the requested target environment;
- elapsed transition time;
- a fixed `3.0` second duration;
- celestial choreography metadata.

The rendered scene interpolates source and target environment properties with an ease-in/ease-out curve. It does not repeatedly sample intermediate clock times. Consequently, light, sky colors, fog, season appearance, wetness, snow, clouds, audio, and weather particles cross-fade directly between two complete states.

If the visitor changes a setting during an active transition, the currently displayed blended state becomes the next source. There is no snap back to the original source.

Returning to Auto uses the same transition system. The target is the latest continuously running automatic state, so the handoff has no discontinuity.

### 6.2 Weather particles and audio

Lighting, clouds, fog, wind, surface response, particles, and ambient audio share the same normalized transition progress. Mutually exclusive particle systems may overlap during the cross-fade, but their combined opacity and spawn budget must remain bounded.

## 7. Sun and Moon Choreography

### 7.1 Camera-relative arc

Celestial screen placement is derived from normalized daylight progress rather than the existing mostly vertical world direction.

- Sunrise begins at the left horizon.
- Noon reaches the upper central region without requiring the disc to pass directly overhead.
- Sunset ends at the right horizon.
- The moon follows the complementary nighttime arc from left to right.

The arc is evaluated relative to the active camera using right, up, and forward vectors. Horizontal position travels from `-0.9` to `0.9` of the safe visible width. Vertical position uses a sine arc from the horizon to a responsive peak. The peak is lower on viewports with an aspect ratio below `1.0` so the body remains visible for a meaningful portion of its cycle.

Lighting direction and visible disc placement remain derived from the same celestial state, but they are represented separately: the directional light may approximate a distant astronomical direction while the disc uses a composition-safe camera-relative projection.

### 7.2 Occlusion and atmosphere

Celestial discs render after the sky and before clouds and foreground geometry. They use depth testing with depth writing disabled. Grass and terrain therefore occlude the discs, while cloud opacity and horizon haze attenuate them.

At the horizon:

- only the upper portion of the disc appears first;
- halo strength grows before the full disc clears the meadow;
- warm scattering increases for the sun;
- apparent vertical scale may compress by at most 8% to suggest atmospheric refraction;
- the disc never renders over grass silhouettes.

### 7.3 Transition choreography

For a manual time change of at most one quarter of a day (six hours), the active body moves along the shortest valid section of its arc during the `3.0` second transition.

For a larger change or a day/night boundary:

1. the current body eases toward its nearest horizon and fades into haze;
2. the incoming body begins at the opposite horizon;
3. the incoming body rises while its visibility and halo cross-fade in;
4. environment lighting independently interpolates source-to-target instead of following every intermediate celestial position.

This preserves spatial logic without showing the sun or moon racing through an entire day.

Reduced-motion mode shortens visible travel and relies more heavily on opacity and atmospheric blending.

## 8. Atmosphere and Postprocessing

### 8.1 Lighting and aerial perspective

The shared atmosphere state continues to own sky, fog, sun, moon, and hemisphere lighting. It is extended so the grass shader receives:

- hemisphere sky and ground colors;
- hemisphere intensity;
- sun and moon color, direction, and intensity;
- storm-flash contribution;
- fog color and density.

This closes the current mismatch during lightning and ground bounce. Horizon fog gains a modest height-sensitive component so distant grass merges into the atmosphere before the foreground does.

### 8.2 Postprocessing stack

The project uses Three.js addon passes or focused local passes rather than adding a large runtime package.

1. Render the scene normally with explicit ACES filmic tonemapping.
2. Apply luminance-threshold bloom. Only emissive values assigned to the sun, moon halo, fireflies, wet highlights, and lightning exceed the threshold.
3. Apply a small color-grade/vignette pass.

Bloom must remain restrained: it supports bright sources but never softens the whole sky or turns grass edges into glowing outlines. Vignette strength stays low enough that it is mainly visible in direct before/after comparison.

The stack intentionally excludes SSAO, depth of field, motion blur, chromatic aberration, and lens dirt.

### 8.3 Quality tiers

- **High:** foreground atlases, full transmission, luminance bloom, color grade, vignette, current high shadow budget, and full atmospheric detail.
- **Medium:** foreground atlases, simplified transmission, lower-resolution bloom, color grade, vignette, and current medium shadow budget.
- **Low:** simplified procedural material, no postprocessing composer, no texture transmission, no shadows, but identical composition, transition semantics, celestial arc, terrain coverage, and recognizable weather.

Quality changes may alter sampling cost and detail but must not move the horizon or expose terrain.

## 9. Architecture and Data Flow

### 9.1 Pure state modules

`core/simulation` owns source/target transition snapshots, progress, retargeting, and Auto handoff. It exposes pure functions for transition creation and stepping.

`core/celestial` owns camera-independent arc progress, horizon choice, day/night swap choreography, visibility, and refractive scale. Camera projection remains in the scene layer.

`core/grassLayout` owns layer-specific scale, lean, stiffness, atlas cell, and deterministic variation. Pure helpers define maximum bend and root influence so they can be unit-tested independently of WebGL.

### 9.2 Scene components

`NatureScene` remains composition glue. It steps the automatic clock, transition state, season appearance, atmosphere, and weather once per frame, then updates shared refs.

`CelestialBodies` projects the pure celestial state into the active camera basis and owns disc/halo meshes. `Atmosphere` owns sky, clouds, fog, and lights. `Meadow` owns grass geometry/materials and reads the same final atmosphere and weather refs. A focused postprocessing component owns the composer and recreates render targets only when viewport or quality changes.

No component allocates arrays, colors, vectors, materials, geometries, or render targets during ordinary frame updates.

## 10. Assets and Failure Handling

Grass atlas assets are local, versioned, and loaded through the application bundle. Until an atlas finishes loading, the foreground uses the existing procedural shading. A missing or failed texture must not prevent the scene from rendering.

If postprocessing initialization fails, the renderer falls back to the direct scene output. Existing WebGL and audio error boundaries remain unchanged. Controls remain functional even if optional visual layers fail.

## 11. Testing and Verification

### 11.1 Unit tests

- Foreground height correlates with stiffness and stays within approved ranges.
- Root influence remains near zero through the lower blade.
- Calm and storm bend angles remain capped.
- Near-camera clearance reduces height, lean, and wind deformation together.
- A manual transition reaches its target in three seconds without advancing the automatic clock faster.
- Retargeting starts from the current displayed blend.
- Returning to Auto targets the latest automatic snapshot.
- Small time changes select a short same-body arc.
- Large and day/night changes select horizon-swap choreography.
- Sunrise maps left, noon maps near the central peak, and sunset maps right.
- Reduced-motion choreography reduces travel.
- Quality profiles enable only their intended material and postprocessing features.

### 11.2 Browser and visual tests

- No page, WebGL, or console errors on initial load, reload, settings interaction, and quality fallback.
- Manual time, season, and weather changes complete without an accelerated clock.
- The sun and moon remain behind foreground grass and clouds.
- Desktop and mobile screenshots cover sunrise, daylight, sunset, moonlit night, rain, storm flash, and snow.
- Foreground grass does not show greater angular deformation than middle grass under the same wind.
- Terrain stays hidden at all tested viewports.
- Bloom does not affect ordinary grass or daytime sky values.
- Reduced-motion mode preserves controls and atmosphere while reducing rapid celestial and gust movement.

### 11.3 Performance checks

- No per-frame JavaScript allocation is introduced in scene loops.
- High and medium postprocessing render targets resize only on viewport or quality changes.
- Adaptive quality can still step from high to medium to low without remounting the entire application.
- Mobile and low-quality modes retain stable frame pacing and the same fixed composition.

## 12. Acceptance Criteria

1. Foreground blades no longer look rubberier or more angularly deformed than the distant field.
2. Blade roots stay planted and most visible motion occurs in the upper blade.
3. Manual environment changes finish within `2.8–3.2` seconds without speeding up the automatic simulation clock.
4. Small time changes move the active body along a short arc; large day/night changes exchange bodies at opposite horizons.
5. The sun and moon travel from left to right and never draw over grass silhouettes.
6. Sunrise and sunset are visibly integrated with horizon haze and warm scattering.
7. Foreground blade detail improves without introducing obvious atlas repetition or distant shimmer.
8. Grass lighting includes shared hemisphere, celestial, fog, and storm-flash state.
9. Bloom remains limited to intended bright sources, and the vignette is subtle.
10. High, medium, and low tiers preserve composition, hidden terrain, settings behavior, and weather identity.
11. Existing unit, E2E, lint, and production-build checks continue to pass.
12. The final result remains calm, passive, and visually closer to a real field than to an effects-heavy game scene.
