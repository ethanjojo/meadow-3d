import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EnvironmentSettings } from '../../src/components/EnvironmentSettings'
import { DEFAULT_SIMULATION_SETTINGS } from '../../src/core/simulation'

describe('EnvironmentSettings', () => {
  it('opens, enables manual controls, and emits a weather choice', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <EnvironmentSettings value={DEFAULT_SIMULATION_SETTINGS} onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /nastavení prostředí/i }))

    expect(screen.getByRole('dialog', { name: /nastavení prostředí/i })).toBeVisible()
    expect(screen.getByLabelText(/čas dne/i)).toBeDisabled()

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
})
