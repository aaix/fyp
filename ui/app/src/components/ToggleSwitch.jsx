export default function ToggleSwitch({
  checked = false,
  onChange,
  disabled = false,
  label,
  onLabel = 'On',
  offLabel = 'Off',
}) {
  return (
    <label className="flex items-center gap-2">
      {label ? <span className="text-xs text-[color:var(--text-muted)]">{label}</span> : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full p-0 transition-colors ${
          checked
            ? 'bg-[color:var(--accent)] hover:bg-[color:var(--accent-hover)]'
            : 'bg-[color:var(--card-border)] hover:bg-[color:var(--input-border-hover)]'
        }`}
      >
        <span className="sr-only">{checked ? onLabel : offLabel}</span>
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
          aria-hidden
        />
      </button>
    </label>
  )
}
