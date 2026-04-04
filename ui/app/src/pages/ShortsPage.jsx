import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PageContainer from '../components/PageContainer.jsx'
import ShortFeedItem from '../components/ShortFeedItem.jsx'
import { useFeed } from '../hooks/useFeed.js'
import { FEED_TYPE_SHORTS } from '../lib/post.js'
import { getAvatarUrl } from '../lib/utils.js'
import { userManager } from '../lib/user.js'

export default function ShortsPage() {
  const { posts, loading, error, hasMore, loadingMore, loadMore } = useFeed(FEED_TYPE_SHORTS)
  const [authorById, setAuthorById] = useState(() => ({}))
  const [playingId, setPlayingId] = useState(null)
  const [scrollRootEl, setScrollRootEl] = useState(null)
  const ratiosRef = useRef({})
  const loadSentinelRef = useRef(null)

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

  useEffect(() => {
    const valid = new Set((posts ?? []).map((p) => (p?.post_id != null ? String(p.post_id) : '')))
    for (const k of Object.keys(ratiosRef.current)) {
      if (!valid.has(k)) delete ratiosRef.current[k]
    }
  }, [posts])

  const onVisibilityChange = useCallback((postId, ratio) => {
    ratiosRef.current[postId] = ratio
    let bestId = null
    let best = 0
    for (const [id, r] of Object.entries(ratiosRef.current)) {
      if (r > best) {
        best = r
        bestId = id
      }
    }
    setPlayingId(best >= 0.45 ? bestId : null)
  }, [])

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return
    const root = scrollRootEl
    const el = loadSentinelRef.current
    if (!root || !el) return
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0]
        if (e?.isIntersecting) loadMore()
      },
      { root, rootMargin: '200px', threshold: 0 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, loading, loadingMore, loadMore, posts?.length, scrollRootEl])

  const hasPosts = (posts?.length ?? 0) > 0
  const showInitialSkeleton = loading && !hasPosts

  return (
    <PageContainer className="min-h-0 flex-1 !gap-0 overflow-hidden !p-0 !pb-0 md:!gap-4 md:!px-6 md:!pt-4 md:!pb-5">
      <header className="hidden flex-shrink-0 flex-col border-b border-[color:var(--card-border)] pb-3 md:flex">
        <div>
          <h1 className="text-xl font-bold text-[color:var(--text-primary)]">Shorts</h1>
          <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">Swipe or scroll for the next clip.</p>
        </div>
      </header>
      <div
        ref={setScrollRootEl}
        className="snap-y snap-mandatory overflow-y-auto overscroll-y-contain max-md:h-[calc(100dvh-var(--bottom-nav-height))] max-md:min-h-0 max-md:flex-none md:mt-2 md:min-h-0 md:flex-1"
      >
        {error ? (
          <p className="px-4 py-8 text-center text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : showInitialSkeleton ? (
          <div
            className="flex min-h-[calc(100dvh-var(--bottom-nav-height))] items-center justify-center max-md:min-h-[calc(100dvh-var(--bottom-nav-height))] md:min-h-[50dvh]"
            aria-busy="true"
            aria-label="Loading shorts"
          >
            <p className="text-sm text-[color:var(--text-muted)]">Loading…</p>
          </div>
        ) : !hasPosts ? (
          <p className="px-4 py-12 text-center text-sm text-[color:var(--text-muted)]">
            No shorts yet.
          </p>
        ) : (
          <>
            {posts.map((p, i) => {
              const id = p.post_id != null ? String(p.post_id) : ''
              const aid = p?.author_id != null ? String(p.author_id) : ''
              const preview = aid && authorById[aid] != null ? authorById[aid] : null
              return (
                <ShortFeedItem
                  key={id || `short-${i}`}
                  post={p}
                  feedType={FEED_TYPE_SHORTS}
                  authorPreview={preview}
                  isPlaying={playingId === id}
                  scrollRoot={scrollRootEl}
                  onVisibilityChange={onVisibilityChange}
                />
              )
            })}
            {hasMore && !loadingMore ? (
              <div ref={loadSentinelRef} className="h-px w-full shrink-0" aria-hidden />
            ) : null}
            {loadingMore ? (
              <p className="py-4 text-center text-xs text-[color:var(--text-muted)]" aria-live="polite">
                Loading more…
              </p>
            ) : null}
          </>
        )}
      </div>
    </PageContainer>
  )
}
