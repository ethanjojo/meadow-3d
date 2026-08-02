import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/App'
import { hasWebGLSupport } from '../../src/core/webgl'

vi.mock('@react-three/fiber', () => ({
  Canvas: () => <div data-testid="nature-canvas" />,
}))

vi.mock('../../src/core/webgl', () => ({
  hasWebGLSupport: vi.fn(() => true),
}))

beforeEach(() => {
  vi.mocked(hasWebGLSupport).mockReturnValue(true)
})

describe('App', () => {
  it('renders a full-screen nature experience with an accessible title', () => {
    render(<App />)

    expect(screen.getByRole('main', { name: /živá louka/i })).toBeInTheDocument()
    expect(screen.getByTestId('nature-canvas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /zapnout zvuk/i })).toBeInTheDocument()
  })

  it('shows a deliberate static scene when WebGL is unavailable', () => {
    vi.mocked(hasWebGLSupport).mockReturnValue(false)
    render(<App />)

    expect(screen.queryByTestId('nature-canvas')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: /klidná louka/i })).toBeInTheDocument()
  })
})
