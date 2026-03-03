/**
 * Reusable profile view: avatar, @username, followers/following stats, posts grid.
 * No header or settings link; the parent (AccountPage or UserPage) provides those.
 *
 * @param {Object} props
 * @param {{ username: string, iconUrl: string | null, followers: number, following: number }} props.profile
 * @param {boolean} [props.loading]
 * @param {string | null} [props.error]
 */
export default function ProfileView({ profile, loading = false, error = null }) {
  const { username = '', iconUrl = null, followers = 0, following = 0 } = profile ?? {}

  return (
    <main className="flex flex-1 flex-col items-center overflow-y-auto px-5 pb-[calc(1.5rem+var(--bottom-nav-height)+env(safe-area-inset-bottom))] pt-6">
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={username ? `${username}'s avatar` : 'User avatar'}
          className={`aspect-square h-24 w-24 rounded-full border-2 border-[color:var(--card-border)] object-cover ${loading ? 'skeleton-pulse' : ''}`}
        />
      ) : (
        <div
          className={`h-24 w-24 rounded-full border-2 border-[color:var(--card-border)] bg-[color:var(--card-bg)] ${loading ? 'skeleton-pulse' : ''}`}
          aria-hidden="true"
        />
      )}
      <p className="mt-3 text-base font-medium text-[color:var(--text-primary)]">
        @{username || (loading ? 'loading' : 'user')}
      </p>
      {error && (
        <p className="mt-2 text-sm text-[color:var(--text-muted)]" role="alert">
          {error}
        </p>
      )}
      <div className="mt-2 flex gap-6">
        <span className="flex flex-col items-center gap-0.5">
          <strong className="text-lg font-bold text-[color:var(--text-primary)]">
            {followers}
          </strong>
          <span className="text-xs text-[color:var(--text-muted)]">followers</span>
        </span>
        <span className="flex flex-col items-center gap-0.5">
          <strong className="text-lg font-bold text-[color:var(--text-primary)]">
            {following}
          </strong>
          <span className="text-xs text-[color:var(--text-muted)]">following</span>
        </span>
      </div>
      <section className="mt-6 w-full" aria-label="Posts">
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className={`aspect-square rounded border border-[color:var(--card-border)] bg-[color:var(--card-bg)] ${loading ? 'skeleton-pulse' : ''}`}
            />
          ))}
        </div>
      </section>
    </main>
  )
}
