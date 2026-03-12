import { useEffect, useMemo, useState } from 'react'
import FriendMultiSelect from './FriendMultiSelect.jsx'
import { channelManager } from '../lib/chat.js'
import Button from './Button.jsx'
import ModalCloseButton from './ModalCloseButton.jsx'
import useEscapeToClose from './useEscapeToClose.js'
import ToggleSwitch from './ToggleSwitch.jsx'

export default function CreateChannelModal({
  open,
  onClose,
  onCreated,
  maxFriends = 15,
  getEncryptedSharedKey = () => '',
  getEncryptedMemberKey = () => '',
}) {
  const [channelName, setChannelName] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [allowMembersManageUsers, setAllowMembersManageUsers] = useState(true)

  useEffect(() => {
    if (!open) {
      setChannelName('')
      setSelectedIds([])
      setSubmitting(false)
      setError(null)
      setAllowMembersManageUsers(true)
    }
  }, [open])

  const trimmedName = channelName.trim()
  const canSubmit = selectedIds.length > 0 && trimmedName.length > 0 && !submitting

  const titleId = 'create-channel-title'
  const descriptionId = 'create-channel-description'

  const payload = useMemo(() => {
    const CHANNEL_TYPE = {
      REGULAR: 0,
      RESTRICTED_EXPANSION: 1,
    }

    return {
      channel_type: allowMembersManageUsers
        ? CHANNEL_TYPE.REGULAR
        : CHANNEL_TYPE.RESTRICTED_EXPANSION,
      channel_name: trimmedName,
      encrypted_shared_key: getEncryptedSharedKey?.() ?? '',
      channel_members: (selectedIds ?? []).slice(0, maxFriends).map((userId) => ({
        user_id: userId,
        encrypted_shared_key: getEncryptedMemberKey?.(userId) ?? '',
      })),
    }
  }, [
    allowMembersManageUsers,
    getEncryptedMemberKey,
    getEncryptedSharedKey,
    maxFriends,
    selectedIds,
    trimmedName,
  ])

  useEscapeToClose(open, onClose)

  if (!open) return null

  async function onSubmit(e) {
    e?.preventDefault?.()
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)
    try {
      const res = await channelManager.createChannel(payload)
      if (!res?.success) {
        setError(res?.error?.message ?? 'Could not create channel')
        return
      }
      onCreated?.(res?.data)
      onClose?.()
    } catch (err) {
      setError(err?.message ?? 'Could not create channel')
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
      aria-describedby={descriptionId}
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="w-full max-w-lg rounded-card border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-[color:var(--text-primary)]">
              Create channel
            </h2>
            <p id={descriptionId} className="mt-1 text-sm text-[color:var(--text-muted)]">
              Pick up to {maxFriends} friends to add. Encryption fields are currently stubbed.
            </p>
          </div>
          <ModalCloseButton onClick={onClose} disabled={submitting} />
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-[color:var(--text-primary)]">
              Channel name
            </label>
            <input
              type="text"
              className="w-full rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="e.g. Weekend plans"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              maxLength={64}
              disabled={submitting}
              autoComplete="off"
              required
            />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                Allow members to add and remove users
              </div>
              <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">
                When enabled, any member can manage the channel&apos;s membership. When disabled,
                members will only be able to remove themselves.
              </p>
            </div>
            <ToggleSwitch
              checked={allowMembersManageUsers}
              onChange={setAllowMembersManageUsers}
              disabled={submitting}
              label={allowMembersManageUsers ? 'Allowed' : 'Restricted'}
              onLabel="Allowed"
              offLabel="Restricted"
            />
          </div>

          <FriendMultiSelect
            value={selectedIds}
            onChange={setSelectedIds}
            maxSelected={maxFriends}
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
              {submitting ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

