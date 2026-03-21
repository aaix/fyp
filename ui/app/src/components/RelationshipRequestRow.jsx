import { Link } from 'react-router-dom'
import Button from './Button.jsx'
import UserAvatar from './UserAvatar.jsx'

const rowBase =
  'flex w-full items-center gap-3 border-b border-[color:var(--card-border)] px-1 py-2 text-left text-sm text-[color:var(--text-primary)]'

/**
 * Row for a single relationship request (incoming or sent).
 * @param {{ peerId: string, username: string, iconUrl: string | null, variant: 'incoming' | 'sent', onAccept?: () => void, onDecline?: () => void, onRevoke?: () => void, actionLoading?: boolean }} props
 */
export default function RelationshipRequestRow({
  peerId,
  username,
  iconUrl,
  variant,
  onAccept,
  onDecline,
  onRevoke,
  actionLoading = false,
}) {
  const content = (
    <>
      <UserAvatar
        userId={peerId}
        src={iconUrl}
        alt={username ? `${username}'s avatar` : 'User avatar'}
        className="h-11 w-11 flex-shrink-0 rounded-full border border-[color:var(--card-border)] object-cover"
      />
      <span className="min-w-0 flex-1 font-medium truncate">@{username || 'user'}</span>
      {variant === 'incoming' && (
        <div className="flex flex-shrink-0 gap-2">
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs"
            disabled={actionLoading}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDecline?.()
            }}
          >
            Decline
          </Button>
          <Button
            className="px-2 py-1 text-xs"
            disabled={actionLoading}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onAccept?.()
            }}
          >
            Accept
          </Button>
        </div>
      )}
      {variant === 'sent' && (
        <Button
          variant="ghost"
          className="flex-shrink-0 px-2 py-1 text-xs"
          disabled={actionLoading}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRevoke?.()
          }}
        >
          Revoke
        </Button>
      )}
    </>
  )

  return (
    <li>
      <Link
        to={`/user/${peerId}`}
        className={`${rowBase} hover:bg-[color:var(--card-bg)]`}
      >
        {content}
      </Link>
    </li>
  )
}
