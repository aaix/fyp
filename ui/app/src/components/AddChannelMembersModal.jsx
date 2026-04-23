import { useEffect, useMemo, useState } from 'react'
import FriendMultiSelect from './FriendMultiSelect.jsx'
import { channelManager } from '../lib/chat.js'
import Button from './Button.jsx'
import ModalCloseButton from './ModalCloseButton.jsx'
import useEscapeToClose from './useEscapeToClose.js'

function AddChannelMembersModal({
  open,
  onClose,
  channel,
  channelId,
  existingMemberIds = [],
  onMembersAdded,
  maxFriends = 120,
}) {
  const [selectedUsers, setSelectedUsers] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) {
      setSelectedUsers([])
      setSubmitting(false)
      setError(null)
    }
  }, [open])

  const effectiveMax = useMemo(() => {
    const remaining = Math.max(0, maxFriends - (existingMemberIds?.length ?? 0))
    return remaining > 0 ? remaining : 0
  }, [existingMemberIds, maxFriends])

  const canSubmit =
    open &&
    !submitting &&
    channel?.channel_id &&
    selectedUsers.length > 0 &&
    effectiveMax > 0

  const titleId = 'add-channel-members-title'

  useEscapeToClose(open, onClose)

  if (!open) return null

  async function onSubmit(e) {
    e?.preventDefault?.()
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)
    try {
      if (!channel) {
        setError('Missing channel info')
        return
      }

      const existingSet = new Set(existingMemberIds ?? [])
      const toAdd = selectedUsers.filter((u) => !existingSet.has(u.user_id))
      if (toAdd.length === 0) {
        onClose?.()
        return
      }

      const res = await channelManager.addChannelMembers(channel, toAdd)
      if (!res?.success) {
        setError(res?.error?.message ?? 'Could not add members')
        return
      }

      onMembersAdded?.(toAdd.map((u) => u.user_id))
      onClose?.()
    } catch (err) {
      console.error(err);
      setError(err?.message ?? 'Could not add members')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="w-full max-w-lg rounded-card border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-[color:var(--text-primary)]">
              Add members
            </h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Select friends to add to this channel.
            </p>
          </div>
          <ModalCloseButton onClick={onClose} disabled={submitting} />
        </div>

        {effectiveMax === 0 ? (
          <p className="text-sm text-[color:var(--text-muted)]">
            This channel is full. Remove someone before adding new members.
          </p>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <FriendMultiSelect
              value={selectedUsers}
              onChange={setSelectedUsers}
              maxSelected={effectiveMax}
              disabled={submitting}
              labelledById={titleId}
            />

            {error && (
              <p className="text-sm text-[color:var(--text-muted)]" role="alert">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!canSubmit}>
                {submitting ? 'Adding…' : 'Add'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default AddChannelMembersModal
