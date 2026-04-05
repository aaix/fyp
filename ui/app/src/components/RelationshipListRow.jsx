import { Link } from 'react-router-dom'
import { useState } from 'react'
import Button from './Button.jsx'
import UserAvatar from './UserAvatar.jsx'
import { relationshipManager } from '../lib/user.js'

/**
 * One row: profile link + fixed-width relationship action (primary ↔ inverse, no layout shift).
 *
 * @param {Object} props
 * @param {string} props.peerId
 * @param {string} props.username
 * @param {string | null} props.iconUrl
 * @param {'friends' | 'followers' | 'following'} props.variant
 * @param {() => void} [props.onRelationshipChanged] - e.g. refresh profile counts
 * @param {() => void} [props.onNavigateToProfile] - e.g. close modal when opening a profile
 */
export default function RelationshipListRow({
  peerId,
  username,
  iconUrl,
  variant,
  onRelationshipChanged,
  onNavigateToProfile,
}) {
  const [phase, setPhase] = useState(/** @type {'primary' | 'inverse'} */ ('primary'))
  const [busy, setBusy] = useState(false)

  const primaryLabel =
    variant === 'friends'
      ? 'Unfriend'
      : variant === 'followers'
        ? 'Block'
        : 'Unfollow'
  const inverseLabel =
    variant === 'friends'
      ? 'Send friend request'
      : variant === 'followers'
        ? 'Unblock'
        : 'Follow'

  const runPrimary = async () => {
    setBusy(true)
    try {
      let res
      if (variant === 'friends') {
        res = await relationshipManager.unfriendUser(peerId)
      } else if (variant === 'followers') {
        res = await relationshipManager.blockUser(peerId)
      } else {
        res = await relationshipManager.unfollowUser(peerId)
      }
      if (!res?.success) {
        console.error(res?.error?.message ?? 'Relationship action failed')
        return
      }
      setPhase('inverse')
      onRelationshipChanged?.()
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  const runInverse = async () => {
    setBusy(true)
    try {
      let res
      if (variant === 'friends') {
        res = await relationshipManager.friendUser(peerId)
      } else if (variant === 'followers') {
        res = await relationshipManager.unblockUser(peerId)
      } else {
        res = await relationshipManager.followUser(peerId)
      }
      if (!res?.success) {
        console.error(res?.error?.message ?? 'Relationship action failed')
        return
      }
      setPhase('primary')
      onRelationshipChanged?.()
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  const rowBase =
    'flex w-full items-center gap-2 border-b border-[color:var(--card-border)] px-1 py-2 text-left text-sm text-[color:var(--text-primary)]'
  const linkClass =
    'flex min-w-0 flex-1 items-center gap-3 rounded-sm hover:bg-[color:var(--card-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-focus)]'

  const label = phase === 'primary' ? primaryLabel : inverseLabel
  const action = phase === 'primary' ? runPrimary : runInverse

  return (
    <li>
      <div className={rowBase}>
        <Link
          to={`/user/${peerId}`}
          state={{
            user: { user_id: peerId, username, icon_url: iconUrl },
          }}
          className={linkClass}
          onClick={() => onNavigateToProfile?.()}
        >
          <UserAvatar
            userId={peerId}
            src={iconUrl}
            alt={username ? `${username}'s avatar` : 'User avatar'}
            className="h-11 w-11 flex-shrink-0 rounded-full border border-[color:var(--card-border)] object-cover"
          />
          <span className="min-w-0 truncate font-medium">@{username || 'user'}</span>
        </Link>
        <div className="flex h-8 w-[11.5rem] shrink-0 items-center justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="max-w-full truncate px-2 text-xs"
            disabled={busy}
            aria-busy={busy}
            aria-label={label}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void action()
            }}
          >
            {label}
          </Button>
        </div>
      </div>
    </li>
  )
}
