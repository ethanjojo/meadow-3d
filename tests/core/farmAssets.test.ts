// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FARM_CHANNELS } from '../../src/core/audioSettings'

describe('replacement animal recordings', () => {
  for (const call of FARM_CHANNELS.filter(call => call.path.endsWith('.wav'))) {
    it(`${call.id} is a non-clipping local PCM recording matching its playback duration`, () => {
      const file = readFileSync(new URL(`../../public/${call.path}`, import.meta.url))
      expect(file.toString('ascii', 0, 4)).toBe('RIFF')
      expect(file.toString('ascii', 8, 12)).toBe('WAVE')
      expect(file.readUInt16LE(22)).toBe(1)
      expect(file.readUInt32LE(24)).toBe(24_000)
      expect(file.readUInt16LE(34)).toBe(16)
      expect(file.readUInt32LE(40) / 48_000).toBeCloseTo(call.duration, 3)
      let peak = 0
      for (let offset = 44; offset < file.length; offset += 2) peak = Math.max(peak, Math.abs(file.readInt16LE(offset)) / 32_767)
      expect(peak).toBeGreaterThan(0.24)
      expect(peak).toBeLessThan(0.251)
    })
  }
})
