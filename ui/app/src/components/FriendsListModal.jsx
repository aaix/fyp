import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { relationshipManager, userManager } from '../lib/user.js'
import { getAvatarUrl } from '../lib/utils.js'
import { gatewayFactory } from '../lib/gateway.js'

const FRIENDS = 3

/**
 * Modal that lists the current user's friends (avatar + username, link to profile).
 * Fetches relationships and resolves each peer to profile inside.
 * @param {{ open: boolean, onClose: () => void }} props
 */
export default function FriendsListModal({ open, onClose }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setList([])

    ;(async () => {
      try {
        const res = await relationshipManager.getRelationships()
        if (cancelled) return
        if (!res?.success) {
          setError(res?.error?.message ?? 'Could not load friends')
          return
        }
        const relationships = res?.data?.relationships ?? []
        const friendPeerIds = relationships
          .filter((r) => Number(r.relationship) === FRIENDS)
          .map((r) => r.peer_id)

        if (friendPeerIds.length === 0) {
          setList([])
          return
        }


        const users = await userManager.fetchUsersBulk(friendPeerIds)
        if (cancelled) return
        const profiles = users.map((user) => ({
          user_id: user.user_id,
          username: user?.username ?? '',
          icon_url: user ? getAvatarUrl(user) : null,
        }))
        setList(profiles)
      } catch (e) {
        if (!cancelled) setError(e?.message ?? 'Could not load friends')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) return null

  const rowBase =
    'flex w-full items-center gap-3 border-b border-[color:var(--card-border)] px-1 py-2 text-left text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--card-bg)]'

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[color:var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="friends-list-title"
    >
      <div className="flex flex-shrink-0 items-center justify-between border-b border-[color:var(--card-border)] px-4 py-3">
        <h2
          id="friends-list-title"
          className="text-lg font-bold text-[color:var(--text-primary)]"
        >
          Friends
        </h2>
        <button
          type="button"
          className="rounded-button p-2 text-[color:var(--text-primary)] hover:bg-[color:var(--card-bg)]"
          onClick={onClose}
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-xl" aria-hidden>
            close
          </span>
        </button>
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
          <p className="py-4 text-sm text-[color:var(--text-muted)]">
            No friends yet.
          </p>
        )}
        {!loading && list.length > 0 && (
          <ul className="space-y-0.5" role="list">
            {list.map((friend) => (
              <li key={friend.user_id}>
                <Link
                  to={`/user/${friend.user_id}`}
                  state={{ user: friend }}
                  className={rowBase}
                  onClick={onClose}
                >
                  {friend.icon_url ? (
                    <img
                      src={friend.icon_url}
                      alt={friend.username ? `${friend.username}'s avatar` : 'User avatar'}
                      className="h-11 w-11 flex-shrink-0 rounded-full border border-[color:var(--card-border)] object-cover"
                    />
                  ) : (
                    <div className="h-11 w-11 flex-shrink-0 rounded-full border border-[color:var(--card-border)] bg-[color:var(--card-bg)]" />
                  )}
                  <span className="font-medium">@{friend.username || 'user'}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
