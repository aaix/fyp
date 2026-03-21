import { useEffect, useState } from 'react'
import { getCurrentSession } from '../lib/session.js'
import { getAvatarUrl } from '../lib/utils.js'
import { relationshipManager } from '../lib/user.js'
import ProfileView from '../components/ProfileView.jsx'
import PageContainer from '../components/PageContainer.jsx'
import FriendsListModal from '../components/FriendsListModal.jsx'
import IconLinkButton from '../components/IconLinkButton.jsx'

const FRIENDS = 3
const MAX_AVATAR_BYTES = 10_000_000

export default function AccountPage() {
  const [profile, setProfile] = useState({
    username: '',
    friendsCount: 0,
    iconUrl: null,
    userId: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [avatarError, setAvatarError] = useState(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [friendsModalOpen, setFriendsModalOpen] = useState(false)

  const loadAccountInfo = async () => {
    try {
      setError(null)
      const session = getCurrentSession()
      const [accountRes, relRes] = await Promise.all([
        session.getCurrentAccount(),
        relationshipManager.getRelationships(FRIENDS),
      ])

      if (!accountRes?.success) {
        setError(accountRes?.error?.message || 'Could not load account')
        return
      }

      const data = accountRes.data || {}
      const iconUrl = getAvatarUrl(data)

      const friendsCount = relRes?.success ? (relRes?.data?.relationships?.length ?? 0) : 0

      setProfile({
        username: data.username ?? '',
        friendsCount,
        iconUrl,
        userId: data.user_id ?? null,
      })
    } catch (e) {
      console.error(e);
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
        <h1 className="m-0 text-xl font-bold text-[color:var(--text-primary)]">
          My Profile
        </h1>
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
      />
      <FriendsListModal
        open={friendsModalOpen}
        onClose={() => setFriendsModalOpen(false)}
      />
    </PageContainer>
  )
}
