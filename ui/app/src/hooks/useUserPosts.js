import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FEED_TYPE_MAIN, postManager } from '../lib/post.js'

/** Matches API default in shared/py/grpc/post.py read_users_posts */
const PAGE_SIZE = 15

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
 * @param {string | null | undefined} userId
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
export function useUserPosts(userId, feedType = FEED_TYPE_MAIN) {
  const stableUserId = useMemo(() => {
    if (userId == null || userId === '') return null
    return String(userId)
  }, [userId])

  const stableFeedType = useMemo(() => {
    if (feedType == null || feedType === '') return FEED_TYPE_MAIN
    return String(feedType)
  }, [feedType])

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(!!stableUserId)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)
  const loadMoreInFlight = useRef(false)
  const postsRef = useRef(posts)
  postsRef.current = posts

  const reload = () => setReloadToken((n) => n + 1)

  useEffect(() => {
    if (!stableUserId) {
      setPosts([])
      setLoading(false)
      setLoadingMore(false)
      setHasMore(false)
      setError(null)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        setHasMore(false)
        const res = await postManager.getUserPosts(stableUserId, stableFeedType)
        if (cancelled) return
        if (res?.success && res.data?.posts) {
          const list = res.data.posts
          setPosts(list)
          setHasMore(list.length >= PAGE_SIZE)
        } else {
          setPosts([])
          setHasMore(false)
          const msg = res?.error?.message ?? 'Could not load posts'
          setError(msg)
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setPosts([])
          setHasMore(false)
          setError(e?.message ?? 'Could not load posts')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [stableUserId, stableFeedType, reloadToken])

  const loadMore = useCallback(async () => {
    if (!stableUserId || !hasMore || loadMoreInFlight.current) return
    const list = postsRef.current
    const last = list[list.length - 1]
    const before = last?.post_id
    if (before == null) return

    loadMoreInFlight.current = true
    setLoadingMore(true)
    try {
      const res = await postManager.getUserPosts(stableUserId, stableFeedType, String(before))
      if (res?.success && res.data?.posts) {
        const next = res.data.posts
        if (next.length === 0) {
          setHasMore(false)
        } else {
          setPosts((prev) => mergePostsById(prev, next))
          if (next.length < PAGE_SIZE) setHasMore(false)
        }
      } else {
        setHasMore(false)
        const msg = res?.error?.message ?? 'Could not load posts'
        setError(msg)
      }
    } catch (e) {
      console.error(e)
      setError(e?.message ?? 'Could not load posts')
    } finally {
      loadMoreInFlight.current = false
      setLoadingMore(false)
    }
  }, [stableUserId, stableFeedType, hasMore])

  return { posts, loading, error, reload, hasMore, loadingMore, loadMore }
}
