import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/App'
import { hasWebGLSupport } from '../../src/core/webgl'

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => (
    <div data-testid="nature-canvas">{children}</div>
  ),
}))

vi.mock('../../src/scene/NatureScene', () => ({
  NatureScene: ({ simulationSettings }: { simulationSettings: { mode: string } }) => (
    <output data-testid="simulation-mode">{simulationSettings.mode}</output>
  ),
}))

vi.mock('../../src/core/webgl', () => ({
  hasWebGLSupport: vi.fn(() => true),
}))

beforeEach(() => {
  vi.mocked(hasWebGLSupport).mockReturnValue(true)
  localStorage.clear()
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

  it('persists an environment choice only after a visitor changes it', () => {
    render(<App />)

    expect(localStorage.getItem('living-meadow:environment')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /nastavení prostředí/i }))
    fireEvent.click(screen.getByRole('radio', { name: /ručně/i }))

    expect(JSON.parse(localStorage.getItem('living-meadow:environment') ?? '')).toEqual({
      mode: 'manual',
      dayPhase: 0.31,
      seasonIndex: 0,
      weather: 'clear',
    })
  })

  it('restores a validated environment choice from storage', () => {
    localStorage.setItem(
      'living-meadow:environment',
      JSON.stringify({
        mode: 'manual',
        dayPhase: 0.72,
        seasonIndex: 2,
        weather: 'storm',
      }),
    )
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /nastavení prostředí/i }))

    expect(screen.getByLabelText(/čas dne/i)).toBeEnabled()
    expect(screen.getByRole('radio', { name: /bouřka/i })).toBeChecked()
  })

  it('falls back safely when stored settings contain malformed JSON', () => {
    localStorage.setItem('living-meadow:environment', '{malformed')

    render(<App />)

    expect(screen.getByRole('button', { name: /nastavení prostředí/i })).toBeInTheDocument()
  })

  it('passes the app-owned simulation settings to the scene', () => {
    localStorage.setItem(
      'living-meadow:environment',
      JSON.stringify({
        mode: 'manual',
        dayPhase: 0.72,
        seasonIndex: 2,
        weather: 'storm',
      }),
    )

    render(<App />)

    expect(screen.getByTestId('simulation-mode')).toHaveTextContent('manual')
  })
})
