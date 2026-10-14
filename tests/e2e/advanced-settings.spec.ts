import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

async function openAdvanced(page: Page) {
  await page.getByRole('button', { name: 'Environment settings', exact: true }).click()
  await page.getByRole('button', { name: 'Advanced', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Advanced settings', exact: true })).toBeVisible()
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }))
})

test('edits overnight animal and farm schedules, persists them and keeps a single modal scrollbar', async ({ page }, info) => {
  test.slow()
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('/?__e2eEffects=0')
  await openAdvanced(page)
  await expect(page.getByRole('tab')).toHaveCount(6)
  if (await page.getByRole('button', { name: 'Search settings', exact: true }).isVisible()) await page.getByRole('button', { name: 'Search settings', exact: true }).click()
  await page.getByRole('combobox', { name: 'Search all settings' }).fill('cat activity')
  await page.getByRole('option', { name: /^Cat activity,/ }).click()
  await page.getByLabel('Cat activity', { exact: true }).selectOption('custom')
  await page.getByLabel(/^Cat from/).fill('23:00')
  await page.getByLabel(/^Cat until/).fill('04:00')
  await page.getByLabel(/^Cat minimum interval/).fill('8')
  await page.getByLabel(/^Cat maximum interval/).fill('12')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('living-meadow:audio')!).calls.cat)).toMatchObject({ activity: 'custom', startHour: 23, endHour: 4, minInterval: 8, maxInterval: 12 })
  await page.getByRole('tab', { name: 'Farm', exact: true }).click()
  await page.locator('summary').filter({ hasText: 'Window lights' }).click()
  await page.getByLabel('Window light schedule', { exact: true }).selectOption('custom')
  await page.getByLabel(/^Lights on at/).fill('22:00')
  await page.getByLabel(/^Lights off at/).fill('04:00')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('living-meadow:scene')!))).toMatchObject({ farmLightMode: 'custom', farmLightStart: 22, farmLightEnd: 4 })
  const layout = await page.getByRole('dialog', { name: 'Advanced settings', exact: true }).evaluate(dialog => ({
    scrollbars: [...dialog.querySelectorAll('*'), dialog].filter(element => {
      const style = getComputedStyle(element)
      return ['auto', 'scroll'].includes(style.overflowY) && element.scrollHeight > element.clientHeight + 2
    }).length,
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    bottom: dialog.getBoundingClientRect().bottom,
    height: window.innerHeight,
  }))
  expect(layout.scrollbars).toBe(1)
  expect(layout.overflow).toBe(false)
  expect(layout.bottom).toBeLessThanOrEqual(layout.height)
  await page.getByRole('tab', { name: 'Farm', exact: true }).click()
  await page.screenshot({ path: info.outputPath('advanced-farm.png') })
  await page.reload()
  await openAdvanced(page)
  if (await page.getByRole('button', { name: 'Search settings', exact: true }).isVisible()) await page.getByRole('button', { name: 'Search settings', exact: true }).click()
  await page.getByRole('combobox', { name: 'Search all settings' }).fill('cat activity')
  await page.getByRole('option', { name: /^Cat activity,/ }).click()
  await expect(page.getByLabel('Cat activity', { exact: true })).toHaveValue('custom')
  await expect(page.getByLabel(/^Cat from/)).toHaveValue('23:00')
  expect(errors).toEqual([])
})

test('saves, reapplies and exports a preset, rejecting invalid imports without changing preferences', async ({ page }) => {
  test.slow()
  await page.goto('/?__e2eEffects=0')
  await openAdvanced(page)
  await page.getByRole('tab', { name: 'Presets', exact: true }).click()
  await page.getByLabel('Preset name', { exact: true }).fill('Evening test')
  await page.getByRole('button', { name: 'Save preset', exact: true }).click()
  await page.getByRole('tab', { name: 'Nature', exact: true }).click()
  await page.getByRole('slider', { name: 'Flower density', exact: true }).fill('5')
  await page.getByRole('tab', { name: 'Presets', exact: true }).click()
  await page.getByRole('combobox', { name: 'Saved presets', exact: true }).selectOption({ label: 'Evening test' })
  await page.getByRole('button', { name: 'Apply preset', exact: true }).click()
  await page.getByRole('tab', { name: 'Nature', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Flower density', exact: true })).toHaveValue('33')
  await page.getByRole('tab', { name: 'Presets', exact: true }).click()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export settings', exact: true }).click()
  const path = await (await downloadEvent).path()
  const exported = JSON.parse(await readFile(path!, 'utf8'))
  expect(exported.version).toBe(1)
  expect(exported.scene.flowerDensity).toBeCloseTo(1 / 3)
  expect(exported.audio.calls.cat).toHaveProperty('activity')
  const before = await page.evaluate(() => localStorage.getItem('living-meadow:scene'))
  await page.getByLabel('Import settings file', { exact: true }).setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') })
  await expect(page.getByRole('alert')).toContainText('Your settings have not changed')
  expect(await page.evaluate(() => localStorage.getItem('living-meadow:scene'))).toBe(before)
  exported.scene.flowerDensity = .2
  await page.getByLabel('Import settings file', { exact: true }).setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) })
  await page.getByRole('tab', { name: 'Nature', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Flower density', exact: true })).toHaveValue('20')
  await page.getByRole('tab', { name: 'Time & performance', exact: true }).click()
  await page.locator('summary').filter({ hasText: 'Performance' }).click()
  await page.getByRole('switch', { name: 'Power saving', exact: false }).check()
  await expect(page.getByRole('main')).toHaveAttribute('data-quality', 'low')
  await page.getByRole('button', { name: 'Close advanced settings', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Environment settings', exact: true })).toBeFocused()
})
