import { expect, test } from '@playwright/test'

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
