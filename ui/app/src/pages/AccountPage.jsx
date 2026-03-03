import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentSession } from '../lib/session.js'
import { getAvatarUrl } from '../lib/utils.js'
import { relationshipManager } from '../lib/user.js'
import ProfileView from '../components/ProfileView.jsx'
import PageContainer from '../components/PageContainer.jsx'
import FriendsListModal from '../components/FriendsListModal.jsx'

const FRIENDS = 3

export default function AccountPage() {
  const [profile, setProfile] = useState({
    username: '',
    friendsCount: 0,
    iconUrl: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [friendsModalOpen, setFriendsModalOpen] = useState(false)

  const loadAccountInfo = async () => {
    try {
      setError(null)
      const session = getCurrentSession()
      const [accountRes, relRes] = await Promise.all([
        session.getCurrentAccount(),
        relationshipManager.getRelationships(),
      ])

      if (!accountRes?.success) {
        setError(accountRes?.error?.message || 'Could not load account')
        return
      }

      const data = accountRes.data || {}
      const iconUrl = getAvatarUrl(data)

      let friendsCount = 0
      if (relRes?.success && Array.isArray(relRes.data?.relationships)) {
        friendsCount = relRes.data.relationships.filter(
          (r) => Number(r.relationship) === FRIENDS
        ).length
      }

      setProfile({
        username: data.username ?? '',
        friendsCount,
        iconUrl,
      })
    } catch (e) {
      setError(e.message || 'Could not load account')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccountInfo()
  }, [])

  return (
    <PageContainer>
      <header className="flex items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-3">
        <h1 className="m-0 text-xl font-bold text-[color:var(--text-primary)]">
          My Profile
        </h1>
        <div className="flex items-center gap-1">
          <Link
            to="/notifications"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--text-primary)] no-underline transition-colors hover:bg-[color:var(--card-bg)] hover:text-[color:var(--accent)]"
            aria-label="Friend requests"
          >
            <span className="material-symbols-outlined text-xl" aria-hidden>
              notifications
            </span>
          </Link>
          <Link
            to="/account/settings"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--text-primary)] no-underline transition-colors hover:bg-[color:var(--card-bg)] hover:text-[color:var(--accent)]"
            aria-label="Settings"
          >
            <span className="material-symbols-outlined text-xl" aria-hidden>
              settings
            </span>
          </Link>
        </div>
      </header>
      <ProfileView
        profile={profile}
        loading={loading}
        error={error}
        onFriendsClick={() => setFriendsModalOpen(true)}
      />
      <FriendsListModal
        open={friendsModalOpen}
        onClose={() => setFriendsModalOpen(false)}
      />
    </PageContainer>
  )
}
