import { describe, expect, it } from 'vitest'
import { sampleNatureClock } from '../../src/core/natureClock'
import {
  DEFAULT_SIMULATION_SETTINGS,
  createEnvironmentSnapshot,
  parseSimulationSettings,
  stepEnvironment,
} from '../../src/core/simulation'

describe('environment simulation', () => {
  it('rejects invalid persisted controls', () => {
    expect(parseSimulationSettings({ mode: 'broken' })).toEqual(
      DEFAULT_SIMULATION_SETTINGS,
    )
  })

  it.each([
    { mode: 'auto', dayPhase: -0.01, seasonIndex: 0, weather: 'clear' },
    { mode: 'auto', dayPhase: 1.01, seasonIndex: 0, weather: 'clear' },
    { mode: 'auto', dayPhase: 0.5, seasonIndex: 4, weather: 'clear' },
    { mode: 'auto', dayPhase: 0.5, seasonIndex: 0, weather: 'windy' },
  ])('rejects an invalid persisted field', (value) => {
    expect(parseSimulationSettings(value)).toEqual(DEFAULT_SIMULATION_SETTINGS)
  })

  it('moves toward manual targets without snapping', () => {
    const auto = sampleNatureClock(90)
    const current = createEnvironmentSnapshot(auto, DEFAULT_SIMULATION_SETTINGS)
    const manual = {
      mode: 'manual' as const,
      dayPhase: 0,
      seasonIndex: 3 as const,
      weather: 'snow' as const,
    }
    const next = stepEnvironment(current, auto, manual, 1 / 60)

    expect(next.dayPhase).not.toBe(current.dayPhase)
    expect(next.dayPhase).not.toBe(manual.dayPhase)
    expect(next.weather.snow).toBeGreaterThan(current.weather.snow)
    expect(next.weather.snow).toBeLessThan(1)
  })

  it('rejoins the still-running auto clock through interpolation', () => {
    const oldAuto = sampleNatureClock(20)
    const current = createEnvironmentSnapshot(oldAuto, {
      mode: 'manual', dayPhase: 0.75, seasonIndex: 2, weather: 'storm',
    })
    const liveAuto = sampleNatureClock(140)
    const next = stepEnvironment(
      current,
      liveAuto,
      DEFAULT_SIMULATION_SETTINGS,
      1 / 60,
    )

    expect(next.dayPhase).not.toBe(liveAuto.dayPhase)
    expect(next.autoElapsed).toBe(liveAuto.elapsed)
  })

  it('caps a long frame delta before applying damping', () => {
    const auto = sampleNatureClock(90)
    const current = createEnvironmentSnapshot(auto, DEFAULT_SIMULATION_SETTINGS)
    const manual = {
      mode: 'manual' as const,
      dayPhase: 0,
      seasonIndex: 3 as const,
      weather: 'snow' as const,
    }

    expect(stepEnvironment(current, auto, manual, 10)).toEqual(
      stepEnvironment(current, auto, manual, 0.1),
    )
  })
})
