import PageContainer from '../components/PageContainer.jsx'
import Card from '../components/Card.jsx'

export default function HomePage() {
  return (
    <PageContainer>
      <header className="border-b border-[color:var(--card-border)] pb-3">
        <h1 className="text-xl font-bold text-[color:var(--text-primary)]">Feed</h1>
      </header>
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto pt-2">
        <Card className="min-h-[280px] skeleton-pulse" />
        <Card className="min-h-[400px] skeleton-pulse" />
        <Card className="min-h-[340px] skeleton-pulse" />
      </main>
    </PageContainer>
  )
}
