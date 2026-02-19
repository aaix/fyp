import './HomePage.css'

export default function HomePage() {
  return (
    <div className="home-page">
      <header className="home-header">
        <h1 className="home-title">Feed</h1>
      </header>
      <main className="home-feed">
        <div className="post-skeleton post-skeleton-1" />
        <div className="post-skeleton post-skeleton-2" />
        <div className="post-skeleton post-skeleton-3" />
      </main>
    </div>
  )
}
