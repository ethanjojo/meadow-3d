import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/App'
import type {
  EnvironmentSnapshot,
  EnvironmentTransitionFrame,
  SimulationSettings,
} from '../../src/core/simulation'
import { hasWebGLSupport } from '../../src/core/webgl'

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) => (
    <div data-testid="nature-canvas">{children}</div>
  ),
}))

vi.mock('../../src/scene/NatureScene', () => ({
  NatureScene: ({
    simulationSettings,
    onNatureSample,
  }: {
    simulationSettings: SimulationSettings
    onNatureSample?: (frame: EnvironmentTransitionFrame) => void
  }) => (
    <>
      <output data-testid="simulation-mode">{simulationSettings.mode}</output>
      <button
        type="button"
        aria-label="Publikovat živý stav scény"
        onClick={() => {
          const snapshot: EnvironmentSnapshot = {
            elapsed: 90,
            autoElapsed: 90,
            dayPhase: 0.5,
            seasonPhase: 0.7,
            seasonIndex: 2,
            nextSeasonIndex: 3,
            seasonBlend: 0.8,
            seasonPosition: 2.8,
            windStrength: 0.95,
            weatherIntensity: 1,
            weather: {
              preset: 'storm',
              cloudCover: 1,
              fog: 0.55,
              rain: 1,
              snow: 0,
              storm: 1,
              wetness: 1,
              fireflies: 0,
              dew: 0,
              windStrength: 0.95,
              windDirection: [0.86, 0.5],
            },
          }
          onNatureSample?.({
            source: snapshot,
            target: snapshot,
            snapshot,
            progress: 0.4,
            elapsed: 1.2,
            active: true,
            settingsKey: 'manual:0.5:2:storm',
            revision: 2,
          })
        }}
      />
    </>
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

  it('loads valid environment settings into the controls and scene state', () => {
    localStorage.setItem(
      'living-meadow:environment',
      JSON.stringify({
        mode: 'manual',
        dayPhase: 0,
        seasonIndex: 3,
        weather: 'snow',
      }),
    )
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /nastavení prostředí/i }))

    expect(screen.getByRole('radio', { name: /ručně/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /zima/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /sněžení/i })).toBeChecked()
    expect(screen.getByRole('main', { name: /živá louka/i })).toHaveAttribute(
      'data-simulation-mode',
      'manual',
    )
    expect(screen.getByRole('main', { name: /živá louka/i })).toHaveAttribute(
      'data-weather',
      'snow',
    )
    expect(screen.getByRole('main', { name: /živá louka/i })).toHaveAttribute(
      'data-season',
      '3',
    )
  })

  it('falls back safely when stored settings contain malformed JSON', () => {
    localStorage.setItem('living-meadow:environment', '{malformed')

    render(<App />)

    expect(screen.getByRole('button', { name: /nastavení prostředí/i })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: /živá louka/i })).toHaveAttribute(
      'data-simulation-mode',
      'auto',
    )
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

  it('forwards the throttled visible scene state to Auto settings labels', () => {
    render(<App />)

    fireEvent.click(
      screen.getByRole('button', { name: /publikovat živý stav scény/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /nastavení prostředí/i }))

    expect(screen.getByRole('slider', { name: /čas dne/i })).toHaveAttribute(
      'aria-valuetext',
      'Poledne · 12:00',
    )
    expect(screen.getByRole('radio', { name: /zima/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /bouřka/i })).toBeChecked()
    expect(screen.getByRole('main', { name: /živá louka/i })).toHaveAttribute(
      'data-transition-active',
      'true',
    )
    expect(screen.getByRole('main', { name: /živá louka/i })).toHaveAttribute(
      'data-transition-progress',
      '0.4',
    )
    expect(screen.getByRole('main', { name: /živá louka/i })).toHaveAttribute(
      'data-auto-elapsed',
      '90',
    )
    expect(screen.getByRole('main', { name: /živá louka/i })).toHaveAttribute(
      'data-transition-revision',
      '2',
    )
  })
})
