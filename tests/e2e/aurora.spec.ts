import { expect, test } from '@playwright/test'

test('renders aurora on a clear night and previews it without changing preferences', async ({ page }, info) => {
  test.slow()
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  // Keep interaction tests within the software renderer budget. The separate
  // GPU portability test compiles and samples the full three-layer shader.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 })
    localStorage.setItem('living-meadow:environment', JSON.stringify({ mode: 'manual', dayPhase: .99, seasonIndex: 3, weather: 'clear' }))
    localStorage.setItem('living-meadow:scene', JSON.stringify({ auroraMode: 'night', timePaused: true, quality: 'low' }))
  })
  await page.goto('/?__e2eEffects=0')
  const sample = () => page.evaluate(() => (window as unknown as { __livingMeadowAurora?: { opacity: number; target: number; preview: boolean; time: number; occurrence: number } }).__livingMeadowAurora)
  await expect.poll(async () => (await sample())?.opacity ?? 0, { timeout: 45_000 }).toBeGreaterThan(.2)
  await expect.poll(async () => { const state = await sample(); return state ? state.opacity / Math.max(.001, state.target) : 0 }, { timeout: 45_000 }).toBeGreaterThan(.8)
  await page.screenshot({ path: info.outputPath('aurora-night.png') })
  await page.getByRole('button', { name: 'Environment settings', exact: true }).click()
  await page.getByRole('button', { name: 'Advanced', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Advanced settings', exact: true })).toBeVisible()
  if (await page.getByRole('button', { name: 'Search settings', exact: true }).isVisible()) await page.getByRole('button', { name: 'Search settings', exact: true }).click()
  await page.getByRole('combobox', { name: 'Search all settings' }).fill('aurora mode')
  await page.getByRole('option', { name: /^Aurora mode,/ }).click()
  await page.getByRole('combobox', { name: 'Aurora mode', exact: true }).selectOption('off')
  await expect.poll(async () => (await sample())?.target).toBe(0)
  await expect.poll(async () => (await sample())?.opacity ?? 0).toBeGreaterThan(.01)
  const before = await page.evaluate(() => ({ scene: localStorage.getItem('living-meadow:scene'), environment: localStorage.getItem('living-meadow:environment') }))
  const occurrenceBefore = (await sample())!.occurrence
  await page.getByRole('button', { name: 'Preview aurora', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Stop aurora preview', exact: true })).toBeVisible()
  await expect.poll(async () => (await sample())?.preview).toBe(true)
  await expect.poll(async () => (await sample())?.target ?? 0).toBeGreaterThan(.2)
  expect((await sample())?.time).toBe(0)
  expect((await sample())?.occurrence).toBe(occurrenceBefore + 1)
  expect(await page.evaluate(() => ({ scene: localStorage.getItem('living-meadow:scene'), environment: localStorage.getItem('living-meadow:environment') }))).toEqual(before)
  await page.getByRole('button', { name: 'Stop aurora preview', exact: true }).click()
  await expect.poll(async () => (await sample())?.target).toBe(0)
  await page.getByRole('button', { name: 'Preview aurora', exact: true }).click()
  await expect.poll(async () => (await sample())?.occurrence).toBe(occurrenceBefore + 2)
  expect(errors).toEqual([])
})
