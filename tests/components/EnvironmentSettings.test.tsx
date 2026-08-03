import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EnvironmentSettings } from '../../src/components/EnvironmentSettings'
import { sampleNatureClock } from '../../src/core/natureClock'
import {
  createEnvironmentSnapshot,
  DEFAULT_SIMULATION_SETTINGS,
} from '../../src/core/simulation'

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
      <EnvironmentSettings value={DEFAULT_SIMULATION_SETTINGS} onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /nastavení prostředí/i }))

    expect(screen.getByRole('dialog', { name: /nastavení prostředí/i })).toBeVisible()
    expect(screen.getByRole('slider', { name: /čas dne/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('radio', { name: /ručně/i }))
    const manual = { ...DEFAULT_SIMULATION_SETTINGS, mode: 'manual' as const }
    expect(onChange).toHaveBeenLastCalledWith(manual)

    rerender(<EnvironmentSettings value={manual} onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /bouřka/i }))
    expect(onChange).toHaveBeenLastCalledWith({ ...manual, weather: 'storm' })
  })

  it('closes on Escape and restores focus to the trigger', () => {
    render(<EnvironmentSettings value={DEFAULT_SIMULATION_SETTINGS} onChange={() => {}} />)
    const trigger = screen.getByRole('button', { name: /nastavení prostředí/i })

    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('moves focus into the dialog when it opens', () => {
    render(<EnvironmentSettings value={DEFAULT_SIMULATION_SETTINGS} onChange={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /nastavení prostředí/i }))

    expect(screen.getByRole('dialog', { name: /nastavení prostředí/i })).toHaveFocus()
  })

  it('closes when a visitor clicks outside the popover', () => {
    render(<EnvironmentSettings value={DEFAULT_SIMULATION_SETTINGS} onChange={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /nastavení prostředí/i }))
    fireEvent.pointerDown(document.body)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the throttled visible environment while Auto controls are disabled', () => {
    render(
      <EnvironmentSettings
        value={DEFAULT_SIMULATION_SETTINGS}
        visibleSnapshot={createVisibleWinterNoon()}
        onChange={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /nastavení prostředí/i }))

    const time = screen.getByRole('slider', { name: /čas dne/i })
    expect(time).toBeDisabled()
    expect(time).toHaveValue('0.5')
    expect(time).toHaveAttribute('aria-valuetext', 'Poledne · 12:00')
    expect(screen.getByText('Poledne · 12:00')).toBeVisible()
    expect(screen.getByRole('radio', { name: /zima/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /bouřka/i })).toBeChecked()
  })

  it('seeds Manual targets from the currently visible Auto environment', () => {
    const onChange = vi.fn()
    render(
      <EnvironmentSettings
        value={DEFAULT_SIMULATION_SETTINGS}
        visibleSnapshot={createVisibleWinterNoon()}
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /nastavení prostředí/i }))
    fireEvent.click(screen.getByRole('radio', { name: /ručně/i }))

    expect(onChange).toHaveBeenLastCalledWith({
      mode: 'manual',
      dayPhase: 0.5,
      seasonIndex: 3,
      weather: 'storm',
    })
  })
})
