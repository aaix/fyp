import { useParams, useLocation, Navigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import ProfileView from '../components/ProfileView.jsx'
import Button from '../components/Button.jsx'
import { userManager, relationshipManager } from '../lib/user.js'
import { getAvatarUrl } from '../lib/utils.js'
import { getCurrentSession } from '../lib/session.js'
import { useUserPosts } from '../hooks/useUserPosts.js'
import { FEED_TYPE_MAIN } from '../lib/post.js'
import { FEED_TYPE_SHORTS } from '../lib/post.js'

const CURRENT_REQUESTING_PEER = 1
const PEER_REQUESTING_CURRENT = 2
const FRIENDS = 3
const PEER_BLOCKED_CURRENT = 5
const CURRENT_BLOCKED_PEER = 6
const CURRENT_FOLLOWING_PEER = 7
const PEER_FOLLOWING_CURRENT = 8

/** @typedef {{ blockedByMe: boolean, blockedByThem: boolean, isFriends: boolean, isIncomingRequest: boolean, isOutgoingRequest: boolean, isFollowing: boolean, isFollowedBy: boolean }} PeerRelFlags */

function emptyPeerRel() {
  return {
    blockedByMe: false,
    blockedByThem: false,
    isFriends: false,
    isIncomingRequest: false,
    isOutgoingRequest: false,
    isFollowing: false,
    isFollowedBy: false,
  }
}

/**
 * One UI state from API types (priority: block → friends → incoming request → outgoing request).
 * Avoids contradictory flags when the raw set contains multiple edges.
 */
function peerRelFlagsFromTypes(types) {
  const s = new Set(types ?? [])
  if (s.has(CURRENT_BLOCKED_PEER) || s.has(PEER_BLOCKED_CURRENT)) {
    return {
      blockedByMe: s.has(CURRENT_BLOCKED_PEER),
      blockedByThem: s.has(PEER_BLOCKED_CURRENT),
      isFriends: false,
      isIncomingRequest: false,
      isOutgoingRequest: false,
      isFollowing: false,
      isFollowedBy: false,
    }
  }
  if (s.has(FRIENDS)) {
    return {
      blockedByMe: false,
      blockedByThem: false,
      isFriends: true,
      isIncomingRequest: false,
      isOutgoingRequest: false,
      isFollowing: false,
      isFollowedBy: false,
    }
  }
  if (s.has(PEER_REQUESTING_CURRENT)) {
    return {
      blockedByMe: false,
      blockedByThem: false,
      isFriends: false,
      isIncomingRequest: true,
      isOutgoingRequest: false,
      isFollowing: false,
      isFollowedBy: false,
    }
  }
  if (s.has(CURRENT_REQUESTING_PEER)) {
    return {
      blockedByMe: false,
      blockedByThem: false,
      isFriends: false,
      isIncomingRequest: false,
      isOutgoingRequest: true,
      isFollowing: false,
      isFollowedBy: false,
    }
  }
  if (s.has(CURRENT_FOLLOWING_PEER)) {
    return {
      blockedByMe: false,
      blockedByThem: false,
      isFriends: false,
      isIncomingRequest: false,
      isOutgoingRequest: false,
      isFollowing: true,
      isFollowedBy: s.has(PEER_FOLLOWING_CURRENT),
    }
  }
  if (s.has(PEER_FOLLOWING_CURRENT)) {
    return {
      blockedByMe: false,
      blockedByThem: false,
      isFriends: false,
      isIncomingRequest: false,
      isOutgoingRequest: false,
      isFollowing: false,
      isFollowedBy: true,
    }
  }
  return emptyPeerRel()
}

/** Preserve API `null` for counts (shown as "-" in ProfileView); treat missing keys as 0. */
function countFieldFromUserPayload(v) {
  if (v === null) return null
  return v ?? 0
}

function userToProfile(user, routeUserId) {
  const uid = user?.user_id ?? routeUserId ?? null
  if (!user && !routeUserId) {
    return { username: '', iconUrl: null, friendsCount: 0, followersCount: 0, userId: null }
  }
  if (!user) {
    return {
      username: '',
      iconUrl: null,
      friendsCount: 0,
      followersCount: 0,
      userId: uid ? String(uid) : null,
    }
  }
  return {
    username: user.username ?? '',
    iconUrl: user.icon_url ?? (user.user_id ? getAvatarUrl(user) : null),
    friendsCount: countFieldFromUserPayload(user.friends),
    followersCount: countFieldFromUserPayload(user.followers),
    userId: user.user_id ?? (routeUserId != null ? String(routeUserId) : null),
  }
}

function normId(id) {
  return String(id ?? '').toLowerCase()
}

export default function UserPage() {
  const { userId } = useParams()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const stateUser = location.state?.user

  const [currentUserId, setCurrentUserId] = useState(null)
  const [profile, setProfile] = useState(() => userToProfile(stateUser, userId))
  const [peerRel, setPeerRel] = useState(() => emptyPeerRel())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const postsFeedType =
    searchParams.get('feed') === 'short' ? FEED_TYPE_SHORTS : FEED_TYPE_MAIN

  const {
    posts,
    loading: postsLoading,
    error: postsError,
    hasMore: postsHasMore,
    loadingMore: postsLoadingMore,
    loadMore: loadMorePosts,
  } = useUserPosts(userId, postsFeedType)

  useEffect(() => {
    if (!userId) return

    let cancelled = false
    ;(async () => {
      try {
        if (cancelled) return
        setLoading(true)
        setError(null)
        const session = getCurrentSession()
        const [profileRes, , meRes] = await Promise.all([
          userManager.getUserProfile(userId),
          relationshipManager.refreshPeerRelationshipWithUser(userId),
          session.getCurrentAccount(),
        ])
        if (cancelled) return

        const meId = meRes?.data?.user_id ?? meRes?.data?.id ?? null
        if (meId != null) setCurrentUserId(meId)

        if (profileRes?.success && profileRes?.data) {
          const raw = profileRes.data
          const user = raw?.user ?? raw
          const friendsCount = countFieldFromUserPayload(raw.friends)
          const followersCount = countFieldFromUserPayload(raw.followers)
          setProfile({
            username: user?.username ?? '',
            iconUrl: user ? getAvatarUrl(user) : null,
            friendsCount,
            followersCount,
            userId: user?.user_id ?? userId ?? null,
          })
        } else if (profileRes?.data) {
          const raw = profileRes.data
          const user = raw?.user ?? raw
          const friendsCount = countFieldFromUserPayload(raw.friends)
          const followersCount = countFieldFromUserPayload(raw.followers)
          setProfile({
            username: user?.username ?? '',
            iconUrl: user ? getAvatarUrl(user) : null,
            friendsCount,
            followersCount,
            userId: user?.user_id ?? userId ?? null,
          })
        }

        if (!profileRes?.success && !profileRes?.data) {
          setError('User not found')
        }

        setPeerRel(peerRelFlagsFromTypes(relationshipManager.getRelationshipWithUser(userId) ?? []))
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

  const syncPeerRelFromManager = () => {
    setPeerRel(peerRelFlagsFromTypes(relationshipManager.getRelationshipWithUser(userId) ?? []))
  }

  const refreshPeerRelFromApi = async () => {
    await relationshipManager.refreshPeerRelationshipWithUser(userId)
    syncPeerRelFromManager()
  }

  const refetchProfileCounts = async () => {
    if (!userId) return
    try {
      const profileRes = await userManager.getUserProfile(userId)
      const raw = profileRes?.data
      if (!raw) return
      const friendsCount = raw.friends
      const followersCount = raw.followers
      if (friendsCount === undefined && followersCount === undefined) return
      setProfile((p) => ({
        ...p,
        ...(friendsCount !== undefined ? { friendsCount } : {}),
        ...(followersCount !== undefined ? { followersCount } : {}),
      }))
    } catch (e) {
      console.error(e)
    }
  }

  const handleFriendAction = async () => {
    if (!userId || peerRel.isFriends) return
    setActionLoading(true)
    try {
      const res = await relationshipManager.friendUser(userId)
      if (res?.success) {
        syncPeerRelFromManager()
        await refetchProfileCounts()
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnfriendAction = async () => {
    if (!userId || !peerRel.isFriends) return
    setActionLoading(true)
    try {
      const res = await relationshipManager.unfriendUser(userId)
      if (res?.success) {
        syncPeerRelFromManager()
        await refetchProfileCounts()
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelRequest = async () => {
    if (!userId || !peerRel.isOutgoingRequest) return
    setActionLoading(true)
    try {
      const res = await relationshipManager.unfriendUser(userId)
      if (res?.success) {
        syncPeerRelFromManager()
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleFollowAction = async () => {
    if (!userId || peerRel.isFollowing || peerRel.isFriends) return
    setActionLoading(true)
    try {
      const res = await relationshipManager.followUser(userId)
      if (res?.success) {
        await refreshPeerRelFromApi()
        await refetchProfileCounts()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnfollowAction = async () => {
    if (!userId || !peerRel.isFollowing) return
    setActionLoading(true)
    try {
      const res = await relationshipManager.unfollowUser(userId)
      if (res?.success) {
        await refreshPeerRelFromApi()
        await refetchProfileCounts()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setActionLoading(false)
    }
  }

  const handleBlockAction = async () => {
    if (!userId) return
    setActionLoading(true)
    try {
      const isBlocked = peerRel.blockedByMe
      const res = isBlocked
        ? await relationshipManager.unblockUser(userId)
        : await relationshipManager.blockUser(userId)
      if (res?.success) {
        syncPeerRelFromManager()
        await refetchProfileCounts()
      }
    } finally {
      setActionLoading(false)
    }
  }

  if (currentUserId != null && userId != null && normId(currentUserId) === normId(userId)) {
    return <Navigate to="/account" replace />
  }

  const isBlocked = peerRel.blockedByMe || peerRel.blockedByThem
  const showSendOrAccept =
    (peerRel.isIncomingRequest || (!peerRel.isFriends && !peerRel.isOutgoingRequest)) && !isBlocked
  const showFollowControls = !isBlocked && !peerRel.isFriends

  const profileActions =
    !loading && !error ? (
      <div className="flex justify-center flex-wrap items-center gap-2">
        {showSendOrAccept && (
          <Button
            onClick={handleFriendAction}
            disabled={actionLoading || isBlocked}
            aria-label={peerRel.isIncomingRequest ? 'Accept friend request' : 'Send friend request'}
          >
            {peerRel.isIncomingRequest ? 'Accept' : 'Send friend request'}
          </Button>
        )}
        {peerRel.isOutgoingRequest && (
          <Button
            variant="ghost"
            onClick={handleCancelRequest}
            disabled={actionLoading}
            aria-label="Cancel friend request"
          >
            Cancel friend request
          </Button>
        )}
        {peerRel.isFriends && (
          <Button
            variant="ghost"
            onClick={handleUnfriendAction}
            disabled={actionLoading}
            aria-label="Remove friend"
          >
            Remove friend
          </Button>
        )}
        {showFollowControls &&
          (peerRel.isFollowing ? (
            <Button
              variant="ghost"
              onClick={handleUnfollowAction}
              disabled={actionLoading}
              aria-label="Unfollow user"
            >
              Unfollow
            </Button>
          ) : (
            <Button onClick={handleFollowAction} disabled={actionLoading} aria-label="Follow user">
              Follow
            </Button>
          ))}
        {peerRel.blockedByMe && (
          <Button
            variant="ghost"
            onClick={handleBlockAction}
            disabled={actionLoading}
            aria-label="Unblock user"
          >
            Unblock
          </Button>
        )}
        {!peerRel.blockedByMe && !peerRel.blockedByThem && (
          <Button variant="ghost" onClick={handleBlockAction} disabled={actionLoading} aria-label="Block user">
            Block
          </Button>
        )}
        {peerRel.blockedByThem && (
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
        posts={posts}
        postsLoading={postsLoading}
        postsError={postsError}
        postsHasMore={postsHasMore}
        postsLoadingMore={postsLoadingMore}
        onPostsLoadMore={loadMorePosts}
        postsFeedType={postsFeedType}
        onPostsFeedTypeChange={(next) => {
          const v = next === 'short' || next === FEED_TYPE_SHORTS ? FEED_TYPE_SHORTS : FEED_TYPE_MAIN
          if (v === FEED_TYPE_SHORTS) {
            setSearchParams({ feed: 'short' }, { replace: true })
          } else {
            setSearchParams({}, { replace: true })
          }
        }}
      />
    </div>
  )
}
