export type AuroraVector = [number, number, number, number]
export type AuroraCurtains = [AuroraVector, AuroraVector, AuroraVector]
export interface AuroraComposition {
  /** Horizontal offset, group rotation, vertical scale, animation phase. */
  layout: AuroraVector
  /** Per curtain: position, tilt, height, bend strength. */
  curtains: AuroraCurtains
  /** Per curtain: edge width, phase, translucent wing width, visibility. */
  styles: AuroraCurtains
}
export interface AuroraCompositionState {
  seed: number
  occurrence: number
  active: boolean
  previewId: number
  current: AuroraComposition
  target: AuroraComposition
}

export function getAuroraComposition(seed: number, occurrence: number): AuroraComposition {
  const unit = (channel: number) => {
    const value = Math.sin(seed * 91.7 + occurrence * 127.1 + channel * 43.3) * 43758.5453
    return value - Math.floor(value)
  }
  const count = 1 + Math.floor(unit(1) * 3)
  const spacing = .36 + unit(2) * .14
  const first = count === 1 ? 1 : count === 2 ? Math.floor(unit(7) * 2) : 0
  const curtains = [0, 1, 2].map(index => [
    (index - 1) * spacing, (unit(10 + index) - .5) * .09,
    .65 + unit(20 + index) * .45, .045 + unit(30 + index) * .045,
  ] as AuroraVector) as AuroraCurtains
  const styles = [0, 1, 2].map(index => [
    .018 + unit(40 + index) * .016, unit(50 + index) * Math.PI * 2,
    (count === 1 ? .22 : .10) + unit(60 + index) * .12,
    index >= first && index < first + count ? 1 : 0,
  ] as AuroraVector) as AuroraCurtains
  return { layout: [(unit(3) - .5) * .9, (unit(4) - .5) * 1.4, .85 + unit(5) * .3, unit(6) * Math.PI * 2], curtains, styles }
}

export function createAuroraCompositionState(seed: number): AuroraCompositionState {
  const composition = getAuroraComposition(seed, 0)
  return { seed, occurrence: 0, active: false, previewId: 0, current: composition, target: composition }
}

/** Only a new preview or a new visible event selects a layout, never each frame. */
export function advanceAuroraComposition(state: AuroraCompositionState, active: boolean, previewId: number, opacity: number, delta: number) {
  const newPreview = previewId > 0 && previewId !== state.previewId
  if (newPreview || (active && !state.active && !previewId)) {
    state.target = getAuroraComposition(state.seed, ++state.occurrence)
    // Hidden events may start directly; visible preview changes morph smoothly.
    if (opacity < .001) state.current = state.target
  }
  state.active = active
  state.previewId = previewId
  const blend = 1 - Math.exp(-Math.max(0, delta) / 3)
  const mix = (from: AuroraVector, to: AuroraVector) => from.map((value, index) => value + (to[index] - value) * blend) as AuroraVector
  state.current = { layout: mix(state.current.layout, state.target.layout),
    curtains: state.current.curtains.map((value, index) => mix(value, state.target.curtains[index])) as AuroraCurtains,
    styles: state.current.styles.map((value, index) => mix(value, state.target.styles[index])) as AuroraCurtains }
  return state.current
}
