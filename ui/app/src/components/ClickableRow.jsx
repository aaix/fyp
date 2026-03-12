export default function ClickableRow({ className = '', type = 'button', ...props }) {
  const base =
    'flex w-full cursor-pointer select-none items-center text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)] disabled:cursor-not-allowed disabled:opacity-60'

  return <button type={type} className={`${base} ${className}`} {...props} />
}
