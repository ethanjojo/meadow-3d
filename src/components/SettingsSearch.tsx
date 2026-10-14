import { useEffect, useId, useRef, useState } from 'react'
import { searchSettings, type SettingSearchResult } from '../core/settingsSearch'

export function SettingsSearch({ onSelect, resetKey, includePresets }: { onSelect: (result: SettingSearchResult) => void; resetKey: string; includePresets: boolean }) {
  const [query, setQuery] = useState(''), [expanded, setExpanded] = useState(false), [open, setOpen] = useState(false), [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null), listRef = useRef<HTMLUListElement>(null), id = useId()
  const results = searchSettings(query).filter(result => includePresets || result.tab !== 'presets')
  const showing = open && Boolean(query.trim())
  useEffect(() => { setQuery(''); setOpen(false); setExpanded(false); setActive(-1) }, [resetKey])
  useEffect(() => { if (expanded) inputRef.current?.focus() }, [expanded])
  useEffect(() => { if (showing && active >= 0) listRef.current?.querySelector<HTMLElement>(`[data-result-index="${active}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'instant' }) }, [active, showing])
  const choose = (result: SettingSearchResult) => { setQuery(''); setOpen(false); setExpanded(false); onSelect(result) }
  return <div className="settings-search" data-expanded={expanded} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setExpanded(false) } }}>
    <button type="button" className="icon-button settings-search-toggle" aria-label="Search settings" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg></button>
    <div className="settings-search-field"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
      <input ref={inputRef} type="text" role="combobox" aria-label="Search all settings" placeholder="Search settings…" autoComplete="off" aria-autocomplete="list" aria-expanded={showing} aria-controls={showing ? `${id}-results` : undefined} aria-activedescendant={showing && active >= 0 && results[active] ? `${id}-${active}` : undefined} value={query} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.currentTarget.value); setOpen(true); setActive(-1) }} onKeyDown={event => {
        if (event.key === 'Escape' && (showing || expanded)) { event.preventDefault(); event.stopPropagation(); if (showing) setOpen(false); else { setExpanded(false); setQuery('') }; return }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(index => !results.length ? -1 : index < 0 ? event.key === 'ArrowDown' ? 0 : results.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length) }
        if (event.key === 'Enter' && showing && results.length) { event.preventDefault(); choose(results[Math.max(0, active)]) }
      }} />
      {query ? <button type="button" className="settings-search-clear" aria-label="Clear search" onClick={() => { setQuery(''); setOpen(false); inputRef.current?.focus() }}>×</button> : null}
    </div>
    {showing ? <div className="settings-search-popup"><ul ref={listRef} id={`${id}-results`} role="listbox" aria-label="Settings search results" className="settings-search-results">{results.map((result, index) => <li key={`${result.tab}:${result.id}`} id={`${id}-${index}`} role="option" data-result-index={index} aria-selected={index === active} aria-label={`${result.label}, ${result.path}`} onMouseDown={event => event.preventDefault()} onClick={() => choose(result)} onMouseMove={() => setActive(index)}><span>{result.label}</span><small>{result.path}</small></li>)}</ul>{!results.length ? <p role="status">No settings found. Try a different name.</p> : <p className="settings-search-help">↑↓ choose · Enter open · Esc dismiss</p>}</div> : null}
  </div>
}
