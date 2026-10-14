import { expect, test } from '@playwright/test'

test('finds and navigates to settings from the header with keyboard and pointer', async ({ page }, info) => {
  test.slow()
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 })
    const highlights: string[] = []
    Object.assign(window, { __settingsHighlights: highlights })
    document.addEventListener('animationstart', event => {
      if ((event as AnimationEvent).animationName === 'setting-found') highlights.push((event.target as HTMLElement).dataset.settingId!)
    }, true)
  })
  await page.goto('/?__e2eEffects=0')
  await page.getByRole('button', { name: 'Environment settings', exact: true }).click()
  await page.getByRole('button', { name: 'Advanced', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Advanced settings', exact: true })
  await expect(dialog).toBeVisible()
  const search = page.getByRole('combobox', { name: 'Search all settings' })
  const expandSearch = async () => { const toggle = page.getByRole('button', { name: 'Search settings', exact: true }); if (await toggle.isVisible()) await toggle.click() }
  await expandSearch()
  await search.fill('cat')
  await expect.poll(() => page.locator('.settings-search-popup').evaluate(element => {
    const popup = element.getBoundingClientRect(), dialog = element.closest('dialog')!.getBoundingClientRect()
    return popup.left >= dialog.left && popup.right <= dialog.right
  })).toBe(true)
  await search.press('ArrowUp')
  const lastResult = page.getByRole('listbox', { name: 'Settings search results' }).getByRole('option').last()
  await expect(lastResult).toHaveAttribute('aria-selected', 'true')
  await expect.poll(() => lastResult.evaluate(element => {
    const row = element.getBoundingClientRect(), list = element.parentElement!.getBoundingClientRect()
    return row.top >= list.top - 1 && row.bottom <= list.bottom + 1
  })).toBe(true)
  await search.fill('cat minimum interval')
  await expect(page.getByRole('option', { name: /^Cat minimum interval,/ })).toBeVisible()
  await search.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(dialog).toBeVisible()
  await search.press('ArrowDown')
  await search.press('Enter')
  const interval = page.getByRole('spinbutton', { name: /^Cat minimum interval/ })
  await expect(interval).toBeFocused()
  await expect(interval).toBeInViewport()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __settingsHighlights: string[] }).__settingsHighlights)).toContain('setting-cat-minimum-interval')
  await expect(page.getByRole('tab', { name: 'Sound', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expandSearch()
  await search.fill('aurora brightness')
  await page.screenshot({ path: info.outputPath('settings-search-results.png') })
  await page.getByRole('option', { name: /^Aurora brightness,/ }).click()
  await expect(page.getByRole('tab', { name: 'Sky & weather', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('slider', { name: 'Aurora brightness', exact: true })).toBeFocused()
  await expect(page.getByRole('slider', { name: 'Aurora brightness', exact: true })).toBeInViewport()
  await page.screenshot({ path: info.outputPath('settings-search-destination.png') })
  await expandSearch()
  await search.fill('export')
  await page.getByRole('option', { name: /^Export settings,/ }).click()
  await expect(page.getByRole('tabpanel', { name: 'Presets' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export settings', exact: true })).toBeFocused()
  expect(await dialog.evaluate(element => {
    const search = element.querySelector<HTMLInputElement>('[aria-label="Search all settings"]')!, close = element.querySelector<HTMLButtonElement>('[aria-label="Close advanced settings"]')!
    return getComputedStyle(search.parentElement!).display === 'none' || search.getBoundingClientRect().right <= close.getBoundingClientRect().left
  })).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
