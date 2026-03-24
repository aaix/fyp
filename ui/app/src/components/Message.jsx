import { memo, useCallback, useEffect, useState } from 'react'
import { userContentUrl } from '../lib/utils.js'
import { messageManager } from '../lib/chat.js'
import { decryptB64Sym } from '../lib/keyhandler.js'
import UserAvatar from './UserAvatar.jsx'
import ContextMenu from './ContextMenu.jsx'
import MenuActionItem from './MenuActionItem.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import Button from './Button.jsx'

function uuidTimeToUnixMs(uuid) {
  if (!uuid || typeof uuid !== 'string') return null
  const hex = uuid.replace(/-/g, '').toLowerCase()
  if (hex.length !== 32) return null
  const version = parseInt(hex[12], 16)
  if (version !== 1) return null
  const timeLow = BigInt(`0x${hex.slice(0, 8)}`)
  const timeMid = BigInt(`0x${hex.slice(8, 12)}`)
  const timeHiAndVersion = BigInt(`0x${hex.slice(12, 16)}`)
  const timestamp100ns = (timeHiAndVersion & 0x0fffn) << 48n | timeMid << 32n | timeLow
  const UUID_EPOCH_OFFSET_100NS = 122192928000000000n
  const unix100ns = timestamp100ns - UUID_EPOCH_OFFSET_100NS
  if (unix100ns < 0n) return null
  return Number(unix100ns / 10000n)
}

function sameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatMessageTimestamp(createdMs) {
  if (!createdMs) return { label: '', full: '' }
  const created = new Date(createdMs)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const hhmm = created.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
  const full = created.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  if (sameLocalDay(created, now)) return { label: hhmm, full }
  if (sameLocalDay(created, yesterday)) return { label: `Yesterday at ${hhmm}`, full }
  const date = created.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  return { label: date, full }
}

function decodeMessageContent(content) {
  if (!content) return null
  try {
    if (typeof content === 'string') return content
    if (content instanceof ArrayBuffer) {
      return new TextDecoder().decode(new Uint8Array(content))
    }
    if (ArrayBuffer.isView(content)) {
      return new TextDecoder().decode(content)
    }
    return String(content)
  } catch {
    return null
  }
}

function truncateSnippet(s, n = 80) {
  if (!s) return ''
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

function resolveAuthorLabel(message, selectedMembers, authorProfilesById) {
  const aid = message?.author_id
  if (aid == null) return 'Unknown'
  const key = String(aid)
  const m = selectedMembers?.find((u) => String(u.user_id) === key)
  if (m?.username) return `@${m.username}`
  const p = authorProfilesById?.[key]
  if (p?.username) return `@${p.username}`
  return `@${key}`
}

function Message({
  message,
  author,
  isOwn,
  channel,
  currentUserId,
  messagesById,
  deletedMessageIds,
  selectedMembers,
  authorProfilesById,
  onReply,
  onMessagePatched,
  onMessageDeleted,
}) {
  const replyToId = message?.in_reply_to != null ? String(message.in_reply_to) : null
  const parentFromList = replyToId ? messagesById?.[replyToId] : undefined

  const text = decodeMessageContent(message?.content)
  const createdMs = uuidTimeToUnixMs(message?.message_id)
  const { label: timeLabel, full: fullTimeLabel } = formatMessageTimestamp(createdMs)
  const lastEditedMs =
    message?.last_edited != null && message.last_edited !== 0
      ? message.last_edited > 1e12
        ? message.last_edited
        : message.last_edited * 1000
      : null
  const editedTime = lastEditedMs != null ? formatMessageTimestamp(lastEditedMs) : null

  const timeRowTitle =
    editedTime?.full != null && editedTime.full !== ''
      ? fullTimeLabel
        ? `Sent: ${fullTimeLabel}\nEdited: ${editedTime.full}`
        : `Edited: ${editedTime.full}`
      : fullTimeLabel

  const avatarUrl = author?.icon_url || null
  const authorLabel = author?.username ? `@${author.username}` : 'Unknown'

  const hasAttachment = !!message?.attachment_asset_id
  const maybeImage = hasAttachment && message?.message_type === 1

  const [parentPreview, setParentPreview] = useState(null)
  const [menu, setMenu] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    if (!replyToId || !channel?.shared_key) {
      setParentPreview(null)
      return
    }

    if (deletedMessageIds?.has(replyToId)) {
      setParentPreview({ kind: 'deleted' })
      return
    }

    if (parentFromList) {
      setParentPreview({ kind: 'ready', message: parentFromList })
      return
    }

    let cancelled = false
    setParentPreview({ kind: 'loading' })
    ;(async () => {
      const res = await messageManager.getMessage(channel, message.in_reply_to)
      if (cancelled) return
      if (res?.success && res.data) {
        setParentPreview({ kind: 'ready', message: res.data })
      } else if (res?.status_code === 404) {
        setParentPreview({ kind: 'deleted' })
      } else {
        setParentPreview({ kind: 'deleted' })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [replyToId, parentFromList, deletedMessageIds, channel, message.in_reply_to, message.message_id])

  const parentQuote = (() => {
    if (!replyToId) return null
    if (!parentPreview || parentPreview.kind === 'loading') {
      return (
        <div className="mb-1.5 rounded border-l-2 border-[color:var(--accent)] bg-[color:var(--card-bg)]/50 pl-2 py-0.5 text-xs text-[color:var(--text-muted)]">
          Loading reply…
        </div>
      )
    }
    if (parentPreview.kind === 'deleted') {
      return (
        <div className="mb-1.5 rounded border-l-2 border-[color:var(--text-muted)] bg-[color:var(--card-bg)]/50 pl-2 py-0.5 text-xs italic text-[color:var(--text-muted)]">
          Original message deleted
        </div>
      )
    }
    const pm = parentPreview.message
    const plabel = resolveAuthorLabel(pm, selectedMembers, authorProfilesById)
    const ptext = truncateSnippet(decodeMessageContent(pm?.content))
    return (
      <div className="mb-1.5 rounded border-l-2 border-[color:var(--accent)] bg-[color:var(--card-bg)]/50 pl-2 py-1">
        <div className="text-xs font-semibold text-[color:var(--text-primary)]">{plabel}</div>
        {ptext ? (
          <div className="line-clamp-2 text-xs text-[color:var(--text-muted)]">{ptext}</div>
        ) : (
          <div className="text-xs italic text-[color:var(--text-muted)]">No text</div>
        )}
      </div>
    )
  })()

  const canEditDelete =
    currentUserId != null && message?.author_id != null && String(message.author_id) === String(currentUserId)

  const openMenu = useCallback((e) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const handleReply = useCallback(() => {
    setMenu(null)
    onReply?.(message)
  }, [message, onReply])

  const startEdit = useCallback(() => {
    setMenu(null)
    setEditDraft(text ?? '')
    setEditing(true)
  }, [text])

  const cancelEdit = useCallback(() => {
    setEditing(false)
    setEditDraft('')
  }, [])

  const saveEdit = useCallback(async () => {
    if (!channel?.shared_key) return
    setEditSaving(true)
    try {
      const buf = new TextEncoder().encode((editDraft ?? '').trim()).buffer
      const res = await messageManager.editMessage(channel, message.message_id, buf)
      if (!res?.success) return
      let decrypted = null
      try {
        if (res.data?.content && channel.shared_key) {
          decrypted = await decryptB64Sym(res.data.content, channel.shared_key)
        }
      } catch {
        decrypted = decodeMessageContent(editDraft)
      }
      onMessagePatched?.({
        ...message,
        ...res.data,
        content: decrypted ?? decodeMessageContent(editDraft),
      })
      setEditing(false)
    } finally {
      setEditSaving(false)
    }
  }, [channel, editDraft, message, onMessagePatched])

  const runDelete = useCallback(async () => {
    setDeleteLoading(true)
    try {
      const res = await messageManager.deleteMessage(channel, message.message_id)
      if (res?.success) {
        onMessageDeleted?.(message.message_id)
        setDeleteOpen(false)
      }
    } finally {
      setDeleteLoading(false)
    }
  }, [channel, message, onMessageDeleted])

  return (
    <li
      className={`group flex w-full min-w-0 max-w-full overflow-x-hidden ${isOwn ? 'justify-end' : 'justify-start'}`}
      onContextMenu={openMenu}
    >
      <div
        className={`flex w-full min-w-0 max-w-full gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
      >
          <UserAvatar
            userId={author?.user_id}
            src={avatarUrl}
            alt=""
            className="mt-1 h-8 w-8 flex-shrink-0 rounded-full border border-[color:var(--card-border)] object-cover"
          />

          <div
            className={`relative min-w-0 rounded-card border border-[color:var(--card-border)] px-3 py-2 ${
              editing
                ? 'w-full min-w-0 max-w-full flex-1'
                : 'max-w-[min(100%,80%)] flex-shrink'
            } ${isOwn ? 'bg-[color:var(--tab-active-bg)]' : 'bg-[color:var(--card-bg)]'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{authorLabel}</div>
              <div className="flex flex-shrink-0 items-center gap-1">
                {timeLabel || editedTime?.label ? (
                  <div className="max-w-[min(100%,16rem)] text-right text-xs text-[color:var(--text-muted)]">
                    <span title={timeRowTitle} className="cursor-help">
                      {timeLabel ? (
                        <>
                          {timeLabel}
                          {editedTime?.label ? (
                            <>
                              {' · '}
                              <span className="whitespace-nowrap">Edited {editedTime.label}</span>
                            </>
                          ) : null}
                        </>
                      ) : (
                        editedTime?.label && (
                          <span className="whitespace-nowrap">Edited {editedTime.label}</span>
                        )
                      )}
                    </span>
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="text"
                  size="iconSm"
                  className="h-6 w-6 p-0 text-[color:var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Message actions"
                  onClick={(e) => {
                    e.stopPropagation()
                    openMenu(e)
                  }}
                >
                  <span className="material-symbols-outlined text-base" aria-hidden>
                    more_horiz
                  </span>
                </Button>
              </div>
            </div>

            {parentQuote}

            {editing ? (
              <div className="mt-2 min-w-0 space-y-2">
                <textarea
                  rows={4}
                  className="box-border w-full min-w-0 max-w-full resize-y rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-2 py-1.5 text-base text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  disabled={editSaving}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void saveEdit()
                    } else if (e.key === 'Escape') {
                      cancelEdit()
                    }
                  }}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={cancelEdit} disabled={editSaving}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={() => void saveEdit()} disabled={editSaving}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {text ? (
                  <div className="mt-1 min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-base text-[color:var(--text-primary)]">
                    {text}
                  </div>
                ) : null}

                {hasAttachment ? (
                  <div className="mt-2">
                    {maybeImage ? (
                      <img
                        src={userContentUrl(message.channel_id, message.attachment_asset_id, 'webp')}
                        alt="Attachment"
                        className="max-h-64 w-full rounded-button border border-[color:var(--card-border)] object-contain"
                      />
                    ) : (
                      <div className="text-base text-[color:var(--text-muted)]">
                        Attachment: {String(message.attachment_asset_id)}
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

      <ContextMenu open={!!menu} onClose={() => setMenu(null)} x={menu?.x} y={menu?.y} preferLeft>
        <div className="min-w-[160px] rounded-card border border-[color:var(--card-border)] bg-[color:var(--card-bg)] py-1 text-sm text-[color:var(--text-primary)] shadow-card">
          <MenuActionItem type="button" className="justify-start" onClick={handleReply}>
            Reply
          </MenuActionItem>
          {canEditDelete ? (
            <>
              <MenuActionItem type="button" className="justify-start" onClick={startEdit}>
                Edit
              </MenuActionItem>
              <MenuActionItem
                type="button"
                className="justify-start text-red-500 hover:bg-red-500/10"
                onClick={() => {
                  setMenu(null)
                  setDeleteOpen(true)
                }}
              >
                Delete
              </MenuActionItem>
            </>
          ) : null}
        </div>
      </ContextMenu>

      <ConfirmModal
        open={deleteOpen}
        title="Delete message?"
        description="This message will be removed for everyone in the channel."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        confirmDisabled={deleteLoading}
        onConfirm={() => void runDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </li>
  )
}

export default memo(Message)
