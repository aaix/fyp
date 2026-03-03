import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentSession } from '../lib/session.js'
import { getAvatarUrl } from '../lib/utils.js'
import ProfileView from '../components/ProfileView.jsx'
import PageContainer from '../components/PageContainer.jsx'

export default function AccountPage() {
  const [profile, setProfile] = useState({
    username: '',
    followers: 0,
    following: 0,
    iconUrl: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadAccountInfo = async () => {
    try {
      setError(null)
      const session = getCurrentSession()
      const res = await session.getCurrentAccount()

      if (!res?.success) {
        setError(res?.error?.message || 'Could not load account')
        return
      }

      const data = res.data || {}
      const iconUrl = getAvatarUrl(data)
      setProfile({
        username: data.username ?? '',
        followers: data.followers ?? data.followers_count ?? 0,
        following: data.following ?? data.following_count ?? 0,
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
        <h1 className="m-0 text-xl font-bold text-[color:var(--text-primary)]">My Profile</h1>
        <Link
          to="/account/settings"
          className="flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--text-primary)] no-underline transition-colors hover:bg-[color:var(--card-bg)] hover:text-[color:var(--accent)]"
          aria-label="Settings"
        >
          <span className="material-symbols-outlined text-xl" aria-hidden>
            settings
          </span>
        </Link>
      </header>
      <ProfileView profile={profile} loading={loading} error={error} />
    </PageContainer>
  )
}
