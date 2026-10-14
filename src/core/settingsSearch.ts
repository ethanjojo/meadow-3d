import { ALL_WEATHER, SCENE_CONTROLS } from './sceneSettings'
import { CALL_LABELS, SOUND_GROUPS, SOUND_HINTS, SOUND_LABELS, callLabel, groupVolumeLabel } from './soundControls'

export const ADVANCED_TABS = [{ id: 'sound', label: 'Sound' }, { id: 'nature', label: 'Nature' }, { id: 'sky', label: 'Sky & weather' }, { id: 'farm', label: 'Farm' }, { id: 'time', label: 'Time & performance' }, { id: 'presets', label: 'Presets' }] as const
export type SettingsTab = typeof ADVANCED_TABS[number]['id']
export interface SettingSearchResult { id: string; label: string; tab: SettingsTab; path: string; keywords: string }
export const PREFERENCE_LABELS = { name: 'Preset name', save: 'Save preset', export: 'Export settings', import: 'Import settings' } as const
export function settingTargetId(label: string) { return `setting-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}` }
function entry(tab: SettingsTab, group: string, label: string, hint = ''): SettingSearchResult {
  const path = `${ADVANCED_TABS.find(item => item.id === tab)!.label} → ${group}`
  return { id: settingTargetId(label), label, tab, path, keywords: `${path} ${hint}` }
}
export const SETTINGS_SEARCH_INDEX: readonly SettingSearchResult[] = [
  ...Object.values(SCENE_CONTROLS).map(control => entry(control.section, control.group, control.label, 'hint' in control ? control.hint : '')),
  entry('sky', 'Aurora', 'Preview aurora'),
  ...ALL_WEATHER.map(weather => entry('time', 'Allowed automatic weather', weather[0].toUpperCase() + weather.slice(1))),
  entry('sound', 'Master', SOUND_LABELS.master),
  ...SOUND_GROUPS.flatMap(group => [entry('sound', group.title, groupVolumeLabel(group.title)), ...group.channels.flatMap(channel => [
    entry('sound', group.title, channel.label), entry('sound', group.title, `Preview ${channel.label}`),
    ...(group.id !== 'weather' ? Object.keys(CALL_LABELS).filter(key => key !== 'details').map(key => entry('sound', group.title, callLabel(channel.label, key as keyof typeof CALL_LABELS))) : channel.id === 'thunder' ? [entry('sound', group.title, SOUND_LABELS.thunderDistance, SOUND_HINTS.thunderDistance)] : []),
  ])]),
  ...(['variation', 'maxConcurrent', 'minimumGap'] as const).map(key => entry('sound', SOUND_LABELS.playback, SOUND_LABELS[key], key === 'variation' ? SOUND_HINTS.variation : '')),
  ...Object.values(PREFERENCE_LABELS).map(label => entry('presets', 'Presets & sharing', label, 'move settings to another device')),
]
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
export function searchSettings(query: string) {
  const normalized = normalize(query), terms = normalized.split(/\s+/)
  if (!normalized) return []
  return SETTINGS_SEARCH_INDEX.filter(item => terms.every(term => normalize(`${item.label} ${item.keywords}`).includes(term)))
    .map(item => ({ item, rank: normalize(item.label) === normalized ? 0 : normalize(item.label).startsWith(normalized) ? 1 : normalize(item.label).includes(normalized) ? 2 : 3 }))
    .sort((a, b) => a.rank - b.rank || a.item.label.localeCompare(b.item.label))
    .slice(0, 8).map(({ item }) => item)
}
