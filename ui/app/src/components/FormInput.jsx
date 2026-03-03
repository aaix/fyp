export default function FormInput({
  label,
  error,
  className = '',
  id,
  ...props
}) {
  const inputId = id || props.name

  return (
    <label className="flex flex-col gap-1 text-sm text-[color:var(--text-muted)]" htmlFor={inputId}>
      {label && <span className="font-medium text-[color:var(--text-primary)]">{label}</span>}
      <input
        id={inputId}
        className={`rounded-button border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-focus)] ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  )
}

