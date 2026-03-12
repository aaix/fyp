import { useEffect, useMemo, useState } from 'react'
import FriendMultiSelect from './FriendMultiSelect.jsx'
import { channelManager } from '../lib/chat.js'

export default function AddChannelMembersModal({
  open,
  onClose,
  channelId,
  existingMemberIds = [],
  onMembersAdded,
  maxFriends = 15,
}) {
  const [selectedIds, setSelectedIds] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) {
      setSelectedIds([])
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
    channelId &&
    selectedIds.length > 0 &&
    effectiveMax > 0

  const titleId = 'add-channel-members-title'

  if (!open) return null

  async function onSubmit(e) {
    e?.preventDefault?.()
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)
    try {
      const existingSet = new Set(existingMemberIds ?? [])
      const toAdd = selectedIds.filter((id) => !existingSet.has(id))
      if (toAdd.length === 0) {
        onClose?.()
        return
      }

      const results = await Promise.allSettled(
        toAdd.map((userId) => channelManager.addChannelMember(channelId, userId)),
      )

      const failed = results.filter(
        (r) => r.status === 'rejected' || (r.value && r.value.success === false),
      )

      if (failed.length > 0) {
        setError('Some members could not be added')
      }

      const successfulIds = toAdd.filter((_, idx) => !failed[idx])
      if (successfulIds.length > 0) {
        onMembersAdded?.(successfulIds)
      }
      onClose?.()
    } catch (err) {
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
          <button
            type="button"
            className="rounded-button p-2 text-[color:var(--text-primary)] hover:bg-[color:var(--card-bg)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-xl" aria-hidden>
              close
            </span>
          </button>
        </div>

        {effectiveMax === 0 ? (
          <p className="text-sm text-[color:var(--text-muted)]">
            This channel is full. Remove someone before adding new members.
          </p>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <FriendMultiSelect
              value={selectedIds}
              onChange={setSelectedIds}
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
              <button
                type="button"
                className="rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-1.5 text-sm font-semibold text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--card-bg)]/80 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-button bg-[color:var(--accent)] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canSubmit}
              >
                {submitting ? 'Adding…' : 'Add'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

