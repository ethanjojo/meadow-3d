import { expect, test, type Page } from '@playwright/test'
import {
  getShootingStarState,
  projectShootingStarTrail,
} from '../../src/core/celestial'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 })
  })
})

interface VisualEnvironment {
  dayPhase: number
  weather: 'clear' | 'storm'
}

interface ScreenshotEvidence {
  horizonFraction: number
  largestFlatTerrainFraction: number
  lowerFrameVariance: number
  openSkyLuminance: number
  foregroundLuminance: number
  horizonColor: { red: number; green: number; blue: number }
}

async function loadVisualEnvironment(
  page: Page,
  environment: VisualEnvironment,
) {
  await page.goto('/')
  await page.evaluate((value) => {
    localStorage.setItem(
      'living-meadow:environment',
      JSON.stringify({
        mode: 'manual',
        dayPhase: value.dayPhase,
        seasonIndex: 0,
        weather: value.weather,
      }),
    )
  }, environment)
  await page.reload()
  await expect(page.getByRole('main', { name: 'Živá louka' })).toHaveAttribute(
    'data-weather',
    environment.weather,
  )
  await page.waitForTimeout(1_500)
}

async function analyzeScreenshot(
  page: Page,
  encodedScreenshot: string,
): Promise<ScreenshotEvidence> {
  return page.evaluate(async (encoded) => {
    const image = new Image()
    image.src = `data:image/png;base64,${encoded}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('2D canvas context unavailable')
    context.drawImage(image, 0, 0)

    const pixel = (x: number, y: number) =>
      context.getImageData(
        Math.max(0, Math.min(image.width - 1, Math.round(x))),
        Math.max(0, Math.min(image.height - 1, Math.round(y))),
        1,
        1,
      ).data
    const luminance = (red: number, green: number, blue: number) =>
      red * 0.2126 + green * 0.7152 + blue * 0.0722
    const grassLike = (red: number, green: number, blue: number) =>
      green > blue * 1.04 && red > blue * 1.03 && green > 18

    const horizonRows: number[] = []
    const xStep = Math.max(1, Math.round(image.width / 180))
    const runLength = Math.max(8, Math.round(image.height * 0.012))
    for (
      let x = image.width * 0.1;
      x <= image.width * 0.9;
      x += xStep
    ) {
      for (
        let y = image.height * 0.3;
        y <= image.height * 0.62;
        y += 1
      ) {
        let grassSamples = 0
        for (let offset = 0; offset < runLength; offset += 1) {
          const [red, green, blue] = pixel(x, y + offset)
          if (grassLike(red, green, blue)) grassSamples += 1
        }
        if (grassSamples >= runLength * 0.42) {
          horizonRows.push(y)
          break
        }
      }
    }
    if (horizonRows.length < 12) {
      throw new Error(`Only ${horizonRows.length} grass horizon samples found`)
    }
    horizonRows.sort((left, right) => left - right)
    const horizonFraction =
      horizonRows[Math.floor(horizonRows.length / 2)] / image.height

    const averageRegion = (
      xStart: number,
      xEnd: number,
      yStart: number,
      yEnd: number,
    ) => {
      let red = 0
      let green = 0
      let blue = 0
      let samples = 0
      const step = Math.max(3, Math.round(image.width / 120))
      for (let y = image.height * yStart; y < image.height * yEnd; y += step) {
        for (let x = image.width * xStart; x < image.width * xEnd; x += step) {
          const color = pixel(x, y)
          red += color[0]
          green += color[1]
          blue += color[2]
          samples += 1
        }
      }
      return {
        red: red / samples,
        green: green / samples,
        blue: blue / samples,
        luminance: luminance(red / samples, green / samples, blue / samples),
      }
    }

    const openSky = averageRegion(0.18, 0.82, 0.08, 0.3)
    const foreground = averageRegion(0.1, 0.9, 0.7, 0.94)
    const horizonColor = averageRegion(0.58, 0.94, 0.3, 0.43)

    const cellSize = Math.max(6, Math.round(image.width / 150))
    const columns = Math.ceil(image.width / cellSize)
    const firstRow = Math.floor((image.height * 0.45) / cellSize)
    const rows = Math.ceil(image.height / cellSize)
    const flatTerrain = new Uint8Array(columns * rows)
    let totalVariance = 0
    let sampledCells = 0
    const sampleOffsets = [
      [0.2, 0.2],
      [0.8, 0.2],
      [0.5, 0.5],
      [0.2, 0.8],
      [0.8, 0.8],
    ]
    for (let row = firstRow; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const values = sampleOffsets.map(([offsetX, offsetY]) => {
          const [red, green, blue] = pixel(
            (column + offsetX) * cellSize,
            (row + offsetY) * cellSize,
          )
          return { red, green, blue, light: luminance(red, green, blue) }
        })
        const lights = values.map((value) => value.light)
        const variance = Math.max(...lights) - Math.min(...lights)
        const mean = values.reduce(
          (result, value) => ({
            red: result.red + value.red / values.length,
            green: result.green + value.green / values.length,
            blue: result.blue + value.blue / values.length,
          }),
          { red: 0, green: 0, blue: 0 },
        )
        totalVariance += variance
        sampledCells += 1
        if (
          variance < 4.5 &&
          mean.green > mean.red * 1.035 &&
          mean.green > mean.blue * 1.08
        ) {
          flatTerrain[row * columns + column] = 1
        }
      }
    }

    let largestFlatCells = 0
    const queue = new Int32Array(columns * rows)
    for (let row = firstRow; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const origin = row * columns + column
        if (flatTerrain[origin] !== 1) continue
        let head = 0
        let tail = 1
        queue[0] = origin
        flatTerrain[origin] = 2
        while (head < tail) {
          const current = queue[head]
          head += 1
          const currentRow = Math.floor(current / columns)
          const currentColumn = current % columns
          const neighbors = [
            [currentRow - 1, currentColumn],
            [currentRow + 1, currentColumn],
            [currentRow, currentColumn - 1],
            [currentRow, currentColumn + 1],
          ]
          for (const [nextRow, nextColumn] of neighbors) {
            if (
              nextRow < firstRow ||
              nextRow >= rows ||
              nextColumn < 0 ||
              nextColumn >= columns
            ) {
              continue
            }
            const next = nextRow * columns + nextColumn
            if (flatTerrain[next] !== 1) continue
            flatTerrain[next] = 2
            queue[tail] = next
            tail += 1
          }
        }
        largestFlatCells = Math.max(largestFlatCells, tail)
      }
    }

    return {
      horizonFraction,
      largestFlatTerrainFraction:
        (largestFlatCells * cellSize * cellSize) /
        (image.width * image.height),
      lowerFrameVariance: totalVariance / sampledCells,
      openSkyLuminance: openSky.luminance,
      foregroundLuminance: foreground.luminance,
      horizonColor,
    }
  }, encodedScreenshot)
}

test('loads the meadow and toggles ambience without page errors', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.getByRole('main', { name: 'Živá louka' })).toBeVisible()

  const sound = page.getByRole('button', { name: 'Zapnout zvuk' })
  await expect(sound).toBeVisible()
  await sound.click({ force: true })
  await expect(
    page.getByRole('button', { name: 'Vypnout zvuk' }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(errors).toEqual([])
})

test('keeps the passive experience usable with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const main = page.getByRole('main', { name: 'Živá louka' })
  const sound = page.getByRole('button', { name: 'Zapnout zvuk' })
  await expect(main).toBeVisible()
  await sound.focus()
  await expect(sound).toBeFocused()
  await expect(page.locator('canvas')).toBeVisible()
})

test('gives the opened environment popover the visible focus treatment', async ({ page }) => {
  await page.goto('/')

  await page
    .getByRole('button', { name: 'Nastavení prostředí' })
    .click({ force: true })
  const panel = page.getByRole('dialog', { name: 'Nastavení prostředí' })

  await expect(panel).toBeFocused()
  await expect(panel).toHaveCSS('outline-color', 'rgb(247, 215, 130)')
})

test('keeps the environment popover inside a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 400 })
  await page.goto('/')

  await page
    .getByRole('button', { name: 'Nastavení prostředí' })
    .click({ force: true })
  const panel = page.getByRole('dialog', { name: 'Nastavení prostředí' })

  await expect(panel).toBeFocused()

  const bounds = await panel.boundingBox()
  if (!bounds) throw new Error('Environment panel has no visible bounds')
  expect(bounds.x).toBeGreaterThanOrEqual(16)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(304)
  expect(bounds.y).toBeGreaterThanOrEqual(16)
})

test('keeps the environment popover inside a 500px-wide viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 500, height: 700 })
  await page.goto('/')

  await page
    .getByRole('button', { name: 'Nastavení prostředí' })
    .click({ force: true })
  const panel = page.getByRole('dialog', { name: 'Nastavení prostředí' })
  await expect(panel).toBeFocused()

  const bounds = await panel.boundingBox()
  if (!bounds) throw new Error('Environment panel has no visible bounds')
  expect(bounds.x).toBeGreaterThanOrEqual(16)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(484)
  expect(bounds.y).toBeGreaterThanOrEqual(16)
})

test('manually controls the environment and returns to auto', async ({ page }) => {
  test.slow()
  await page.goto('/')

  await page
    .getByRole('button', { name: /nastavení prostředí/i })
    .click({ force: true })
  const manual = page.getByRole('radio', { name: /ručně/i })
  await expect(manual).toBeVisible()
  await expect(manual).toBeEnabled()
  await manual.check()

  const winter = page.getByRole('radio', { name: /zima/i })
  await expect(winter).toBeVisible()
  await expect(winter).toBeEnabled()
  await winter.check()

  const snow = page.getByRole('radio', { name: /sněžení/i })
  await expect(snow).toBeVisible()
  await expect(snow).toBeEnabled()
  await snow.check()

  const main = page.getByRole('main', { name: 'Živá louka' })
  await expect(main).toHaveAttribute('data-weather', 'snow')

  const auto = page.getByRole('radio', { name: /^auto$/i })
  await expect(auto).toBeVisible()
  await expect(auto).toBeEnabled()
  await auto.check()
  await expect(main).toHaveAttribute('data-simulation-mode', 'auto')
})

test('completes a manual environment crossfade without accelerating auto time', async ({
  page,
}) => {
  test.slow()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  const main = page.getByRole('main', { name: 'Živá louka' })
  await expect(main).not.toHaveAttribute('data-auto-elapsed', '0')

  await page
    .getByRole('button', { name: 'Nastavení prostředí' })
    .click({ force: true })
  await page.getByRole('radio', { name: 'Ručně' }).check({ force: true })
  await page.getByRole('radio', { name: 'Zima' }).check({ force: true })
  const previousRevision = Number(
    await main.getAttribute('data-transition-revision'),
  )
  await page.getByRole('radio', { name: 'Sněžení' }).check({ force: true })
  await expect(main).toHaveAttribute('data-weather', 'snow')
  await expect
    .poll(async () => Number(await main.getAttribute('data-transition-revision')))
    .toBeGreaterThan(previousRevision)

  const before = Number(await main.getAttribute('data-auto-elapsed'))
  await expect(main).toHaveAttribute('data-transition-active', 'false', {
    timeout: 5_500,
  })

  const after = Number(await main.getAttribute('data-auto-elapsed'))
  expect(after - before).toBeGreaterThan(2.5)
  expect(after - before).toBeLessThan(4.5)
  expect(errors).toEqual([])
})

test('preserves an open daylight sky above the fixed grass horizon', async ({
  page,
}) => {
  test.slow()
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')

  await page
    .getByRole('button', { name: 'Nastavení prostředí' })
    .click({ force: true })
  await page.getByRole('radio', { name: 'Ručně' }).check()
  await page.getByLabel('Čas dne').fill('0.5')
  await page.getByRole('radio', { name: 'Léto' }).check()
  await page.getByRole('radio', { name: 'Jasno' }).check()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(3_500)

  const screenshot = await page.screenshot()
  const skyCoverage = await page.evaluate(async (encodedScreenshot) => {
    const image = new Image()
    image.src = `data:image/png;base64,${encodedScreenshot}`
    await image.decode()

    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('2D canvas context unavailable')
    context.drawImage(image, 0, 0)

    let skySamples = 0
    let totalSamples = 0
    for (let y = 36; y <= 216; y += 30) {
      for (let x = 48; x <= 1232; x += 48) {
        const [red, green, blue] = context.getImageData(x, y, 1, 1).data
        if (blue >= green * 0.9 && blue > red * 1.03) skySamples += 1
        totalSamples += 1
      }
    }

    return skySamples / totalSamples
  }, screenshot.toString('base64'))

  expect(skyCoverage).toBeGreaterThan(0.9)
})

test('projects celestial arcs across the sky while grass occludes the horizon edge', async ({
  page,
}, testInfo) => {
  test.slow()
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.addInitScript(() => {
    const raw = new URLSearchParams(window.location.search).get(
      '__e2eCelestial',
    )
    if (!raw) return
    const targetDayPhase = Number(raw.split(',')[1])
    localStorage.setItem(
      'living-meadow:environment',
      JSON.stringify({
        mode: 'manual',
        dayPhase: targetDayPhase,
        seasonIndex: 1,
        weather: 'clear',
      }),
    )
  })

  const cases = [
    {
      name: 'sunrise',
      query: '0.28,0.28,1',
      body: 'sun' as const,
      minimumX: -0.9,
      maximumX: -0.6,
      expectGrassOverlap: true,
    },
    {
      name: 'sunset',
      query: '0.72,0.72,1',
      body: 'sun' as const,
      minimumX: 0.6,
      maximumX: 0.9,
      expectGrassOverlap: true,
    },
    {
      name: 'day-night-swap',
      query: '0.5,0,0.75',
      body: 'moon' as const,
      minimumX: -0.8,
      maximumX: -0.05,
      expectGrassOverlap: false,
    },
  ]

  for (const scene of cases) {
    await page.goto(`/?__e2eCelestial=${scene.query}`)
    await expect(page.locator('canvas')).toBeVisible()
    await page.waitForFunction(
      () =>
        '__livingMeadowCelestial' in window &&
        Boolean(
          (window as Window & {
            __livingMeadowCelestial?: { sun: unknown; moon: unknown }
          }).__livingMeadowCelestial,
        ),
    )

    const presentation = await page.evaluate(
      () =>
        (window as unknown as Window & {
          __livingMeadowCelestial: {
            sun: { x: number; y: number; opacity: number }
            moon: { x: number; y: number; opacity: number }
          }
        }).__livingMeadowCelestial,
    )
    const body = presentation[scene.body]
    expect(body.x).toBeGreaterThan(scene.minimumX)
    expect(body.x).toBeLessThan(scene.maximumX)
    expect(body.y).toBeGreaterThan(-0.05)
    expect(body.opacity).toBeGreaterThan(0.25)

    const screenshot = await page.screenshot({
      path: testInfo.outputPath(`${scene.name}.png`),
    })
    if (!scene.expectGrassOverlap) continue

    const overlap = await page.evaluate(
      async ({ encodedScreenshot, center }) => {
        const image = new Image()
        image.src = `data:image/png;base64,${encodedScreenshot}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('2D canvas context unavailable')
        context.drawImage(image, 0, 0)

        const centerX = (center.x + 1) * image.width * 0.5
        const centerY = (1 - center.y) * image.height * 0.5
        let brightPixels = 0
        let grassPixels = 0
        for (let y = -24; y <= 30; y += 1) {
          for (let x = -28; x <= 28; x += 1) {
            const [red, green, blue] = context.getImageData(
              Math.round(centerX + x),
              Math.round(centerY + y),
              1,
              1,
            ).data
            if (red > 175 && green > 135 && red > blue * 1.02) {
              brightPixels += 1
            }
            const luminance = (red + green + blue) / 3
            if (
              y > 8 &&
              luminance < 175 &&
              green > blue * 1.04 &&
              red > blue * 1.03
            ) {
              grassPixels += 1
            }
          }
        }
        return { brightPixels, grassPixels }
      },
      {
        encodedScreenshot: screenshot.toString('base64'),
        center: body,
      },
    )

    expect(overlap.brightPixels).toBeGreaterThan(20)
    expect(overlap.grassPixels).toBeGreaterThan(8)
  }
})

test('renders a deterministic shooting-star trail inside the real canvas', async ({
  page,
}, testInfo) => {
  test.slow()
  const forcedElapsed = 96.08
  const state = getShootingStarState(forcedElapsed, 731, 1, 1)
  const trail = projectShootingStarTrail(state, false)
  expect(state.active).toBe(true)

  await page.addInitScript(() => {
    localStorage.setItem(
      'living-meadow:environment',
      JSON.stringify({
        mode: 'manual',
        dayPhase: 0.8,
        seasonIndex: 1,
        weather: 'clear',
      }),
    )
  })
  await page.goto(`/?__e2eMeteor=${forcedElapsed}`)
  await expect(page.locator('canvas')).toBeVisible()
  await page.waitForTimeout(1_000)

  const screenshot = await page.screenshot({
    path: testInfo.outputPath('forced-meteor.png'),
  })
  const evidence = await page.evaluate(
    async ({ encodedScreenshot, head, tail }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${encodedScreenshot}`
      await image.decode()

      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('2D canvas context unavailable')
      context.drawImage(image, 0, 0)

      const scale = image.width / window.innerWidth
      const radius = Math.max(2, Math.ceil(scale * 1.5))
      const lineX = (head[0] - tail[0]) * image.width * 0.5
      const lineY = -(head[1] - tail[1]) * image.height * 0.5
      const lineLength = Math.hypot(lineX, lineY) || 1
      const normalX = -lineY / lineLength
      const normalY = lineX / lineLength
      const backgroundOffset = scale * 8

      const luminanceAt = (centerX: number, centerY: number) => {
        let maximum = 0
        for (let y = -radius; y <= radius; y += 1) {
          for (let x = -radius; x <= radius; x += 1) {
            const [red, green, blue] = context.getImageData(
              Math.round(centerX + x),
              Math.round(centerY + y),
              1,
              1,
            ).data
            maximum = Math.max(maximum, (red + green + blue) / 3)
          }
        }
        return maximum
      }

      const samples = Array.from({ length: 7 }, (_, index) => {
        const amount = 0.15 + index * (0.7 / 6)
        const ndcX = tail[0] + (head[0] - tail[0]) * amount
        const ndcY = tail[1] + (head[1] - tail[1]) * amount
        const x = (ndcX + 1) * image.width * 0.5
        const y = (1 - ndcY) * image.height * 0.5
        const foreground = luminanceAt(x, y)
        const background = Math.max(
          luminanceAt(
            x + normalX * backgroundOffset,
            y + normalY * backgroundOffset,
          ),
          luminanceAt(
            x - normalX * backgroundOffset,
            y - normalY * backgroundOffset,
          ),
        )
        return { foreground, contrast: foreground - background }
      })

      return {
        hits: samples.filter(
          ({ foreground, contrast }) => foreground > 150 && contrast > 45,
        ).length,
        samples,
      }
    },
    {
      encodedScreenshot: screenshot.toString('base64'),
      head: trail.head,
      tail: trail.tail,
    },
  )

  expect(evidence.hits, JSON.stringify(evidence.samples)).toBeGreaterThanOrEqual(4)
})

test('matches the reference composition with dense grass and no exposed terrain', async ({
  page,
}, testInfo) => {
  test.slow()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await loadVisualEnvironment(page, { dayPhase: 0.5, weather: 'clear' })

  const screenshot = await page.screenshot({
    path: testInfo.outputPath('reference-composition.png'),
  })
  const evidence = await analyzeScreenshot(
    page,
    screenshot.toString('base64'),
  )

  expect(evidence.horizonFraction).toBeGreaterThanOrEqual(0.43)
  expect(evidence.horizonFraction).toBeLessThanOrEqual(0.47)
  expect(evidence.largestFlatTerrainFraction).toBeLessThanOrEqual(0.015)
  expect(evidence.lowerFrameVariance).toBeGreaterThan(4)
  expect(errors).toEqual([])
})

test('keeps weather transitions coherent and moonlit readability restrained', async ({
  page,
}, testInfo) => {
  test.slow()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const cases = [
    { name: 'day', dayPhase: 0.5, weather: 'clear' as const },
    { name: 'storm', dayPhase: 0.5, weather: 'storm' as const },
    { name: 'sunset', dayPhase: 0.72, weather: 'clear' as const },
    { name: 'twilight', dayPhase: 0.78, weather: 'clear' as const },
    { name: 'night', dayPhase: 0, weather: 'clear' as const },
  ]
  const evidence: Record<string, ScreenshotEvidence> = {}

  for (const scene of cases) {
    await loadVisualEnvironment(page, scene)
    const screenshot = await page.screenshot({
      path: testInfo.outputPath(`${scene.name}.png`),
    })
    evidence[scene.name] = await analyzeScreenshot(
      page,
      screenshot.toString('base64'),
    )
  }

  expect(evidence.storm.openSkyLuminance).toBeLessThan(
    evidence.day.openSkyLuminance,
  )
  expect(
    evidence.sunset.horizonColor.red -
      evidence.sunset.horizonColor.blue,
  ).toBeGreaterThan(
    evidence.day.horizonColor.red - evidence.day.horizonColor.blue + 8,
  )
  expect(evidence.twilight.openSkyLuminance).toBeGreaterThan(
    evidence.night.openSkyLuminance,
  )
  expect(evidence.night.openSkyLuminance).toBeGreaterThan(255 * 0.07)
  expect(evidence.night.foregroundLuminance).toBeGreaterThan(255 * 0.03)
  expect(evidence.night.openSkyLuminance).toBeLessThan(
    evidence.day.openSkyLuminance * 0.55,
  )
  expect(evidence.night.foregroundLuminance).toBeLessThan(
    evidence.day.foregroundLuminance * 0.6,
  )
  expect(errors).toEqual([])
})
