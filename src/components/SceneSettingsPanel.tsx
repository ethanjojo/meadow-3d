import { settingTargetId } from '../core/settingsSearch'
import { ALL_WEATHER, SCENE_CONTROLS, type SceneControl, type SceneSettings, type SettingsSection } from '../core/sceneSettings'
import { SettingsNumber, SettingsRange, SettingsSelect, SettingsTime, SettingsToggle } from './SettingsFields'
type SceneKey = keyof typeof SCENE_CONTROLS
const controls = Object.entries(SCENE_CONTROLS) as [SceneKey, SceneControl][]
function dependency(key: SceneKey, value: SceneSettings): string | undefined {
 if (key === 'auroraFrequency') return value.auroraMode !== 'auto' ? 'Choose Automatic to change event frequency.' : undefined
 if (['auroraBrightness', 'auroraSpeed'].includes(key) && value.auroraMode === 'off') return 'Enable Aurora to use these settings.'
 if (key === 'fireflyStart' || key === 'fireflyEnd') return value.fireflySchedule !== 'custom' ? 'Choose Custom hours to edit these times.' : undefined
 if (key === 'moonPhase') return value.moonPhaseMode !== 'fixed' ? 'Choose Fixed phase to set the moon phase.' : undefined
 if (key === 'dayDuration') return value.realTime ? 'Device time sets the day length.' : undefined
 if (['meteorInterval', 'meteorBrightness', 'meteorTrail'].includes(key) && !value.shootingStars) return 'Enable Shooting stars to use these settings.'
 if (['lightningInterval', 'lightningBrightness', 'groundLightning'].includes(key) && !value.lightning) return 'Enable Lightning flashes to use these settings.'
 if (key.startsWith('farmLight') && key !== 'farmLights') {
  if (!value.farmVisible || !value.farmLights) return 'Show the farm and enable Farm lights to use these settings.'
  if (key === 'farmLightStart' || key === 'farmLightEnd') return value.farmLightMode !== 'custom' ? 'Choose Custom hours to edit these times.' : undefined
  if (key !== 'farmLightMode' && value.farmLightMode === 'off') return 'Choose a light schedule to use these settings.'
 }
 if (['quality', 'fpsLimit', 'bloom', 'shadows'].includes(key) && value.powerSaving) return 'Power saving uses Low graphics and 30 FPS.'
 return undefined
}
export function SceneSettingsPanel({ value, onChange, section = 'nature', auroraPreviewActive, onAuroraPreview }: { value: SceneSettings; onChange: (value: SceneSettings) => void; section?: SettingsSection; auroraPreviewActive?: boolean; onAuroraPreview?: () => void }) {
 const update = (key: SceneKey, next: number | string | boolean) => onChange({ ...value, [key]: next })
 const sectionControls = controls.filter(([, control]) => control.section === section)
 const groups = [...new Set(sectionControls.map(([, control]) => control.group))]
 const matching = sectionControls
 return <div className="scene-settings-panel settings-groups">{groups.map((group, index) => <details className="settings-group" key={group} open={index === 0 ? true : undefined}>
  <summary>{group}<span>{matching.filter(([, control]) => control.group === group).length} {matching.filter(([, control]) => control.group === group).length === 1 ? 'setting' : 'settings'}</span></summary><div className="settings-group-content">
  {group === 'Aurora' ? <><p className="settings-hint">Visible on dark, clear nights. Clouds obscure the curtains; rain and storms suppress them. Preview bypasses rarity and season for 45 seconds, while keeping daylight and weather.</p>{onAuroraPreview ? <button type="button" className="quiet-button" onClick={onAuroraPreview} data-setting-id={settingTargetId('Preview aurora')}>{auroraPreviewActive ? 'Stop aurora preview' : 'Preview aurora'}</button> : null}{auroraPreviewActive ? <p role="status" className="settings-hint">Preview active. Close settings to watch the sky.</p> : null}</> : null}
  {group === 'Flowers' ? <div className="settings-quick-choices" role="group" aria-label="Flower presets">{[{ label: 'Sparse', value: .15 }, { label: 'Natural', value: 1 / 3 }, { label: 'Full bloom', value: .75 }].map(choice => <button type="button" className="quiet-button" key={choice.label} aria-pressed={value.flowerDensity === choice.value} onClick={() => update('flowerDensity', choice.value)}>{choice.label}</button>)}</div> : null}
  {matching.filter(([, control]) => control.group === group).map(([key, control]) => {
   const reason = dependency(key, value), timingHint = key === 'snowAccumulation' || key === 'snowMelt' ? 'Automatic weather timing. Manual changes use Transition duration.' : key === 'farmLightStart' || key === 'farmLightEnd' ? 'Hours can cross midnight. Equal times mean all day.' : undefined, hint = [control.hint, timingHint, reason].filter(Boolean).join(' ')
   return <div key={key} className={reason ? 'settings-dependent' : undefined}>{control.kind === 'toggle' ? <SettingsToggle label={control.label} checked={value[key] as boolean} onChange={next => update(key, next)} disabled={Boolean(reason)} hint={hint} /> : control.kind === 'select' ? <><SettingsSelect label={control.label} value={String(value[key])} options={control.options} onChange={next => update(key, next)} disabled={Boolean(reason)} />{hint ? <p className="settings-hint">{hint}</p> : null}</> : control.kind === 'time' ? <><SettingsTime label={control.label} value={Number(value[key])} onChange={next => update(key, next)} disabled={Boolean(reason)} />{hint ? <p className="settings-hint">{hint}</p> : null}</> : control.unit === 's' ? <><SettingsNumber label={control.label} value={Number(value[key])} min={control.min} max={control.max} step={control.step} onChange={next => update(key, next)} disabled={Boolean(reason)} />{hint ? <p className="settings-hint">{hint}</p> : null}</> : <SettingsRange label={control.label} value={Number(value[key])} min={control.min} max={control.max} step={control.step} unit={control.unit} onChange={next => update(key, next)} disabled={Boolean(reason)} hint={hint} />}</div>
  })}</div></details>)}
  {section === 'time' ? <details className="settings-group" ><summary>Allowed automatic weather<span>{value.allowedWeather.length} enabled</span></summary><div className="settings-group-content"><p className="settings-hint">Keep at least one weather mode enabled.</p>{ALL_WEATHER.map(weather => <SettingsToggle key={weather} label={weather[0].toUpperCase() + weather.slice(1)} checked={value.allowedWeather.includes(weather)} disabled={value.allowedWeather.length === 1 && value.allowedWeather.includes(weather)} onChange={checked => onChange({ ...value, allowedWeather: checked ? [...value.allowedWeather, weather] : value.allowedWeather.filter(item => item !== weather) })} />)}</div></details> : null}
 </div>
}
