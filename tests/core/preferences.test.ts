import { describe, expect, it } from 'vitest'
import { DEFAULT_AUDIO_SETTINGS } from '../../src/core/audioSettings'
import { DEFAULT_SCENE_SETTINGS } from '../../src/core/sceneSettings'
import { DEFAULT_SIMULATION_SETTINGS } from '../../src/core/simulation'
import { exportPreferences, importPreferences, parseSavedPresets } from '../../src/core/preferences'

const settings = { audio: DEFAULT_AUDIO_SETTINGS, scene: DEFAULT_SCENE_SETTINGS, simulation: DEFAULT_SIMULATION_SETTINGS }
describe('portable preferences', () => {
  it('retains existing presets and exports created before aurora settings existed', () => {
    const old = JSON.parse(exportPreferences(settings))
    for (const key of ['auroraMode', 'auroraBrightness', 'auroraFrequency', 'auroraSpeed']) delete old.scene[key]
    expect(importPreferences(JSON.stringify(old))).toEqual(settings)
    expect(parseSavedPresets([{ id: 'old', name: 'Before aurora', settings: old }])).toHaveLength(1)
    old.scene.auroraBrightness = 99
    expect(() => importPreferences(JSON.stringify(old))).toThrow(/auroraBrightness/)
  })
  it('round-trips all three canonical settings stores', () => {
    expect(importPreferences(exportPreferences(settings))).toEqual(settings)
  })
  it('rejects a malformed or out of range file without manufacturing defaults', () => {
    expect(() => importPreferences('{}')).toThrow()
    const invalid = JSON.parse(exportPreferences(settings))
    invalid.scene.dayDuration = -20
    expect(() => importPreferences(JSON.stringify(invalid))).toThrow(/dayDuration/)
    invalid.scene.dayDuration = 180
    invalid.audio.calls.cat.activity = 'missing'
    expect(() => importPreferences(JSON.stringify(invalid))).toThrow(/audio/)
  })
  it('rejects future versions and safely filters corrupted stored presets', () => {
    const invalid = JSON.parse(exportPreferences(settings)); invalid.version = 2
    expect(() => importPreferences(JSON.stringify(invalid))).toThrow(/version/)
    expect(parseSavedPresets([{ id: 'ok', name: 'Evening', settings }, { id: 'bad', name: 'Broken', settings: {} }])).toHaveLength(1)
    expect(parseSavedPresets([{ id: 'x'.repeat(81), name: 'Too long', settings }])).toEqual([])
  })
})
