import { useEffect, useState } from 'react'
import { relationshipManager, userManager } from '../lib/user.js'
import { getAvatarUrl } from '../lib/utils.js'
import ModalCloseButton from './ModalCloseButton.jsx'
import useEscapeToClose from './useEscapeToClose.js'
import RelationshipListRow from './RelationshipListRow.jsx'

const FRIENDS = 3

/**
 * Modal that lists the current user's friends (avatar + username, link to profile).
 * Fetches relationships and resolves each peer to profile inside.
 * @param {{ open: boolean, onClose: () => void, onRelationshipChanged?: () => void }} props
 */
export default function FriendsListModal({ open, onClose, onRelationshipChanged }) {
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
        const res = await relationshipManager.getRelationships(FRIENDS)
        if (cancelled) return
        if (!res?.success) {
          setError(res?.error?.message ?? 'Could not load friends')
          return
        }
        const relationships = res?.data?.relationships ?? []
        const friendPeerIds = relationships.map((r) => String(r.peer_id))

        if (friendPeerIds.length === 0) {
          setList([])
          return
        }

        const users = await userManager.fetchUsersBulk(friendPeerIds)
        if (cancelled) return
        const profiles = friendPeerIds.map((id) => {
          const user = users.find((u) => String(u.user_id) === String(id))
          return {
            user_id: id,
            username: user?.username ?? '',
            icon_url: user ? getAvatarUrl(user) : null,
          }
        })
        setList(profiles)
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(e?.message ?? 'Could not load friends')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open])

  useEscapeToClose(open, onClose)

  if (!open) return null

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
          <p className="py-4 text-sm text-[color:var(--text-muted)]">No friends yet.</p>
        )}
        {!loading && list.length > 0 && (
          <ul className="space-y-0.5" role="list">
            {list.map((friend) => (
              <RelationshipListRow
                key={friend.user_id}
                peerId={String(friend.user_id)}
                username={friend.username}
                iconUrl={friend.icon_url}
                variant="friends"
                onRelationshipChanged={onRelationshipChanged}
                onNavigateToProfile={onClose}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
