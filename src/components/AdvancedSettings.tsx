import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_AUDIO_SETTINGS, parseAudioSettings, type AudioChannelId, type AudioPreviewState, type AudioSettings } from '../core/audioSettings'
import { DEFAULT_SCENE_SETTINGS, SCENE_CONTROLS, type SceneSettings } from '../core/sceneSettings'
import { SceneSettingsPanel } from './SceneSettingsPanel'
import { SoundSettingsPanel } from './SoundSettingsPanel'
import { ADVANCED_TABS as TABS, type SettingsTab as Tab, type SettingSearchResult } from '../core/settingsSearch'
import { SettingsSearch } from './SettingsSearch'
interface AdvancedSettingsProps {
 auroraPreviewActive?: boolean
 onAuroraPreview?: () => void
 sceneSettings: SceneSettings
 onSceneChange: (next: SceneSettings) => void
 open: boolean
 value: AudioSettings
 enabled: boolean
 onChange: (next: AudioSettings) => void
 onSoundChange: (enabled: boolean) => void
 onMasterVolumeChange: (volume: number) => void
 preview: AudioPreviewState
 onPreview: (id: AudioChannelId) => void
 onStopPreview: () => void
 onClose: () => void
 preferencesTools?: ReactNode
}
export function AdvancedSettings({ auroraPreviewActive, onAuroraPreview, sceneSettings, onSceneChange, open, value, enabled, onChange, onSoundChange, onMasterVolumeChange, preview, onPreview, onStopPreview, onClose, preferencesTools }: AdvancedSettingsProps) {
 const [tab, setTab] = useState<Tab>('sound')
 const [searchRevision, setSearchRevision] = useState(0)
 const [destination, setDestination] = useState<{ result: SettingSearchResult; revision: number } | null>(null)
 const bodyRef = useRef<HTMLDivElement>(null), dialogRef = useRef<HTMLDialogElement>(null)
 const selectTab = (next: Tab) => { setTab(next); setSearchRevision(revision => revision + 1); setDestination(null); onStopPreview(); if (bodyRef.current) bodyRef.current.scrollTop = 0 }
 const navigate = (result: SettingSearchResult) => { setTab(result.tab); onStopPreview(); setDestination(current => ({ result, revision: (current?.revision ?? 0) + 1 })) }
 useEffect(() => {
  if (!destination || !open) return
  const target = bodyRef.current?.querySelector<HTMLElement>(`[data-setting-id="${destination.result.id}"]`)
  if (!target) return
  for (let parent = target.parentElement; parent && parent !== bodyRef.current; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  target.scrollIntoView({ block: 'center', behavior: reduced ? 'instant' : 'smooth' })
  const control = target.matches('input, button, select') ? target : target.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled), select:not(:disabled)')
  if (control && !control.matches(':disabled')) control.focus({ preventScroll: true })
  else { const fallback = target.matches(':disabled') ? target.parentElement! : target; fallback.tabIndex = -1; fallback.focus({ preventScroll: true }) }
  target.classList.remove('setting-search-highlight')
  void target.offsetWidth
  target.classList.add('setting-search-highlight')
  const timer = setTimeout(() => target.classList.remove('setting-search-highlight'), 2600)
  return () => { clearTimeout(timer); target.classList.remove('setting-search-highlight') }
 }, [destination, open])
 useEffect(() => { const dialog = dialogRef.current; if (!open || !dialog) return; dialog.showModal(); return () => { if (dialog.open) dialog.close() } }, [open])
 const close = () => { onStopPreview(); dialogRef.current?.close(); onClose() }
 const reset = () => {
  if (tab === 'presets') return
  if (tab === 'sound') { onStopPreview(); onChange(parseAudioSettings(DEFAULT_AUDIO_SETTINGS)); return }
  const next = { ...sceneSettings }
  for (const [key, control] of Object.entries(SCENE_CONTROLS)) if (control.section === tab) Object.assign(next, { [key]: control.default })
  if (tab === 'time') next.allowedWeather = [...DEFAULT_SCENE_SETTINGS.allowedWeather]
  onSceneChange(next)
 }
 const sections = TABS.filter(item => item.id === tab)
 const presetsOnly = tab === 'presets'
 return <dialog ref={dialogRef} className="advanced-settings-dialog" aria-labelledby="advanced-settings-title" onKeyDown={event => {
  if (event.key !== 'Tab') return
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), input:not(:disabled), select:not(:disabled), summary, a[href]')).filter(element => { for (let ancestor: HTMLElement | null = element; ancestor && ancestor !== dialogRef.current; ancestor = ancestor.parentElement) if (ancestor.hidden || getComputedStyle(ancestor).display === 'none') return false; return (!element.closest('details:not([open])') || element.tagName === 'SUMMARY' && element.parentElement === element.closest('details:not([open])')) })
  const first = controls[0], last = controls[controls.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
 }} onCancel={event => { event.preventDefault(); close() }} onClick={event => { if (event.target === event.currentTarget) close() }}>
 <div className="advanced-settings-shell"><header className="advanced-settings-header"><div><h2 id="advanced-settings-title">Advanced settings</h2><p>Make the meadow feel like yours.</p></div><div className="advanced-settings-header-actions"><SettingsSearch resetKey={`${tab}:${searchRevision}`} includePresets={Boolean(preferencesTools)} onSelect={navigate} /><button className="icon-button" type="button" aria-label="Close advanced settings" onClick={close} autoFocus><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="m6 6 12 12M6 18 18 6" /></svg></button></div></header>
 <div className="advanced-settings-tabs" role="tablist" aria-label="Advanced settings sections">{TABS.map((item, index) => <button key={item.id} id={`advanced-tab-${item.id}`} type="button" role="tab" aria-selected={tab === item.id} aria-controls={`advanced-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => selectTab(item.id)} onKeyDown={event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
  const next = TABS[nextIndex].id; selectTab(next); document.getElementById(`advanced-tab-${next}`)?.focus()
 }}>{item.label}</button>)}</div>
 <div ref={bodyRef} className="advanced-settings-body">
 {sections.map(item => <div key={item.id} role="tabpanel" id={`advanced-panel-${item.id}`} aria-labelledby={`advanced-tab-${item.id}`} className="advanced-settings-panel">{item.id === 'sound' ? <SoundSettingsPanel value={value} enabled={enabled} onChange={onChange} onMasterVolumeChange={onMasterVolumeChange} preview={preview} onPreview={onPreview} /> : item.id === 'presets' ? preferencesTools : <SceneSettingsPanel value={sceneSettings} onChange={onSceneChange} section={item.id} auroraPreviewActive={auroraPreviewActive} onAuroraPreview={onAuroraPreview} />}</div>)}</div>
 {presetsOnly ? null : <footer className="advanced-settings-footer"><button className="quiet-button" type="button" onClick={reset}>{tab === 'sound' ? 'Reset sound' : `Reset ${TABS.find(item => item.id === tab)!.label.toLowerCase()}`}</button>{tab === 'sound' ? <button className="audio-action" type="button" onClick={() => onSoundChange(!enabled)}>{enabled ? 'Mute sound' : 'Unmute sound'}</button> : <span className="scene-settings-saved">Saved automatically</span>}</footer>}
 </div></dialog>
}
