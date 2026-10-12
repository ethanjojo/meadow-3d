import { useEffect, useRef, useState } from 'react'
import { BIRD_CHANNELS, DEFAULT_AUDIO_SETTINGS, FARM_CHANNELS, WEATHER_CHANNELS, type AudioChannelId, type AudioPreviewState, type AudioSettings } from '../core/audioSettings'
import { DEFAULT_SCENE_SETTINGS, type SceneSettings } from '../core/sceneSettings'
import { SceneSettingsPanel } from './SceneSettingsPanel'
import { RangeSlider } from './RangeSlider'
import { AudioChannelIcon } from './AudioChannelIcon'

interface AdvancedSettingsProps {
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
}

export function AdvancedSettings({ sceneSettings, onSceneChange, open, value, enabled, onChange, onSoundChange, onMasterVolumeChange, preview, onPreview, onStopPreview, onClose }: AdvancedSettingsProps) {
  const [tab, setTab] = useState<'sound' | 'scene'>('sound')
  const bodyRef = useRef<HTMLDivElement>(null)
  const selectTab = (next: 'sound' | 'scene') => { setTab(next); onStopPreview(); if (bodyRef.current) bodyRef.current.scrollTop = 0 }
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [open])
  const close = () => { onStopPreview(); dialogRef.current?.close(); onClose() }
  const update = (id: AudioChannelId, level: number) => onChange({ ...value, channels: { ...value.channels, [id]: level } })
  return (
    <dialog ref={dialogRef} className="advanced-settings-dialog" aria-labelledby="advanced-settings-title"
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), input:not(:disabled)'))
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }}
      onCancel={event => { event.preventDefault(); close() }}
      onClick={event => { if (event.target === event.currentTarget) close() }}>
      <div className="advanced-settings-shell">
        <header className="advanced-settings-header">
          <div>
            <h2 id="advanced-settings-title">Advanced settings</h2>
            <p>Make the meadow feel like yours.</p>
          </div>
          <button className="icon-button" type="button" aria-label="Close advanced settings" onClick={close} autoFocus>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="m6 6 12 12M6 18 18 6" /></svg>
          </button>
        </header>
        <div className="advanced-settings-tabs" role="tablist" aria-label="Advanced settings sections">
          {(['sound', 'scene'] as const).map(id => <button key={id} id={`advanced-tab-${id}`} type="button" role="tab"
            aria-selected={tab === id} aria-controls={`advanced-panel-${id}`} tabIndex={tab === id ? 0 : -1}
            onClick={() => selectTab(id)} onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
              event.preventDefault()
              const next = event.key === 'Home' ? 'sound' : event.key === 'End' ? 'scene' : tab === 'sound' ? 'scene' : 'sound'
              selectTab(next)
              document.getElementById(`advanced-tab-${next}`)?.focus()
            }}>{id === 'sound' ? 'Sound' : 'Scene'}</button>)}
        </div>
        <div ref={bodyRef} className="advanced-settings-body">
          {tab === 'sound' ? <div role="tabpanel" id="advanced-panel-sound" aria-labelledby="advanced-tab-sound">
          <div className="advanced-settings-master">
            <RangeSlider label="Master volume" value={enabled ? value.master : 0} onChange={onMasterVolumeChange} />
            <p>Previews play on their own, even while ambience is muted.</p>
          </div>
          <div className="advanced-settings-groups">
            {[{ title: 'Weather', channels: WEATHER_CHANNELS }, { title: 'Birds', channels: BIRD_CHANNELS }, { title: 'Farm animals', channels: FARM_CHANNELS }].map(group => (
              <fieldset key={group.title}>
                <legend>{group.title}</legend>
                {group.channels.map(channel => {
                  const current = preview?.id === channel.id ? preview.status : null
                  const action = current === 'playing' ? 'Stop' : current === 'loading' ? 'Cancel' : 'Preview'
                  return <div key={channel.id} className="audio-channel-row">
                    <div className="audio-channel-icon"><AudioChannelIcon id={channel.id} /></div>
                    <RangeSlider label={channel.label} value={value.channels[channel.id]} onChange={level => update(channel.id, level)} />
                    <button className="icon-button preview-button" type="button" aria-label={`${action} ${channel.label}${action === 'Preview' ? '' : ' preview'}`} title={`${action} ${channel.label}`}
                      aria-pressed={current === 'playing'} aria-busy={current === 'loading'} onClick={() => onPreview(channel.id)}>
                      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
                        {current === 'playing' ? <rect x="6" y="6" width="12" height="12" rx="1" /> : current === 'loading' ? <path className="preview-spinner" d="M20 12a8 8 0 1 1-8-8" /> : <path d="m8 4 12 8-12 8V4Z" />}
                      </svg>
                    </button>
                    {current === 'error' ? <p className="preview-error" role="alert">Could not load this preview. Try again.</p> : null}
                  </div>
                })}
              </fieldset>
            ))}
          </div>
          </div> : null}
          {tab === 'scene' ? <div role="tabpanel" id="advanced-panel-scene" aria-labelledby="advanced-tab-scene"><SceneSettingsPanel value={sceneSettings} onChange={onSceneChange} /></div> : null}
        </div>
        <footer className="advanced-settings-footer">
          <button className="quiet-button" type="button" onClick={() => tab === 'sound' ? onChange({ master: DEFAULT_AUDIO_SETTINGS.master, channels: { ...DEFAULT_AUDIO_SETTINGS.channels } }) : onSceneChange({ ...DEFAULT_SCENE_SETTINGS })}>{tab === 'sound' ? 'Reset levels' : 'Reset scene'}</button>
          {tab === 'sound' ? <button className="audio-action" type="button" onClick={() => onSoundChange(!enabled)}>{enabled ? 'Mute sound' : 'Unmute sound'}</button> : <span className="scene-settings-saved">Applies immediately</span>}
        </footer>
      </div>
    </dialog>
  )
}
