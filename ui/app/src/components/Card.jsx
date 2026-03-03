export default function Card({ className = '', ...props }) {
  const base =
    'rounded-card border border-[color:var(--card-border)] bg-[color:var(--card-bg)] shadow-card'

  return <div className={`${base} ${className}`} {...props} />
}

