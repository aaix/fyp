import { useEffect, useState } from 'react'
import { relationshipManager } from '../lib/user.js'
import { channelManager } from '../lib/chat.js'
import MenuActionItem from './MenuActionItem.jsx'

export default function MemberContextMenu({
  userId,
  channelId,
  onClose,
  onMemberRemoved,
  canManageMembers = false,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [relFlags, setRelFlags] = useState({ isFriends: false, blockedByMe: false })
  const [actionLoading, setActionLoading] = useState(false)
  const [removeError, setRemoveError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)

      try {
        const relTypes = await relationshipManager.resolveRelationshipWithUser(userId)
        if (cancelled) return
        const s = new Set(relTypes ?? [])
        setRelFlags({
          isFriends: s.has(relationshipManager.FRIENDS),
          blockedByMe: s.has(relationshipManager.CURRENT_BLOCKED_PEER),
        })
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(e?.message ?? 'Could not load relationship')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const { isFriends, blockedByMe } = relFlags

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
      console.error(e);
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
          setRelFlags((f) => ({ ...f, isFriends: false }))
        }
      } else {
        const res = await relationshipManager.friendUser(userId)
        if (res?.success) {
          setRelFlags({ isFriends: true, blockedByMe: false })
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
      const res = blockedByMe
        ? await relationshipManager.unblockUser(userId)
        : await relationshipManager.blockUser(userId)
      if (res?.success) {
        if (blockedByMe) {
          setRelFlags((f) => ({ ...f, blockedByMe: false }))
        } else {
          setRelFlags({ isFriends: false, blockedByMe: true })
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
          <MenuActionItem
            type="button"
            className="justify-between text-red-500 hover:bg-red-500/10"
            onClick={handleRemoveFromChannel}
            disabled={actionLoading || !channelId || !canManageMembers}
          >
            <span>Remove from group</span>
          </MenuActionItem>
          <MenuActionItem
            type="button"
            className="justify-start hover:bg-[color:var(--card-bg)]/80"
            onClick={handleFriendToggle}
            disabled={actionLoading}
          >
            {isFriends ? 'Remove friend' : 'Add friend'}
          </MenuActionItem>
          <MenuActionItem
            type="button"
            className="justify-start text-red-500 hover:bg-red-500/10"
            onClick={handleBlockToggle}
            disabled={actionLoading}
          >
            {blockedByMe ? 'Unblock' : 'Block'}
          </MenuActionItem>
        </>
      )}
    </div>
  )
}
