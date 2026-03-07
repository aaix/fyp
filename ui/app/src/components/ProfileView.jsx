/**
 * Reusable profile view: avatar, @username, friends stat, posts grid.
 * No header or settings link; the parent (AccountPage or UserPage) provides those.
 *
 * @param {Object} props
 * @param {{ username: string, iconUrl: string | null, friendsCount?: number }} props.profile
 * @param {boolean} [props.loading]
 * @param {string | null} [props.error]
 * @param {() => void} [props.onFriendsClick] - When set, the friends stat is a button that calls this.
 * @param {React.ReactNode} [props.actions] - Optional actions (e.g. buttons) rendered below the stats row.
 */
export default function ProfileView({
  profile,
  loading = false,
  error = null,
  onFriendsClick = null,
  actions = null,
}) {
  const {
    username = '',
    iconUrl = null,
    friendsCount = 0,
  } = profile ?? {}

  const friendsStat = (
    <span className="flex flex-col items-center gap-0.5">
      <strong className="text-lg font-bold text-[color:var(--text-primary)]">
        {friendsCount}
      </strong>
      <span className="text-xs text-[color:var(--text-muted)]">friends</span>
    </span>
  )

  return (
    <main className="flex flex-1 flex-col items-center overflow-y-auto px-5 pb-[calc(1.5rem+var(--bottom-nav-height)+env(safe-area-inset-bottom))] pt-6 md:px-8 md:pb-6">
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
        {onFriendsClick ? (
          <button
            type="button"
            onClick={onFriendsClick}
            className="flex flex-col items-center gap-0.5 rounded-button transition-colors hover:bg-[color:var(--card-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]"
            aria-label={`${friendsCount} friends. View list`}
          >
            {friendsStat}
          </button>
        ) : (
          friendsStat
        )}
      </div>
      {actions != null ? <div className="mt-4 w-full">{actions}</div> : null}
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
