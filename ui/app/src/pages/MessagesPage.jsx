import PageContainer from '../components/PageContainer.jsx'
import Card from '../components/Card.jsx'

export default function MessagesPage() {
  return (
    <PageContainer>
      <header className="border-b border-[color:var(--card-border)] pb-3">
        <h1 className="text-xl font-bold text-[color:var(--text-primary)]">Messages</h1>
      </header>
      <main className="flex flex-1 flex-col gap-2 overflow-y-auto pt-2">
        <Card className="h-18 skeleton-pulse" />
        <Card className="h-18 skeleton-pulse" />
        <Card className="h-18 skeleton-pulse" />
        <Card className="h-18 skeleton-pulse" />
      </main>
    </PageContainer>
  )
}
