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
  it('keeps a gentle clear-weather wind and adds rain only when required', () => {
    const clear = deriveAmbientAudioMix(createSnapshot(.5))
    const rain = deriveAmbientAudioMix(createSnapshot(.5, 'rain'))
    expect(clear.windGain).toBeGreaterThan(0)
    expect(clear.rainGain).toBe(0)
    expect(rain.rainGain).toBeGreaterThan(0)
    expect(rain.windFrequency).toBeGreaterThan(clear.windFrequency)
  })

  it('crossfades weather endpoints without jumping to the destination mix', () => {
    const noonAuto = sampleNatureClock(DEFAULT_CLOCK.dayDuration * 0.5)
    const frame = createEnvironmentTransition(noonAuto, {
      mode: 'manual', dayPhase: 0.5, seasonIndex: 1, weather: 'clear',
    })
    const rainy = {
      mode: 'manual' as const,
      dayPhase: .5,
      seasonIndex: 1 as const,
      weather: 'rain' as const,
    }
    stepEnvironmentTransition(frame, noonAuto, rainy, 0)
    for (let tick = 0; tick < 90; tick += 1) {
      stepEnvironmentTransition(frame, noonAuto, rainy, 1 / 60)
    }

    const mix = deriveAmbientAudioMixFromFrame(frame)
    expect(frame.progress).toBeCloseTo(0.5)
    expect(mix.rainGain).toBeGreaterThan(0)
    expect(mix.rainGain).toBeLessThan(deriveAmbientAudioMix(frame.target).rainGain)
  })
})
