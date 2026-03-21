import { useEffect, useMemo, useState } from 'react'
import { relationshipManager, userManager } from '../lib/user.js'
import { getAvatarUrl } from '../lib/utils.js'
import UserAvatar from './UserAvatar.jsx'
import Button from './Button.jsx'

/**
 * Friend picker that only searches within your existing friends.
 * - Sources friend IDs from relationshipManager.getRelationships()
 * - Hydrates via userManager.fetchUsersBulk() (full user objects, including public_key).
 * - value/onChange are arrays of those full user objects.
 */
export default function FriendMultiSelect({
  value,
  onChange,
  maxSelected = 15,
  disabled = false,
  labelledById,
}) {
  const [query, setQuery] = useState('')
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setFriends([])

    ;(async () => {
      try {
        const res = await relationshipManager.getRelationships(Number(relationshipManager.FRIENDS))
        if (cancelled) return
        if (!res?.success) {
          setError(res?.error?.message ?? 'Could not load friends')
          return
        }

        const relationships = res?.data?.relationships ?? []
        const friendPeerIds = relationships.map((r) => r.peer_id)

        if (friendPeerIds.length === 0) {
          setFriends([])
          return
        }

        const users = await userManager.fetchUsersBulk(friendPeerIds)
        if (cancelled) return

        const list = (users ?? []).slice()
        list.sort((a, b) =>
          (a?.username ?? '').localeCompare(b?.username ?? '', undefined, { sensitivity: 'base' }),
        )
        setFriends(list)
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(e?.message ?? 'Could not load friends')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const selected = value ?? []
  const selectedSet = useMemo(() => new Set(selected.map((u) => u.user_id)), [value])
  const normalizedQuery = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!normalizedQuery) return friends
    return friends.filter((f) => (f?.username ?? '').toLowerCase().includes(normalizedQuery))
  }, [friends, normalizedQuery])

  const selectedCount = selected.length
  const remaining = Math.max(0, maxSelected - selectedCount)
  const canSelectMore = selectedCount < maxSelected

  function toggle(friend) {
    if (disabled) return
    if (selectedSet.has(friend.user_id)) {
      onChange?.(selected.filter((u) => u.user_id !== friend.user_id))
      return
    }
    if (!canSelectMore) return
    onChange?.([...selected, friend])
  }

  const inputId = labelledById ? `${labelledById}-friend-search` : undefined
  const rowBase =
    'w-full justify-start gap-3 border border-[color:var(--card-border)] px-2 py-2 text-left text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--card-bg)]'

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={inputId}
            className="text-sm font-semibold text-[color:var(--text-primary)]"
          >
            Add friends
          </label>
          <span className="text-xs text-[color:var(--text-muted)]">
            {selectedCount}/{maxSelected}
          </span>
        </div>
        <input
          id={inputId}
          type="text"
          className="w-full rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="Search friends…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          autoComplete="off"
        />
        {!disabled && !canSelectMore && (
          <p className="text-xs text-[color:var(--text-muted)]">
            Maximum reached (15). Remove someone to add another.
          </p>
        )}
        {disabled && (
          <p className="text-xs text-[color:var(--text-muted)]">Friend selection is disabled.</p>
        )}
        {!disabled && remaining > 0 && (
          <p className="text-xs text-[color:var(--text-muted)]">
            You can add up to {remaining} more.
          </p>
        )}
      </div>

      {loading && (
        <ul className="space-y-2" role="list" aria-label="Loading friends">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-[color:var(--card-border)] bg-[color:var(--card-bg)] skeleton-pulse" />
              <div className="h-4 w-40 rounded bg-[color:var(--card-bg)] skeleton-pulse" />
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-sm text-[color:var(--text-muted)]" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && friends.length === 0 && (
        <p className="text-sm text-[color:var(--text-muted)]">No friends to add.</p>
      )}

      {!loading && !error && friends.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-[color:var(--text-muted)]">No matches.</p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <ul className="max-h-72 space-y-2 overflow-y-auto pr-1" role="list">
          {filtered.map((friend) => {
            const checked = selectedSet.has(friend.user_id)
            const disableRow = disabled || (!checked && !canSelectMore)
            return (
              <li key={friend.user_id}>
                <Button
                  type="button"
                  variant="text"
                  size="sm"
                  className={rowBase}
                  onClick={() => toggle(friend)}
                  disabled={disableRow}
                  aria-pressed={checked}
                >
                  <UserAvatar
                    userId={friend.user_id}
                    src={getAvatarUrl(friend)}
                    alt={friend?.username ? `${friend.username}'s avatar` : 'User avatar'}
                    className="h-10 w-10 flex-shrink-0 rounded-full border border-[color:var(--card-border)] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">@{friend?.username ?? 'user'}</div>
                  </div>
                  <span
                    className={`material-symbols-outlined text-xl ${checked ? 'text-[color:var(--accent)]' : 'text-[color:var(--text-muted)]'}`}
                    aria-hidden
                  >
                    {checked ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

