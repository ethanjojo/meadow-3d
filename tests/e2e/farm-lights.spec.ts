import { expect, test } from '@playwright/test'

test('farm windows follow evening scene time and the saved lights switch', async ({ page }) => {
  test.slow()
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    // Compare the same low tier across engines, including its bloom-free glow.
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 })
    if (!localStorage.getItem('living-meadow:environment')) localStorage.setItem('living-meadow:environment', JSON.stringify({ mode: 'manual', dayPhase: 19.5 / 24, seasonIndex: 1, weather: 'clear' }))
  })
  const warmPixels = async () => page.evaluate(async (encoded) => {
    const image = new Image()
    image.src = `data:image/png;base64,${encoded}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(Math.floor(image.width * .15), Math.floor(image.height * .15), Math.floor(image.width * .7), Math.floor(image.height * .4)).data
    let count = 0
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 140 && pixels[i + 1] > 90 && pixels[i + 2] < 175 && pixels[i] > pixels[i + 2] * 1.4) count++
    return count
  }, (await page.screenshot()).toString('base64'))
  const openScene = async () => {
    await page.getByRole('button', { name: 'Environment settings', exact: true }).click()
    await page.getByRole('button', { name: 'Advanced', exact: true }).click()
    await page.getByRole('tab', { name: 'Farm', exact: true }).click()
    await page.locator('summary').filter({ hasText: 'Window lights' }).click()
  }
  await page.goto('/?__e2eEffects=0')
  await page.locator('canvas').waitFor()
  // The first actual scene frame includes cold WebGL shader compilation.
  await expect.poll(warmPixels, { timeout: 15_000 }).toBeGreaterThan(100)
  const lit = await warmPixels()
  await openScene()
  await page.getByRole('switch', { name: 'Farm lights', exact: true }).uncheck()
  await page.keyboard.press('Escape')
  await expect.poll(warmPixels).toBeLessThan(lit * .1)
  await page.reload()
  await openScene()
  await expect(page.getByRole('switch', { name: 'Farm lights', exact: true })).not.toBeChecked()
  await page.getByRole('switch', { name: 'Farm lights', exact: true }).check()
  await page.keyboard.press('Escape')
  await expect.poll(warmPixels).toBeGreaterThan(100)
  await page.getByRole('button', { name: 'Environment settings', exact: true }).click()
  await page.getByLabel('Time of day').fill('0.9')
  await page.keyboard.press('Escape')
  await expect.poll(warmPixels, { timeout: 8000 }).toBeLessThan(lit * .1)
  expect(errors).toEqual([])
})
