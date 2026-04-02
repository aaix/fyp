import { useRef } from 'react'
import Button from './Button.jsx'
import UserAvatar from './UserAvatar.jsx'
import { PostTileGrid } from './PostTile.jsx'

/**
 * Reusable profile view: avatar, @username, friends stat, posts grid.
 * No header or settings link; the parent (AccountPage or UserPage) provides those.
 *
 * @param {Object} props
 * @param {{ username: string, iconUrl: string | null, friendsCount?: number | null, followersCount?: number | null, userId?: string | null }} props.profile
 * @param {boolean} [props.loading]
 * @param {string | null} [props.error]
 * @param {string | null} [props.avatarError] - Shown when avatar upload fails (e.g. on account page).
 * @param {() => void} [props.onFriendsClick] - When set, the friends stat is a button that calls this.
 * @param {React.ReactNode} [props.actions] - Optional actions (e.g. buttons) rendered below the stats row.
 * @param {(file: File) => void} [props.onAvatarFileSelected] - When set, avatar shows hover overlay and opens file picker on click.
 * @param {boolean} [props.avatarUploading]
 * @param {object[]} [props.posts] - User posts (PostResponse shape)
 * @param {boolean} [props.postsLoading]
 * @param {string | null} [props.postsError]
 * @param {boolean} [props.postsHasMore]
 * @param {boolean} [props.postsLoadingMore]
 * @param {() => void} [props.onPostsLoadMore]
 * @param {string} [props.postsFeedType] - "feed" | "short"
 * @param {(nextFeedType: string) => void} [props.onPostsFeedTypeChange]
 */
export default function ProfileView({
  profile,
  loading = false,
  error = null,
  avatarError = null,
  onFriendsClick = null,
  actions = null,
  onAvatarFileSelected = null,
  avatarUploading = false,
  posts = [],
  postsLoading = false,
  postsError = null,
  postsHasMore = false,
  postsLoadingMore = false,
  onPostsLoadMore = null,
  postsFeedType = 'feed',
  onPostsFeedTypeChange = null,
}) {
  const fileInputRef = useRef(null)
  const {
    username = '',
    iconUrl = null,
    userId = null,
    friendsCount = 0,
    followersCount = 0,
  } = profile ?? {}

  const friendsDisplay = friendsCount === null ? '-' : friendsCount
  const followersDisplay = followersCount === null ? '-' : followersCount

  const friendsStat = (
    <span className="flex flex-col items-center gap-0.5">
      <strong className="text-lg font-bold text-[color:var(--text-primary)]">
        {friendsDisplay}
      </strong>
      <span className="text-xs text-[color:var(--text-muted)]">friends</span>
    </span>
  )

  const followersStat = (
    <span className="flex flex-col items-center gap-0.5">
      <strong className="text-lg font-bold text-[color:var(--text-primary)]">
        {followersDisplay}
      </strong>
      <span className="text-xs text-[color:var(--text-muted)]">followers</span>
    </span>
  )

  const avatarAlt = username ? `${username}'s avatar` : 'User avatar'
  const avatarInner = (
    <UserAvatar
      userId={userId}
      src={iconUrl}
      alt={avatarAlt}
      loading={loading}
      className="aspect-square h-full w-full rounded-full object-cover"
    />
  )

  const avatarBlock =
    onAvatarFileSelected != null ? (
      <div className="group relative max-sm:h-24 max-sm:w-24 sm:h-48 sm:w-48 shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              onAvatarFileSelected(file)
            }
            e.target.value = ''
          }}
        />
        <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-[color:var(--card-border)]">
          {avatarInner}
          <button
            type="button"
            disabled={avatarUploading || loading}
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full border-0 bg-black/45 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Change profile picture"
          >
            <span
              className="material-symbols-outlined text-3xl text-white drop-shadow"
              aria-hidden
            >
              edit
            </span>
          </button>
        </div>
        {avatarUploading ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/30"
            aria-hidden
          >
            <span className="material-symbols-outlined animate-pulse text-3xl text-white" aria-hidden>
              hourglass_empty
            </span>
          </div>
        ) : null}
      </div>
    ) : (
      <UserAvatar
        userId={userId}
        src={iconUrl}
        alt={avatarAlt}
        loading={loading}
        className="aspect-square max-sm:h-24 max-sm:w-24 min-md:h-48 min-md:w-48 rounded-full border-2 border-[color:var(--card-border)] object-cover"
      />
    )

  return (
    <main className="flex w-full min-w-0 flex-1 flex-col items-center overflow-y-auto px-5 pb-[calc(1.5rem+var(--bottom-nav-height)+env(safe-area-inset-bottom))] pt-6 md:px-8 md:pb-6">
      {avatarBlock}
      <p className="mt-3 text-base font-medium text-[color:var(--text-primary)]">
        @{username || (loading ? 'loading' : 'user')}
      </p>
      {error && (
        <p className="mt-2 text-sm text-[color:var(--text-muted)]" role="alert">
          {error}
        </p>
      )}
      {avatarError && (
        <p className="mt-2 text-sm text-[color:var(--text-muted)]" role="alert">
          {avatarError}
        </p>
      )}
      <div className="mt-2 flex gap-8">
        {onFriendsClick ? (
          <Button
            type="button"
            variant="text"
            size="sm"
            onClick={onFriendsClick}
            className="flex-col gap-0.5"
            aria-label={`${friendsCount === null ? 'Unknown' : friendsCount} friends. View list`}
          >
            {friendsStat}
          </Button>
        ) : (
          friendsStat
        )}
        {followersStat}
      </div>
      {actions != null ? <div className="mt-4 w-full">{actions}</div> : null}
      <section
        className="mt-6 w-full self-stretch px-4 sm:px-6 md:px-10 lg:px-14 xl:px-20 2xl:px-24"
        aria-label="Posts"
      >
        <div className="mb-3 flex items-center justify-center">
          {typeof onPostsFeedTypeChange === 'function' ? (
            <div className="flex items-center overflow-hidden rounded-button border border-[color:var(--card-border)]">
              <button
                type="button"
                onClick={() => onPostsFeedTypeChange('feed')}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  postsFeedType === 'feed'
                    ? 'bg-[color:var(--tab-active-bg)] text-[color:var(--text-primary)]'
                    : 'bg-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'
                }`}
                aria-pressed={postsFeedType === 'feed'}
              >
                Posts
              </button>
              <button
                type="button"
                onClick={() => onPostsFeedTypeChange('short')}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  postsFeedType === 'short'
                    ? 'bg-[color:var(--tab-active-bg)] text-[color:var(--text-primary)]'
                    : 'bg-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'
                }`}
                aria-pressed={postsFeedType === 'short'}
              >
                Shorts
              </button>
            </div>
          ) : null}
        </div>
        <PostTileGrid
          posts={posts}
          loading={postsLoading}
          error={postsError}
          emptyLabel="No posts yet."
          hasMore={postsHasMore}
          loadingMore={postsLoadingMore}
          onLoadMore={onPostsLoadMore}
        />
      </section>
    </main>
  )
}
