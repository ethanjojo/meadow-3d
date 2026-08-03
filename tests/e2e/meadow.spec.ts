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

test('loads the meadow and toggles ambience without page errors', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.getByRole('main', { name: 'Živá louka' })).toBeVisible()

  const sound = page.getByRole('button', { name: 'Zapnout zvuk' })
  await expect(sound).toBeVisible()
  await sound.click()
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

  await page.getByRole('button', { name: 'Nastavení prostředí' }).click()
  const panel = page.getByRole('dialog', { name: 'Nastavení prostředí' })

  await expect(panel).toBeFocused()
  await expect(panel).toHaveCSS('outline-color', 'rgb(247, 215, 130)')
})

test('keeps the environment popover inside a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 400 })
  await page.goto('/')

  await page.getByRole('button', { name: 'Nastavení prostředí' }).click()
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

  await page.getByRole('button', { name: 'Nastavení prostředí' }).click()
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

  await page.getByRole('button', { name: /nastavení prostředí/i }).click()
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

test('preserves an open daylight sky above the fixed grass horizon', async ({
  page,
}) => {
  test.slow()
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')

  await page.getByRole('button', { name: 'Nastavení prostředí' }).click()
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
