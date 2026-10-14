import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AdvancedSettings } from '../../src/components/AdvancedSettings'
import { DEFAULT_AUDIO_SETTINGS } from '../../src/core/audioSettings'
import { DEFAULT_SCENE_SETTINGS } from '../../src/core/sceneSettings'
import { ADVANCED_TABS, SETTINGS_SEARCH_INDEX } from '../../src/core/settingsSearch'
import { PreferencesTools } from '../../src/components/PreferencesTools'
import { DEFAULT_SIMULATION_SETTINGS } from '../../src/core/simulation'
function setup() {
  return render(<AdvancedSettings open sceneSettings={DEFAULT_SCENE_SETTINGS} onSceneChange={vi.fn()} value={DEFAULT_AUDIO_SETTINGS} enabled onChange={vi.fn()} onSoundChange={vi.fn()} onMasterVolumeChange={vi.fn()} preview={null} onPreview={vi.fn()} onStopPreview={vi.fn()} onClose={vi.fn()} onAuroraPreview={vi.fn()} preferencesTools={<PreferencesTools value={{ scene: DEFAULT_SCENE_SETTINGS, audio: DEFAULT_AUDIO_SETTINGS, simulation: DEFAULT_SIMULATION_SETTINGS }} onApply={vi.fn()} />} />)
}
describe('setting search navigation', () => {
  it('starts keyboard navigation at the last result with ArrowUp', () => {
    setup()
    const search = screen.getByRole('combobox', { name: 'Search all settings' })
    fireEvent.change(search, { target: { value: 'aurora' } })
    const results = within(screen.getByRole('listbox', { name: 'Settings search results' })).getAllByRole('option')
    fireEvent.keyDown(search, { key: 'ArrowUp' })
    expect(results.at(-1)).toHaveAttribute('aria-selected', 'true')
    expect(search).toHaveAttribute('aria-activedescendant', results.at(-1)!.id)
  })
  it('has one real destination for every indexed setting, including collapsed groups', () => {
    setup()
    for (const tab of ADVANCED_TABS) {
      fireEvent.click(screen.getByRole('tab', { name: tab.label }))
      const panel = screen.getByRole('tabpanel', { name: tab.label })
      for (const result of SETTINGS_SEARCH_INDEX.filter(item => item.tab === tab.id)) expect(panel.querySelectorAll(`[data-setting-id="${result.id}"]`), result.label).toHaveLength(1)
    }
  })
  it('opens the exact tab and group and highlights and focuses the chosen setting', () => {
    setup()
    fireEvent.change(screen.getByRole('combobox', { name: 'Search all settings' }), { target: { value: 'aurora brightness' } })
    expect(screen.getByRole('tabpanel', { name: 'Sound' })).toBeVisible()
    fireEvent.click(screen.getByRole('option', { name: /^Aurora brightness,/ }))
    expect(screen.getByRole('tab', { name: 'Sky & weather' })).toHaveAttribute('aria-selected', 'true')
    const slider = screen.getByRole('slider', { name: 'Aurora brightness' })
    expect(slider).toHaveFocus()
    expect(slider.closest('[data-setting-id]')).toHaveClass('setting-search-highlight')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
  it('navigates into nested animal settings with the keyboard and closes results before the modal', () => {
    setup()
    const search = screen.getByRole('combobox', { name: 'Search all settings' })
    fireEvent.change(search, { target: { value: 'Cat minimum interval' } })
    fireEvent.keyDown(search, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeVisible()
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'Enter' })
    const interval = screen.getByRole('spinbutton', { name: /Cat minimum interval/ })
    expect(interval).toBeVisible()
    expect(interval).toHaveFocus()
    expect(interval.closest('[data-setting-id]')).toHaveClass('setting-search-highlight')
  })
})
