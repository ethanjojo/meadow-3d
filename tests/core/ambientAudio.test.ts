import { describe, expect, it } from 'vitest'
import {
  deriveAmbientAudioMix,
  deriveAmbientAudioMixFromFrame,
} from '../../src/audio/ambientAudio'
import { DEFAULT_CLOCK, sampleNatureClock } from '../../src/core/natureClock'
import {
  createEnvironmentTransition,
  stepEnvironmentTransition,
  createEnvironmentSnapshot,
} from '../../src/core/simulation'

function createSnapshot(dayPhase: number, weather: 'clear' | 'rain' = 'clear') {
  return createEnvironmentSnapshot(
    sampleNatureClock(DEFAULT_CLOCK.dayDuration * dayPhase),
    {
      mode: 'manual',
      dayPhase,
      seasonIndex: 1,
      weather,
    },
  )
}

describe('deriveAmbientAudioMix', () => {
  it('routes daytime birds through an audible day layer', () => {
    const mix = deriveAmbientAudioMix(createSnapshot(0.5))

    expect(mix.dayGain).toBeGreaterThan(0)
    expect(mix.birdGain).toBeGreaterThan(0)
  })

  it('silences daytime birds at night and reduces them in rain', () => {
    const clear = deriveAmbientAudioMix(createSnapshot(0))
    const rain = deriveAmbientAudioMix(createSnapshot(0, 'rain'))

    expect(clear.birdGain).toBe(0)
    expect(clear.dayGain).toBe(0)
    expect(rain.birdGain).toBe(0)
    expect(deriveAmbientAudioMix(createSnapshot(0.5, 'rain')).birdGain).toBeLessThan(deriveAmbientAudioMix(createSnapshot(0.5)).birdGain)
  })

  it('crossfades day and night endpoints instead of sampling accelerated time', () => {
    const noonAuto = sampleNatureClock(DEFAULT_CLOCK.dayDuration * 0.5)
    const frame = createEnvironmentTransition(noonAuto, {
      mode: 'manual', dayPhase: 0.5, seasonIndex: 1, weather: 'clear',
    })
    const midnight = {
      mode: 'manual' as const,
      dayPhase: 0,
      seasonIndex: 1 as const,
      weather: 'clear' as const,
    }
    stepEnvironmentTransition(frame, noonAuto, midnight, 0)
    for (let tick = 0; tick < 90; tick += 1) {
      stepEnvironmentTransition(frame, noonAuto, midnight, 1 / 60)
    }

    const mix = deriveAmbientAudioMixFromFrame(frame)
    expect(frame.progress).toBeCloseTo(0.5)
    expect(mix.dayGain).toBeGreaterThan(0)
    expect(mix.birdGain).toBeGreaterThan(0)
  })
})
