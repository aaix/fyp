import { useParams, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import ProfileView from '../components/ProfileView.jsx'
import { userManager } from '../lib/user.js'

/**
 * Map a search-result user (icon_url, username, user_id, public_key) to ProfileView profile shape.
 */
function userToProfile(user) {
  if (!user) return { username: '', iconUrl: null, followers: 0, following: 0 }
  return {
    username: user.username ?? '',
    iconUrl: user.icon_url ?? null,
    followers: user.followers ?? 0,
    following: user.following ?? 0,
  }
}

export default function UserPage() {
  const { userId } = useParams()
  const location = useLocation()
  const stateUser = location.state?.user

  const [profile, setProfile] = useState(() => userToProfile(stateUser))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) return

    let cancelled = false
    ;(async () => {
      try {
        if (cancelled) return
        setLoading(true)
        setError(null)
        const data = await userManager.getUserProfile(userId)
        if (cancelled) return
        if (data) {
          setProfile({
            username: data.username ?? '',
            iconUrl: data.icon_url ?? null,
            followers: data.followers ?? 0,
            following: data.following ?? 0,
          })
          setError(null)
        } else {
          setError('User not found')
        }
      } catch (e) {
        if (!cancelled) setError(e?.message ?? 'Could not load profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId, stateUser])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ProfileView profile={profile} loading={loading} error={error} />
    </div>
  )
}
