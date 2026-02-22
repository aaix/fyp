import './MessagesPage.css'

export default function MessagesPage() {
  return (
    <div className="messages-page">
      <header className="messages-header">
        <h1 className="messages-title">Messages</h1>
      </header>
      <main className="messages-list">
        <div className="conversation-skeleton skeleton-pulse" />
        <div className="conversation-skeleton skeleton-pulse" />
        <div className="conversation-skeleton skeleton-pulse" />
        <div className="conversation-skeleton skeleton-pulse" />
      </main>
    </div>
  )
}
