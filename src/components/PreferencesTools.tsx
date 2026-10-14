import { PREFERENCE_LABELS, settingTargetId } from '../core/settingsSearch'
import { useRef, useState, type ChangeEvent } from 'react'
import { exportPreferences, importPreferences, parseSavedPresets, type MeadowPreferences, type SavedPreset } from '../core/preferences'

const STORAGE_KEY = 'living-meadow:presets'
export function PreferencesTools({ value, onApply }: { value: MeadowPreferences; onApply: (value: MeadowPreferences) => void }) {
  const [presets, setPresets] = useState<SavedPreset[]>(() => {
    try { return parseSavedPresets(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')) } catch { return [] }
  })
  const [name, setName] = useState('')
  const [selected, setSelected] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const persist = (next: SavedPreset[]) => {
    setPresets(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) }
    catch { setError('Could not save presets on this device. They remain available until you leave the Presets tab.') }
  }
  const save = () => {
    if (!name.trim() || presets.length >= 12) return
    setError(''); const id = crypto.randomUUID()
    persist([...presets, { id, name: name.trim().slice(0, 48), settings: importPreferences(exportPreferences(value)) }])
    setSelected(id); setName(''); setMessage('Preset saved.')
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportPreferences(value)], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'living-meadow-settings.json'; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setError(''); setMessage('')
    try {
      if (file.size > 128_000) throw new Error('Settings file is too large')
      const next = importPreferences(await file.text())
      onApply(next); setMessage('Settings imported.'); setSelected('')
    } catch { setError('Could not import this file. Choose a valid Living Meadow settings export. Your settings have not changed.') }
  }
  return <div className="preferences-tools-body">
      <p>Save this meadow, or move all settings to another device.</p>
      <div className="preferences-save">
        <label data-setting-id={settingTargetId(PREFERENCE_LABELS.name)}>{PREFERENCE_LABELS.name}<input type="text" value={name} maxLength={48} placeholder="My evening meadow" onChange={event => setName(event.target.value)} /></label>
        <button type="button" className="quiet-button" onClick={save} disabled={!name.trim() || presets.length >= 12} data-setting-id={settingTargetId(PREFERENCE_LABELS.save)}>{PREFERENCE_LABELS.save}</button>
      </div>
      {presets.length ? <div className="preferences-load">
        <label>Saved presets<select value={selected} onChange={event => setSelected(event.target.value)}><option value="">Choose a preset</option>{presets.map(preset => <option value={preset.id} key={preset.id}>{preset.name}</option>)}</select></label>
        <button type="button" className="quiet-button" disabled={!selected} onClick={() => { const preset = presets.find(item => item.id === selected); if (preset) { onApply(preset.settings); setMessage('Preset applied.'); setError('') } }}>Apply preset</button>
        <button type="button" className="quiet-button" disabled={!selected} onClick={() => { persist(presets.filter(preset => preset.id !== selected)); setSelected(''); setMessage('Preset deleted.') }}>Delete preset</button>
      </div> : null}
      <div className="preferences-transfer"><button type="button" className="quiet-button" onClick={download} data-setting-id={settingTargetId(PREFERENCE_LABELS.export)}>{PREFERENCE_LABELS.export}</button><button type="button" className="quiet-button" onClick={() => fileRef.current?.click()} data-setting-id={settingTargetId(PREFERENCE_LABELS.import)}>{PREFERENCE_LABELS.import}</button></div>
      <input ref={fileRef} type="file" accept="application/json,.json" aria-label="Import settings file" hidden onChange={upload} />
      {presets.length >= 12 ? <p>Delete a preset to save another (12 maximum).</p> : null}
      {error ? <p role="alert">{error}</p> : message ? <p role="status">{message}</p> : null}
  </div>
}
