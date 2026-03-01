import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentSession } from '../lib/session.js'
import { getAvatarUrl } from '../lib/utils.js'
import ProfileView from '../components/ProfileView.jsx'
import './AccountPage.css'

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="account-page">
      <header className="account-header">
        <h1 className="account-title">My Profile</h1>
        <Link to="/account/settings" className="account-settings-link" aria-label="Settings">
          <span className="material-symbols-outlined" aria-hidden>settings</span>
        </Link>
      </header>
      <ProfileView profile={profile} isOwnProfile loading={loading} error={error} />
    </div>
  )
}
