import type { ReactNode } from 'react'
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react'
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
        aria-label="Publish visible scene state"
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

vi.mock('../../src/audio/ambientAudio', () => ({
  createAmbientAudio: () => ({ start: vi.fn(async () => true), suspend: vi.fn(async () => {}), resume: vi.fn(async () => {}), dispose: vi.fn(async () => {}),
    setAudioSettings: vi.fn(), setNature: vi.fn(), preview: vi.fn(async () => true), stopPreview: vi.fn() }),
}))

beforeEach(() => {
  vi.mocked(hasWebGLSupport).mockReturnValue(true)
  localStorage.clear()
})

describe('App', () => {
  it('switches advanced tabs, saves scene preferences independently and restores defaults', async () => {
    const { unmount } = render(<App />)
    const open = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Environment settings' }))
      fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
      await screen.findByRole('dialog', { name: 'Advanced settings' })
    }
    await open()
    const sound = screen.getByRole('tab', { name: 'Sound' })
    fireEvent.keyDown(sound, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Scene' })).toHaveFocus()
    expect(screen.queryByRole('slider', { name: 'Cow' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('slider', { name: 'Flower density' }), { target: { value: '75' } })
    fireEvent.click(screen.getByRole('switch', { name: /Shooting stars/ }))
    expect(JSON.parse(localStorage.getItem('living-meadow:scene')!)).toMatchObject({ flowerDensity: .75, shootingStars: false })
    expect(localStorage.getItem('living-meadow:audio')).toBeNull()
    unmount()
    render(<App />)
    await open()
    fireEvent.click(screen.getByRole('tab', { name: 'Scene' }))
    expect(screen.getByRole('slider', { name: 'Flower density' })).toHaveValue('75')
    expect(screen.getByRole('switch', { name: /Shooting stars/ })).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Reset scene' }))
    expect(screen.getByRole('slider', { name: 'Flower density' })).toHaveValue('33')
    expect(screen.getByRole('switch', { name: /Shooting stars/ })).toBeChecked()
  })
  it('persists individual audio levels and shares master volume between controls', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Environment settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    const dialog = await screen.findByRole('dialog', { name: 'Advanced settings' })
    expect(dialog).toBeVisible()
    fireEvent.change(within(dialog).getByRole('slider', { name: 'Master volume' }), { target: { value: '55' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Turn sound off' })).toBeInTheDocument())
    fireEvent.change(screen.getByRole('slider', { name: 'Cow' }), { target: { value: '20' } })
    const settings = JSON.parse(localStorage.getItem('living-meadow:audio') ?? '')
    expect(settings.master).toBe(0.55)
    expect(settings.channels.cow).toBe(0.2)
    expect(settings.channels.dog).toBe(1)
    expect(within(screen.getByRole('button', { name: 'Turn sound off' }).parentElement!).getByLabelText('Master volume')).toHaveValue('55')
    fireEvent.click(screen.getByRole('button', { name: 'Reset levels' }))
    expect(JSON.parse(localStorage.getItem('living-meadow:audio') ?? '').channels.cow).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close advanced settings' }))
    expect(screen.queryByRole('dialog', { name: 'Advanced settings' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Environment settings' })).toHaveFocus()
  })
  it('unmutes when increasing volume, shows zero on mute, and restores volume on unmute', async () => {
    render(<App />)
    const control = screen.getByRole('button', { name: 'Turn sound on' }).parentElement!
    const slider = within(control).getByLabelText('Master volume')
    expect(slider).toHaveValue('0')
    fireEvent.change(slider, { target: { value: '40' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Turn sound off' })).toBeInTheDocument())
    expect(slider).toHaveValue('40')
    fireEvent.click(screen.getByRole('button', { name: 'Turn sound off' }))
    expect(slider).toHaveValue('0')
    fireEvent.click(screen.getByRole('button', { name: 'Turn sound on' }))
    await waitFor(() => expect(slider).toHaveValue('40'))
    fireEvent.change(slider, { target: { value: '0' } })
    expect(screen.getByRole('button', { name: 'Turn sound on' })).toBeInTheDocument()
  })
  it('renders a full-screen nature experience with an accessible title', () => {
    render(<App />)

    expect(screen.getByRole('main', { name: /living meadow/i })).toBeInTheDocument()
    expect(screen.getByTestId('nature-canvas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /turn sound on/i })).toBeInTheDocument()
  })

  it('shows a deliberate static scene when WebGL is unavailable', () => {
    vi.mocked(hasWebGLSupport).mockReturnValue(false)
    render(<App />)

    expect(screen.queryByTestId('nature-canvas')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: /calm meadow/i })).toBeInTheDocument()
  })

  it('persists an environment choice only after a visitor changes it', () => {
    render(<App />)

    expect(localStorage.getItem('living-meadow:environment')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /environment settings/i }))
    fireEvent.click(screen.getByRole('radio', { name: /manual/i }))

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

    fireEvent.click(screen.getByRole('button', { name: /environment settings/i }))

    expect(screen.getByRole('radio', { name: /manual/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /winter/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /snow/i })).toBeChecked()
    expect(screen.getByRole('main', { name: /living meadow/i })).toHaveAttribute(
      'data-simulation-mode',
      'manual',
    )
    expect(screen.getByRole('main', { name: /living meadow/i })).toHaveAttribute(
      'data-weather',
      'snow',
    )
    expect(screen.getByRole('main', { name: /living meadow/i })).toHaveAttribute(
      'data-season',
      '3',
    )
  })

  it('falls back safely when stored settings contain malformed JSON', () => {
    localStorage.setItem('living-meadow:environment', '{malformed')

    render(<App />)

    expect(screen.getByRole('button', { name: /environment settings/i })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: /living meadow/i })).toHaveAttribute(
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
      screen.getByRole('button', { name: /publish visible scene state/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: /environment settings/i }))

    expect(screen.getByRole('slider', { name: /time of day/i })).toHaveAttribute(
      'aria-valuetext',
      'Noon · 12:00',
    )
    expect(screen.getByRole('radio', { name: /winter/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /storm/i })).toBeChecked()
    expect(screen.getByRole('main', { name: /living meadow/i })).toHaveAttribute(
      'data-transition-active',
      'true',
    )
    expect(screen.getByRole('main', { name: /living meadow/i })).toHaveAttribute(
      'data-transition-progress',
      '0.4',
    )
    expect(screen.getByRole('main', { name: /living meadow/i })).toHaveAttribute(
      'data-auto-elapsed',
      '90',
    )
    expect(screen.getByRole('main', { name: /living meadow/i })).toHaveAttribute(
      'data-transition-revision',
      '2',
    )
  })
})
