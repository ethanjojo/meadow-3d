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
