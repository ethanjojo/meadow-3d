# Living Meadow

A passive 3D nature experience for the browser. Instanced grass bends through layered GPU wind, daylight flows smoothly into night, and the environment gradually moves through spring, summer, autumn, and winter.

## Run locally

```bash
npm install
npm run dev
```

The local site runs at the address printed by Vite, normally `http://localhost:5173`.

## Verification

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

- `npm test` runs unit and component tests.
- `npm run lint` performs strict TypeScript checking.
- `npm run build` creates the production output in `dist`.
- `npm run test:e2e` verifies Chromium desktop/mobile, Firefox and WebKit.

## Controls and performance

The scene is intentionally passive: the camera moves only subtly and responds to the pointer with light parallax. Sound always starts muted and can be enabled with the button in the lower-right corner.

Grass density, particle counts, resolution, and shadows adapt automatically to device performance. `prefers-reduced-motion` limits camera and particle movement without disabling the day or seasonal cycle. When WebGL is unavailable, the page displays a static fallback meadow.

Wet grass reflections use the light/view half-vector and share cloud attenuation
with the blade lighting. Overhead sunlight therefore retains the grass colour
during rain and storms instead of applying a white highlight to every blade.
Wet reflections use the actual rotated and bent blade surface normals rather than
the upward canopy normal used for diffuse fill. Narrow, bounded dielectric glints
retain the grass colour when low sunlight faces the viewer across a rainy meadow.

Aurora reuses the shared precomputed cloud-noise texture for broad translucent
veils, bending rising plumes, brightness gaps and occasional violet tips.
Each occurrence generates one to three veils with different bends, widths and
heights. Their group can lie on either side, across the centre, upright or slanted;
there are no fixed left/right plumes. A slow lateral drift carries the composition
across the view. Independent travelling
bends twist the upper sheets while their widths and translucent wings gently breathe.
The movement setting controls both drift and deformation; pause and reduced motion freeze them.
Each preview and new visible event selects a fresh composition. Visible changes
morph over a few seconds, including fades for added or removed veils. Ordered
positions, a shared group rotation and bounded independent bends keep creases
apart while allowing their translucent wings to overlap locally.
There is no repeated filament
grid or continuous bright baseline. Sampling is
bounded at 12 texture reads per layer,
without extra assets or ray marching. It uses one sky dome with 1/2/3 layers at
Low/Medium/High quality, drawn behind the cloud dome and foreground scenery.
Automatic displays favour winter (an artistic choice), last 2–4 minutes with
25–30 second event fades, and occur irregularly about every 15 minutes at the
default frequency. Darkness gates visibility, moonlight and fog attenuate it,
and rain/storms suppress it. Sky & weather → Aurora provides Automatic,
Always at night and Off modes, brightness, frequency and movement. Its transient
45-second Preview bypasses rarity/season/off without changing saved preferences;
daylight and weather still apply. Setting changes ease over several seconds,
paused time freezes curtain movement, and reduced motion keeps it static.
Older version-1 presets/exports receive only the missing Aurora defaults;
supplied values and all existing fields remain strictly validated.

## Atmospheric effects

Wildflowers use instanced 3D geometry: curved daisy petals, cupped yellow
buttercups, raised pollen centers, curved stems and folded leaves. Seeded small
clusters vary in height, direction and tilt, with some blooms hidden by grass.
Sparse flower budgets (48/144/240 for low/medium/high) keep grass dominant and
leave open space between clusters.
Advanced settings has six tabs: Sound, Nature, Sky & weather, Farm,
Time & performance and Presets. Header search lists individual settings with their tab/group path; selecting a result
opens the tab and nested groups, scrolls and focuses the control, then highlights it
twice (a static highlight for reduced motion). Arrow keys/Enter navigate results;
Escape dismisses results before the modal. Mobile search expands from a magnifier.
One shared search index uses the same labels as the controls. Expandable groups keep
detailed controls out of the way. Each settings category has its own reset.
Settings apply immediately and persist on this device. The Presets tab holds
all preset and sharing tools: named snapshots capture scene, sound and
environment choices, and JSON export/import transfers them between devices.
Invalid imports leave current settings untouched. Up to twelve named presets
can be stored.

Sound includes group and individual levels, independent previews, per-species
natural/all-day/custom activity, overnight scene-hour windows, random real-second
pause ranges, distance, stereo placement and weather sensitivity. One event-driven
scheduler shares concurrency and minimum-gap limits across farm animals and birds.
Busy playback can postpone a call beyond its nominal pause range. Thunder distance
sets both its volume and its delay, using the same event as visual lightning.

Nature controls flower species (daisies, buttercups and cornflowers), size, density
and motion; grass detail, height and motion; firefly hours, speed and brightness;
wind, gusts and dew. Sky controls clouds, shadows, fog, precipitation, snow buildup
and melting, stars, meteors, lightning, golden hour and moon appearance/phase.
Flower density defaults to 33% and retains a maximum of three times the tier's
sparse budget. System reduced-motion preferences always take priority.

Time controls preserve current phases when changing day/season duration; pausing
freezes scene motion while setting transitions can finish. Device time is available
in automatic mode; Manual time takes priority. Automatic weather can be restricted
to selected profiles. Performance offers automatic/manual quality, actual GPU frame
limits, power saving, bloom and shadows. Power saving uses Low and 30 FPS. Low
quality does not provide bloom or cast shadows.
Farm windows glow in warm amber from about 18:30 to 21:00 in scene time. Each
window has a staggered nine-minute fade, a subdued halo and a soft facade spill,
including on low quality without bloom. Manual time selects the same schedule.
Farm settings can hide the building, override the light schedule (including
overnight hours or always on/off), adjust warmth, brightness and fade duration,
and stagger windows or vary their routine between scene days.
Plant bending and a slight delayed head sway follow the shared wind; thin petals
transmit sunlight. Distant flowers and low quality use simpler geometry with the
same lighting and silhouettes. Snow shrinks the plants with the existing seasonal
transition, and reduced motion limits their sway.

The active scene clock coordinates weather effects and audio. A shared gust
modulates vegetation, rain/snow drift, cloud movement and wind sound. Cloud
shapes use clustered procedural puffs with darker bodies, light-facing edges,
sunset tint and subdued moonlight. The same world-space density field drives
cloud shadows and stellar/meteor occlusion; distant secondary layers add depth.
Cloud lighting blends separate sun and moon contributions smoothly through
twilight, avoiding direction flips or a sudden tint switch. Automatic rain/snow
weather also crossfades across the seasonal boundary; manual changes retain the
shared three-second environment transition.
At noon and midnight, horizontal edge lighting fades to zero as the light
passes overhead, instead of flipping sides at the zenith.
All cloud consumers share one seeded 128×128 RGBA noise data texture, owned by
the scene and disposed on unmount. Nearest sampling, ungraded data and complete
neighbor coverage keep shapes stable across GPU implementations and cell seams.
Shaders use ordered smoothstep bounds and multiplication for signed squares,
avoiding undefined GLSL calculations in clouds, mist, precipitation and meteors.

Cross-browser verification: run `npx playwright install chromium firefox webkit`
then `npm run test:e2e -- tests/e2e/shader-portability.spec.ts`. The test renders
the actual cloud field on the GPU at negative coordinates, texture seams and
both sides of the celestial zenith in
Chromium desktop/mobile, Firefox and WebKit. Local tests use port 5175. Playwright
WebKit is an additional check; actual Safari/macOS hardware still needs verification.
Windows Playwright WebKit does not expose Web Audio in this installation; the
native audio activation test skips only when both AudioContext constructors are
absent. Chromium and Firefox verify activation; Safari audio requires a real
Mac/iPhone check.

Stars have a restrained distribution of brightness, size, temperature and
individual twinkle speeds, fading toward the horizon. Clear nights on medium/high
tiers include a faint sky band. The moon has procedural surface relief and a slow
phase change. The moon uses fixed procedural maria and restrained crater rims,
a soft curved phase terminator and cool gray-blue earthshine that reveals surface
detail on the unlit side, rather than a
photo texture. Its gray-white surface is distinct from the cool atmospheric halo;
clear nights keep that halo small, while haze and thin clouds spread it softly.
The sun retains its size and glow with a subtle cream-to-gold radial gradient,
gentle limb darkening and a warmer tint near the horizon.
Golden hour is driven by the sun's elevation at both sunrise and sunset: orange-gold
direct light, an orange horizon and warmer cloud edges contrast with cooler shadows.
Ambient and emissive fill decrease smoothly to preserve directional lighting.
Dense clouds, storms and fog attenuate this shared lighting state. In manual mode,
choose Clear and set Time of day around 06:43 or 17:17 (28% or 72% of the day).
Meteors have bright heads, tapered fading ribbons, both travel
directions, irregular 52–138-second primary gaps and occasional separated pairs.
Logical meteor lanes share the allocated rendering pool on all quality tiers.

Summer fireflies hover in loose groups, with independent 4–9-second pulse cycles
and dark intervals. Rain has varied streak sizes, coherent wind tilt and elliptical
ground splashes. Snow has varied sizes and falling speeds, flutter and wind drift;
snow/rain use normal blending rather than emissive glow. In automatic weather, snow coverage accumulates
over approximately 24 seconds and melts more slowly, coloring upper surfaces of
the grass, ground, barn roof and fence. Manual environment changes crossfade snow
to the exact selected target alongside seasonal colors, so winter residue cannot
keep autumn or summer grass white. Low fog layers drift over the meadow,
strengthening with mist, precipitation and dawn.

Storms share deterministic, irregular event timings between lightning and thunder.
Ground strikes have a bright core and thin branches, sometimes a second flash;
cloud strikes illuminate the sky without a visible ground bolt. Event distance
controls illumination, stereo placement, filtering and thunder delay (compressed
to 0.9–3 seconds for this miniature scene). Two real thunder recordings are local and credited alongside the
animal recordings. Thunder has its own volume and preview. Pending thunder is
cancelled on mute, page hiding, channel mute or leaving storm weather.

Low quality reduces cloud layers, particle counts and meteor allocations; inactive
particle systems are hidden entirely. Reduced motion slows drift, reduces particles
and suppresses lightning flashes. Development-only `__e2eEffects` and `__e2eMeteor`
query parameters make visual checks reproducible; production builds ignore them.

## Farm

A red clapboard barn with a gambrel roof, white cross-braced doors, and a fenced
yard sits beyond the foreground grass. Its static geometry is merged into eight
material batches, and a shared footprint keeps vegetation out of the yard.

With sound enabled, recorded cows, cats, dogs, hens, sheep, goats, horses, donkeys,
roosters, ducks, and pigs call occasionally from the farm. A shuffled rotation
avoids immediate repeats; low-pass filtering, restrained volume, and stereo
placement suggest distance. Calls become quieter and less frequent at night or
in rain. Audio shares the existing mute and page-visibility lifecycle. Recordings
load locally only after enabling sound; see [audio credits](public/audio/CREDITS.md).

Individual cow, cat, sheep, goat, horse, donkey, rooster, duck, and pig calls use trimmed real
recordings in WAV format. Farm calls retain their original pitch and speed,
with brief edge fades and a distance filter that preserves vocal detail. Preview
plays each complete retained excerpt. The donkey uses a brief 2.08-second excerpt;
the goat is a single bleat, and the duck and pig use field recordings.

## Birds

Blackbirds, great tits, chaffinches, and sparrows use real recordings, with varied
excerpts and no immediate repetition of a recording. Individual calls vary in
distance and stereo direction. Occasional brief replies (at most two) give way
to 12–40 second pauses, longer when activity is low. Dawn is busiest, midday is
quieter, and rain or storms reduce activity. Daytime birds fade out at night.

Birds and farm animals share one recorded-audio loader, scheduler, and cleanup
path. All recordings are local, load after enabling sound, and reuse decoded
buffers on subsequent toggles. Muting or hiding the page cancels queued calls.

## Sound controls

The speaker icon toggles mute. Hovering or focusing the control reveals the
vertical master-volume slider; tapping the button also exposes it on touch
screens. The circular button expands upward into one glass pill of the same
width, with the slider and percentage above the speaker icon. Muted controls
show 0%; increasing the slider automatically unmutes.
The mute button restores the last audible level when unmuting.
Environment settings → Advanced opens a keyboard-accessible sound-mix dialog.
It provides independent levels for wind, rain, every bird recording, and each
farm animal, plus master volume and a reset action. Changes apply immediately
and persist locally. The page still starts muted on each visit.

The expanding master-volume control is available for a fine pointer with hover
(desktop). Touch devices show only the mute/unmute icon; per-channel sliders
remain available in advanced settings.

All sources route through one master gain. Recorded sounds also have individual
channel gains, so changing a level affects an already-playing call. Channels at
0% are omitted from future selections. The ambient day/weather mix is multiplied
by these user levels; volume settings do not force inactive weather or nocturnal
birds to play.

Each channel has an illustrated icon and a play/stop preview button. Previews
use the actual recording or weather noise, play one at a time, and bypass the
muted ambience mix at a restrained audition level. They do not change saved
levels or start ambient scheduling. Closing the dialog, muting, or hiding the
page stops a preview. The dialog has a single themed scroll area with fixed
header and footer.

Mobile audio is resumed directly from the sound/preview tap handler. Where the
Audio Session API is supported (including recent iOS Safari), playback selects
the media session so the phone's silent switch does not silence Web Audio. Muting,
ending a muted preview, hiding the page, or disposing restores the previous session
type. Returning to the page also resumes Safari's interrupted context before
restarting ambience. Older iOS versions without this API may still require the
phone's silent switch to be off. Physical iPhone playback must be checked on-device.
