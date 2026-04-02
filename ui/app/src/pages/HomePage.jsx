import { useEffect, useState } from 'react'
import PageContainer from '../components/PageContainer.jsx'
import IconLinkButton from '../components/IconLinkButton.jsx'
import { PostTileGrid } from '../components/PostTile.jsx'
import { useUserPosts } from '../hooks/useUserPosts.js'
import { getCurrentSession } from '../lib/session.js'
import { FEED_TYPE_MAIN } from '../lib/post.js'

export default function HomePage() {
  const [feedUserId, setFeedUserId] = useState(null)
  const [sessionResolved, setSessionResolved] = useState(false)
  const { posts, loading, error, hasMore, loadingMore, loadMore } = useUserPosts(feedUserId, FEED_TYPE_MAIN)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const session = getCurrentSession()
        const res = await session.getCurrentAccount()
        if (cancelled) return
        const id = res?.data?.user_id ?? res?.data?.id ?? null
        if (id != null) setFeedUserId(String(id))
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setSessionResolved(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <PageContainer className="min-h-0 flex-1 overflow-y-auto">
      <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-3">
        <div>
          <h1 className="text-xl font-bold text-[color:var(--text-primary)]">Feed</h1>
          <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">
            Masonry preview of your posts (full feed coming later).
          </p>
        </div>
        <IconLinkButton to="/create-post" label="Create post" icon="add" />
      </header>
      <main className="flex flex-shrink-0 flex-col gap-4 pt-4 pb-2">
        <PostTileGrid
          posts={posts}
          loading={!sessionResolved || (feedUserId != null && loading)}
          error={error}
          emptyLabel="No posts yet. Create one to see it here."
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          feedType={FEED_TYPE_MAIN}
        />
      </main>
    </PageContainer>
  )
}
