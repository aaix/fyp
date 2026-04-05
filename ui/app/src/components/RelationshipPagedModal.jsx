import { useEffect, useState } from 'react'
import { relationshipManager, userManager } from '../lib/user.js'
import { getAvatarUrl } from '../lib/utils.js'
import ModalCloseButton from './ModalCloseButton.jsx'
import useEscapeToClose from './useEscapeToClose.js'
import RelationshipListRow from './RelationshipListRow.jsx'

const CHUNK = 20

/**
 * Paginated list of relationships for the current user (followers or following).
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {number} props.relType - RelationshipType (7 = following, 8 = followers)
 * @param {string} props.title
 * @param {'followers' | 'following'} props.rowVariant
 * @param {() => void} [props.onRelationshipChanged]
 */
export default function RelationshipPagedModal({
  open,
  onClose,
  relType,
  title,
  rowVariant,
  onRelationshipChanged,
}) {
  const [list, setList] = useState(/** @type {{ user_id: string, username: string, icon_url: string | null }[]} */ ([]))
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(/** @type {string | null} */ (null))
  const [afterCursor, setAfterCursor] = useState(/** @type {string | null} */ (null))
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setLoading(true)
    setLoadingMore(false)
    setError(null)
    setList([])
    setAfterCursor(null)
    setHasMore(false)

    ;(async () => {
      try {
        const res = await relationshipManager.pageRelationships(relType, null)
        if (cancelled) return
        if (!res?.success) {
          setError(res?.error?.message ?? 'Could not load list')
          return
        }
        const rows = res?.data?.relationships ?? []
        const peerIds = rows.map((r) => String(r.peer_id))
        if (peerIds.length === 0) {
          setList([])
          setHasMore(false)
          return
        }
        const users = await userManager.fetchUsersBulk(peerIds)
        if (cancelled) return
        const profiles = peerIds.map((id) => {
          const user = users.find((u) => String(u.user_id) === id)
          return {
            user_id: id,
            username: user?.username ?? '',
            icon_url: user ? getAvatarUrl(user) : null,
          }
        })
        setList(profiles)
        setHasMore(rows.length >= CHUNK)
        const last = rows[rows.length - 1]
        setAfterCursor(last?.peer_id != null ? String(last.peer_id) : null)
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(e?.message ?? 'Could not load list')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, relType])

  const loadMore = async () => {
    if (!afterCursor || loadingMore) return
    setLoadingMore(true)
    setError(null)
    try {
      const res = await relationshipManager.pageRelationships(relType, afterCursor)
      if (!res?.success) {
        setError(res?.error?.message ?? 'Could not load more')
        return
      }
      const rows = res?.data?.relationships ?? []
      const peerIds = rows.map((r) => String(r.peer_id))
      if (peerIds.length === 0) {
        setHasMore(false)
        return
      }
      const users = await userManager.fetchUsersBulk(peerIds)
      const profiles = peerIds.map((id) => {
        const user = users.find((u) => String(u.user_id) === id)
        return {
          user_id: id,
          username: user?.username ?? '',
          icon_url: user ? getAvatarUrl(user) : null,
        }
      })
      setList((prev) => {
        const seen = new Set(prev.map((p) => p.user_id))
        const next = [...prev]
        for (const p of profiles) {
          if (!seen.has(p.user_id)) {
            seen.add(p.user_id)
            next.push(p)
          }
        }
        return next
      })
      setHasMore(rows.length >= CHUNK)
      const last = rows[rows.length - 1]
      setAfterCursor(last?.peer_id != null ? String(last.peer_id) : null)
    } catch (e) {
      console.error(e)
      setError(e?.message ?? 'Could not load more')
    } finally {
      setLoadingMore(false)
    }
  }

  useEscapeToClose(open, onClose)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[color:var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="relationship-paged-title"
    >
      <div className="flex flex-shrink-0 items-center justify-between border-b border-[color:var(--card-border)] px-4 py-3">
        <h2 id="relationship-paged-title" className="text-lg font-bold text-[color:var(--text-primary)]">
          {title}
        </h2>
        <ModalCloseButton onClick={onClose} />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {loading && (
          <ul className="space-y-0.5" role="list" aria-label="Loading">
            {Array.from({ length: 5 }, (_, i) => (
              <li
                key={i}
                className="flex items-center gap-3 border-b border-[color:var(--card-border)] px-1 py-2"
              >
                <div className="h-11 w-11 rounded-full border border-[color:var(--card-border)] bg-[color:var(--card-bg)] skeleton-pulse" />
                <div className="h-4 w-32 rounded bg-[color:var(--card-bg)] skeleton-pulse" />
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p className="py-4 text-sm text-[color:var(--text-muted)]" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && list.length === 0 && (
          <p className="py-4 text-sm text-[color:var(--text-muted)]">No one here yet.</p>
        )}
        {!loading && list.length > 0 && (
          <ul className="space-y-0.5" role="list">
            {list.map((row) => (
              <RelationshipListRow
                key={row.user_id}
                peerId={row.user_id}
                username={row.username}
                iconUrl={row.icon_url}
                variant={rowVariant}
                onRelationshipChanged={onRelationshipChanged}
                onNavigateToProfile={onClose}
              />
            ))}
          </ul>
        )}
        {!loading && hasMore && (
          <div className="flex justify-center py-4">
            <button
              type="button"
              className="rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--text-primary)] hover:bg-[color:var(--tab-active-bg)] disabled:opacity-60"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
