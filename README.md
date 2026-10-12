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
- `npm run test:e2e` verifies desktop and mobile rendering in Chromium.

## Controls and performance

The scene is intentionally passive: the camera moves only subtly and responds to the pointer with light parallax. Sound always starts muted and can be enabled with the button in the lower-right corner.

Grass density, particle counts, resolution, and shadows adapt automatically to device performance. `prefers-reduced-motion` limits camera and particle movement without disabling the day or seasonal cycle. When WebGL is unavailable, the page displays a static fallback meadow.

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
