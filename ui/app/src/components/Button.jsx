export default function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center rounded-button px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)] disabled:opacity-60 disabled:cursor-not-allowed'

  const variants = {
    primary:
      'bg-[color:var(--accent)] text-[color:var(--bg)] hover:bg-[color:var(--accent-hover)] focus-visible:ring-[color:var(--accent-focus)]',
    ghost:
      'border border-[color:var(--card-border)] bg-[color:var(--card-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--tab-active-bg)]',
    danger:
      'bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-700',
  }

  const variantClasses = variants[variant] ?? variants.primary

  return (
    <button
      type={type}
      className={`${base} ${variantClasses} ${className}`}
      {...props}
    />
  )
}

