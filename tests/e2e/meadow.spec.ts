import { expect, test } from '@playwright/test'
import {
  getShootingStarState,
  projectShootingStarTrail,
} from '../../src/core/celestial'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 })
  })
})

test('persists advanced scene preferences and supports keyboard tabs', async ({ page }) => {
  test.slow()
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  const open = async () => {
    await page.getByRole('button', { name: 'Environment settings' }).click()
    await page.getByRole('button', { name: 'Advanced', exact: true }).click()
  }
  const group = (name: string) => page.locator('summary').filter({ hasText: name })
  await open()
  await page.getByRole('tab', { name: 'Sound', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Nature', exact: true })).toBeFocused()
  await page.getByRole('slider', { name: 'Flower density' }).fill('0')
  await group('Wind & motion').click()
  await page.getByRole('switch', { name: 'Gentler motion', exact: true }).check()
  await page.getByRole('tab', { name: 'Sky & weather', exact: true }).click()
  await group('Stars & meteors').click()
  await page.getByRole('switch', { name: 'Shooting stars', exact: true }).uncheck()
  await page.getByRole('slider', { name: 'Star brightness' }).fill('0')
  await group('Storm').click()
  await page.getByRole('switch', { name: 'Lightning flashes', exact: true }).uncheck()
  await group('Rain & snow').click()
  await page.getByRole('slider', { name: 'Rain & snow particles' }).fill('0')
  await page.getByRole('button', { name: 'Close advanced settings' }).click()
  await expect(page.getByRole('button', { name: 'Environment settings' })).toBeFocused()
  await page.reload()
  await open()
  await page.getByRole('tab', { name: 'Nature', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Flower density' })).toHaveValue('0')
  await group('Wind & motion').click()
  await expect(page.getByRole('switch', { name: 'Gentler motion', exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Reset nature' }).click()
  await expect(page.getByRole('slider', { name: 'Flower density' })).toHaveValue('33')
  await page.getByRole('tab', { name: 'Sky & weather', exact: true }).click()
  await group('Stars & meteors').click()
  await expect(page.getByRole('switch', { name: 'Shooting stars', exact: true })).not.toBeChecked()
  await page.getByRole('button', { name: 'Reset sky & weather' }).click()
  await expect(page.getByRole('switch', { name: 'Shooting stars', exact: true })).toBeChecked()
  await page.getByRole('tab', { name: 'Sound', exact: true }).click()
  await group('Farm animals').click()
  await expect(page.getByRole('slider', { name: 'Cow', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})

test('loads the meadow and toggles ambience without page errors', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page).toHaveTitle('Living Meadow')
  await expect(page.getByRole('main', { name: 'Living Meadow' })).toBeVisible()

  const supportsWebAudio = await page.evaluate(() => Boolean(window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext))
  test.skip(!supportsWebAudio, 'This browser engine build does not expose Web Audio; native audio activation cannot be verified here.')

  const sound = page.getByRole('button', { name: 'Turn sound on' })
  await expect(sound).toBeVisible()
  await sound.click({ force: true })
  await expect(
    page.getByRole('button', { name: 'Turn sound off' }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(errors).toEqual([])
})

test('keeps the passive experience usable with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const main = page.getByRole('main', { name: 'Living Meadow' })
  const sound = page.getByRole('button', { name: 'Turn sound on' })
  await expect(main).toBeVisible()
  await sound.focus()
  await expect(sound).toBeFocused()
  await expect(page.locator('canvas')).toBeVisible()
})

test('gives the opened environment popover the visible focus treatment', async ({ page }) => {
  await page.goto('/')

  await page
    .getByRole('button', { name: 'Environment settings' })
    .click({ force: true })
  const panel = page.getByRole('dialog', { name: 'Environment settings' })

  await expect(panel).toBeFocused()
  await expect(panel).toHaveCSS('outline-color', 'rgb(247, 215, 130)')
})

test('keeps the environment popover inside a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 400 })
  await page.goto('/')

  await page
    .getByRole('button', { name: 'Environment settings' })
    .click({ force: true })
  const panel = page.getByRole('dialog', { name: 'Environment settings' })

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
    .getByRole('button', { name: 'Environment settings' })
    .click({ force: true })
  const panel = page.getByRole('dialog', { name: 'Environment settings' })
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
    .getByRole('button', { name: /environment settings/i })
    .click({ force: true })
  const manual = page.getByRole('radio', { name: /manual/i })
  await expect(manual).toBeVisible()
  await expect(manual).toBeEnabled()
  await manual.check()

  const winter = page.getByRole('radio', { name: /winter/i })
  await expect(winter).toBeVisible()
  await expect(winter).toBeEnabled()
  await winter.check()

  const snow = page.getByRole('radio', { name: /snow/i })
  await expect(snow).toBeVisible()
  await expect(snow).toBeEnabled()
  await snow.check()

  const main = page.getByRole('main', { name: 'Living Meadow' })
  await expect(main).toHaveAttribute('data-weather', 'snow')

  const auto = page.getByRole('radio', { name: /^automatic$/i })
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
  const main = page.getByRole('main', { name: 'Living Meadow' })
  await expect(main).not.toHaveAttribute('data-auto-elapsed', '0')

  await page
    .getByRole('button', { name: 'Environment settings' })
    .click({ force: true })
  await page.getByRole('radio', { name: 'Manual' }).check({ force: true })
  await page.getByRole('radio', { name: 'Winter' }).check({ force: true })
  const previousRevision = Number(
    await main.getAttribute('data-transition-revision'),
  )
  // Capture the first published transition frame, before a slow browser driver
  // can spend part of the three-second transition checking UI assertions.
  const firstTransitionSample = main.evaluate((element, revision) => new Promise<number>(resolve => {
    const observer = new MutationObserver(() => {
      if (Number((element as HTMLElement).dataset.transitionRevision) <= revision) return
      observer.disconnect()
      resolve(Number((element as HTMLElement).dataset.autoElapsed))
    })
    observer.observe(element, { attributes: true, attributeFilter: ['data-transition-revision'] })
  }), previousRevision)
  await page.getByRole('radio', { name: 'Snow' }).check({ force: true })
  await expect(main).toHaveAttribute('data-weather', 'snow')
  await expect
    .poll(async () => Number(await main.getAttribute('data-transition-revision')))
    .toBeGreaterThan(previousRevision)

  const before = await firstTransitionSample
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
    .getByRole('button', { name: 'Environment settings' })
    .click({ force: true })
  await page.getByRole('radio', { name: 'Manual' }).check()
  await page.getByLabel('Time of day').fill('0.5')
  await page.getByRole('radio', { name: 'Summer' }).check()
  await page.getByRole('radio', { name: 'Clear' }).check()
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
  const forcedElapsed = 118.2190851862193
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

test('clears winter snow when changing to autumn even after rapid season retargeting', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('living-meadow:environment', JSON.stringify({ mode: 'manual', dayPhase: .5, seasonIndex: 3, weather: 'rain' }))
  })
  await page.goto('/')
  await page.waitForFunction(() => {
    const effects = (window as Window & { __livingMeadowEffects?: { snowCover: number } }).__livingMeadowEffects
    return effects && effects.snowCover > .7
  })
  await page.getByRole('button', { name: 'Environment settings' }).click()
  await page.getByRole('radio', { name: 'Autumn', exact: true }).check()
  await page.waitForFunction(() => (window as Window & { __livingMeadowEffects?: { snowCover: number } }).__livingMeadowEffects?.snowCover === 0)
  await page.getByRole('radio', { name: 'Winter', exact: true }).check()
  await page.waitForTimeout(400)
  await page.getByRole('radio', { name: 'Summer', exact: true }).check()
  await page.waitForTimeout(300)
  await page.getByRole('radio', { name: 'Autumn', exact: true }).check()
  await page.waitForFunction(() => (window as Window & { __livingMeadowEffects?: { snowCover: number } }).__livingMeadowEffects?.snowCover === 0)
  await expect(page.getByRole('radio', { name: 'Autumn', exact: true })).toBeChecked()
})
