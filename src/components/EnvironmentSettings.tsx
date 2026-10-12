import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { SceneSettings } from '../core/sceneSettings'
import type { SeasonIndex } from '../core/natureClock'
import type { AudioChannelId, AudioPreviewState, AudioSettings } from '../core/audioSettings'
import type {
  EnvironmentSnapshot,
  SimulationSettings,
  WeatherPreset,
} from '../core/simulation'

const AdvancedSettings = lazy(() => import('./AdvancedSettings').then(module => ({ default: module.AdvancedSettings })))

interface EnvironmentSettingsProps {
  sceneSettings: SceneSettings
  onSceneChange: (next: SceneSettings) => void
  value: SimulationSettings
  visibleSnapshot?: EnvironmentSnapshot | null
  onChange: (next: SimulationSettings) => void
  audioSettings: AudioSettings
  soundEnabled: boolean
  onAudioChange: (next: AudioSettings) => void
  onSoundChange: (enabled: boolean) => void
  onMasterVolumeChange: (volume: number) => void
  preview: AudioPreviewState
  onPreview: (id: AudioChannelId) => void
  onStopPreview: () => void
}

const SEASONS: readonly { value: SeasonIndex; label: string }[] = [
  { value: 0, label: 'Spring' },
  { value: 1, label: 'Summer' },
  { value: 2, label: 'Autumn' },
  { value: 3, label: 'Winter' },
]

const WEATHER_OPTIONS: readonly { value: WeatherPreset; label: string }[] = [
  { value: 'clear', label: 'Clear' },
  { value: 'cloudy', label: 'Cloudy' },
  { value: 'fog', label: 'Fog' },
  { value: 'rain', label: 'Rain' },
  { value: 'storm', label: 'Storm' },
  { value: 'snow', label: 'Snow' },
]

function getVisibleSeason(snapshot: EnvironmentSnapshot): SeasonIndex {
  return (Math.round(snapshot.seasonPosition) % 4) as SeasonIndex
}

function getEnglishTimeText(dayPhase: number) {
  const wrappedPhase = ((dayPhase % 1) + 1) % 1
  const totalMinutes = Math.round(wrappedPhase * 24 * 60) % (24 * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const dayPart =
    hours < 5 || hours >= 21
      ? 'Night'
      : hours < 7
        ? 'Dawn'
        : hours < 11
          ? 'Morning'
          : hours < 13
            ? 'Noon'
            : hours < 18
              ? 'Afternoon'
              : 'Dusk'

  return `${dayPart} · ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function EnvironmentSettings({
  sceneSettings,
  onSceneChange,
  value,
  visibleSnapshot,
  onChange,
  audioSettings,
  soundEnabled,
  onAudioChange,
  onSoundChange,
  onMasterVolumeChange,
  preview,
  onPreview,
  onStopPreview,
}: EnvironmentSettingsProps) {
  const [open, setOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const manual = value.mode === 'manual'
  const displayedDayPhase =
    manual || !visibleSnapshot ? value.dayPhase : visibleSnapshot.dayPhase
  const displayedSeason =
    manual || !visibleSnapshot
      ? value.seasonIndex
      : getVisibleSeason(visibleSnapshot)
  const displayedWeather =
    manual || !visibleSnapshot ? value.weather : visibleSnapshot.weather.preset
  const timeText = getEnglishTimeText(displayedDayPhase)

  const dismiss = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return

    panelRef.current?.focus()

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        !panelRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        dismiss()
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [dismiss, open])

  const update = <Key extends keyof SimulationSettings>(
    key: Key,
    next: SimulationSettings[Key],
  ) => onChange({ ...value, [key]: next })

  const updateMode = (mode: SimulationSettings['mode']) => {
    if (mode === 'manual' && value.mode === 'auto' && visibleSnapshot) {
      onChange({
        mode,
        dayPhase: visibleSnapshot.dayPhase,
        seasonIndex: getVisibleSeason(visibleSnapshot),
        weather: visibleSnapshot.weather.preset,
      })
      return
    }

    update('mode', mode)
  }

  return (
    <div className="environment-settings">
      <button
        ref={triggerRef}
        className="environment-settings-trigger"
        type="button"
        aria-label="Environment settings"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <SettingsIcon />
      </button>
      {open ? (
        <section
          ref={panelRef}
          role="dialog"
          aria-label="Environment settings"
          className="environment-panel"
          tabIndex={-1}
        >
          <fieldset>
            <legend>Mode</legend>
            {(['auto', 'manual'] as const).map((mode) => (
              <label key={mode} className="environment-choice">
                <input
                  type="radio"
                  name="environment-mode"
                  checked={value.mode === mode}
                  onChange={() => updateMode(mode)}
                />
                {mode === 'auto' ? 'Automatic' : 'Manual'}
              </label>
            ))}
          </fieldset>
          <div className="environment-range">
            <span>
              <label htmlFor="environment-day-phase">Time of day</label>
              <output htmlFor="environment-day-phase">{timeText}</output>
            </span>
            <input
              id="environment-day-phase"
              aria-label="Time of day"
              aria-valuetext={timeText}
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={displayedDayPhase}
              disabled={!manual}
              onChange={(event) => update('dayPhase', Number(event.currentTarget.value))}
            />
          </div>
          <SeasonChoices
            value={displayedSeason}
            disabled={!manual}
            onChange={(seasonIndex) => update('seasonIndex', seasonIndex)}
          />
          <WeatherChoices
            value={displayedWeather}
            disabled={!manual}
            onChange={(weather) => update('weather', weather)}
          />
            <button className="advanced-settings-trigger" type="button" onClick={() => { setOpen(false); setAdvancedOpen(true) }}>
              <span>Advanced</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M7 7h10v10" /></svg>
            </button>
        </section>
      ) : null}
      {advancedOpen ? <Suspense fallback={<span className="settings-loading" role="status">Opening settings…</span>}>
        <AdvancedSettings sceneSettings={sceneSettings} onSceneChange={onSceneChange} open={advancedOpen} value={audioSettings} enabled={soundEnabled} onChange={onAudioChange} onSoundChange={onSoundChange}
          onMasterVolumeChange={onMasterVolumeChange} preview={preview} onPreview={onPreview} onStopPreview={onStopPreview}
          onClose={() => { setAdvancedOpen(false); triggerRef.current?.focus() }} />
      </Suspense> : null}
    </div>
  )
}

function SettingsIcon() {
  const points = Array.from({ length: 32 }, (_, index) => {
    const angle = -Math.PI / 2 + (index + 0.5) * Math.PI / 16
    const radius = index % 4 < 2 ? 9.5 : 7.5
    return `${12 + Math.cos(angle) * radius},${12 + Math.sin(angle) * radius}`
  }).join(' ')
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <polygon points={points} />
      <circle cx="12" cy="12" r="3.1" />
    </svg>
  )
}

function SeasonChoices({
  value,
  disabled,
  onChange,
}: {
  value: SeasonIndex
  disabled: boolean
  onChange: (seasonIndex: SeasonIndex) => void
}) {
  return (
    <fieldset>
      <legend>Season</legend>
      <div className="environment-options">
        {SEASONS.map((season) => (
          <label key={season.value} className="environment-choice">
            <input
              type="radio"
              name="environment-season"
              checked={value === season.value}
              disabled={disabled}
              onChange={() => onChange(season.value)}
            />
            {season.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function WeatherChoices({
  value,
  disabled,
  onChange,
}: {
  value: WeatherPreset
  disabled: boolean
  onChange: (weather: WeatherPreset) => void
}) {
  return (
    <fieldset>
      <legend>Weather</legend>
      <div className="environment-options">
        {WEATHER_OPTIONS.map((weather) => (
          <label key={weather.value} className="environment-choice">
            <input
              type="radio"
              name="environment-weather"
              checked={value === weather.value}
              disabled={disabled}
              onChange={() => onChange(weather.value)}
            />
            {weather.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
