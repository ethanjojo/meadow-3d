import { createRecordedAmbience } from './recordedAmbience'
import { getStormEvent } from '../core/sceneEffects'
import type { EnvironmentSnapshot } from '../core/simulation'

export const THUNDER_CALLS = [
  { id: 'close', path: 'audio/thunder-close.wav', duration: 3.73, fadeIn: .035, fadeOut: .5 },
  { id: 'distant', path: 'audio/thunder-distant.wav', duration: 9.47, fadeIn: .12, fadeOut: .8 },
] as const

export function createThunderAudio(context: AudioContext, destination: AudioNode) {
  const player = createRecordedAmbience(context, THUNDER_CALLS, () => null, destination)
  let running = false, timer: number | null = null, revision = 0, lastEvent = -1, level = 1
  const cancel = () => {
    revision++
    if (timer !== null) window.clearTimeout(timer)
    timer = null
    player.suspend()
  }
  return {
    start() { running = true; void player.prepare() },
    setLevel(value: number) {
      level = value
      player.setChannelVolumes({ close: value, distant: value })
      if (value === 0) cancel()
    },
    sync(snapshot: EnvironmentSnapshot) {
      if (!running) return
      if (snapshot.weather.storm < .2 || context.state !== 'running') { cancel(); return }
      const event = getStormEvent(snapshot.elapsed)
      const age = snapshot.elapsed - event.start
      if (level === 0 || event.id === lastEvent || age < 0 || age > 1) return
      lastEvent = event.id
      const request = revision
      const id = event.distanceKm < 2.8 ? 'close' : 'distant'
      timer = window.setTimeout(() => {
        timer = null
        if (!running || request !== revision) return
        void player.trigger(id, {
          volume: .65 / (1 + event.distanceKm * .22), rate: 1, pan: event.x * .6,
          cutoff: 5_500 / (1 + event.distanceKm * .45), fadeIn: THUNDER_CALLS[id === 'close' ? 0 : 1].fadeIn, fadeOut: .8,
        }, () => running && request === revision)
      }, Math.max(0, event.thunderAt - snapshot.elapsed) * 1_000)
    },
    preview(isCurrent: () => boolean, onEnded: () => void) {
      return player.preview('close', isCurrent, onEnded)
    },
    suspend() { running = false; cancel() },
    dispose() { running = false; cancel(); player.dispose() },
  }
}
