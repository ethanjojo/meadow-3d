import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PreferencesTools } from '../../src/components/PreferencesTools'
import { DEFAULT_AUDIO_SETTINGS } from '../../src/core/audioSettings'
import { DEFAULT_SCENE_SETTINGS } from '../../src/core/sceneSettings'
import { DEFAULT_SIMULATION_SETTINGS } from '../../src/core/simulation'
import { exportPreferences } from '../../src/core/preferences'
const value = { audio: DEFAULT_AUDIO_SETTINGS, scene: DEFAULT_SCENE_SETTINGS, simulation: DEFAULT_SIMULATION_SETTINGS }
beforeEach(() => localStorage.clear())
describe('preset tools', () => {
  it('saves a snapshot and applies it after the live preferences have changed', () => {
    const onApply = vi.fn()
    const { rerender } = render(<PreferencesTools value={value} onApply={onApply} />)
    fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'My evening' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save preset' }))
    rerender(<PreferencesTools value={{ ...value, scene: { ...value.scene, farmLightStart: 20 } }} onApply={onApply} />)
    fireEvent.click(screen.getByRole('button', { name: 'Apply preset' }))
    expect(onApply).toHaveBeenCalledWith(value)
    fireEvent.click(screen.getByRole('button', { name: 'Delete preset' }))
    expect(JSON.parse(localStorage.getItem('living-meadow:presets')!)).toEqual([])
  })
  it('leaves live settings untouched when an imported file is invalid', async () => {
    const onApply = vi.fn()
    render(<PreferencesTools value={value} onApply={onApply} />)
    const file = new File(['invalid'], 'settings.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => '{}' })
    fireEvent.change(screen.getByLabelText('Import settings file'), { target: { files: [file] } })
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Your settings have not changed'))
    expect(onApply).not.toHaveBeenCalled()
  })
  it('applies the complete validated import in one callback', async () => {
    const onApply = vi.fn()
    render(<PreferencesTools value={value} onApply={onApply} />)
    const file = new File(['valid'], 'settings.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => exportPreferences(value) })
    fireEvent.change(screen.getByLabelText('Import settings file'), { target: { files: [file] } })
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(value))
  })
})
