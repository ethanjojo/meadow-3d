import { useCallback, useRef, useState } from 'react'
import {
  evaluateQuality,
  selectInitialQuality,
  type DeviceCapabilities,
  type QualityTier,
} from '../core/quality'

const DOWNGRADE_SAMPLE_SIZE = 120
const COMPLETE_SAMPLE_SIZE = 300
const CHANGE_COOLDOWN_MS = 10_000

export function useAdaptiveQuality(capabilities: DeviceCapabilities) {
  const [tier, setTier] = useState<QualityTier>(() =>
    selectInitialQuality(capabilities),
  )
  const tierRef = useRef(tier)
  const samplesRef = useRef<number[]>([])
  const lastChangeRef = useRef(Number.NEGATIVE_INFINITY)

  const recordFrame = useCallback((deltaSeconds: number) => {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return

    const now = performance.now()
    if (now - lastChangeRef.current < CHANGE_COOLDOWN_MS) return

    const fps = 1 / Math.max(deltaSeconds, 1 / 240)
    const samples = samplesRef.current
    samples.push(fps)
    if (samples.length < DOWNGRADE_SAMPLE_SIZE) return

    const nextTier = evaluateQuality(tierRef.current, samples)
    if (nextTier !== tierRef.current) {
      tierRef.current = nextTier
      lastChangeRef.current = now
      samplesRef.current = []
      setTier(nextTier)
      return
    }

    if (samples.length >= COMPLETE_SAMPLE_SIZE) {
      samplesRef.current = []
    }
  }, [])

  return { tier, recordFrame }
}
