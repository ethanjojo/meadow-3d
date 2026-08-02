import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SoundToggle } from '../../src/components/SoundToggle'

describe('SoundToggle', () => {
  it('starts muted and exposes its state accessibly', () => {
    render(<SoundToggle enabled={false} onChange={() => undefined} />)

    expect(
      screen.getByRole('button', { name: /zapnout zvuk/i }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('requests sound after a visitor gesture', () => {
    const onChange = vi.fn()
    render(<SoundToggle enabled={false} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button'))

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('offers to mute an enabled ambience', () => {
    render(<SoundToggle enabled onChange={() => undefined} />)
    expect(
      screen.getByRole('button', { name: /vypnout zvuk/i }),
    ).toHaveAttribute('aria-pressed', 'true')
  })
})
