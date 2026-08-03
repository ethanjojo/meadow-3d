import { useCallback, useEffect, useRef, useState } from 'react'
import type { SeasonIndex } from '../core/natureClock'
import type {
  SimulationSettings,
  WeatherPreset,
} from '../core/simulation'

interface EnvironmentSettingsProps {
  value: SimulationSettings
  onChange: (next: SimulationSettings) => void
}

const SEASONS: readonly { value: SeasonIndex; label: string }[] = [
  { value: 0, label: 'Jaro' },
  { value: 1, label: 'Léto' },
  { value: 2, label: 'Podzim' },
  { value: 3, label: 'Zima' },
]

const WEATHER_OPTIONS: readonly { value: WeatherPreset; label: string }[] = [
  { value: 'clear', label: 'Jasno' },
  { value: 'cloudy', label: 'Oblačno' },
  { value: 'fog', label: 'Mlha' },
  { value: 'rain', label: 'Déšť' },
  { value: 'storm', label: 'Bouřka' },
  { value: 'snow', label: 'Sněžení' },
]

export function EnvironmentSettings({ value, onChange }: EnvironmentSettingsProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const manual = value.mode === 'manual'

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

  return (
    <div className="environment-settings">
      <button
        ref={triggerRef}
        className="environment-settings-trigger"
        type="button"
        aria-label="Nastavení prostředí"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <SettingsIcon />
      </button>
      {open ? (
        <section
          ref={panelRef}
          role="dialog"
          aria-label="Nastavení prostředí"
          className="environment-panel"
          tabIndex={-1}
        >
          <fieldset>
            <legend>Režim</legend>
            {(['auto', 'manual'] as const).map((mode) => (
              <label key={mode} className="environment-choice">
                <input
                  type="radio"
                  name="environment-mode"
                  checked={value.mode === mode}
                  onChange={() => update('mode', mode)}
                />
                {mode === 'auto' ? 'Auto' : 'Ručně'}
              </label>
            ))}
          </fieldset>
          <label className="environment-range">
            <span>Čas dne</span>
            <input
              aria-label="Čas dne"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={value.dayPhase}
              disabled={!manual}
              onChange={(event) => update('dayPhase', Number(event.currentTarget.value))}
            />
          </label>
          <SeasonChoices
            value={value.seasonIndex}
            disabled={!manual}
            onChange={(seasonIndex) => update('seasonIndex', seasonIndex)}
          />
          <WeatherChoices
            value={value.weather}
            disabled={!manual}
            onChange={(weather) => update('weather', weather)}
          />
        </section>
      ) : null}
    </div>
  )
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 8.1a3.9 3.9 0 1 0 0 7.8 3.9 3.9 0 0 0 0-7.8Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="m19.35 13.35 1.1.85-1.85 3.2-1.3-.52a7.75 7.75 0 0 1-1.83 1.06l-.2 1.38h-3.7l-.2-1.38a7.75 7.75 0 0 1-1.83-1.06l-1.3.52-1.85-3.2 1.1-.85a7.43 7.43 0 0 1 0-2.12l-1.1-.85 1.85-3.2 1.3.52a7.75 7.75 0 0 1 1.83-1.06l.2-1.38h3.7l.2 1.38A7.75 7.75 0 0 1 17.3 7l1.3-.52 1.85 3.2-1.1.85a7.43 7.43 0 0 1 0 2.12Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.45"
      />
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
      <legend>Roční období</legend>
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
      <legend>Počasí</legend>
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
