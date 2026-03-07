export default function PageContainer({ className = '', ...props }) {
  const base =
    'flex min-h-0 flex-1 flex-col gap-4 px-4 pb-[calc(var(--bottom-nav-height)+max(0.5rem,env(safe-area-inset-bottom)))] pt-4 md:px-6 md:pb-5'

  return <div className={`${base} ${className}`} {...props} />
}

