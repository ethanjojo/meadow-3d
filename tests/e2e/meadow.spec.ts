import { expect, test } from '@playwright/test'

test('loads the meadow and toggles ambience without page errors', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 })
  })

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
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 })
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const main = page.getByRole('main', { name: 'Živá louka' })
  const sound = page.getByRole('button', { name: 'Zapnout zvuk' })
  await expect(main).toBeVisible()
  await sound.focus()
  await expect(sound).toBeFocused()
  await expect(page.locator('canvas')).toBeVisible()
})
