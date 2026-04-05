import { useCallback, useEffect, useState } from 'react'
import { getCurrentSession } from '../lib/session.js'
import { getAvatarUrl } from '../lib/utils.js'
import { relationshipManager } from '../lib/user.js'
import ProfileView from '../components/ProfileView.jsx'
import PageContainer from '../components/PageContainer.jsx'
import { useUserPosts } from '../hooks/useUserPosts.js'
import FriendsListModal from '../components/FriendsListModal.jsx'
import RelationshipPagedModal from '../components/RelationshipPagedModal.jsx'
import IconLinkButton from '../components/IconLinkButton.jsx'
import { FEED_TYPE_MAIN, FEED_TYPE_SHORTS } from '../lib/post.js'

const MAX_AVATAR_BYTES = 10_000_000

export default function AccountPage() {
  const [profile, setProfile] = useState({
    username: '',
    friendsCount: 0,
    followersCount: 0,
    followingCount: 0,
    iconUrl: null,
    userId: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [avatarError, setAvatarError] = useState(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [friendsModalOpen, setFriendsModalOpen] = useState(false)
  const [followersModalOpen, setFollowersModalOpen] = useState(false)
  const [followingModalOpen, setFollowingModalOpen] = useState(false)
  const [postsFeedType, setPostsFeedType] = useState(FEED_TYPE_MAIN)

  const {
    posts,
    loading: postsLoading,
    error: postsError,
    hasMore: postsHasMore,
    loadingMore: postsLoadingMore,
    loadMore: loadMorePosts,
  } = useUserPosts(profile.userId, postsFeedType)
  const postsGridLoading = postsLoading || (loading && !profile.userId)

  const refreshRelationshipCounts = useCallback(async () => {
    try {
      const countRes = await relationshipManager.getMyRelationshipsCount()
      if (!countRes?.success) return
      const c = countRes.data ?? {}
      setProfile((p) => ({
        ...p,
        ...(c.friends !== undefined ? { friendsCount: c.friends } : {}),
        ...(c.followers !== undefined ? { followersCount: c.followers } : {}),
        ...(c.following !== undefined ? { followingCount: c.following } : {}),
      }))
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadAccountInfo = async () => {
    try {
      setError(null)
      const session = getCurrentSession()
      const [accountRes, countRes] = await Promise.all([
        session.getCurrentAccount(),
        relationshipManager.getMyRelationshipsCount(),
      ])

      if (!accountRes?.success) {
        setError(accountRes?.error?.message || 'Could not load account')
        return
      }

      const data = accountRes.data || {}
      const iconUrl = getAvatarUrl(data)

      const c = countRes?.success ? countRes.data ?? {} : {}
      const n = (v) => (v !== undefined ? v : 0)
      setProfile({
        username: data.username ?? '',
        friendsCount: countRes?.success ? n(c.friends) : 0,
        followersCount: countRes?.success ? n(c.followers) : 0,
        followingCount: countRes?.success ? n(c.following) : 0,
        iconUrl,
        userId: data.user_id ?? null,
      })
    } catch (e) {
      console.error(e)
      setError(e.message || 'Could not load account')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccountInfo()
  }, [])

  const handleAvatarFileSelected = async (file) => {
    setAvatarError(null)
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError(`Choose an image that is ${MAX_AVATAR_BYTES / 1_000_000} MB or smaller.`)
      return
    }
    setAvatarUploading(true)
    try {
      const session = getCurrentSession()
      const res = await session.setMyAvatar(file)
      if (!res?.success) {
        setAvatarError(res?.error?.message || 'Could not update avatar')
        return
      }
      await loadAccountInfo()
    } catch (e) {
      console.error(e)
      setAvatarError(e.message || 'Could not update avatar')
    } finally {
      setAvatarUploading(false)
    }
  }

  return (
    <PageContainer>
      <header className="flex items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-3">
        <h1 className="m-0 text-xl font-bold text-[color:var(--text-primary)]">My Profile</h1>
        <div className="flex items-center gap-1">
          <IconLinkButton to="/notifications" label="Friend requests" icon="notifications" />
          <IconLinkButton to="/account/settings" label="Settings" icon="settings" />
        </div>
      </header>
      <ProfileView
        profile={profile}
        loading={loading}
        error={error}
        avatarError={avatarError}
        onAvatarFileSelected={handleAvatarFileSelected}
        avatarUploading={avatarUploading}
        onFriendsClick={() => setFriendsModalOpen(true)}
        onFollowersClick={() => setFollowersModalOpen(true)}
        onFollowingClick={() => setFollowingModalOpen(true)}
        posts={posts}
        postsLoading={postsGridLoading}
        postsError={postsError}
        postsHasMore={postsHasMore}
        postsLoadingMore={postsLoadingMore}
        onPostsLoadMore={loadMorePosts}
        postsFeedType={postsFeedType}
        onPostsFeedTypeChange={(next) => {
          const v = next === FEED_TYPE_SHORTS ? FEED_TYPE_SHORTS : FEED_TYPE_MAIN
          setPostsFeedType(v)
        }}
      />
      <FriendsListModal
        open={friendsModalOpen}
        onClose={() => setFriendsModalOpen(false)}
        onRelationshipChanged={refreshRelationshipCounts}
      />
      <RelationshipPagedModal
        open={followersModalOpen}
        onClose={() => setFollowersModalOpen(false)}
        relType={relationshipManager.PEER_FOLLOWING_CURRENT}
        title="Followers"
        rowVariant="followers"
        onRelationshipChanged={refreshRelationshipCounts}
      />
      <RelationshipPagedModal
        open={followingModalOpen}
        onClose={() => setFollowingModalOpen(false)}
        relType={relationshipManager.CURRENT_FOLLOWING_PEER}
        title="Following"
        rowVariant="following"
        onRelationshipChanged={refreshRelationshipCounts}
      />
    </PageContainer>
  )
}
