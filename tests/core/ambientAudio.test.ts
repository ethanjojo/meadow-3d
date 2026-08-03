import { describe, expect, it } from 'vitest'
import { deriveAmbientAudioMix } from '../../src/audio/ambientAudio'
import { DEFAULT_CLOCK, sampleNatureClock } from '../../src/core/natureClock'
import { createEnvironmentSnapshot } from '../../src/core/simulation'

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

    expect(mix.chirpLayer).toBe('day')
    expect(mix.dayGain).toBeGreaterThan(0)
    expect(mix.nightGain).toBe(0)
  })

  it('routes night chirps through the weather-sensitive night layer', () => {
    const clear = deriveAmbientAudioMix(createSnapshot(0))
    const rain = deriveAmbientAudioMix(createSnapshot(0, 'rain'))

    expect(clear.chirpLayer).toBe('night')
    expect(clear.nightGain).toBeGreaterThan(0)
    expect(clear.dayGain).toBe(0)
    expect(rain.nightGain).toBeLessThan(clear.nightGain)
  })
})
