import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SoundToggle } from '../../src/components/SoundToggle'

const volumeProps = { volume: 1, onVolumeChange: () => undefined }

describe('SoundToggle', () => {
  it('starts muted and exposes its state accessibly', () => {
    render(<SoundToggle {...volumeProps} enabled={false} onChange={() => undefined} />)

    expect(
      screen.getByRole('button', { name: /turn sound on/i }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('requests sound after a visitor gesture', () => {
    const onChange = vi.fn()
    render(<SoundToggle {...volumeProps} enabled={false} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button'))

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('offers to mute an enabled ambience', () => {
    render(<SoundToggle {...volumeProps} enabled onChange={() => undefined} />)
    expect(
      screen.getByRole('button', { name: /turn sound off/i }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('changes master volume without toggling mute', () => {
    const onChange = vi.fn()
    const onVolumeChange = vi.fn()
    render(<SoundToggle enabled volume={0.6} onChange={onChange} onVolumeChange={onVolumeChange} />)
    fireEvent.change(screen.getByRole('slider', { name: 'Master volume' }), { target: { value: '30' } })
    expect(onVolumeChange).toHaveBeenCalledWith(0.3)
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button').textContent).toBe('')
  })
  it('shows zero volume while muted', () => {
    render(<SoundToggle enabled={false} volume={0.8} onChange={() => undefined} onVolumeChange={() => undefined} />)
    expect(screen.getByRole('slider', { name: 'Master volume' })).toHaveValue('0')
    expect(screen.getByRole('slider', { name: 'Master volume' })).toHaveAttribute('aria-orientation', 'vertical')
  })
})
