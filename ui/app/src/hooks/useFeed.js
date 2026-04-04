import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FEED_TYPE_MAIN, postManager } from '../lib/post.js'

function postIdKey(p) {
  if (p == null || p.post_id == null) return ''
  return String(p.post_id)
}

function mergePostsById(prev, next) {
  const seen = new Set(prev.map((p) => postIdKey(p)).filter(Boolean))
  const merged = [...prev]
  for (const p of next) {
    const id = postIdKey(p)
    if (!id || seen.has(id)) continue
    seen.add(id)
    merged.push(p)
  }
  return merged
}

/**
 * Global timeline feed (`GET post/{feed|short}`).
 *
 * @param {string} feedType - {@link FEED_TYPE_MAIN} | FEED_TYPE_SHORTS
 * @returns {{
 *   posts: object[],
 *   loading: boolean,
 *   error: string | null,
 *   reload: () => void,
 *   hasMore: boolean,
 *   loadingMore: boolean,
 *   loadMore: () => Promise<void>,
 * }}
 */
export function useFeed(feedType = FEED_TYPE_MAIN) {
  const stableFeedType = useMemo(() => {
    if (feedType == null || feedType === '') return FEED_TYPE_MAIN
    return String(feedType)
  }, [feedType])

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)
  const loadMoreInFlight = useRef(false)
  const postsRef = useRef(posts)
  postsRef.current = posts

  const reload = () => setReloadToken((n) => n + 1)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        setHasMore(false)
        const res = await postManager.getFeed(stableFeedType, null)
        if (cancelled) return
        if (res?.success && res.data?.posts) {
          const list = res.data.posts
          setPosts(list)
          // Keep loading until a page returns posts: [] — do not infer end from short pages.
          setHasMore(list.length > 0)
        } else {
          setPosts([])
          setHasMore(false)
          const msg = res?.error?.message ?? 'Could not load feed'
          setError(msg)
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setPosts([])
          setHasMore(false)
          setError(e?.message ?? 'Could not load feed')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [stableFeedType, reloadToken])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadMoreInFlight.current) return
    const list = postsRef.current
    const last = list[list.length - 1]
    const before = last?.post_id
    if (before == null) return

    loadMoreInFlight.current = true
    setLoadingMore(true)
    try {
      const res = await postManager.getFeed(stableFeedType, String(before))
      if (res?.success && res.data?.posts) {
        const next = res.data.posts
        if (next.length === 0) {
          setHasMore(false)
        } else {
          setPosts((prev) => mergePostsById(prev, next))
        }
      } else {
        setHasMore(false)
        const msg = res?.error?.message ?? 'Could not load feed'
        setError(msg)
      }
    } catch (e) {
      console.error(e)
      setError(e?.message ?? 'Could not load feed')
    } finally {
      loadMoreInFlight.current = false
      setLoadingMore(false)
    }
  }, [stableFeedType, hasMore])

  return { posts, loading, error, reload, hasMore, loadingMore, loadMore }
}
