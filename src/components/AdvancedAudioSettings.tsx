import { useEffect, useRef } from 'react'
import { BIRD_CHANNELS, DEFAULT_AUDIO_SETTINGS, FARM_CHANNELS, WEATHER_CHANNELS, type AudioChannelId, type AudioPreviewState, type AudioSettings } from '../core/audioSettings'
import { VolumeSlider } from './VolumeSlider'
import { AudioChannelIcon } from './AudioChannelIcon'

interface AdvancedAudioSettingsProps {
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

export function AdvancedAudioSettings({ open, value, enabled, onChange, onSoundChange, onMasterVolumeChange, preview, onPreview, onStopPreview, onClose }: AdvancedAudioSettingsProps) {
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
    <dialog ref={dialogRef} className="advanced-audio-dialog" aria-labelledby="advanced-audio-title"
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'))
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }}
      onCancel={event => { event.preventDefault(); close() }}
      onClick={event => { if (event.target === event.currentTarget) close() }}>
      <div className="advanced-audio-shell">
        <header className="advanced-audio-header">
          <div>
            <h2 id="advanced-audio-title">Sound mix</h2>
            <p>Balance the sounds around your meadow.</p>
          </div>
          <button className="icon-button" type="button" aria-label="Close advanced settings" onClick={close} autoFocus>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="m6 6 12 12M6 18 18 6" /></svg>
          </button>
        </header>
        <div className="advanced-audio-body">
          <div className="advanced-audio-master">
            <VolumeSlider label="Master volume" value={enabled ? value.master : 0} onChange={onMasterVolumeChange} />
            <p>Previews play on their own, even while ambience is muted.</p>
          </div>
          <div className="advanced-audio-groups">
            {[{ title: 'Weather', channels: WEATHER_CHANNELS }, { title: 'Birds', channels: BIRD_CHANNELS }, { title: 'Farm animals', channels: FARM_CHANNELS }].map(group => (
              <fieldset key={group.title}>
                <legend>{group.title}</legend>
                {group.channels.map(channel => {
                  const current = preview?.id === channel.id ? preview.status : null
                  const action = current === 'playing' ? 'Stop' : current === 'loading' ? 'Cancel' : 'Preview'
                  return <div key={channel.id} className="audio-channel-row">
                    <div className="audio-channel-icon"><AudioChannelIcon id={channel.id} /></div>
                    <VolumeSlider label={channel.label} value={value.channels[channel.id]} onChange={level => update(channel.id, level)} />
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
        </div>
        <footer className="advanced-audio-footer">
          <button className="quiet-button" type="button" onClick={() => onChange({ master: DEFAULT_AUDIO_SETTINGS.master, channels: { ...DEFAULT_AUDIO_SETTINGS.channels } })}>Reset levels</button>
          <button className="audio-action" type="button" onClick={() => onSoundChange(!enabled)}>{enabled ? 'Mute sound' : 'Unmute sound'}</button>
        </footer>
      </div>
    </dialog>
  )
}
