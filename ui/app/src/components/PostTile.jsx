import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { columnCountFromContainerWidth, distributePostsRoundRobin } from '../lib/postTileGridLayout.js'
import { clampTileAspectRatio, postRendersAsImage, postRendersAsVideo } from '../lib/postMedia.js'

const TILE_ROW_GAP_CLASS = 'gap-2 md:gap-3'

/** Pixels of empty space below the grid (inside the scroll area) before we auto-fetch the next page. */
const AUTO_FILL_GAP_PX = 20

/**
 * @param {HTMLElement | null} el
 * @returns {HTMLElement | null}
 */
function findNearestScrollParent(el) {
  if (typeof document === 'undefined' || !el) return null
  let p = el.parentElement
  while (p && p !== document.documentElement) {
    const { overflowY, overflow } = window.getComputedStyle(p)
    const oy = overflowY || overflow
    if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') {
      return p
    }
    p = p.parentElement
  }
  return null
}

/**
 * Bottom Y (viewport) of the visible scrollport — use clientHeight so nested flex + overflow-y-auto
 * (e.g. ProfileView main on /account) measures the on-screen scroll area, not the wrong edge.
 * @param {HTMLElement | null} scrollParent
 */
function visibleScrollBottomPx(scrollParent) {
  const nav =
    parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--bottom-nav-height'), 10) || 72
  const windowBottom = window.innerHeight - nav - 8

  if (scrollParent) {
    const r = scrollParent.getBoundingClientRect()
    const portBottom = r.top + scrollParent.clientHeight
    return Math.min(portBottom, windowBottom)
  }
  return windowBottom
}

/** IO root: nested scroll containers need root set; viewport uses null. */
function intersectionObserverRoot(scrollParent) {
  if (
    !scrollParent ||
    scrollParent === document.documentElement ||
    scrollParent === document.body
  ) {
    return null
  }
  return scrollParent
}

function measureContainerWidthPx(el) {
  if (!el) return 0
  const cr = el.getBoundingClientRect().width
  if (cr > 0) return cr
  const cw = el.clientWidth
  if (cw > 0) return cw
  return 0
}

function usePostTileColumnCount() {
  const ref = useRef(null)
  const [columnCount, setColumnCount] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const apply = () => {
      const w = measureContainerWidthPx(el)
      if (w > 0) {
        setColumnCount(columnCountFromContainerWidth(w))
      }
    }

    apply()
    let rafInner = 0
    const rafOuter = requestAnimationFrame(() => {
      rafInner = requestAnimationFrame(apply)
    })

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry?.target) return
      const w =
        entry.contentRect.width > 0
          ? entry.contentRect.width
          : measureContainerWidthPx(entry.target)
      if (w > 0) {
        setColumnCount(columnCountFromContainerWidth(w))
      }
    })
    ro.observe(el)

    return () => {
      cancelAnimationFrame(rafOuter)
      cancelAnimationFrame(rafInner)
      ro.disconnect()
    }
  }, [])
  return [ref, columnCount]
}

/**
 * Full cell width; height follows intrinsic media aspect ratio, clamped to 1:3 … 3:1 (center crop).
 * Laid out in JS columns: row-major assignment (1,2,3 / 4,5,6 …), each column stacks vertically.
 *
 * @param {object} props
 * @param {object} props.post - PostResponse shape
 * @param {string} [props.className]
 */
export default function PostTile({ post, className = '' }) {
  const videoRef = useRef(null)
  const id = post.post_id != null ? String(post.post_id) : ''
  const isVideo = postRendersAsVideo(post.post_type)
  const isImage = postRendersAsImage(post.post_type)

  const [displayRatio, setDisplayRatio] = useState(null)

  const ratio = displayRatio ?? 1

  const onImgLoad = useCallback((e) => {
    const img = e.currentTarget
    const w = img.naturalWidth
    const h = img.naturalHeight
    setDisplayRatio(clampTileAspectRatio(w, h))
  }, [])

  const onImgError = useCallback(() => {
    setDisplayRatio(1)
  }, [])

  const onVideoMeta = useCallback((e) => {
    const v = e.currentTarget
    setDisplayRatio(clampTileAspectRatio(v.videoWidth, v.videoHeight))
  }, [])

  const onVideoError = useCallback(() => {
    setDisplayRatio(1)
  }, [])

  const onEnter = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.play().catch(() => {})
  }, [])

  const onLeave = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.pause()
    v.currentTime = 0
  }, [])

  const inner = (
    <div
      className={`relative w-full overflow-hidden bg-[color:var(--bg)] ${className}`}
      style={{ aspectRatio: ratio }}
    >
      {post.asset_url && isVideo ? (
        <video
          ref={videoRef}
          className={`h-full w-full object-cover object-center transition-opacity duration-150 ${
            displayRatio != null ? 'opacity-100' : 'opacity-0'
          }`}
          src={post.asset_url}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          onLoadedMetadata={onVideoMeta}
          onError={onVideoError}
        />
      ) : post.asset_url && isImage ? (
        <img
          src={post.asset_url}
          alt=""
          className={`h-full w-full object-cover object-center transition-opacity duration-150 ${
            displayRatio != null ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
          onLoad={onImgLoad}
          onError={onImgError}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-[color:var(--text-muted)]">
          Media
        </div>
      )}
      {displayRatio === null && (isImage || isVideo) && post.asset_url ? (
        <div
          className="pointer-events-none absolute inset-0 skeleton-pulse bg-[color:var(--card-border)]"
          aria-hidden
        />
      ) : null}
      {isVideo ? (
        <span
          className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[0.65rem] font-medium text-white"
          aria-hidden
        >
          Video
        </span>
      ) : null}
    </div>
  )

  if (!id) {
    return (
      <article className="w-full min-w-0 break-inside-avoid overflow-hidden rounded-card border border-[color:var(--card-border)] bg-[color:var(--card-bg)] shadow-sm">
        {inner}
      </article>
    )
  }

  const label =
    post.body && String(post.body).trim().length > 0
      ? `View post: ${String(post.body).trim().slice(0, 80)}${String(post.body).length > 80 ? '…' : ''}`
      : 'View post'

  return (
    <article className="w-full min-w-0 break-inside-avoid overflow-hidden rounded-card border border-[color:var(--card-border)] bg-[color:var(--card-bg)] shadow-sm transition-shadow hover:shadow-md">
      <Link
        to={`/post/${encodeURIComponent(id)}`}
        state={{ post }}
        aria-label={label}
        className="block w-full min-w-0 text-[color:inherit] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]"
        onMouseEnter={isVideo ? onEnter : undefined}
        onMouseLeave={isVideo ? onLeave : undefined}
        onFocus={isVideo ? onEnter : undefined}
        onBlur={isVideo ? onLeave : undefined}
      >
        {inner}
      </Link>
    </article>
  )
}

/**
 * Multi-column stack: column count from container width (ResizeObserver); posts assigned
 * round-robin so order reads left-to-right, then next band (1,2 / 3,4 / …), with independent column heights.
 */
export function PostTileGrid({
  posts,
  loading,
  error,
  emptyLabel = 'No posts yet.',
  skeletonCount = 12,
  hasMore = false,
  loadingMore = false,
  onLoadMore = null,
}) {
  const [containerRef, columnCount] = usePostTileColumnCount()
  const loadMoreSentinelRef = useRef(null)
  const columns = useMemo(
    () => distributePostsRoundRobin(posts ?? [], columnCount),
    [posts, columnCount],
  )
  const skeletonColumns = useMemo(
    () =>
      distributePostsRoundRobin(
        Array.from({ length: skeletonCount }, (_, i) => i),
        columnCount,
      ),
    [skeletonCount, columnCount],
  )

  const hasPosts = (posts?.length ?? 0) > 0
  /** Full skeleton only on first load; keep showing tiles if a refetch sets loading so appended pages are not hidden. */
  const showInitialSkeleton = loading && !hasPosts

  const autoFillStateRef = useRef({
    hasMore,
    loading,
    loadingMore,
    hasPosts,
    onLoadMore,
  })

  useLayoutEffect(() => {
    autoFillStateRef.current = { hasMore, loading, loadingMore, hasPosts, onLoadMore }
  }, [hasMore, loading, loadingMore, hasPosts, onLoadMore])

  /** If the first page(s) do not fill the scroll area, fetch more without requiring the user to scroll. */
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    const checkFill = () => {
      const s = autoFillStateRef.current
      if (
        !s.hasPosts ||
        !s.hasMore ||
        s.loading ||
        s.loadingMore ||
        typeof s.onLoadMore !== 'function'
      ) {
        return
      }
      const scrollParent = findNearestScrollParent(el)
      const gridRect = el.getBoundingClientRect()
      const visibleBottom = visibleScrollBottomPx(scrollParent)
      if (gridRect.bottom < visibleBottom - AUTO_FILL_GAP_PX) {
        s.onLoadMore()
      }
    }

    checkFill()
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(checkFill)
    })
    ro.observe(el)
    const onResize = () => requestAnimationFrame(checkFill)
    window.addEventListener('resize', onResize)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [hasMore, loading, loadingMore, hasPosts, posts?.length, columnCount, containerRef])

  useEffect(() => {
    if (!hasMore || !onLoadMore || loading || loadingMore) return
    const grid = containerRef.current
    const el = loadMoreSentinelRef.current
    if (!el || !grid) return
    const scrollParent = findNearestScrollParent(grid)
    const root = intersectionObserverRoot(scrollParent)
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0]
        if (e?.isIntersecting) onLoadMore()
      },
      { root, rootMargin: '240px', threshold: 0 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, onLoadMore, loading, loadingMore, posts?.length, containerRef])

  let body = null
  if (error) {
    body = (
      <p className="text-center text-sm text-red-600" role="alert">
        {error}
      </p>
    )
  } else if (showInitialSkeleton) {
    body = (
      <div
        className={`flex w-full min-w-0 ${TILE_ROW_GAP_CLASS}`}
        aria-busy="true"
        aria-label="Loading posts"
      >
        {skeletonColumns.map((slots, colIndex) => (
          <div key={colIndex} className={`flex min-w-0 flex-1 flex-col ${TILE_ROW_GAP_CLASS}`}>
            {slots.map((slot) => (
              <div
                key={slot}
                className="w-full min-w-0 overflow-hidden rounded-card border border-[color:var(--card-border)] bg-[color:var(--card-bg)]"
              >
                <div
                  className="w-full skeleton-pulse bg-[color:var(--card-border)]"
                  style={{ aspectRatio: 1 }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  } else if (!hasPosts) {
    body = <p className="text-center text-sm text-[color:var(--text-muted)]">{emptyLabel}</p>
  } else {
    body = (
      <div className={`flex w-full min-w-0 ${TILE_ROW_GAP_CLASS}`}>
        {columns.map((colPosts, colIndex) => (
          <div key={colIndex} className={`flex min-w-0 flex-1 flex-col ${TILE_ROW_GAP_CLASS}`}>
            {colPosts.map((p, tileIndex) => (
              <PostTile
                key={p.post_id != null ? String(p.post_id) : `tile-${colIndex}-${tileIndex}`}
                post={p}
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  const showLoadSentinel =
    !error &&
    !loadingMore &&
    hasPosts &&
    hasMore &&
    typeof onLoadMore === 'function'

  return (
    <div ref={containerRef} className="w-full min-w-0">
      {body}
      {showLoadSentinel ? (
        <div
          ref={loadMoreSentinelRef}
          className="h-px w-full shrink-0"
          aria-hidden
        />
      ) : null}
      {loadingMore ? (
        <p className="mt-3 text-center text-xs text-[color:var(--text-muted)]" aria-live="polite">
          Loading more…
        </p>
      ) : null}
    </div>
  )
}
