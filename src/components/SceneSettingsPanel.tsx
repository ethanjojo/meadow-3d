import { type SceneSettings } from '../core/sceneSettings'
import { RangeSlider } from './RangeSlider'

const GROUPS = [
  { title: 'Meadow', controls: [
    { key: 'flowerDensity', label: 'Flower density', hint: 'From open grass to a meadow full of blooms.' },
    { key: 'fireflyDensity', label: 'Firefly density', hint: 'Visible on warm nights when weather allows.' },
  ] },
  { title: 'Sky & weather', controls: [
    { key: 'starBrightness', label: 'Star brightness', hint: 'Stars still follow the night sky and cloud cover.' },
    { key: 'precipitationDensity', label: 'Rain & snow particles', hint: 'Changes visible particles; weather and sound stay independent.' },
  ] },
] as const

export function SceneSettingsPanel({ value, onChange }: { value: SceneSettings; onChange: (value: SceneSettings) => void }) {
  const update = <K extends keyof SceneSettings>(key: K, next: SceneSettings[K]) => onChange({ ...value, [key]: next })
  return <div className="scene-settings-panel">
    <p className="scene-settings-intro">Shape your meadow. Changes apply immediately and are saved on this device.</p>
    <div className="scene-settings-groups">
      {GROUPS.map(group => <fieldset key={group.title}><legend>{group.title}</legend>
        {group.controls.map(control => <div className="scene-settings-control" key={control.key}>
          <RangeSlider label={control.label} value={value[control.key]} onChange={next => update(control.key, next)} />
          <p>{control.hint}</p>
        </div>)}
      </fieldset>)}
    </div>
    <fieldset className="scene-settings-toggles"><legend>Effects & motion</legend>
      {([
        ['shootingStars', 'Shooting stars', 'Occasional meteors on clear nights.'],
        ['lightning', 'Lightning flashes', 'Visual flashes during storms. Thunder has its own sound level.'],
        ['gentleMotion', 'Gentler motion', 'Calmer wind movement and fewer animated effects. System motion preferences always take priority.'],
      ] as const).map(([key, label, hint]) => <label className="scene-settings-toggle" key={key}>
        <span><strong>{label}</strong><small>{hint}</small></span>
        <input type="checkbox" role="switch" checked={value[key]} onChange={event => update(key, event.currentTarget.checked)} />
      </label>)}
    </fieldset>
  </div>
}
