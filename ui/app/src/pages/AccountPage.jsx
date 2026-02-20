import { Link } from 'react-router-dom'
import './AccountPage.css'

export default function AccountPage() {
  return (
    <div className="account-page">
      <header className="account-header">
        <h1 className="account-title">My Profile</h1>
        <Link to="/account/settings" className="account-settings-link" aria-label="Settings">
          <span className="material-symbols-outlined" aria-hidden>settings</span>
        </Link>
      </header>
      <main className="account-content">
        <div className="profile-avatar" />
        <p className="profile-userid">@user_id</p>
        <div className="profile-stats">
          <span className="profile-stat">
            <strong className="profile-stat-value">0</strong>
            <span className="profile-stat-label">followers</span>
          </span>
          <span className="profile-stat">
            <strong className="profile-stat-value">0</strong>
            <span className="profile-stat-label">following</span>
          </span>
        </div>
        <section className="profile-posts" aria-label="Posts">
          <div className="profile-posts-grid">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="profile-post-tile" />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
