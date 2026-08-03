# Meadow Composition and Celestial Polish Design

**Date:** 2026-08-03

**Status:** Approved in conversation; awaiting written-spec review

**Scope:** Incremental refinement of the existing living meadow

## 1. Objective

Bring the composition and motion closer to the supplied “Swaying grass” Steam background while preserving the existing passive, fixed-camera experience. The meadow must fill the lower 55% of the image without exposing terrain, foreground grass must visibly participate in the shared wind field, sunsets must illuminate the atmosphere rather than only recolor the solar disc, and moonlit nights must remain dark but readable.

The work extends the completed realism upgrade. It does not replace the transition, weather, celestial-arc, adaptive-quality, audio, or settings systems.

## 2. Current Problems

The fixed camera currently sits at `(0, 1.08, 5.4)` and looks toward `(0, 0.78, -5)`. Foreground blades can begin only 0.4 m in front of it. The camera-clearance function then reduces nearby blade height to 15% and reduces lean and wind to zero. This creates two connected defects:

1. the camera appears to look down onto a thin or cleared patch where terrain can become visible;
2. distant grass carries the wind wave while the nearest grass appears almost still.

The sun and moon already follow camera-safe left-to-right arcs and are correctly occluded by grass, but their discs and lighting remain visually simple. Sunset color is concentrated around the disc, and the clear-night illumination floor is too low for the grass to remain comfortably readable.

## 3. Goals

- Keep the visible grass horizon between 43% and 47% of viewport height on supported desktop and mobile aspect ratios.
- Fill the lower 55% of the frame with overlapping grass silhouettes; terrain must not become visible in calm, reduced-motion, or maximum-storm bend states.
- Keep the camera fixed and non-interactive.
- Make foreground tip motion at least as perceptually legible as middle-layer motion while keeping roots stable.
- Preserve one coherent wind field across foreground, middle, horizon, rain, snow, and pollen.
- Add subtle spatial clusters of grass width, height, hue, dryness, and species silhouette without creating obvious patches or atlas repetition.
- Improve cloud depth with lightweight layered shading rather than volumetric ray marching.
- Make sunrise and sunset affect horizon haze, clouds, grass tips, and ambient light.
- Give the sun a height-dependent disc and halo treatment.
- Give the moon a readable surface, soft limb, atmospheric halo, and scene-wide cool illumination.
- Keep nights clearly nocturnal without crushed-black sky or grass.
- Preserve adaptive quality, WebGL fallback, reduced motion, direct three-second transitions, and mobile settings usability.

## 4. Non-goals

- Free camera movement, mouse parallax, camera bob, or gameplay.
- Full volumetric cloud ray marching.
- Screen-space ambient occlusion, depth of field, motion blur, lens dirt, or strong vignette.
- Physically exact lunar phases, astronomical coordinates, or geographic sun paths.
- Per-blade rigid-body simulation.
- Runtime downloads of textures or weather data.

## 5. Composition and Terrain Coverage

### 5.1 Camera framing

`FixedCamera` remains the single owner of camera placement. Its height and look target will be lowered together and tuned against rendered output rather than chosen only from world-space intuition. The invariant is a grass horizon at 43–47% of image height, leaving approximately 45% open sky and 55% meadow like the supplied reference.

The same invariant applies at the supported desktop landscape and mobile portrait viewports. Responsive framing may adjust the look target slightly by aspect ratio, but it must not create camera motion or change while a viewport remains stable.

### 5.2 Near-field layout

The foreground band will no longer place roots almost inside the camera. Its nearest roots begin approximately 0.7–1.0 m in front of the near clipping region. A dedicated near-coverage distribution overlaps the existing foreground band so that tall and medium blades cross in screen space and hide the terrain even when the wind opens temporary gaps.

This is still real instanced grass using the shared material and wind field, not an opaque foreground billboard. The distribution remains deterministic and seeded. Density increases near the lower screen edge, while width and height remain varied enough to avoid a solid wall.

### 5.3 Camera clearance

Camera clearance changes from a near-field suppression effect to a collision-safety effect:

- blade height retains at least 70% of its authored value;
- wind response retains at least 70% of the layer response;
- rest lean retains at least 60% of its authored value;
- only extreme camera-facing lateral displacement is reduced;
- roots remain outside the camera near plane.

The clearance curve must remain smooth so no circular boundary is visible around the camera.

### 5.4 Coverage guarantee

Coverage comes from overlapping depth bands, not from painting the terrain green. The terrain material remains as a fallback beneath the field, but no connected terrain-colored area may be visible in the lower 55% of the final frame during the acceptance states.

## 6. Foreground Wind and Grass Variation

### 6.1 Coherent motion

Every grass layer continues to consume the same wind direction, strength, broad wave, and traveling gust front. Layer profiles may change stiffness and recovery, but must not change the spatial phase into unrelated motion.

Foreground blades remain somewhat stiffer because they are wider and more legible. Their greater world-space height must nevertheless produce visible screen-space tip travel. At equal wind strength, median foreground tip travel should be at least 90% of median middle-layer tip travel after projection, while root travel remains visually negligible.

Reduced-motion mode lowers global bend and flutter consistently. It must not selectively freeze the foreground.

### 6.2 Curvature

The root-locked curvature model remains. Bend influence begins through the lower third, rises smoothly toward the tip, and stays inside the existing calm/storm angular limits. The refinement changes near-camera attenuation and layer recovery timing; it does not reintroduce scale-multiplied translation.

### 6.3 Structured variation

Grass variation will use low-frequency spatial fields sampled from root position. Nearby blades receive correlated but not identical changes to:

- base/tip hue and value;
- width and height;
- stiffness and dryness;
- one of a small set of restrained blade silhouettes.

Per-instance noise remains as a secondary detail. Spatial fields must blend continuously and remain subordinate to season colors. Atlas selection remains foreground-only and deterministic.

## 7. Clouds and Aerial Perspective

`CloudLayer` remains a lightweight shader-based system. High quality renders three separated noise layers, medium renders two, and low keeps one simplified layer. The layers use different scales, heights, drift speeds, and parallax so they read as depth rather than one sliding texture.

Cloud lighting uses the shared atmosphere state:

- upper and sun-facing regions receive soft illumination;
- undersides darken with density, rain, and storm strength;
- low-sun light creates restrained warm edging and warm lower-cloud scatter;
- cloud contrast decreases toward the horizon and merges into aerial haze;
- moonlight provides a weak cool edge at night.

No layer may become opaque enough to resemble a ceiling in clear or partly cloudy presets. Storm presets may cover the sky but must retain tonal structure.

## 8. Sun, Sunset, and Twilight

### 8.1 Solar disc

The sun uses a local shader rather than a uniformly colored basic disc. It adds a soft limb, subtle center-to-edge variation, and height-dependent color. Apparent size stays realistic and restrained; the existing arc and grass occlusion remain unchanged.

Near the horizon, atmospheric extinction reduces the hard disc intensity while widening the warm halo. Higher in the sky, the halo narrows and the disc becomes pale yellow-white. Bloom remains luminance-thresholded and must not soften the whole sky.

### 8.2 Scene-wide sunset response

Solar elevation drives a shared scattering term consumed by the sky, fog, clouds, and meadow. During sunrise and sunset it produces:

- orange/red horizon scatter centered around the solar azimuth;
- a cooler upper sky rather than a uniform orange gradient;
- warm cloud undersides and edges;
- directional warm light on exposed grass tips;
- lengthened but bounded atmospheric haze.

After the disc sets, twilight persists as a direct transition between complete atmosphere states. The scene moves through warm dusk into blue hour instead of snapping to the night palette.

## 9. Moon and Readable Night

The moon receives a committed local asset no larger than 512 px containing restrained grayscale albedo and surface variation. Runtime rendering adds a soft limb and a halo whose strength depends on fog and cloud cover. The existing left-to-right night arc and horizon occlusion remain.

Moonlight affects the same shared lighting contract as sunlight:

- the upper sky remains dark blue-gray rather than black;
- horizon haze is slightly brighter than the zenith near the moon;
- grass receives cool hemisphere fill plus directional moon highlights;
- wet tips may reflect a small moon highlight;
- clouds receive weak cool edge light;
- stars remain visible except close to the moon halo or behind cloud cover.

A clear moonlit-night screenshot must retain a dark-night reading while meeting these readability floors after final color management:

- representative open-sky pixels have RGB luminance above 7% of display range;
- representative foreground-grass pixels have RGB luminance above 3% of display range;
- neither the median sky nor median grass luminance may approach daytime values.

Storm nights may be darker between flashes, but controls and major grass silhouettes remain readable.

## 10. Quality and Performance

- **High:** full foreground atlas, structured spatial variation, three cloud layers, detailed sun/moon shaders, full moon surface, current restrained postprocessing.
- **Medium:** foreground atlas, reduced spatial samples, two cloud layers, simplified celestial surface sampling, lower-resolution bloom.
- **Low:** procedural grass, coverage-preserving lower blade budget, one cloud layer, analytic sun/moon shading, no postprocessing composer.

Quality changes may reduce detail, samples, and cloud layers. They may not change the horizon, expose terrain, freeze foreground wind, remove celestial occlusion, or make the clear night black.

No new large runtime dependency is introduced. Ordinary frame updates remain allocation-free. Textures and shader materials are created outside frame callbacks and disposed on replacement or unmount.

## 11. Architecture and Data Flow

`core/grassLayout` owns deterministic near-field bands, spatial variation fields, clearance response, and layer motion parameters. Pure helpers expose coverage bands, projected motion inputs, and quality-dependent budgets for unit tests.

`FixedCamera` owns the aspect-aware fixed framing. It publishes no animation state.

`core/atmosphere` extends its blended output with solar elevation/scatter, twilight, lunar ambient floor, and cloud-light terms. `NatureScene` continues to compute one final blended atmosphere per frame.

`Atmosphere`, `CloudLayer`, `CelestialBodies`, and `Meadow` consume that final state through existing refs. No component independently invents a sunset or night palette. This keeps sky, fog, clouds, grass, and visible discs synchronized during manual retargeting.

The existing three-second source/target cross-fade remains the only environment transition mechanism. New light and cloud fields participate in the same blend.

## 12. Failure Handling

- A moon texture load failure falls back to the analytic disc shader without breaking the scene.
- Cloud shader or postprocessing construction failure retains the existing direct-render fallback.
- Low quality and WebGL fallback remain usable without the new detail paths.
- Invalid or unavailable GPU capabilities select a cheaper quality path; they do not alter persisted environment settings.
- Development-only visual probes must be removed from production output by build-time dead-code elimination.

## 13. Testing and Acceptance

### 13.1 Unit tests

- Camera framing helpers keep the horizon within 43–47% at supported aspect ratios.
- Near-band roots stay outside the near plane and preserve deterministic coverage distributions.
- Clearance response respects the 70% height/wind and 60% lean floors.
- Projected foreground tip travel is at least 90% of middle-layer travel for representative wind states.
- Spatial variation is deterministic, bounded, locally correlated, and season-compatible.
- Sunset, twilight, and moonlight atmosphere values remain continuous through source/target blends.
- Quality profiles preserve coverage and lighting semantics while reducing cost.
- Moon-asset failure selects the analytic fallback and disposes partial resources.

### 13.2 Browser and visual tests

Capture desktop landscape and mobile portrait states for:

1. calm daylight;
2. strong wind;
3. maximum storm bend;
4. sunrise;
5. right-horizon sunset;
6. post-sunset twilight;
7. clear moonlit night;
8. cloudy moonlit night;
9. rain with wet highlights;
10. reduced motion and low quality.

The tests and visual review must confirm:

- the horizon stays within the approved band;
- the lower 55% has no connected visible terrain patch;
- foreground tips move clearly with the same wind front as the middle field;
- roots do not slide;
- sun and moon remain behind grass at the horizon;
- sunset warms the atmosphere, clouds, and grass consistently;
- moonlit grass remains readable without looking like daytime;
- no new page, shader, WebGL, or console errors occur;
- settings remain usable at minimum supported viewport sizes.

## 14. Delivery

The implementation will be split into independently testable steps: framing and coverage, foreground wind response, structured grass variation, shared atmosphere fields, cloud lighting, solar rendering, lunar rendering, and final cross-quality visual acceptance. The final verified page remains open in Auto mode with settings closed.
