import { useEffect, useState } from 'react'
import { relationshipManager } from '../lib/user.js'

export default function MemberContextMenu({ userId, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [relationship, setRelationship] = useState(null)
  const [blockRelationship, setBlockRelationship] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await relationshipManager.getRelationshipWithUser(userId)
        if (cancelled) return
        if (!res?.success) {
          setError(res?.error?.message ?? 'Could not load relationship')
          return
        }
        setRelationship(res?.data?.relationship ?? null)
        setBlockRelationship(res?.data?.blockRelationship ?? null)
      } catch (e) {
        if (!cancelled) setError(e?.message ?? 'Could not load relationship')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const isFriends = relationship === relationshipManager.FRIENDS
  const isBlockedByMe = blockRelationship === relationshipManager.CURRENT_BLOCKED_PEER

  const handleFriendToggle = async () => {
    if (!userId) return
    setActionLoading(true)
    try {
      if (isFriends) {
        const res = await relationshipManager.unfriendUser(userId)
        if (res?.success) {
          setRelationship(null)
        }
      } else {
        const res = await relationshipManager.friendUser(userId)
        if (res?.success) {
          setRelationship(relationshipManager.FRIENDS)
        }
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleBlockToggle = async () => {
    if (!userId) return
    setActionLoading(true)
    try {
      const res = isBlockedByMe
        ? await relationshipManager.unblockUser(userId)
        : await relationshipManager.blockUser(userId)
      if (res?.success) {
        setBlockRelationship(isBlockedByMe ? null : relationshipManager.CURRENT_BLOCKED_PEER)
        if (!isBlockedByMe) {
          setRelationship(null)
        }
      }
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div
      className="min-w-[180px] rounded-card border border-[color:var(--card-border)] bg-[color:var(--card-bg)] py-1 text-sm text-[color:var(--text-primary)] shadow-card"
      role="menu"
      onClick={(e) => e.stopPropagation()}
    >
      {loading && (
        <div className="px-3 py-2 text-xs text-[color:var(--text-muted)]">Loading…</div>
      )}
      {!loading && error && (
        <div className="px-3 py-2 text-xs text-[color:var(--text-muted)]">{error}</div>
      )}
      {!loading && !error && (
        <>
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[color:var(--card-bg)]/80 disabled:cursor-not-allowed disabled:opacity-60"
            disabled
          >
            <span>Remove from group</span>
            <span className="text-[10px] uppercase tracking-wide text-[color:var(--text-muted)]">
              Coming soon
            </span>
          </button>
          <button
            type="button"
            className="flex w-full items-center px-3 py-2 text-left hover:bg-[color:var(--card-bg)]/80 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleFriendToggle}
            disabled={actionLoading}
          >
            {isFriends ? 'Remove friend' : 'Add friend'}
          </button>
          <button
            type="button"
            className="flex w-full items-center px-3 py-2 text-left text-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleBlockToggle}
            disabled={actionLoading}
          >
            {isBlockedByMe ? 'Unblock' : 'Block'}
          </button>
          <button
            type="button"
            className="mt-1 flex w-full items-center justify-center border-t border-[color:var(--card-border)] px-3 py-2 text-center text-xs text-[color:var(--text-muted)] hover:bg-[color:var(--card-bg)]/80"
            onClick={onClose}
          >
            Close
          </button>
        </>
      )}
    </div>
  )
}

