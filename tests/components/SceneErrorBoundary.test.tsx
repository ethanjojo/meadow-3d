import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SceneErrorBoundary } from '../../src/components/SceneErrorBoundary'

function BrokenScene(): never {
  throw new Error('context lost')
}

describe('SceneErrorBoundary', () => {
  it('replaces a crashed scene with the supplied fallback', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(
      <SceneErrorBoundary fallback={<p>Calm fallback meadow</p>}>
        <BrokenScene />
      </SceneErrorBoundary>,
    )

    expect(screen.getByText('Calm fallback meadow')).toBeInTheDocument()
    consoleError.mockRestore()
  })
})
