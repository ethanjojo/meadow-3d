import { clamp01 } from './noise'

export function getCelestialAppearance(elapsed: number, sunElevation: number, fog: number, cloudCover: number) {
  const elevation = clamp01(sunElevation / .5)
  const thinCloud = clamp01(cloudCover / .35) * (1 - clamp01((cloudCover - .35) / .65))
  const haze = clamp01(fog * .8 + thinCloud * .45)
  const phase = .25 + Math.max(0, elapsed) / 900
  return {
    sunWarmth: 1 - elevation * elevation * (3 - 2 * elevation),
    moonPhase: phase % (Math.PI * 2),
    moonHaloScale: 1 + haze * .65,
    moonHaloStrength: (.18 + haze * .18) * (1 - clamp01(cloudCover) * .65),
  }
}
