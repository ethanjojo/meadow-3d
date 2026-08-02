import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useAdaptiveQuality } from '../../src/hooks/useAdaptiveQuality'

const highEndDevice = {
  logicalCores: 10,
  devicePixelRatio: 2,
  reducedMotion: false,
}

describe('useAdaptiveQuality', () => {
  it('drops from high to medium after sustained 40 FPS rendering', () => {
    const { result } = renderHook(() => useAdaptiveQuality(highEndDevice))
    expect(result.current.tier).toBe('high')

    act(() => {
      for (let frame = 0; frame < 120; frame += 1) {
        result.current.recordFrame(1 / 40)
      }
    })

    expect(result.current.tier).toBe('medium')
  })

  it('ignores a short performance dip', () => {
    const { result } = renderHook(() => useAdaptiveQuality(highEndDevice))

    act(() => {
      for (let frame = 0; frame < 5; frame += 1) {
        result.current.recordFrame(1 / 24)
      }
    })

    expect(result.current.tier).toBe('high')
  })
})
