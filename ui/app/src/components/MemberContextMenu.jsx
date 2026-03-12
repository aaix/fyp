import { useEffect, useState } from 'react'
import { relationshipManager } from '../lib/user.js'
import { channelManager } from '../lib/chat.js'
import Button from './Button.jsx'

export default function MemberContextMenu({
  userId,
  channelId,
  onClose,
  onMemberRemoved,
  canManageMembers = false,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [relationship, setRelationship] = useState(null)
  const [blockRelationship, setBlockRelationship] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [removeError, setRemoveError] = useState(null)

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

  const handleRemoveFromChannel = async () => {
    if (!userId || !channelId) return
    setActionLoading(true)
    setRemoveError(null)
    try {
      const res = await channelManager.removeChannelMember(channelId, userId)
      if (res?.success === false) {
        setRemoveError(res?.error?.message ?? 'Could not remove from channel')
        return
      }
      onMemberRemoved?.(userId)
      onClose?.()
    } catch (e) {
      setRemoveError(e?.message ?? 'Could not remove from channel')
    } finally {
      setActionLoading(false)
    }
  }

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
    >
      {loading && (
        <div className="px-3 py-2 text-xs text-[color:var(--text-muted)]">Loading…</div>
      )}
      {!loading && error && (
        <div className="px-3 py-2 text-xs text-[color:var(--text-muted)]">{error}</div>
      )}
      {!loading && !error && removeError && (
        <div className="px-3 py-2 text-xs text-red-500" role="alert">
          {removeError}
        </div>
      )}
      {!loading && !error && (
        <>
          <Button
            type="button"
            variant="text"
            size="sm"
            className="w-full justify-between rounded-none px-3 text-left text-red-500 hover:bg-red-500/10"
            onClick={handleRemoveFromChannel}
            disabled={actionLoading || !channelId || !canManageMembers}
          >
            <span>Remove from group</span>
          </Button>
          <Button
            type="button"
            variant="text"
            size="sm"
            className="w-full justify-start rounded-none px-3 text-left hover:bg-[color:var(--card-bg)]/80"
            onClick={handleFriendToggle}
            disabled={actionLoading}
          >
            {isFriends ? 'Remove friend' : 'Add friend'}
          </Button>
          <Button
            type="button"
            variant="text"
            size="sm"
            className="w-full justify-start rounded-none px-3 text-left text-red-500 hover:bg-red-500/10"
            onClick={handleBlockToggle}
            disabled={actionLoading}
          >
            {isBlockedByMe ? 'Unblock' : 'Block'}
          </Button>
        </>
      )}
    </div>
  )
}

