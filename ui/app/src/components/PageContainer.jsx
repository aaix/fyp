export default function PageContainer({ className = '', ...props }) {
  const base =
    'flex min-h-0 flex-1 flex-col gap-4 px-4 pb-[calc(4.5rem+max(0.5rem,env(safe-area-inset-bottom)))] pt-4'

  return <div className={`${base} ${className}`} {...props} />
}

