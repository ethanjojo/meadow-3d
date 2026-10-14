import { settingTargetId } from '../core/settingsSearch'
import { useId } from 'react'
export function SettingsRange({ label, value, onChange, min = 0, max = 1, step = .01, unit = '%', disabled = false, hint }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; unit?: string; disabled?: boolean; hint?: string }) {
 const id = useId(), percent = unit === '%', display = percent ? Math.round(value * 100) : Number(value.toFixed(2))
 return <div className="scene-settings-control" data-setting-id={settingTargetId(label)}><div className="range-slider"><div className="range-slider-label"><label htmlFor={id}>{label}</label><output htmlFor={id}>{display}{unit === '%' || unit === '×' ? unit : ` ${unit}`}</output></div><input id={id} type="range" min={percent ? min * 100 : min} max={percent ? max * 100 : max} step={percent ? step * 100 : step} value={display} disabled={disabled} aria-valuetext={`${display} ${unit}`} aria-describedby={hint ? `${id}-hint` : undefined} onChange={event => onChange(Number(event.currentTarget.value) / (percent ? 100 : 1))} /></div>{hint ? <p id={`${id}-hint`}>{hint}</p> : null}</div>
}
export function SettingsSelect({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean }) {
 const id = useId()
 return <div className="settings-field" data-setting-id={settingTargetId(label)}><label htmlFor={id}>{label}</label><select id={id} value={value} disabled={disabled} onChange={event => onChange(event.currentTarget.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
}
export function SettingsTime({ label, value, onChange, disabled = false }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
 const id = useId(), minutes = Math.min(1439, Math.round(value * 60))
 return <div className="settings-field" data-setting-id={settingTargetId(label)}><label htmlFor={id}>{label}<small>Scene time</small></label><input id={id} type="time" value={`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`} disabled={disabled} onChange={event => { if (event.currentTarget.value) { const [hours, mins] = event.currentTarget.value.split(':').map(Number); onChange(hours + mins / 60) } }} /></div>
}
export function SettingsNumber({ label, value, min, max, onChange, unit = 'real seconds', disabled = false, step = 1 }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; unit?: string; disabled?: boolean; step?: number }) {
 const id = useId()
 return <div className="settings-field" data-setting-id={settingTargetId(label)}><label htmlFor={id}>{label}<small>{unit}</small></label><input id={id} type="number" value={value} min={min} max={max} step={step} disabled={disabled} onChange={event => { const next = event.currentTarget.valueAsNumber; if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next))) }} /></div>
}
export function SettingsToggle({ label, checked, onChange, disabled = false, hint }: { label: string; checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; hint?: string }) {
 const id = useId()
 return <label className="scene-settings-toggle" data-setting-id={settingTargetId(label)}><span><strong id={`${id}-label`}>{label}</strong>{hint ? <small id={`${id}-hint`}>{hint}</small> : null}</span><input type="checkbox" role="switch" aria-labelledby={`${id}-label`} aria-describedby={hint ? `${id}-hint` : undefined} checked={checked} disabled={disabled} onChange={event => onChange(event.currentTarget.checked)} /></label>
}
