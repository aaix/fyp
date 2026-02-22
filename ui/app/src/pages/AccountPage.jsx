import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Session } from '../lib/session.js'
import './AccountPage.css'
import { getAvatarUrl } from '../lib/utils.js'

export default function AccountPage() {
  const [profile, setProfile] = useState({
    username: '',
    followers: 0,
    following: 0,
    iconUrl: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Callback that uses Session.getCurrentAccount to populate user info
  const loadAccountInfo = async () => {
    try {
      setError(null)
      const session = window.session || new Session()
      const res = await session.getCurrentAccount()

      if (!res?.success) {
        setError(res?.error?.message || 'Could not load account')
        return
      }

      const data = res.data || {}

      const iconUrl = getAvatarUrl(data);
      setProfile({
        username: data.username ?? '',
        followers: data.followers ?? data.followers_count ?? 0,
        following: data.following ?? data.following_count ?? 0,
        iconUrl: iconUrl,
      })
    } catch (e) {
      setError(e.message || 'Could not load account')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccountInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="account-page">
      <header className="account-header">
        <h1 className="account-title">My Profile</h1>
        <Link to="/account/settings" className="account-settings-link" aria-label="Settings">
          <span className="material-symbols-outlined" aria-hidden>settings</span>
        </Link>
      </header>
      <main className="account-content">
        <div
          className={`profile-avatar ${loading ? 'skeleton-pulse' : ''}`}
          style={
            profile.iconUrl
              ? { backgroundImage: `url(${profile.iconUrl})`, backgroundSize: 'cover' }
              : undefined
          }
        />
        <p className="profile-userid">
          @{profile.username || (loading ? 'loading' : 'user')}
        </p>
        {error && (
          <p className="profile-error" role="alert">
            {error}
          </p>
        )}
        <div className="profile-stats">
          <span className="profile-stat">
            <strong className="profile-stat-value">{profile.followers}</strong>
            <span className="profile-stat-label">followers</span>
          </span>
          <span className="profile-stat">
            <strong className="profile-stat-value">{profile.following}</strong>
            <span className="profile-stat-label">following</span>
          </span>
        </div>
        <section className="profile-posts" aria-label="Posts">
          <div className="profile-posts-grid">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className={`profile-post-tile ${loading ? 'skeleton-pulse' : ''}`} />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
