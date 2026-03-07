import { useParams, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import ProfileView from '../components/ProfileView.jsx'
import Button from '../components/Button.jsx'
import { userManager, relationshipManager } from '../lib/user.js'
import { getAvatarUrl } from '../lib/utils.js'

const CURRENT_REQUESTING_PEER = 1
const PEER_REQUESTING_CURRENT = 2
const FRIENDS = 3

function userToProfile(user) {
  if (!user) return { username: '', iconUrl: null, friendsCount: 0 }
  return {
    username: user.username ?? '',
    iconUrl: user.icon_url ?? (user.user_id ? getAvatarUrl(user) : null),
    friendsCount: 0,
  }
}

export default function UserPage() {
  const { userId } = useParams()
  const location = useLocation()
  const stateUser = location.state?.user

  const [profile, setProfile] = useState(() => userToProfile(stateUser))
  const [relationship, setRelationship] = useState(null)
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
        const [profileRes, relRes] = await Promise.all([
          userManager.getUserProfile(userId),
          relationshipManager.getRelationships(),
        ])
        if (cancelled) return

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

        const relList = relRes?.data?.relationships ?? []
        const norm = (id) => String(id ?? '').toLowerCase()
        const peerRels = relList.filter((r) => norm(r.peer_id) === norm(userId)).map((r) => Number(r.relationship))
        // Prefer FRIENDS (3) > PEER_REQUESTING_CURRENT (2) > CURRENT_REQUESTING_PEER (1)
        const best = peerRels.includes(FRIENDS) ? FRIENDS : peerRels.includes(PEER_REQUESTING_CURRENT) ? PEER_REQUESTING_CURRENT : peerRels.includes(CURRENT_REQUESTING_PEER) ? CURRENT_REQUESTING_PEER : null
        setRelationship(best)
      } catch (e) {
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
    const username = (profile.username || stateUser?.username || '').replace(/^@+/, '').trim()
    document.title = `az7 | ${username ? `@${username}` : 'Profile'}`
  }, [profile.username, stateUser?.username])

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

  const isIncoming = relationship === PEER_REQUESTING_CURRENT
  const isSent = relationship === CURRENT_REQUESTING_PEER
  const isFriends = relationship === FRIENDS
  const showSendOrAccept = relationship == null || isIncoming

  const profileActions =
    !loading && !error ? (
      <div className="flex justify-center">
        {showSendOrAccept && (
          <Button
            onClick={handleFriendAction}
            disabled={actionLoading}
            aria-label={isIncoming ? 'Accept friend request' : 'Send friend request'}
          >
            {isIncoming ? 'Accept' : 'Send friend request'}
          </Button>
        )}
        {isSent && (
          <Button variant="ghost" disabled className="cursor-default">
            Requested
          </Button>
        )}
        {isFriends && (
          <span className="text-sm font-medium text-[color:var(--text-muted)]">
            Friends
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
