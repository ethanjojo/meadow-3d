import { BIRD_CHANNELS, type AudioSettings, type RecordingChannelId, type RecordingSettings } from '../core/audioSettings'
import { isWithinHours } from '../core/timeWindow'
import type { EnvironmentSnapshot } from '../core/simulation'
import { deriveBirdActivity, BIRD_CALLS } from './birdAudio'
import { FARM_CALLS } from './farmAudio'
import { createRecordedAmbience } from './recordedAmbience'

const calls = [...BIRD_CALLS, ...FARM_CALLS]
const isBird = (id: string) => BIRD_CHANNELS.some(call => call.id === id)

/** Natural activity shapes call strength and eligibility; explicit schedules keep their own hours. */
export function recordingActivity(id: RecordingChannelId, setting: RecordingSettings, snapshot: EnvironmentSnapshot) {
  if (!setting.enabled) return 0
  if (setting.activity === 'custom' && !isWithinHours(snapshot.dayPhase, setting.startHour, setting.endHour)) return 0
  const rain = setting.respectWeather ? snapshot.weather.rain : 0
  const storm = setting.respectWeather ? snapshot.weather.storm : 0
  if (setting.activity === 'natural' && isBird(id)) return deriveBirdActivity(snapshot.dayPhase, rain, storm)
  const daylight = Math.max(0, Math.sin(snapshot.dayPhase * Math.PI * 2 - Math.PI / 2))
  const natural = setting.activity === 'natural' ? .35 + daylight * .65 : 1
  return natural * (1 - rain * .45) * (1 - storm * .8)
}

export function recordingVoice(setting: RecordingSettings, variation: number, random = Math.random) {
  const distance = { near: { volume: .52, cutoff: 11_000 }, medium: { volume: .36, cutoff: 6_000 }, far: { volume: .22, cutoff: 2_800 } }[setting.distance]
  const pan = setting.pan === 'random' ? random() * 1.4 - .7 : { left: -.7, center: 0, right: .7 }[setting.pan]
  return { volume: distance.volume * (1 + (random() * 2 - 1) * variation * .5), cutoff: distance.cutoff, pan, rate: 1 }
}

/** One independent due time per recording, with a shared concurrency and spacing budget. */
export function createRecordedCalls(context: AudioContext, destination: AudioNode, initial: AudioSettings) {
  const player = createRecordedAmbience(context, calls, destination)
  let settings = initial
  let snapshot: EnvironmentSnapshot | null = null
  let running = false, disposed = false, prepared = false, revision = 0, timer: number | null = null, lastStarted = -Infinity
  const due = new Map<RecordingChannelId, number>()
  const active = new Map<RecordingChannelId, { stop: (() => void) | null }>()
  const eligible = (id: RecordingChannelId) => snapshot && settings.master > 0 && settings.channels[id] > 0 && settings.groups[isBird(id) ? 'birds' : 'farm'] > 0 ? recordingActivity(id, settings.calls[id], snapshot) : 0
  const delay = (id: RecordingChannelId) => {
    const setting = settings.calls[id]
    return (setting.minInterval + Math.random() * (setting.maxInterval - setting.minInterval)) * 1_000
  }
  const reconcile = () => {
    const now = Date.now()
    for (const call of calls) {
      const id = call.id as RecordingChannelId
      if (eligible(id) < .015) {
        active.get(id)?.stop?.()
        active.delete(id)
        due.delete(id)
      } else if (!due.has(id)) due.set(id, now + delay(id))
    }
  }
  const schedule = () => {
    if (timer !== null) window.clearTimeout(timer)
    timer = null
    if (!prepared || !running || disposed || context.state !== 'running' || active.size >= settings.maxConcurrent) return
    const candidates = [...due].filter(([id]) => !active.has(id))
    if (!candidates.length) return
    const next = Math.max(Math.min(...candidates.map(([, at]) => at)), lastStarted + settings.minimumGap * 1_000)
    timer = window.setTimeout(tick, Math.max(0, next - Date.now()))
  }
  const tick = () => {
    timer = null
    if (!running || disposed || context.state !== 'running') return
    reconcile()
    const now = Date.now()
    const candidates = [...due].sort((a, b) => a[1] - b[1])
    for (const [id, at] of candidates) {
      if (at > now || active.has(id) || active.size >= settings.maxConcurrent || now - lastStarted < settings.minimumGap * 1_000) continue
      const entry = { stop: null as (() => void) | null }
      active.set(id, entry) // Reserve before the asynchronous buffer lookup.
      lastStarted = now
      due.set(id, now + delay(id))
      const request = revision
      const voice = recordingVoice(settings.calls[id], settings.variation)
      void player.trigger(id, { ...voice, varyExcerpt: isBird(id) }, () => running && !disposed && request === revision && active.get(id) === entry && eligible(id) >= .015, () => {
        if (active.get(id) !== entry) return
        active.delete(id)
        if (running && eligible(id) >= .015) due.set(id, Date.now() + delay(id))
        schedule()
      }).then(stop => {
        if (!stop) { if (active.get(id) === entry) active.delete(id); schedule(); return }
        if (!running || request !== revision || active.get(id) !== entry) { stop(); return }
        entry.stop = stop
      })
    }
    schedule()
  }
  const applyLevels = () => player.setChannelVolumes(Object.fromEntries(calls.map(call => {
    const id = call.id as RecordingChannelId
    return [id, settings.channels[id] * settings.groups[isBird(id) ? 'birds' : 'farm'] * eligible(id)]
  })))
  applyLevels()
  const suspend = () => {
    running = false
    revision++
    if (timer !== null) window.clearTimeout(timer)
    timer = null
    due.clear()
    active.clear()
    player.suspend()
  }
  return {
    async start() {
      if (disposed || (running && timer !== null)) return
      running = true
      const request = ++revision
      await player.prepare()
      if (running && !disposed && request === revision) { prepared = true; reconcile(); schedule() }
    },
    setNature(next: EnvironmentSnapshot) { snapshot = next; applyLevels(); if (running) { reconcile(); schedule() } },
    setSettings(next: AudioSettings) {
      for (const call of calls) {
        const id = call.id as RecordingChannelId
        const previous = settings.calls[id], value = next.calls[id]
        if ((Object.keys(value) as (keyof RecordingSettings)[]).some(key => value[key] !== previous[key])) due.delete(id)
      }
      settings = next
      applyLevels()
      if (running) reconcile()
      while (active.size > settings.maxConcurrent) {
        const [id, entry] = [...active].at(-1)!
        entry.stop?.(); active.delete(id)
      }
      schedule()
    },
    preview: player.preview,
    suspend,
    dispose() { disposed = true; suspend(); player.dispose() },
  }
}
