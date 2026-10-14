import type { SceneSettings } from './sceneSettings'

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t) }
const random = (index: number) => { const value = Math.sin(index * 127.1 + 83.7) * 43758.5453; return value - Math.floor(value) }

/** Stable event timing, independent of frame rate; no random draws per frame. */
export function getAuroraActivity(elapsed: number, frequency: number) {
  if (frequency <= 0) return 0
  const spacing = 900 / frequency
  const index = Math.floor(Math.max(0, elapsed) / spacing)
  const start = spacing * (.16 + random(index) * .22)
  const duration = Math.min(spacing * .35, 120 + random(index + 19) * 120)
  const age = elapsed - index * spacing - start
  return smooth(age / 25) * smooth((duration - age) / 30) * (.65 + random(index + 37) * .35)
}

interface AuroraInput {
  mode: SceneSettings['auroraMode']; night: number; seasonPosition: number
  rain: number; storm: number; fog: number; moon: number
  elapsed: number; frequency: number; preview: boolean
}
export function getAuroraVisibility(input: AuroraInput) {
  if (input.mode === 'off' && !input.preview) return 0
  const conditions = smooth(input.night) * (1 - smooth(input.rain * 2)) * (1 - smooth(input.storm * 2)) * (1 - clamp(input.fog) * .8) * (1 - clamp(input.moon) * .35)
  if (input.preview || input.mode === 'night') return conditions
  // Winter preference is an artistic choice for this meadow, not an astronomy model.
  const winter = .5 + .5 * Math.cos((input.seasonPosition - 3) * Math.PI / 2)
  return conditions * (.2 + winter * .8) * getAuroraActivity(input.elapsed, input.frequency)
}
export function advanceAuroraOpacity(current: number, target: number, delta: number) {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, delta) / 9))
}
