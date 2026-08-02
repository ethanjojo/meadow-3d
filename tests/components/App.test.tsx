import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../../src/App'

vi.mock('@react-three/fiber', () => ({
  Canvas: () => <div data-testid="nature-canvas" />,
}))

describe('App', () => {
  it('renders a full-screen nature experience with an accessible title', () => {
    render(<App />)

    expect(screen.getByRole('main', { name: /živá louka/i })).toBeInTheDocument()
    expect(screen.getByTestId('nature-canvas')).toBeInTheDocument()
  })
})
