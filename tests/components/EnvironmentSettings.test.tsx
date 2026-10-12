import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EnvironmentSettings } from '../../src/components/EnvironmentSettings'
import { sampleNatureClock } from '../../src/core/natureClock'
import { DEFAULT_AUDIO_SETTINGS } from '../../src/core/audioSettings'
import {
  createEnvironmentSnapshot,
  DEFAULT_SIMULATION_SETTINGS,
} from '../../src/core/simulation'

const audioProps = {
  audioSettings: DEFAULT_AUDIO_SETTINGS,
  soundEnabled: false,
  onAudioChange: () => undefined,
  onSoundChange: () => undefined,
  onMasterVolumeChange: () => undefined,
  preview: null,
  onPreview: () => undefined,
  onStopPreview: () => undefined,
}

function createVisibleWinterNoon() {
  const auto = sampleNatureClock(90)
  const snapshot = createEnvironmentSnapshot(auto, {
    mode: 'manual',
    dayPhase: 0.5,
    seasonIndex: 2,
    weather: 'storm',
  })

  return {
    ...snapshot,
    seasonPosition: 2.8,
    seasonBlend: 0.8,
  }
}

describe('EnvironmentSettings', () => {
  it('opens, enables manual controls, and emits a weather choice', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <EnvironmentSettings {...audioProps} value={DEFAULT_SIMULATION_SETTINGS} onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /environment settings/i }))

    expect(screen.getByRole('dialog', { name: /environment settings/i })).toBeVisible()
    expect(screen.getByRole('slider', { name: /time of day/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('radio', { name: /manual/i }))
    const manual = { ...DEFAULT_SIMULATION_SETTINGS, mode: 'manual' as const }
    expect(onChange).toHaveBeenLastCalledWith(manual)

    rerender(<EnvironmentSettings {...audioProps} value={manual} onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /storm/i }))
    expect(onChange).toHaveBeenLastCalledWith({ ...manual, weather: 'storm' })
  })

  it('closes on Escape and restores focus to the trigger', () => {
    render(<EnvironmentSettings {...audioProps} value={DEFAULT_SIMULATION_SETTINGS} onChange={() => {}} />)
    const trigger = screen.getByRole('button', { name: /environment settings/i })

    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('moves focus into the dialog when it opens', () => {
    render(<EnvironmentSettings {...audioProps} value={DEFAULT_SIMULATION_SETTINGS} onChange={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /environment settings/i }))

    expect(screen.getByRole('dialog', { name: /environment settings/i })).toHaveFocus()
  })

  it('closes when a visitor clicks outside the popover', () => {
    render(<EnvironmentSettings {...audioProps} value={DEFAULT_SIMULATION_SETTINGS} onChange={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /environment settings/i }))
    fireEvent.pointerDown(document.body)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the throttled visible environment while Auto controls are disabled', () => {
    render(
      <EnvironmentSettings {...audioProps}
        value={DEFAULT_SIMULATION_SETTINGS}
        visibleSnapshot={createVisibleWinterNoon()}
        onChange={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /environment settings/i }))

    const time = screen.getByRole('slider', { name: /time of day/i })
    expect(time).toBeDisabled()
    expect(time).toHaveValue('0.5')
    expect(time).toHaveAttribute('aria-valuetext', 'Noon · 12:00')
    expect(screen.getByText('Noon · 12:00')).toBeVisible()
    expect(screen.getByRole('radio', { name: /winter/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /storm/i })).toBeChecked()
  })

  it('seeds Manual targets from the currently visible Auto environment', () => {
    const onChange = vi.fn()
    render(
      <EnvironmentSettings {...audioProps}
        value={DEFAULT_SIMULATION_SETTINGS}
        visibleSnapshot={createVisibleWinterNoon()}
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /environment settings/i }))
    fireEvent.click(screen.getByRole('radio', { name: /manual/i }))

    expect(onChange).toHaveBeenLastCalledWith({
      mode: 'manual',
      dayPhase: 0.5,
      seasonIndex: 3,
      weather: 'storm',
    })
  })
})
