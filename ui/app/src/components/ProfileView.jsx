import './ProfileView.css'

/**
 * Reusable profile view: avatar, @username, followers/following stats, posts grid.
 * No header or settings link; the parent (AccountPage or UserPage) provides those.
 *
 * @param {Object} props
 * @param {{ username: string, iconUrl: string | null, followers: number, following: number }} props.profile
 * @param {boolean} [props.isOwnProfile] - Unused for now; reserved for future account-only UI.
 * @param {boolean} [props.loading]
 * @param {string | null} [props.error]
 */
export default function ProfileView({ profile, isOwnProfile = false, loading = false, error = null }) {
  const { username = '', iconUrl = null, followers = 0, following = 0 } = profile ?? {}

  return (
    <main className="profile-content">
      <div
        className={`profile-avatar ${loading ? 'skeleton-pulse' : ''}`}
        style={
          iconUrl
            ? { backgroundImage: `url(${iconUrl})`, backgroundSize: 'cover' }
            : undefined
        }
      />
      <p className="profile-userid">
        @{username || (loading ? 'loading' : 'user')}
      </p>
      {error && (
        <p className="profile-error" role="alert">
          {error}
        </p>
      )}
      <div className="profile-stats">
        <span className="profile-stat">
          <strong className="profile-stat-value">{followers}</strong>
          <span className="profile-stat-label">followers</span>
        </span>
        <span className="profile-stat">
          <strong className="profile-stat-value">{following}</strong>
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
  )
}
