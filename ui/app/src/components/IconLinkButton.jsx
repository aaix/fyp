import { Link } from 'react-router-dom'

export default function IconLinkButton({ to, label, icon, className = '' }) {
  return (
    <Link
      to={to}
      className={`flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--text-primary)] no-underline transition-colors hover:bg-[color:var(--card-bg)] hover:text-[color:var(--accent)] ${className}`}
      aria-label={label}
    >
      <span className="material-symbols-outlined text-xl" aria-hidden>
        {icon}
      </span>
    </Link>
  )
}
