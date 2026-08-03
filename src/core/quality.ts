export const QUALITY_PROFILES = {
  low: {
    grassBlades: 18_000,
    particles: 400,
    shadowSize: 0,
    maxDpr: 1,
    postprocessing: false,
    cloudLayers: 1,
    starCount: 700,
    shootingStarPool: 1,
    grassAtlas: false,
    grassTransmission: false,
    bloomStrength: 0,
    bloomResolutionScale: 0,
    vignetteStrength: 0,
  },
  medium: {
    grassBlades: 48_000,
    particles: 1_000,
    shadowSize: 1024,
    maxDpr: 1.5,
    postprocessing: true,
    cloudLayers: 2,
    starCount: 1_300,
    shootingStarPool: 2,
    grassAtlas: true,
    grassTransmission: false,
    bloomStrength: 0.14,
    bloomResolutionScale: 0.6,
    vignetteStrength: 0.045,
  },
  high: {
    grassBlades: 90_000,
    particles: 2_200,
    shadowSize: 2048,
    maxDpr: 2,
    postprocessing: true,
    cloudLayers: 3,
    starCount: 2_000,
    shootingStarPool: 3,
    grassAtlas: true,
    grassTransmission: true,
    bloomStrength: 0.22,
    bloomResolutionScale: 1,
    vignetteStrength: 0.055,
  },
} as const

export type QualityTier = keyof typeof QUALITY_PROFILES
export type QualityProfile = (typeof QUALITY_PROFILES)[QualityTier]

export interface DeviceCapabilities {
  logicalCores: number
  devicePixelRatio: number
  reducedMotion: boolean
}

export function selectInitialQuality({
  logicalCores,
  devicePixelRatio,
  reducedMotion,
}: DeviceCapabilities): QualityTier {
  if (reducedMotion || logicalCores <= 4) return 'low'
  if (logicalCores >= 8 && devicePixelRatio <= 2) return 'high'
  return 'medium'
}

function average(values: readonly number[]) {
  let total = 0
  for (const value of values) total += value
  return total / values.length
}

export function evaluateQuality(
  current: QualityTier,
  samples: readonly number[],
): QualityTier {
  if (samples.length < 90) return current

  const averageFps = average(samples)
  if (current === 'high' && averageFps < 48) return 'medium'
  if (current === 'medium' && averageFps < 27) return 'low'

  if (samples.length >= 300 && averageFps >= 58) {
    if (current === 'low') return 'medium'
    if (current === 'medium') return 'high'
  }

  return current
}
