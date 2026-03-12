export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  const base =
    'inline-flex cursor-pointer select-none items-center justify-center gap-1.5 rounded-button font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)] disabled:cursor-not-allowed disabled:opacity-60'

  const sizes = {
    xs: 'min-h-7 px-2.5 py-1 text-xs',
    sm: 'min-h-8 px-3 py-1.5 text-sm',
    md: 'min-h-10 px-4 py-2 text-sm',
    iconSm: 'h-8 w-8 p-0',
    icon: 'h-9 w-9 p-0',
    iconLg: 'h-10 w-10 p-0',
  }

  const variants = {
    primary:
      'bg-[color:var(--accent)] text-[color:var(--bg)] hover:bg-[color:var(--accent-hover)] focus-visible:ring-[color:var(--accent-focus)]',
    ghost:
      'border border-[color:var(--card-border)] bg-[color:var(--card-bg)] text-[color:var(--text-primary)] hover:bg-[color:var(--tab-active-bg)]',
    danger:
      'bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-700',
    text:
      'text-[color:var(--text-primary)] hover:bg-[color:var(--tab-active-bg)] focus-visible:ring-[color:var(--accent-focus)]',
    tab:
      'rounded-none border-b-2 border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]',
  }

  const sizeClasses = sizes[size] ?? sizes.md
  const variantClasses = variants[variant] ?? variants.primary

  return (
    <button
      type={type}
      className={`${base} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    />
  )
}

