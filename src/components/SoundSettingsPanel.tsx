import { AUDIO_SETTING_LIMITS, type AudioChannelId, type AudioPreviewState, type AudioSettings, type RecordingChannelId } from '../core/audioSettings'
import { RangeSlider } from './RangeSlider'
import { AudioChannelIcon } from './AudioChannelIcon'
import { SettingsNumber, SettingsRange, SettingsSelect, SettingsTime, SettingsToggle } from './SettingsFields'
import { SOUND_GROUPS as GROUPS, SOUND_LABELS, SOUND_HINTS, callLabel, groupVolumeLabel } from '../core/soundControls'
import { settingTargetId } from '../core/settingsSearch'
export function SoundSettingsPanel({ value, enabled, onChange, onMasterVolumeChange, preview, onPreview }: { value: AudioSettings; enabled: boolean; onChange: (next: AudioSettings) => void; onMasterVolumeChange: (volume: number) => void; preview: AudioPreviewState; onPreview: (id: AudioChannelId) => void }) {
 const setCall = <K extends keyof AudioSettings['calls'][RecordingChannelId]>(id: RecordingChannelId, key: K, next: AudioSettings['calls'][RecordingChannelId][K]) => {
  const call = { ...value.calls[id], [key]: next }
  if (key === 'minInterval') call.maxInterval = Math.max(call.minInterval, call.maxInterval)
  if (key === 'maxInterval') call.minInterval = Math.min(call.minInterval, call.maxInterval)
  onChange({ ...value, calls: { ...value.calls, [id]: call } })
 }
 return <div className="sound-settings-panel">
 <div className="advanced-settings-master"><RangeSlider label={SOUND_LABELS.master} value={enabled ? value.master : 0} onChange={onMasterVolumeChange} /><p>Previews play on their own, even while ambience is muted.</p></div>
 <div className="settings-groups">{GROUPS.map(group => {
  const channels = group.channels
  return <details className="settings-group sound-group" key={group.id} open={group.id === 'weather' ? true : undefined}><summary>{group.title}<span>{channels.length} sounds</span></summary><div className="settings-group-content">
   <RangeSlider label={groupVolumeLabel(group.title)} value={value.groups[group.id]} onChange={level => onChange({ ...value, groups: { ...value.groups, [group.id]: level } })} />
   {channels.map(channel => {
    const current = preview?.id === channel.id ? preview.status : null, action = current === 'playing' ? 'Stop' : current === 'loading' ? 'Cancel' : 'Preview'
    const call = channel.id in value.calls ? value.calls[channel.id as RecordingChannelId] : null
    return <div className="audio-channel" key={channel.id}><div className="audio-channel-row"><div className="audio-channel-icon"><AudioChannelIcon id={channel.id} /></div><RangeSlider label={channel.label} value={value.channels[channel.id]} onChange={level => onChange({ ...value, channels: { ...value.channels, [channel.id]: level } })} /><button className="icon-button preview-button" type="button" data-setting-id={settingTargetId(`Preview ${channel.label}`)} aria-label={`${action} ${channel.label}${action === 'Preview' ? '' : ' preview'}`} title={`${action} ${channel.label}`} aria-pressed={current === 'playing'} aria-busy={current === 'loading'} onClick={() => onPreview(channel.id)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">{current === 'playing' ? <rect x="6" y="6" width="12" height="12" rx="1" /> : current === 'loading' ? <path className="preview-spinner" d="M20 12a8 8 0 1 1-8-8" /> : <path d="m8 4 12 8-12 8V4Z" />}</svg></button>{current === 'error' ? <p className="preview-error" role="alert">Could not load this preview. Try again.</p> : null}</div>
    {call ? <details className="audio-call-details" ><summary>{callLabel(channel.label, 'details')}</summary><div className="settings-call-content">
     <SettingsToggle label={callLabel(channel.label, 'enabled')} checked={call.enabled} onChange={next => setCall(channel.id as RecordingChannelId, 'enabled', next)} />
     <SettingsSelect label={callLabel(channel.label, 'activity')} value={call.activity} disabled={!call.enabled} options={[{ value: 'natural', label: 'Natural activity' }, { value: 'always', label: 'All day' }, { value: 'custom', label: 'Custom hours' }]} onChange={next => setCall(channel.id as RecordingChannelId, 'activity', next as typeof call.activity)} />
     <div className="settings-field-pair"><SettingsTime label={callLabel(channel.label, 'startHour')} value={call.startHour} disabled={!call.enabled || call.activity !== 'custom'} onChange={next => setCall(channel.id as RecordingChannelId, 'startHour', next)} /><SettingsTime label={callLabel(channel.label, 'endHour')} value={call.endHour} disabled={!call.enabled || call.activity !== 'custom'} onChange={next => setCall(channel.id as RecordingChannelId, 'endHour', next)} /></div>
     <p className="settings-hint">{call.activity === 'custom' ? 'Hours can cross midnight. Equal times mean all day.' : 'Choose Custom hours to set a time window.'}</p>
     <div className="settings-field-pair"><SettingsNumber label={callLabel(channel.label, 'minInterval')} value={call.minInterval} min={AUDIO_SETTING_LIMITS.interval.min} max={AUDIO_SETTING_LIMITS.interval.max} disabled={!call.enabled} onChange={next => setCall(channel.id as RecordingChannelId, 'minInterval', next)} /><SettingsNumber label={callLabel(channel.label, 'maxInterval')} value={call.maxInterval} min={AUDIO_SETTING_LIMITS.interval.min} max={AUDIO_SETTING_LIMITS.interval.max} disabled={!call.enabled} onChange={next => setCall(channel.id as RecordingChannelId, 'maxInterval', next)} /></div>
     <p className="settings-hint">Calls wait a random time within this range.</p>
     <SettingsSelect label={callLabel(channel.label, 'distance')} value={call.distance} disabled={!call.enabled} options={[{ value: 'near', label: 'Near' }, { value: 'medium', label: 'Medium' }, { value: 'far', label: 'Far' }]} onChange={next => setCall(channel.id as RecordingChannelId, 'distance', next as typeof call.distance)} />
     <SettingsSelect label={callLabel(channel.label, 'pan')} value={call.pan} disabled={!call.enabled} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }, { value: 'random', label: 'Random' }]} onChange={next => setCall(channel.id as RecordingChannelId, 'pan', next as typeof call.pan)} />
     <SettingsToggle label={callLabel(channel.label, 'respectWeather')} checked={call.respectWeather} disabled={!call.enabled} onChange={next => setCall(channel.id as RecordingChannelId, 'respectWeather', next)} hint="Quiet during heavy rain and storms." />
    </div></details> : channel.id === 'thunder' ? <SettingsRange label={SOUND_LABELS.thunderDistance} value={value.thunderDistance} min={AUDIO_SETTING_LIMITS.thunderDistance.min} max={AUDIO_SETTING_LIMITS.thunderDistance.max} step={.1} unit="km" onChange={next => onChange({ ...value, thunderDistance: next })} hint={SOUND_HINTS.thunderDistance} /> : null}</div>
   })}</div></details>
 })}
 <details className="settings-group" ><summary>{SOUND_LABELS.playback}<span>3 settings</span></summary><div className="settings-group-content"><SettingsRange label={SOUND_LABELS.variation} value={value.variation} onChange={next => onChange({ ...value, variation: next })} hint={SOUND_HINTS.variation} /><SettingsNumber label={SOUND_LABELS.maxConcurrent} value={value.maxConcurrent} min={AUDIO_SETTING_LIMITS.concurrency.min} max={AUDIO_SETTING_LIMITS.concurrency.max} unit="calls" onChange={next => onChange({ ...value, maxConcurrent: next })} /><SettingsNumber label={SOUND_LABELS.minimumGap} value={value.minimumGap} min={AUDIO_SETTING_LIMITS.gap.min} max={AUDIO_SETTING_LIMITS.gap.max} onChange={next => onChange({ ...value, minimumGap: next })} /></div></details>
 </div></div>
}
