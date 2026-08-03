interface SoundToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
}

function SoundIcon({ enabled }: { enabled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
    >
      <path
        d="M4.5 9.25v5.5h3.2l4.4 3.35V5.9L7.7 9.25H4.5Z"
        fill="currentColor"
      />
      {enabled ? (
        <>
          <path d="M15 8.25a5 5 0 0 1 0 7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M17.7 5.8a8.4 8.4 0 0 1 0 12.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </>
      ) : (
        <path d="m15.1 9 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      )}
    </svg>
  )
}

export function SoundToggle({ enabled, onChange }: SoundToggleProps) {
  const label = enabled ? 'Turn sound off' : 'Turn sound on'

  return (
    <button
      className="sound-toggle"
      type="button"
      aria-label={label}
      aria-pressed={enabled}
      onClick={() => onChange(!enabled)}
    >
      <SoundIcon enabled={enabled} />
      <span>{enabled ? 'Sound on' : 'Sound off'}</span>
    </button>
  )
}
