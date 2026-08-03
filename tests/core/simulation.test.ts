import { describe, expect, it } from 'vitest'
import { sampleNatureClock } from '../../src/core/natureClock'
import {
  DEFAULT_SIMULATION_SETTINGS,
  ENVIRONMENT_TRANSITION_DURATION,
  createEnvironmentTransition,
  parseSimulationSettings,
  stepEnvironmentTransition,
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

  it('completes a manual transition in three seconds while auto time continues', () => {
    const auto = sampleNatureClock(90)
    const frame = createEnvironmentTransition(auto, DEFAULT_SIMULATION_SETTINGS)
    const manual = {
      mode: 'manual' as const,
      dayPhase: 0,
      seasonIndex: 3 as const,
      weather: 'snow' as const,
    }

    stepEnvironmentTransition(frame, auto, manual, 0)
    expect(frame.active).toBe(true)
    expect(frame.progress).toBe(0)
    expect(frame.revision).toBe(1)

    for (let tick = 1; tick <= 90; tick += 1) {
      stepEnvironmentTransition(
        frame,
        sampleNatureClock(90 + tick / 60),
        manual,
        1 / 60,
      )
    }

    expect(frame.progress).toBeCloseTo(0.5, 5)
    expect(frame.snapshot.autoElapsed).toBeCloseTo(91.5, 5)
    expect(frame.snapshot.weather.snow).toBeGreaterThan(0)
    expect(frame.snapshot.weather.snow).toBeLessThan(1)

    for (let tick = 91; tick <= 180; tick += 1) {
      stepEnvironmentTransition(
        frame,
        sampleNatureClock(90 + tick / 60),
        manual,
        1 / 60,
      )
    }

    expect(ENVIRONMENT_TRANSITION_DURATION).toBe(3)
    expect(frame.active).toBe(false)
    expect(frame.progress).toBe(1)
    expect(frame.snapshot.dayPhase).toBe(manual.dayPhase)
    expect(frame.snapshot.weather.snow).toBe(1)
    expect(frame.snapshot.autoElapsed).toBeCloseTo(93, 5)
  })

  it('retargets from the exact displayed state and increments revision once', () => {
    const auto = sampleNatureClock(40)
    const snow = {
      mode: 'manual' as const,
      dayPhase: 0.05,
      seasonIndex: 3 as const,
      weather: 'snow' as const,
    }
    const storm = {
      mode: 'manual' as const,
      dayPhase: 0.7,
      seasonIndex: 2 as const,
      weather: 'storm' as const,
    }
    const frame = createEnvironmentTransition(auto, DEFAULT_SIMULATION_SETTINGS)

    stepEnvironmentTransition(frame, auto, snow, 0)
    for (let tick = 1; tick <= 60; tick += 1) {
      stepEnvironmentTransition(
        frame,
        sampleNatureClock(40 + tick / 60),
        snow,
        1 / 60,
      )
    }
    const displayed = {
      dayPhase: frame.snapshot.dayPhase,
      seasonPosition: frame.snapshot.seasonPosition,
      snow: frame.snapshot.weather.snow,
    }
    const previousRevision = frame.revision

    stepEnvironmentTransition(frame, sampleNatureClock(41), storm, 0)

    expect(frame.revision).toBe(previousRevision + 1)
    expect(frame.source.dayPhase).toBeCloseTo(displayed.dayPhase)
    expect(frame.source.seasonPosition).toBeCloseTo(displayed.seasonPosition)
    expect(frame.source.weather.snow).toBeCloseTo(displayed.snow)
    expect(frame.source).not.toBe(frame.snapshot)

    stepEnvironmentTransition(frame, sampleNatureClock(41 + 1 / 60), storm, 1 / 60)
    expect(frame.revision).toBe(previousRevision + 1)
  })

  it('returns to the latest still-running automatic target', () => {
    const oldAuto = sampleNatureClock(20)
    const manual = {
      mode: 'manual' as const,
      dayPhase: 0.75,
      seasonIndex: 2 as const,
      weather: 'storm' as const,
    }
    const frame = createEnvironmentTransition(oldAuto, manual)
    const liveAuto = sampleNatureClock(140)

    stepEnvironmentTransition(frame, liveAuto, DEFAULT_SIMULATION_SETTINGS, 0)

    expect(frame.active).toBe(true)
    expect(frame.target.dayPhase).toBeCloseTo(liveAuto.dayPhase)
    expect(frame.target.autoElapsed).toBe(liveAuto.elapsed)
    expect(frame.snapshot.dayPhase).not.toBe(liveAuto.dayPhase)
    expect(frame.snapshot.autoElapsed).toBe(liveAuto.elapsed)
  })

  it('caps a long frame delta at half a second', () => {
    const auto = sampleNatureClock(90)
    const manual = {
      mode: 'manual' as const,
      dayPhase: 0,
      seasonIndex: 3 as const,
      weather: 'snow' as const,
    }
    const stalled = createEnvironmentTransition(auto, DEFAULT_SIMULATION_SETTINGS)
    const capped = createEnvironmentTransition(auto, DEFAULT_SIMULATION_SETTINGS)
    stepEnvironmentTransition(stalled, auto, manual, 0)
    stepEnvironmentTransition(capped, auto, manual, 0)

    stepEnvironmentTransition(stalled, auto, manual, 10)
    stepEnvironmentTransition(capped, auto, manual, 0.5)

    expect(stalled.progress).toBe(capped.progress)
    expect(stalled.snapshot.dayPhase).toBe(capped.snapshot.dayPhase)
    expect(stalled.snapshot.weather.snow).toBe(capped.snapshot.weather.snow)
  })
})
