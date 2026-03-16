import { useParams, useLocation, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import ProfileView from '../components/ProfileView.jsx'
import Button from '../components/Button.jsx'
import { userManager, relationshipManager } from '../lib/user.js'
import { getAvatarUrl } from '../lib/utils.js'
import { getCurrentSession } from '../lib/session.js'

const CURRENT_REQUESTING_PEER = 1
const PEER_REQUESTING_CURRENT = 2
const FRIENDS = 3
const PEER_BLOCKED_CURRENT = 5
const CURRENT_BLOCKED_PEER = 6

function userToProfile(user) {
  if (!user) return { username: '', iconUrl: null, friendsCount: 0 }
  return {
    username: user.username ?? '',
    iconUrl: user.icon_url ?? (user.user_id ? getAvatarUrl(user) : null),
    friendsCount: 0,
  }
}

function normId(id) {
  return String(id ?? '').toLowerCase()
}

export default function UserPage() {
  const { userId } = useParams()
  const location = useLocation()
  const stateUser = location.state?.user

  const [currentUserId, setCurrentUserId] = useState(null)
  const [profile, setProfile] = useState(() => userToProfile(stateUser))
  const [relationship, setRelationship] = useState(null)
  const [blockRelationship, setBlockRelationship] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!userId) return

    let cancelled = false
    ;(async () => {
      try {
        if (cancelled) return
        setLoading(true)
        setError(null)
        const session = getCurrentSession()
        const [profileRes, relRes, meRes] = await Promise.all([
          userManager.getUserProfile(userId),
          relationshipManager.getRelationshipWithUser(userId),
          session.getCurrentAccount(),
        ])
        if (cancelled) return

        const meId = meRes?.data?.user_id ?? meRes?.data?.id ?? null
        if (meId != null) setCurrentUserId(meId)

        if (profileRes?.success && profileRes?.data) {
          const user = profileRes.data?.user ?? profileRes.data
          setProfile({
            username: user?.username ?? '',
            iconUrl: user ? getAvatarUrl(user) : null,
            friendsCount: 0,
          })
        } else if (profileRes?.data) {
          const user = profileRes.data?.user ?? profileRes.data
          setProfile({
            username: user?.username ?? '',
            iconUrl: user ? getAvatarUrl(user) : null,
            friendsCount: 0,
          })
        } else {
          setError('User not found')
        }

        const relData = relRes?.data ?? {}
        setRelationship(relData.relationship ?? null)
        setBlockRelationship(relData.blockRelationship ?? null)
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(e?.message ?? 'Could not load profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    const username = (profile.username || stateUser?.username || userId || '').replace(/^@+/, '').trim()
    document.title = `az7 | ${username ? `@${username}` : 'Profile'}`
  }, [profile.username, stateUser?.username, userId])

  const handleFriendAction = async () => {
    if (!userId || relationship === FRIENDS) return
    setActionLoading(true)
    try {
      const res = await relationshipManager.friendUser(userId)
      if (res?.success) {
        setRelationship(res?.data?.relationship != null ? Number(res.data.relationship) : FRIENDS)
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnfriendAction = async () => {
    if (!userId || relationship !== FRIENDS) return
    setActionLoading(true)
    try {
      const res = await relationshipManager.unfriendUser(userId)
      if (res?.success) {
        setRelationship(null)
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelRequest = async () => {
    if (!userId || relationship !== CURRENT_REQUESTING_PEER) return
    setActionLoading(true)
    try {
      const res = await relationshipManager.unfriendUser(userId)
      if (res?.success) {
        setRelationship(null)
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleBlockAction = async () => {
    if (!userId) return
    setActionLoading(true)
    try {
      const isBlocked = blockRelationship === CURRENT_BLOCKED_PEER
      const res = isBlocked
        ? await relationshipManager.unblockUser(userId)
        : await relationshipManager.blockUser(userId)
      if (res?.success) {
        setBlockRelationship(isBlocked ? null : CURRENT_BLOCKED_PEER)
        setRelationship(null)
      }
    } finally {
      setActionLoading(false)
    }
  }

  if (currentUserId != null && userId != null && normId(currentUserId) === normId(userId)) {
    return <Navigate to="/account" replace />
  }

  const isIncoming = relationship === PEER_REQUESTING_CURRENT
  const isSent = relationship === CURRENT_REQUESTING_PEER
  const isFriends = relationship === FRIENDS
  const isBlockedByMe = blockRelationship === CURRENT_BLOCKED_PEER
  const isBlockedByThem = blockRelationship === PEER_BLOCKED_CURRENT
  const isBlocked = isBlockedByMe || isBlockedByThem
  const showSendOrAccept = (relationship == null || isIncoming) && !isBlocked

  const profileActions =
    !loading && !error ? (
      <div className="flex justify-center flex-wrap gap-2">
        {showSendOrAccept && (
          <Button
            onClick={handleFriendAction}
            disabled={actionLoading || isBlocked}
            aria-label={isIncoming ? 'Accept friend request' : 'Send friend request'}
          >
            {isIncoming ? 'Accept' : 'Send friend request'}
          </Button>
        )}
        {isSent && (
          <Button
            variant="ghost"
            onClick={handleCancelRequest}
            disabled={actionLoading}
            aria-label="Cancel friend request"
          >
            Cancel friend request
          </Button>
        )}
        {isFriends && (
          <Button
            variant="ghost"
            onClick={handleUnfriendAction}
            disabled={actionLoading}
            aria-label="Remove friend"
          >
            Remove friend
          </Button>
        )}
        {isBlockedByMe && (
          <Button
            variant="ghost"
            onClick={handleBlockAction}
            disabled={actionLoading}
            aria-label="Unblock user"
          >
            Unblock
          </Button>
        )}
        {!isBlockedByMe && !isBlockedByThem && (
          <Button variant="ghost" onClick={handleBlockAction} disabled={actionLoading} aria-label="Block user">
            Block
          </Button>
        )}
        {isBlockedByThem && (
          <span className="text-sm font-medium text-[color:var(--text-muted)]">
            You are blocked
          </span>
        )}
      </div>
    ) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ProfileView
        profile={profile}
        loading={loading}
        error={error}
        actions={profileActions}
      />
    </div>
  )
}
