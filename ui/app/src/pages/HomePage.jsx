import { useEffect, useMemo, useState } from 'react'
import PageContainer from '../components/PageContainer.jsx'
import IconLinkButton from '../components/IconLinkButton.jsx'
import { PostTileGrid } from '../components/PostTile.jsx'
import { useFeed } from '../hooks/useFeed.js'
import { FEED_TYPE_MAIN } from '../lib/post.js'
import { getAvatarUrl } from '../lib/utils.js'
import { userManager } from '../lib/user.js'

export default function HomePage() {
  const { posts, loading, error, hasMore, loadingMore, loadMore } = useFeed(FEED_TYPE_MAIN)
  const [authorById, setAuthorById] = useState(() => ({}))

  const authorIds = useMemo(() => {
    const s = new Set()
    for (const p of posts ?? []) {
      if (p?.author_id != null) s.add(String(p.author_id))
    }
    return [...s]
  }, [posts])

  useEffect(() => {
    if (authorIds.length === 0) return
    let cancelled = false
    ;(async () => {
      try {
        const users = await userManager.fetchUsersBulk(authorIds)
        if (cancelled) return
        const next = {}
        for (const u of users) {
          if (!u?.user_id) continue
          next[String(u.user_id)] = {
            username: u.username ?? '',
            iconUrl: getAvatarUrl(u),
          }
        }
        setAuthorById((prev) => ({ ...prev, ...next }))
      } catch (e) {
        console.error(e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authorIds])

  return (
    <PageContainer className="min-h-0 flex-1 overflow-y-auto">
      <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-3">
        <div>
          <h1 className="text-xl font-bold text-[color:var(--text-primary)]">Feed</h1>
          <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">
            Posts from people you follow.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconLinkButton to="/shorts" label="Shorts" icon="movie" />
          <IconLinkButton to="/create-post" label="Create post" icon="add" />
        </div>
      </header>
      <main className="flex flex-shrink-0 flex-col gap-4 pt-4 pb-2">
        <PostTileGrid
          posts={posts}
          loading={loading}
          error={error}
          emptyLabel="Nothing in your feed yet."
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          feedType={FEED_TYPE_MAIN}
          showAuthorOnHover
          authorById={authorById}
        />
      </main>
    </PageContainer>
  )
}
