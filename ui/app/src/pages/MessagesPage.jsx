import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import PageContainer from '../components/PageContainer.jsx'
import Card from '../components/Card.jsx'
import CreateChannelModal from '../components/CreateChannelModal.jsx'
import UserAvatar from '../components/UserAvatar.jsx'
import AddChannelMembersModal from '../components/AddChannelMembersModal.jsx'
import ContextMenu from '../components/ContextMenu.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import Button from '../components/Button.jsx'
import ClickableRow from '../components/ClickableRow.jsx'
import MenuActionItem from '../components/MenuActionItem.jsx'
import Message from '../components/Message.jsx'
import SystemMessage from '../components/SystemMessage.jsx'
import {
  SYSTEM_MSG_ADD_MEMBERS,
  SYSTEM_MSG_REMOVE_MEMBER,
  decodeSystemMessageContent,
  parseCommaSeparatedUserIds,
  uuidHexKey,
  uuidFrom32Hex,
} from '../utils/systemMessageContent.js'
import { getCurrentSession } from '../lib/session.js'
import { channelManager, isUserMessageType, messageManager } from '../lib/chat.js'
import { decryptB64Sym } from '../lib/keyhandler.js'
import { userManager } from '../lib/user.js'
import { getAvatarUrl, getDefaultChannelUrl, userContentUrl } from '../lib/utils.js'
import MemberContextMenu from '../components/MemberContextMenu.jsx'

function decodeReplyPreviewContent(content) {
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

function truncateReplyPreview(s, n = 200) {
  if (!s) return ''
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

function canonicalChannelMemberId(raw) {
  const key = uuidHexKey(raw)
  if (key.length === 32 && /^[0-9a-f]+$/.test(key)) {
    return uuidFrom32Hex(key) ?? String(raw).trim()
  }
  return String(raw).trim()
}

/** 100ns ticks since UUID epoch (RFC 4122 v1); used to compare message ids when the acked row is missing. */
function uuidV1Ticks(uuid) {
  if (uuid == null || uuid === '') return null
  const hex = String(uuid).replace(/-/g, '').toLowerCase()
  if (hex.length !== 32) return null
  const version = parseInt(hex[12], 16)
  if (version !== 1) return null
  const timeLow = BigInt(`0x${hex.slice(0, 8)}`)
  const timeMid = BigInt(`0x${hex.slice(8, 12)}`)
  const timeHiAndVersion = BigInt(`0x${hex.slice(12, 16)}`)
  return (timeHiAndVersion & 0x0fffn) << 48n | timeMid << 32n | timeLow
}

const UUID_V1_UNIX_OFFSET_100NS = 122192928000000000n

function uuidV1UnixMs(uuid) {
  const ticks = uuidV1Ticks(uuid)
  if (ticks === null) return null
  const unix100ns = ticks - UUID_V1_UNIX_OFFSET_100NS
  if (unix100ns < 0n) return null
  return Number(unix100ns / 10000n)
}

function sameCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Label for “since …” in the unread banner (today: time only; else yesterday / date + time). */
function formatAckedSinceForUnreadBar(ms) {
  const d = new Date(ms)
  const now = new Date()
  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (sameCalendarDay(d, now)) return timeStr
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameCalendarDay(d, yesterday)) return `yesterday at ${timeStr}`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function sortChannelsByLastAcked(list) {
  return [...list].sort((a, b) => {
    const ta = uuidV1Ticks(a.last_acked_message_id)
    const tb = uuidV1Ticks(b.last_acked_message_id)
    const va = ta ?? 0n
    const vb = tb ?? 0n
    if (vb > va) return 1
    if (vb < va) return -1
    return 0
  })
}

function countUnreadMessages(msgs, ackId) {
  const ackTicks = uuidV1Ticks(ackId)
  return (msgs ?? []).filter((m) => {
    const t = uuidV1Ticks(m.message_id)
    if (t === null) return false
    if (ackTicks === null) return true
    return t > ackTicks
  }).length
}

/** Pixels from bottom to treat as “still at bottom” for auto-scroll. */
const SCROLL_BOTTOM_THRESHOLD_PX = 120

export default function MessagesPage() {
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [selectedChannelId, setSelectedChannelId] = useState(null)
  const [selectedChannel, setSelectedChannel] = useState(null)
  const selectedChannelIdRef = useRef(null)
  const selectedChannelRef = useRef(null)
  const lastLoadedChannelIdRef = useRef(null)
  const [selectedMembers, setSelectedMembers] = useState([])
  const [authorProfilesById, setAuthorProfilesById] = useState({})
  const [channelLoading, setChannelLoading] = useState(false)
  const [channelError, setChannelError] = useState(null)
  const [memberMenu, setMemberMenu] = useState(null)
  const [addingMembers, setAddingMembers] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [editNameLoading, setEditNameLoading] = useState(false)
  const [editNameError, setEditNameError] = useState(null)
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [leaveError, setLeaveError] = useState(null)
  const [channelMenu, setChannelMenu] = useState(null)
  const [leaveConfirm, setLeaveConfirm] = useState(null)

  const currentUserId = getCurrentSession()?.user_id

  const [messages, setMessages] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState(null)

  const PAGE_SIZE = 20
  const [hasMoreBefore, setHasMoreBefore] = useState(true)
  const [olderMessagesLoading, setOlderMessagesLoading] = useState(false)

  const messagesScrollRef = useRef(null)
  /** True while the user is at/near the bottom; updated on scroll. Used to avoid jumping when reading history. */
  const userPinnedToBottomRef = useRef(true)
  const shouldAutoScrollRef = useRef(false)
  const scrollLockUntilRef = useRef(0)
  const nextScrollBehaviorRef = useRef('smooth')
  const fillViewportRef = useRef(false)

  const [draft, setDraft] = useState('')
  const [sendLoading, setSendLoading] = useState(false)
  const [sendError, setSendError] = useState(null)

  // Typing indicators for the currently open channel.
  // Keeps a 10s timeout per user; cleared immediately when that user sends a message.
  const [typingByUserId, setTypingByUserId] = useState({})
  const typingTimersRef = useRef(new Map()) // user_id(string) -> { timeoutId, seq }
  const lastTypingSentAtRef = useRef(0)
  const typingAckStartedRef = useRef(false)

  const [attachment, setAttachment] = useState(null) // { kind: 'file'|'image'|'video', file, previewUrl? }
  const [fileDragOver, setFileDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const bottomRef = useRef(null)
  const messageInputRef = useRef(null)
  const sendButtonRef = useRef(null)
  const messagesListContentRef = useRef(null)
  const messagesRef = useRef([])
  const channelsRef = useRef([])
  const authorLookupInFlightRef = useRef(new Set())

  const [replyingTo, setReplyingTo] = useState(null)
  const [deletedMessageIds, setDeletedMessageIds] = useState(() => new Set())
  const appliedMemberSystemMsgIdsRef = useRef(new Set())

  const messagesById = useMemo(() => {
    const o = {}
    for (const m of messages ?? []) {
      o[String(m.message_id)] = m
    }
    return o
  }, [messages])

  const replyPreviewText = useMemo(() => {
    if (!replyingTo) return null
    const raw = decodeReplyPreviewContent(replyingTo.content)
    return raw ? truncateReplyPreview(raw) : null
  }, [replyingTo])

  const unreadInfo = useMemo(() => {
    const msgs = messages ?? []
    const fromList =
      selectedChannelId != null
        ? (channels ?? []).find((c) => String(c.channel_id) === String(selectedChannelId))
        : null
    const ackId =
      selectedChannel?.last_acked_message_id ?? fromList?.last_acked_message_id ?? null
    const ackTicks = uuidV1Ticks(ackId)
    const ackMs = ackId != null ? uuidV1UnixMs(ackId) : null
    const sinceLabel = ackMs != null ? formatAckedSinceForUnreadBar(ackMs) : null

    const isUnread = (m) => {
      const t = uuidV1Ticks(m.message_id)
      if (t === null) return false
      if (ackTicks === null) return true
      return t > ackTicks
    }

    const unreadCount = msgs.filter(isUnread).length
    if (unreadCount === 0) {
      return { unreadCount: 0, showPlus: false, sepBeforeIndex: null, sinceLabel: null }
    }

    const sepBeforeIndex = msgs.findIndex(isUnread)
    const ackIdx = ackId != null ? msgs.findIndex((m) => String(m.message_id) === String(ackId)) : -1
    const ackInView = ackIdx >= 0
    const allRenderedUnread = unreadCount === msgs.length && msgs.length > 0
    const showPlus =
      unreadCount > 0 &&
      ((allRenderedUnread && hasMoreBefore) || (!ackInView && ackId != null && hasMoreBefore))

    return {
      unreadCount,
      showPlus,
      sepBeforeIndex: sepBeforeIndex >= 0 ? sepBeforeIndex : null,
      sinceLabel,
    }
  }, [messages, selectedChannel?.last_acked_message_id, selectedChannelId, channels, hasMoreBefore])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    channelsRef.current = channels
  }, [channels])

  const applyChannelAckUpdate = useCallback((messageId) => {
    setSelectedChannel((prev) => (prev ? { ...prev, last_acked_message_id: messageId } : prev))
    const cid = selectedChannelIdRef.current
    if (!cid) return
    setChannels((prev) =>
      sortChannelsByLastAcked(
        (prev ?? []).map((c) =>
          String(c.channel_id) === String(cid) ? { ...c, last_acked_message_id: messageId } : c,
        ),
      ),
    )
  }, [])

  const ackLastMessageIfUnread = useCallback(async () => {
    const channel = selectedChannelRef.current
    if (!channel?.channel_id) return
    const msgs = messagesRef.current ?? []
    const last = msgs[msgs.length - 1]
    if (!last?.message_id) return
    const cid = selectedChannelIdRef.current
    const fromList = cid != null ? (channelsRef.current ?? []).find((c) => String(c.channel_id) === String(cid)) : null
    const ackId = channel.last_acked_message_id ?? fromList?.last_acked_message_id ?? null
    const ackTicks = uuidV1Ticks(ackId)
    const lastTicks = uuidV1Ticks(last.message_id)
    if (lastTicks === null) return
    if (ackTicks !== null && lastTicks <= ackTicks) return
    try {
      const res = await messageManager.ackMessageAsRead(channel.channel_id, last.message_id)
      if (!res?.success) return
      applyChannelAckUpdate(last.message_id)
    } catch (e) {
      console.error(e)
    }
  }, [applyChannelAckUpdate])

  const scrollChatToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const root = messagesScrollRef.current
      if (!root || !bottomRef.current) return
      scrollLockUntilRef.current = Date.now() + 400
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
      requestAnimationFrame(() => {
        const r = messagesScrollRef.current
        if (!r) return
        userPinnedToBottomRef.current =
          r.scrollHeight - r.scrollTop - r.clientHeight < SCROLL_BOTTOM_THRESHOLD_PX
      })
    })
  }, [])

  const handleEscapeInChannel = useCallback(() => {
    const channel = selectedChannelRef.current
    const cid = selectedChannelIdRef.current
    if (!channel?.channel_id || !cid) return
    const fromList = (channelsRef.current ?? []).find((c) => String(c.channel_id) === String(cid))
    const ackId = channel.last_acked_message_id ?? fromList?.last_acked_message_id ?? null
    const msgs = messagesRef.current ?? []
    if (countUnreadMessages(msgs, ackId) > 0) {
      void ackLastMessageIfUnread()
    } else {
      scrollChatToBottom()
    }
  }, [ackLastMessageIfUnread, scrollChatToBottom])

  useEffect(() => {
    if (!selectedChannelId || !selectedChannel) return
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return
      if (editingName) return
      const t = e.target
      if (!(t instanceof HTMLElement)) return
      if (t.closest('[role="dialog"]')) return
      const panel = document.querySelector('[data-channel-panel]')
      if (!panel || !panel.contains(t)) return
      if (messageInputRef.current && t === messageInputRef.current) return
      e.preventDefault()
      handleEscapeInChannel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedChannelId, selectedChannel, editingName, handleEscapeInChannel])

  const handleReply = useCallback((m) => {
    setReplyingTo(m)
    messageInputRef.current?.focus?.()
  }, [])

  const handleMessagePatched = useCallback((updated) => {
    if (userPinnedToBottomRef.current) {
      nextScrollBehaviorRef.current = 'smooth'
      shouldAutoScrollRef.current = true
    }
    setMessages((prev) =>
      (prev ?? []).map((row) =>
        String(row.message_id) === String(updated.message_id) ? { ...row, ...updated } : row,
      ),
    )
  }, [])

  const handleMessageDeleted = useCallback((messageId) => {
    const sid = String(messageId)
    setMessages((prev) => (prev ?? []).filter((m) => String(m.message_id) !== sid))
    setDeletedMessageIds((prev) => {
      const next = new Set(prev)
      next.add(sid)
      return next
    })
    setReplyingTo((r) => (r && String(r.message_id) === sid ? null : r))
  }, [])

  const handleRemoteMessageEdit = useCallback((payload) => {
    if (userPinnedToBottomRef.current) {
      nextScrollBehaviorRef.current = 'smooth'
      shouldAutoScrollRef.current = true
    }
    const ts = Math.floor(Date.now() / 1000)
    setMessages((prev) =>
      (prev ?? []).map((row) => {
        if (String(row.message_id) !== String(payload.message_id)) return row
        const next = { ...row, last_edited: ts }
        // Only apply fields present on the event. PATCH often omits `new_content`; sending
        // `content: null` used to wipe decrypted `mime;fileName` and break attachment display.
        if (Object.prototype.hasOwnProperty.call(payload, 'content')) {
          next.content = payload.content
        }
        if (payload.new_message_type !== undefined && payload.new_message_type !== null) {
          next.message_type = payload.new_message_type
        }
        if (payload.attachment_url != null && payload.attachment_url !== '') {
          next.attachment_url = payload.attachment_url
        }
        return next
      }),
    )
  }, [])

  const handleRemoteMessageDelete = useCallback(
    (payload) => {
      handleMessageDeleted(payload.message_id)
    },
    [handleMessageDeleted],
  )

  const applyMemberDeltaFromSystemMessage = useCallback((incomingMessage) => {
    const mid = String(incomingMessage.message_id)
    if (appliedMemberSystemMsgIdsRef.current.has(mid)) return
    appliedMemberSystemMsgIdsRef.current.add(mid)

    const mt = incomingMessage.message_type
    if (mt === SYSTEM_MSG_ADD_MEMBERS) {
      const rawText = decodeSystemMessageContent(incomingMessage.content)
      const segments = parseCommaSeparatedUserIds(rawText ?? '')
      const seen = new Set()
      const unique = []
      for (const s of segments) {
        const canon = canonicalChannelMemberId(s)
        if (!canon) continue
        const k = uuidHexKey(canon)
        if (seen.has(k)) continue
        seen.add(k)
        unique.push(canon)
      }
      if (unique.length === 0) return

      void (async () => {
        try {
          const users = await userManager.fetchUsersBulk(unique)
          setSelectedChannel((prev) => {
            if (!prev) return prev
            const prevMembers = prev.channel_members ?? []
            const byHex = new Set(prevMembers.map((x) => uuidHexKey(x)))
            const mergedIds = [...prevMembers]
            for (const id of unique) {
              const k = uuidHexKey(id)
              if (!byHex.has(k)) {
                byHex.add(k)
                mergedIds.push(id)
              }
            }
            return { ...prev, channel_members: mergedIds }
          })
          setSelectedMembers((prev) => {
            const existingById = new Map((prev ?? []).map((m) => [uuidHexKey(m.user_id), m]))
            for (const u of users ?? []) {
              if (!u?.user_id) continue
              const k = uuidHexKey(u.user_id)
              existingById.set(k, {
                user_id: u.user_id,
                username: u?.username ?? '',
                icon_url: u ? getAvatarUrl(u) : null,
              })
            }
            const merged = Array.from(existingById.values())
            merged.sort((a, b) =>
              (a.username || '').localeCompare(b.username || '', undefined, { sensitivity: 'base' }),
            )
            return merged
          })
        } catch {
          setSelectedChannel((prev) => {
            if (!prev) return prev
            const prevMembers = prev.channel_members ?? []
            const byHex = new Set(prevMembers.map((x) => uuidHexKey(x)))
            const mergedIds = [...prevMembers]
            for (const id of unique) {
              const k = uuidHexKey(id)
              if (!byHex.has(k)) {
                byHex.add(k)
                mergedIds.push(id)
              }
            }
            return { ...prev, channel_members: mergedIds }
          })
        }
      })()
      return
    }

    if (mt === SYSTEM_MSG_REMOVE_MEMBER) {
      const rawText = decodeSystemMessageContent(incomingMessage.content)
      const uid = rawText?.trim()
      if (!uid) return
      const key = uuidHexKey(uid)
      setSelectedChannel((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          channel_members: (prev.channel_members ?? []).filter((id) => uuidHexKey(id) !== key),
        }
      })
      setSelectedMembers((prev) => prev.filter((m) => uuidHexKey(m.user_id) !== key))
    }
  }, [])

  const handleIncomingMessage = useCallback((incomingMessage) => {
    if (!incomingMessage?.message_id) return

    // Clear typing indicator when the sender posts a message.
    const authorId = incomingMessage?.author_id
    const channelId = incomingMessage?.channel_id
    const activeChannelId = selectedChannelIdRef.current
    if (authorId && channelId && activeChannelId && String(channelId) === String(activeChannelId)) {
      const uid = String(authorId)
      const existing = typingTimersRef.current.get(uid)
      if (existing?.timeoutId) clearTimeout(existing.timeoutId)
      typingTimersRef.current.delete(uid)
      setTypingByUserId((prev) => {
        if (!prev || prev[uid] == null) return prev
        const next = { ...prev }
        delete next[uid]
        return next
      })
    }

    let shouldApplyMemberDelta = false
    setMessages((prev) => {
      const prevList = prev ?? []
      if (prevList.some((m) => String(m.message_id) === String(incomingMessage.message_id))) return prevList
      if (userPinnedToBottomRef.current) {
        nextScrollBehaviorRef.current = 'smooth'
        shouldAutoScrollRef.current = true
      }
      const mt = incomingMessage.message_type
      const ch = incomingMessage.channel_id
      if (
        (mt === SYSTEM_MSG_ADD_MEMBERS || mt === SYSTEM_MSG_REMOVE_MEMBER) &&
        activeChannelId &&
        ch != null &&
        String(ch) === String(activeChannelId)
      ) {
        shouldApplyMemberDelta = true
      }
      return [...prevList, incomingMessage]
    })
    if (shouldApplyMemberDelta) {
      queueMicrotask(() => applyMemberDeltaFromSystemMessage(incomingMessage))
    }
  }, [applyMemberDeltaFromSystemMessage])

  const handleUserTyping = useCallback(
    (channelId, userId) => {
      if (!channelId || userId == null) return
      const activeChannelId = selectedChannelIdRef.current
      if (!activeChannelId || String(channelId) !== String(activeChannelId)) return

      const uid = String(userId)
      if (currentUserId != null && uid === String(currentUserId)) return

      const seq = Date.now()

      setTypingByUserId((prev) => ({ ...(prev ?? {}), [uid]: seq }))

      const existing = typingTimersRef.current.get(uid)
      if (existing?.timeoutId) clearTimeout(existing.timeoutId)

      const timeoutId = setTimeout(() => {
        const current = typingTimersRef.current.get(uid)
        if (!current || current.seq !== seq) return
        typingTimersRef.current.delete(uid)
        setTypingByUserId((prev) => {
          if (!prev || prev[uid] !== seq) return prev
          const next = { ...prev }
          delete next[uid]
          return next
        })
      }, 10_000)

      typingTimersRef.current.set(uid, { timeoutId, seq })
    },
    [currentUserId],
  )

  function formatRelativeFromSeconds(epochSeconds) {
    if (!epochSeconds) return ''
    const nowMs = Date.now()
    const thenMs = epochSeconds * 1000
    const diffMs = nowMs - thenMs
    const diffSec = Math.round(diffMs / 1000)

    if (diffSec < 5) return 'Just now'
    if (diffSec < 60) return `${diffSec}s ago`
    const diffMin = Math.round(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.round(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.round(diffHr / 24)
    return `${diffDay}d ago`
  }

  const clearAttachment = useCallback(() => {
    setAttachment((prev) => {
      if (prev?.previewUrl) {
        try {
          URL.revokeObjectURL(prev.previewUrl)
        } catch {
          // Ignore; best-effort cleanup
        }
      }
      return null
    })
  }, [])

  const setAttachmentFromFile = useCallback((file) => {
    if (!file) return
    setAttachment((prev) => {
      if (prev?.previewUrl) {
        try {
          URL.revokeObjectURL(prev.previewUrl)
        } catch {
          // Ignore
        }
      }
      const kind = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : 'file'
      const previewUrl =
        kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : undefined
      return { kind, file, previewUrl }
    })
  }, [])

  const handleChannelDragEnter = useCallback(
    (e) => {
      if (!selectedChannel || sendLoading) return
      if (![...e.dataTransfer.types].includes('Files')) return
      e.preventDefault()
      setFileDragOver(true)
    },
    [selectedChannel, sendLoading],
  )

  const handleChannelDragOver = useCallback(
    (e) => {
      if (!selectedChannel || sendLoading) return
      if (![...e.dataTransfer.types].includes('Files')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setFileDragOver(true)
    },
    [selectedChannel, sendLoading],
  )

  const handleChannelDragLeave = useCallback((e) => {
    const el = e.currentTarget
    const next = e.relatedTarget
    if (next && el.contains(next)) return
    setFileDragOver(false)
  }, [])

  const handleChannelDrop = useCallback(
    (e) => {
      e.preventDefault()
      setFileDragOver(false)
      if (!selectedChannel || sendLoading) return
      const file = e.dataTransfer.files?.[0]
      if (!file) return
      setAttachmentFromFile(file)
      requestAnimationFrame(() => {
        sendButtonRef.current?.focus?.()
      })
    },
    [selectedChannel, sendLoading, setAttachmentFromFile],
  )

  const scrollToBottomIfPinned = useCallback(() => {
    requestAnimationFrame(() => {
      if (!userPinnedToBottomRef.current) return
      const root = messagesScrollRef.current
      if (!root || !bottomRef.current) return
      scrollLockUntilRef.current = Date.now() + 300
      bottomRef.current.scrollIntoView({ behavior: 'auto', block: 'end' })
      userPinnedToBottomRef.current =
        root.scrollHeight - root.scrollTop - root.clientHeight < SCROLL_BOTTOM_THRESHOLD_PX
    })
  }, [])

  const oldestMessageId = messages[0]?.message_id
  const lastMessageId = messages[messages.length - 1]?.message_id

  const loadMessages = useCallback(async () => {
    const channel = selectedChannelRef.current
    if (!channel) return
    setMessagesLoading(true)
    setMessagesError(null)
    try {
      const res = await messageManager.getMessages(channel, null, PAGE_SIZE)
      if (!res?.success) {
        setMessagesError(res?.error?.message ?? 'Could not load messages')
        setMessages([])
        return
      }

      const raw = res?.data?.messages ?? []
      const settled = await Promise.allSettled(raw)
      const ok = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value)
      setMessages(ok)

      // If we got a full page, optimistically assume there's more older history.
      setHasMoreBefore(ok.length === PAGE_SIZE && ok.length > 0)
      nextScrollBehaviorRef.current = 'auto'
      shouldAutoScrollRef.current = true
      userPinnedToBottomRef.current = true
    } catch (e) {
      console.error(e)
      setMessagesError(e?.message ?? 'Could not load messages')
      setMessages([])
    } finally {
      setMessagesLoading(false)
    }
  }, [PAGE_SIZE])

  useEffect(() => {
    selectedChannelRef.current = selectedChannel
  }, [selectedChannel])

  useEffect(() => {
    if (!selectedChannelId) {
      lastLoadedChannelIdRef.current = null
    }
    // Clear immediately on channel switch; load happens once the channel is ready.
    setMessages([])
    setMessagesError(null)
    setHasMoreBefore(true)
    setOlderMessagesLoading(false)
    setAuthorProfilesById({})
    authorLookupInFlightRef.current.clear()
    shouldAutoScrollRef.current = false
    userPinnedToBottomRef.current = true
    setReplyingTo(null)
    setDeletedMessageIds(new Set())
    appliedMemberSystemMsgIdsRef.current.clear()
    typingAckStartedRef.current = false
  }, [selectedChannelId])

  useEffect(() => {
    const knownMemberIds = new Set((selectedMembers ?? []).map((m) => String(m.user_id)))
    const missingIds = []

    for (const m of messages ?? []) {
      const authorId = m?.author_id
      if (authorId == null) continue
      const key = String(authorId)
      if (knownMemberIds.has(key)) continue
      if (authorProfilesById[key]) continue
      if (authorLookupInFlightRef.current.has(key)) continue
      missingIds.push(authorId)
      authorLookupInFlightRef.current.add(key)
    }

    if (missingIds.length === 0) return

    let cancelled = false
    ;(async () => {
      try {
        const users = await userManager.fetchUsersBulk(missingIds)
        if (cancelled || !users?.length) return
        setAuthorProfilesById((prev) => {
          const next = { ...(prev ?? {}) }
          for (const user of users) {
            if (!user?.user_id) continue
            const key = String(user.user_id)
            next[key] = {
              user_id: user.user_id,
              username: user?.username ?? '',
              icon_url: getAvatarUrl(user),
            }
          }
          return next
        })
      } catch {
        // Best-effort fallback; keep rendering with existing data.
      } finally {
        for (const id of missingIds) {
          authorLookupInFlightRef.current.delete(String(id))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [messages, selectedMembers, authorProfilesById])

  useEffect(() => {
    if (!selectedChannelId) return
    if (!selectedChannel?.shared_key) return
    if (lastLoadedChannelIdRef.current === selectedChannelId) return

    lastLoadedChannelIdRef.current = selectedChannelId
    void loadMessages()
  }, [selectedChannelId, selectedChannel?.shared_key, loadMessages])

  const loadOlderMessages = useCallback(async () => {
    if (olderMessagesLoading) return
    if (!hasMoreBefore) return
    if (!selectedChannelRef.current) return
    if (!oldestMessageId) return

    const channel = selectedChannelRef.current
    const before = oldestMessageId

    setOlderMessagesLoading(true)

    const el = messagesScrollRef.current
    const prevScrollTop = el?.scrollTop ?? null
    const prevScrollHeight = el?.scrollHeight ?? null

    try {
      const res = await messageManager.getMessages(channel, before, PAGE_SIZE)
      if (!res?.success) {
        setHasMoreBefore(false)
        return
      }

      const raw = res?.data?.messages ?? []
      const settled = await Promise.allSettled(raw)
      const ok = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value)

      setMessages((prev) => {
        const prevList = prev ?? []
        const existing = new Set(prevList.map((m) => m.message_id))
        const filtered = ok.filter((m) => !existing.has(m.message_id))
        return [...filtered, ...prevList]
      })

      setHasMoreBefore(ok.length === PAGE_SIZE && ok.length > 0)
    } catch (e) {
      console.error(e)
      setHasMoreBefore(false)
    } finally {
      setOlderMessagesLoading(false)
      // Keep the viewport anchored when prepending older messages.
      requestAnimationFrame(() => {
        const root = messagesScrollRef.current
        if (!root) return
        if (prevScrollTop == null || prevScrollHeight == null) return
        const nextScrollHeight = root.scrollHeight
        root.scrollTop = prevScrollTop + (nextScrollHeight - prevScrollHeight)
      })
    }
  }, [PAGE_SIZE, hasMoreBefore, oldestMessageId, olderMessagesLoading])

  const handleMessagesScroll = useCallback(() => {
    const root = messagesScrollRef.current
    if (!root) return
    // While we are programmatically scrolling (initial open, append, etc.), ignore scroll events —
    // otherwise intermediate positions (e.g. scrollTop 0 before scrollIntoView) clear "pinned to bottom".
    if (Date.now() < scrollLockUntilRef.current) return
    if (shouldAutoScrollRef.current) return
    userPinnedToBottomRef.current =
      root.scrollHeight - root.scrollTop - root.clientHeight < SCROLL_BOTTOM_THRESHOLD_PX

    // Load older history only when user scrolls near the top.
    if (messagesLoading) return
    if (olderMessagesLoading) return
    if (root.scrollHeight <= root.clientHeight + 1) return
    if (root.scrollTop > 80) return
    void loadOlderMessages()
  }, [loadOlderMessages, messagesLoading, olderMessagesLoading])

  // Keep `messageManager` in sync with the currently selected channel so it can decrypt
  // incoming gateway events and emit only relevant messages.
  useEffect(() => {
    messageManager.setActiveChannel(selectedChannelRef.current)
    return () => {
      messageManager.setActiveChannel(null)
    }
  }, [selectedChannelId, selectedChannel?.shared_key])

  useEffect(() => {
    messageManager.setOnMessageCreate(handleIncomingMessage)
    return () => {
      messageManager.setOnMessageCreate(null)
    }
  }, [handleIncomingMessage])

  useEffect(() => {
    messageManager.setOnMessageEdit(handleRemoteMessageEdit)
    return () => {
      messageManager.setOnMessageEdit(null)
    }
  }, [handleRemoteMessageEdit])

  useEffect(() => {
    messageManager.setOnMessageDelete(handleRemoteMessageDelete)
    return () => {
      messageManager.setOnMessageDelete(null)
    }
  }, [handleRemoteMessageDelete])

  useEffect(() => {
    channelManager.setOnUserTyping(handleUserTyping)
    return () => channelManager.setOnUserTyping(null)
  }, [handleUserTyping])

  // Focus the message input when a channel is opened.
  useEffect(() => {
    if (!selectedChannelId || !selectedChannel?.shared_key) return
    // Wait a tick so the input is mounted and enabled.
    const t = setTimeout(() => {
      messageInputRef.current?.focus?.()
    }, 0)
    return () => clearTimeout(t)
  }, [selectedChannelId, selectedChannel?.shared_key])

  useLayoutEffect(() => {
    if (!bottomRef.current) return
    if (messagesLoading) return
    if (!shouldAutoScrollRef.current) return

    // Prevent `onScroll` from firing pagination while the browser is still applying
    // the programmatic scroll to the bottom.
    scrollLockUntilRef.current = Date.now() + 400
    fillViewportRef.current = true

    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: nextScrollBehaviorRef.current, block: 'end' })
      // Second frame: media that laid out after decrypt can grow `scrollHeight`; snap again if needed.
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
        shouldAutoScrollRef.current = false
        const root = messagesScrollRef.current
        if (root) {
          userPinnedToBottomRef.current =
            root.scrollHeight - root.scrollTop - root.clientHeight < SCROLL_BOTTOM_THRESHOLD_PX
        }
      })
    })
  }, [messages, messagesLoading, lastMessageId, hasMoreBefore, olderMessagesLoading, loadOlderMessages])

  // When images/videos finish decoding and grow the thread, keep the view pinned if the user was at bottom.
  useEffect(() => {
    const list = messagesListContentRef.current
    if (!list) return

    let raf = null
    const scheduleScroll = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        raf = null
        scrollToBottomIfPinned()
      })
    }

    const ro = new ResizeObserver(scheduleScroll)
    ro.observe(list)
    return () => {
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [scrollToBottomIfPinned, messages.length, selectedChannelId, messagesLoading, messagesError])

  // If the screen is tall, keep fetching older pages until we actually fill the viewport.
  // We stop as soon as we either run out of history or the user scrolls away from the bottom.
  useEffect(() => {
    if (!fillViewportRef.current) return
    if (!selectedChannelId) return
    if (messagesLoading) return
    if (olderMessagesLoading) return

    const root = messagesScrollRef.current
    if (!root) return

    const remainingToBottom = root.scrollHeight - root.scrollTop - root.clientHeight
    const atBottom = remainingToBottom < 6
    if (!atBottom) {
      fillViewportRef.current = false
      return
    }

    if (!hasMoreBefore) {
      fillViewportRef.current = false
      return
    }

    // No scrollbar / not enough content to fill viewport.
    if (root.scrollHeight <= root.clientHeight + 1) {
      void loadOlderMessages()
    } else {
      fillViewportRef.current = false
    }
  }, [selectedChannelId, messagesLoading, olderMessagesLoading, hasMoreBefore, loadOlderMessages, messages.length])

  // No polling / realtime updates in this UI.

  const loadChannels = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await channelManager.getChannels()
      if (!res?.success) {
        setError(res?.error?.message ?? 'Could not load channels')
        setChannels([])
        return
      }
      const list = sortChannelsByLastAcked(res?.data?.channels ?? [])
      setChannels(list)
    } catch (e) {
      console.error(e);
      setError(e?.message ?? 'Could not load channels')
      setChannels([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (cancelled) return
      await loadChannels()
    })()
    return () => {
      cancelled = true
    }
  }, [loadChannels])

  useEffect(() => {
    channelManager.setOnChannelUpsert((channel, isNew) => {
      setChannels((prev) => {
        const list = prev ?? []
        if (isNew) {
          if (list.some((c) => c.channel_id === channel.channel_id)) return list
          return sortChannelsByLastAcked([...list, channel])
        }
        const next = list.map((c) => (c.channel_id === channel.channel_id ? { ...c, ...channel } : c))
        return sortChannelsByLastAcked(next)
      })

      // If the currently open channel is updated by the gateway, ensure we
      // keep the existing decrypted `shared_key` so messaging still works.
      if (selectedChannelIdRef.current && channel?.channel_id === selectedChannelIdRef.current) {
        setSelectedChannel((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            ...channel,
            shared_key: prev.shared_key,
            encrypted_channel_key: prev.encrypted_channel_key ?? channel.encrypted_channel_key,
            last_acked_message_id: channel.last_acked_message_id ?? prev.last_acked_message_id,
          }
        })
      }
    })
    return () => channelManager.setOnChannelUpsert(null)
  }, [])

  useEffect(() => {
    selectedChannelIdRef.current = selectedChannelId
  }, [selectedChannelId])

  useEffect(() => {
    // Reset typing indicators when switching channels.
    setTypingByUserId({})
    for (const { timeoutId } of typingTimersRef.current.values()) clearTimeout(timeoutId)
    typingTimersRef.current.clear()
    lastTypingSentAtRef.current = 0
  }, [selectedChannelId])

  useEffect(() => {
    // Unmount cleanup.
    const timers = typingTimersRef.current
    return () => {
      for (const { timeoutId } of timers.values()) clearTimeout(timeoutId)
      timers.clear()
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 768px)')
    if (!media) {
      setIsDesktop(false)
      return
    }
    const update = () => setIsDesktop(!!media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  const getChannelIconSrc = useCallback((ch) => {
    if (ch?.channel_icon) {
      return userContentUrl(ch.channel_id, ch.channel_icon, 'webp')
    }
    return getDefaultChannelUrl(ch.channel_id)
  }, [])

  const selectedChannelName = selectedChannel?.channel_name ?? ''
  useEffect(() => {
    if (!isDesktop) return
    if (!selectedChannelName) {
      document.title = 'az7 | Messages'
      return
    }
    document.title = `az7 | ${selectedChannelName}`
    return () => {
      document.title = 'az7 | Messages'
    }
  }, [isDesktop, selectedChannelName])

  const selectedChannelIconSrc = useMemo(() => {
    if (!selectedChannelId) return null
    const ch = selectedChannel || channels.find((c) => c.channel_id === selectedChannelId)
    if (!ch) return null
    return getChannelIconSrc(ch)
  }, [channels, getChannelIconSrc, selectedChannel, selectedChannelId])

  const canManageMembers = useMemo(() => {
    if (!selectedChannel) return false
    // REGULAR = 0 (members can manage), RESTRICTED_EXPANSION = 1 (restricted)
    const type = selectedChannel.channel_type
    if (typeof type === 'number') {
      return type !== 1
    }
    // Default to allowing management for legacy channels without a type
    return true
  }, [selectedChannel])

  const typingDisplay = useMemo(() => {
    const typingIds = Object.keys(typingByUserId ?? {}).filter((uid) => typingByUserId[uid] != null)
    const visibleTypingIds =
      currentUserId != null ? typingIds.filter((uid) => uid !== String(currentUserId)) : typingIds

    if (visibleTypingIds.length === 0) return null

    const names = visibleTypingIds.map((uid) => {
      const profile = selectedMembers.find((m) => String(m.user_id) === uid)
      return profile?.username ? `@${profile.username}` : `@${uid}`
    })

    const shown = names.slice(0, 3)
    const remaining = names.length - shown.length

    if (names.length === 1) return `${shown[0]} is typing...`
    return `${shown.join(', ')}${remaining > 0 ? ` +${remaining} more` : ''} are typing...`
  }, [typingByUserId, selectedMembers, currentUserId])

  const selectChannel = useCallback(
    async (channelId) => {
      if (!isDesktop) return
      setSelectedChannelId(channelId)
      setSelectedChannel(null)
      setSelectedMembers([])
      setChannelLoading(true)
      setChannelError(null)
      try {
        const channelFromList = channels.find((c) => c.channel_id === channelId)
        const encryptedChannelKey = channelFromList?.encrypted_channel_key
        const res = await channelManager.getChannel(channelId, encryptedChannelKey)
        if (!res?.success) {
          setChannelError(res?.error?.message ?? 'Could not load channel')
          return
        }
        const raw = res?.data
        const channel = raw
          ? {
              ...raw,
              last_acked_message_id:
                raw.last_acked_message_id ?? channelFromList?.last_acked_message_id ?? null,
            }
          : null
        setSelectedChannel(channel)
        setEditName(channel?.channel_name ?? '')

        const memberIds = channel?.channel_members ?? []
        if (memberIds.length > 0) {
          const users = await userManager.fetchUsersBulk(memberIds)
          const profiles = (users ?? []).map((u) => ({
            user_id: u.user_id,
            username: u?.username ?? '',
            icon_url: u ? getAvatarUrl(u) : null,
          }))
          profiles.sort((a, b) =>
            (a.username || '').localeCompare(b.username || '', undefined, { sensitivity: 'base' }),
          )
          setSelectedMembers(profiles)
        }
      } catch (e) {
        console.error(e);
        setChannelError(e?.message ?? 'Could not load channel')
      } finally {
        setChannelLoading(false)
      }
    },
    [isDesktop, channels],
  )

  const handleMemberRemoved = useCallback((userId) => {
    setSelectedMembers((prev) => prev.filter((m) => m.user_id !== userId))
    setSelectedChannel((prev) =>
      prev
        ? {
            ...prev,
            channel_members: (prev.channel_members ?? []).filter((id) => id !== userId),
          }
        : prev,
    )
  }, [])

  const handleStartEditName = () => {
    if (!selectedChannel) return
    setEditName(selectedChannel.channel_name ?? '')
    setEditNameError(null)
    setEditingName(true)
  }

  const handleCancelEditName = () => {
    setEditingName(false)
    setEditName(selectedChannel?.channel_name ?? '')
    setEditNameError(null)
  }

  const handleSubmitEditName = async () => {
    if (!selectedChannel) return
    const trimmed = (editName ?? '').trim()
    if (!trimmed) {
      setEditNameError('Channel name cannot be empty')
      return
    }
    setEditNameLoading(true)
    setEditNameError(null)
    try {
      const res = await channelManager.editChannel(selectedChannel, trimmed)
      if (!res?.success) {
        setEditNameError(res?.error?.message ?? 'Could not update channel name')
        return
      }
      const updated = res?.data
      setSelectedChannel((prev) =>
        prev && updated
          ? {
              ...updated,
              shared_key: updated.shared_key ?? prev.shared_key,
              last_acked_message_id: updated.last_acked_message_id ?? prev.last_acked_message_id,
            }
          : updated,
      )
      setChannels((prev) =>
        (prev ?? []).map((ch) =>
          ch.channel_id === updated.channel_id
            ? {
                ...updated,
                last_acked_message_id: updated.last_acked_message_id ?? ch.last_acked_message_id,
              }
            : ch,
        ),
      )
      setEditingName(false)
    } catch (e) {
      console.error(e);
      setEditNameError(e?.message ?? 'Could not update channel name')
    } finally {
      setEditNameLoading(false)
    }
  }

  const handleLeaveChannel = async (channelId) => {
    if (!channelId) return
    setLeaveLoading(true)
    setLeaveError(null)
    try {
      const session = getCurrentSession()
      const currentUserId = session?.user_id
      if (!currentUserId) {
        setLeaveError('Could not determine current user')
        return
      }

      await channelManager.removeChannelMember(channelId, currentUserId)

      setChannels((prev) => (prev ?? []).filter((ch) => ch.channel_id !== channelId))

      if (channelId === selectedChannelId) {
        setSelectedChannelId(null)
        setSelectedChannel(null)
        setSelectedMembers([])
        setMemberMenu(null)
        setAddingMembers(false)
        setEditingName(false)
        setEditName('')
        setEditNameError(null)

        setMessages([])
        setMessagesLoading(false)
        setMessagesError(null)
        setHasMoreBefore(true)
        setOlderMessagesLoading(false)
        shouldAutoScrollRef.current = false
        setDraft('')
        setSendError(null)
        setSendLoading(false)
        setReplyingTo(null)
        setDeletedMessageIds(new Set())
        clearAttachment()
      }
      setLeaveConfirm(null)
    } catch (e) {
      console.error(e);
      setLeaveError(e?.message ?? 'Could not leave channel')
    } finally {
      setLeaveLoading(false)
    }
  }

  return (
    <PageContainer>
      <main className="min-h-0 flex-1 md:flex md:gap-3 md:overflow-hidden">
        <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden border-b border-[color:var(--card-border)] pb-3 md:w-64 md:flex-none md:border-b-0 md:pb-0 md:overflow-y-auto lg:w-80">
          <div className="flex items-center justify-between gap-2 px-1 md:px-0">
            <h1 className="text-lg font-bold text-[color:var(--text-primary)]">Messages</h1>
            <Button type="button" size="sm" className="text-xs" onClick={() => setCreateOpen(true)}>
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                add
              </span>
              Create
            </Button>
          </div>
          {loading && (
            <>
              <Card className="h-18 skeleton-pulse" />
              <Card className="h-18 skeleton-pulse" />
              <Card className="h-18 skeleton-pulse" />
              <Card className="h-18 skeleton-pulse" />
            </>
          )}

          {!loading && error && (
            <Card className="p-4">
              <p className="text-sm text-[color:var(--text-muted)]" role="alert">
                {error}
              </p>
              <div className="mt-3">
                <Button type="button" variant="ghost" size="sm" onClick={loadChannels}>
                  Retry
                </Button>
              </div>
            </Card>
          )}

          {!loading && !error && channels.length === 0 && (
            <Card className="p-4">
              <p className="text-sm text-[color:var(--text-muted)]">
                No channels yet. Create one to start chatting.
              </p>
            </Card>
          )}

          {!loading && !error && channels.length > 0 && (
            <ul className="space-y-2 overflow-x-hidden" role="list" aria-label="Channels">
              {channels.map((ch) => {
                const isSelected = isDesktop && selectedChannelId === ch.channel_id
                const iconSrc = getChannelIconSrc(ch)
                return (
                  <li key={ch.channel_id} className="min-w-0">
                    <ClickableRow
                      type="button"
                      className={`w-full overflow-hidden px-0 py-0 hover:bg-transparent ${isDesktop ? '' : 'cursor-default'}`}
                      onClick={() => selectChannel(ch.channel_id)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setChannelMenu({
                          channelId: ch.channel_id,
                          x: e.clientX,
                          y: e.clientY,
                          name: ch.channel_name,
                        })
                      }}
                      disabled={!isDesktop}
                    >
                      <Card
                        className={`w-full overflow-hidden px-4 py-3 transition-colors hover:bg-[color:var(--tab-active-bg)]/60 ${isSelected ? 'border-[color:var(--accent)]' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={iconSrc}
                            alt=""
                            className="h-10 w-10 flex-shrink-0 rounded-full border border-[color:var(--card-border)] object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <div
                              className="truncate text-sm font-semibold text-[color:var(--text-primary)]"
                              title={ch.channel_name}
                            >
                              {ch.channel_name}
                            </div>
                            <div className="mt-0.5 text-xs text-[color:var(--text-muted)]">
                              {(() => {
                                const ms = uuidV1UnixMs(ch.last_acked_message_id)
                                return ms != null ? `Last read: ${formatRelativeFromSeconds(Math.floor(ms / 1000))}` : ''
                              })()}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </ClickableRow>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="hidden min-h-0 flex-1 md:flex md:flex-col md:overflow-hidden">
          {!selectedChannelId && (
            <Card className="flex h-full items-center justify-center p-6">
              <p className="text-sm text-[color:var(--text-muted)]">Select a channel to open it.</p>
            </Card>
          )}

          {selectedChannelId && (
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden" data-channel-panel tabIndex={-1}>
              <div className="flex items-center gap-3 border-b border-[color:var(--card-border)] px-4 py-3">
                {selectedChannelIconSrc ? (
                  <img
                    src={selectedChannelIconSrc}
                    alt=""
                    className="h-10 w-10 flex-shrink-0 rounded-full border border-[color:var(--card-border)] object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 flex-shrink-0 rounded-full border border-[color:var(--card-border)] bg-[color:var(--card-bg)]" />
                )}
                <div className="min-w-0 flex-1">
                  {!editingName && (
                    <Button
                      type="button"
                      variant="text"
                      size="sm"
                      className="group w-full justify-start truncate px-0 py-0 text-left text-base font-bold hover:bg-transparent"
                      onClick={handleStartEditName}
                    >
                      <span className="truncate">
                        {selectedChannel?.channel_name ?? '…'}
                      </span>
                      <span className="flex-shrink-0 text-[color:var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="material-symbols-outlined text-sm align-middle" aria-hidden>
                          edit
                        </span>
                        <span className="sr-only">Edit channel name</span>
                      </span>
                    </Button>
                  )}
                  {editingName && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="min-w-0 flex-1 rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-2 py-1 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
                        value={editName}
                        maxLength={64}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={editNameLoading}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleSubmitEditName()
                          } else if (e.key === 'Escape') {
                            e.preventDefault()
                            handleCancelEditName()
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="iconSm"
                        onClick={handleSubmitEditName}
                        disabled={editNameLoading}
                        aria-label="Save channel name"
                      >
                        <span className="material-symbols-outlined text-base" aria-hidden>
                          check
                        </span>
                      </Button>
                      <Button
                        type="button"
                        variant="text"
                        size="iconSm"
                        className="text-[color:var(--text-muted)]"
                        onClick={handleCancelEditName}
                        disabled={editNameLoading}
                        aria-label="Cancel edit"
                      >
                        <span className="material-symbols-outlined text-base" aria-hidden>
                          close
                        </span>
                      </Button>
                    </div>
                  )}
                  {editNameError && (
                    <div className="mt-0.5 text-xs text-red-500" role="alert">
                      {editNameError}
                    </div>
                  )}
                  <div className="mt-0.5 text-xs text-[color:var(--text-muted)]">
                    {selectedChannelId}
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
                <div
                  className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden${fileDragOver ? ' ring-2 ring-inset ring-[color:var(--accent)]' : ''}`}
                  onDragEnter={handleChannelDragEnter}
                  onDragOver={handleChannelDragOver}
                  onDragLeave={handleChannelDragLeave}
                  onDrop={handleChannelDrop}
                >
                  {fileDragOver && selectedChannel ? (
                    <div
                      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-[color:var(--card-bg)]/40 backdrop-blur-[2px]"
                      aria-hidden
                    >
                      <div className="rounded-button border border-dashed border-[color:var(--accent)] bg-[color:var(--card-bg)]/95 px-4 py-3 text-sm font-medium text-[color:var(--text-primary)] shadow-card">
                        Drop file to attach
                      </div>
                    </div>
                  ) : null}
                  <div
                    ref={messagesScrollRef}
                    onScroll={handleMessagesScroll}
                    className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4"
                  >
                    {messagesLoading && (
                      <div className="space-y-2" aria-label="Loading messages">
                        {Array.from({ length: 6 }, (_, i) => (
                          <Card key={i} className="h-14 skeleton-pulse" />
                        ))}
                      </div>
                    )}

                    {!messagesLoading && messagesError && (
                      <Card className="p-4">
                        <p className="text-sm text-[color:var(--text-muted)]" role="alert">
                          {messagesError}
                        </p>
                        <div className="mt-3">
                          <Button type="button" variant="ghost" size="sm" onClick={() => void loadMessages()}>
                            Retry
                          </Button>
                        </div>
                      </Card>
                    )}

                    {!messagesLoading && !messagesError && messages.length === 0 && (
                      <div className="flex h-full items-center justify-center py-10">
                        <p className="text-sm text-[color:var(--text-muted)]">No messages yet.</p>
                      </div>
                    )}

                    {!messagesLoading && !messagesError && messages.length > 0 && (
                      <ul
                        ref={messagesListContentRef}
                        className="w-full min-w-0 max-w-full space-y-2"
                        role="list"
                        aria-label="Messages"
                      >
                        {!sendLoading && unreadInfo.unreadCount > 0 && (
                          <li className="sticky top-0 z-10 list-none py-1">
                            <div
                              className="rounded-button border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3 py-1.5 text-center text-xs font-medium text-[color:var(--text-primary)]"
                              role="status"
                              aria-live="polite"
                            >
                              {(() => {
                                const n = unreadInfo.unreadCount
                                const plus = unreadInfo.showPlus
                                const since = unreadInfo.sinceLabel
                                const countPart = plus ? `${n}+` : String(n)
                                const noun = !plus && n === 1 ? 'message' : 'messages'
                                const sincePart = since ? ` since ${since}` : ''
                                return `${countPart} ${noun} unread${sincePart}`
                              })()}
                            </div>
                          </li>
                        )}
                        {messages.map((m, i) => {
                          const sep =
                            unreadInfo.sepBeforeIndex === i ? (
                              <li
                                key={`unread-sep-${String(m.message_id)}`}
                                className="flex w-full list-none justify-center py-1"
                                role="separator"
                                aria-label="Unread messages below"
                              >
                                <span className="rounded-full border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
                                  Unread
                                </span>
                              </li>
                            ) : null

                          if (!isUserMessageType(m.message_type)) {
                            return (
                              <Fragment key={String(m.message_id)}>
                                {sep}
                                <SystemMessage
                                  message={m}
                                  selectedMembers={selectedMembers}
                                  authorProfilesById={authorProfilesById}
                                />
                              </Fragment>
                            )
                          }
                          const author =
                            selectedMembers.find((u) => u.user_id === m.author_id) ??
                            authorProfilesById[String(m.author_id)] ??
                            null
                          const isOwn = currentUserId && m.author_id === currentUserId
                          return (
                            <Fragment key={String(m.message_id)}>
                              {sep}
                              <Message
                                message={m}
                                author={author}
                                isOwn={!!isOwn}
                                channel={selectedChannel}
                                currentUserId={currentUserId}
                                messagesById={messagesById}
                                deletedMessageIds={deletedMessageIds}
                                selectedMembers={selectedMembers}
                                authorProfilesById={authorProfilesById}
                                onReply={handleReply}
                                onMessagePatched={handleMessagePatched}
                                onMessageDeleted={handleMessageDeleted}
                                onAttachmentDisplayReady={scrollToBottomIfPinned}
                              />
                            </Fragment>
                          )
                        })}
                        <li ref={bottomRef} className="h-0 list-none" />
                      </ul>
                    )}
                  </div>

                  {!messagesLoading && !messagesError && typingDisplay && (
                    <div className="px-3 pb-2 text-xs text-[color:var(--text-muted)]" aria-live="polite">
                      {typingDisplay}
                    </div>
                  )}

                  <form
                    className="border-t border-[color:var(--card-border)] p-3"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!selectedChannel || sendLoading) return

                      setSendError(null)
                      const trimmed = (draft ?? '').trim()
                      const hasAttachment = Boolean(attachment?.file)
                      if (!trimmed && !hasAttachment) return

                      const replyId = replyingTo?.message_id ?? null

                      const appendDecryptedMessage = async (created) => {
                        if (created?.message_id) {
                          // Keep local read state in sync without an extra ack request.
                          applyChannelAckUpdate(created.message_id)
                        }
                        let decryptedContent = created?.content ?? null
                        try {
                          if (decryptedContent && selectedChannel?.shared_key) {
                            decryptedContent = await decryptB64Sym(
                              decryptedContent,
                              selectedChannel.shared_key,
                            )
                          }
                        } catch {
                          decryptedContent = null
                        }
                        const newMessage = { ...created, content: decryptedContent }
                        setMessages((prev) => {
                          const prevList = prev ?? []
                          if (prevList.some((m) => String(m.message_id) === String(newMessage.message_id))) {
                            return prevList
                          }
                          nextScrollBehaviorRef.current = 'smooth'
                          shouldAutoScrollRef.current = true
                          return [...prevList, newMessage]
                        })
                      }

                      setSendLoading(true)
                      try {
                        if (hasAttachment) {
                          const file = attachment.file
                          const buf = await file.arrayBuffer()
                          const contentType = file.type || 'application/octet-stream'

                          if (trimmed) {
                            const textRes = await messageManager.sendMessage(
                              selectedChannel,
                              { content: new TextEncoder().encode(trimmed).buffer },
                              replyId,
                            )
                            if (!textRes?.success) {
                              setSendError(textRes?.error?.message ?? 'Could not send message')
                              return
                            }
                            await appendDecryptedMessage(textRes.data)
                          }

                          const mediaRes = await messageManager.sendMessageAttachment(
                            selectedChannel,
                            buf,
                            contentType,
                            file.name || '',
                            replyId,
                          )
                          if (!mediaRes?.success) {
                            setSendError(mediaRes?.error?.message ?? 'Could not send attachment')
                            return
                          }
                          await appendDecryptedMessage(mediaRes.data)
                        } else {
                          const res = await messageManager.sendMessage(
                            selectedChannel,
                            { content: new TextEncoder().encode(trimmed).buffer },
                            replyId,
                          )
                          if (!res?.success) {
                            setSendError(res?.error?.message ?? 'Could not send message')
                            return
                          }
                          await appendDecryptedMessage(res.data)
                        }

                        setDraft('')
                        setReplyingTo(null)
                        clearAttachment()
                      } catch (err) {
                        console.error(err)
                        setSendError(err?.message ?? 'Could not send message')
                      } finally {
                        setSendLoading(false)
                        setTimeout(() => {
                          messageInputRef.current?.focus?.()
                        }, 0)
                      }
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setAttachmentFromFile(file)
                        e.target.value = ''
                        requestAnimationFrame(() => {
                          sendButtonRef.current?.focus?.()
                        })
                      }}
                    />
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*,video/*,.mp4,.webm,.mov,.mkv,.ogv,.m4v"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setAttachmentFromFile(file)
                        e.target.value = ''
                        requestAnimationFrame(() => {
                          sendButtonRef.current?.focus?.()
                        })
                      }}
                    />

                    {replyingTo ? (
                      <div className="mb-2 flex items-start justify-between gap-2 rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-[color:var(--text-muted)]">
                            Replying to{' '}
                            <span className="font-medium text-[color:var(--text-primary)]">
                              {(() => {
                                const rid = replyingTo?.author_id
                                const u =
                                  selectedMembers.find((x) => x.user_id === rid) ??
                                  authorProfilesById[String(rid)]
                                return u?.username ? `@${u.username}` : 'message'
                              })()}
                            </span>
                          </div>
                          {replyPreviewText ? (
                            <div className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-xs text-[color:var(--text-primary)]">
                              {replyPreviewText}
                            </div>
                          ) : replyingTo?.attachment_url ? (
                            <div className="mt-1 text-xs italic text-[color:var(--text-muted)]">
                              Attachment
                            </div>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          variant="text"
                          size="iconSm"
                          className="h-7 w-7 flex-shrink-0 text-[color:var(--text-muted)]"
                          aria-label="Cancel reply"
                          onClick={() => setReplyingTo(null)}
                        >
                          <span className="material-symbols-outlined text-base" aria-hidden>
                            close
                          </span>
                        </Button>
                      </div>
                    ) : null}

                    <div className="flex items-end gap-2">
                      <Button
                        type="button"
                        size="iconSm"
                        variant="ghost"
                        aria-label="Attach file"
                        disabled={!selectedChannel || sendLoading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <span className="material-symbols-outlined text-base" aria-hidden>
                          attach_file
                        </span>
                      </Button>

                      <Button
                        type="button"
                        size="iconSm"
                        variant="ghost"
                        aria-label="Attach image or video"
                        disabled={!selectedChannel || sendLoading}
                        onClick={() => imageInputRef.current?.click()}
                      >
                        <span className="material-symbols-outlined text-base" aria-hidden>
                          image
                        </span>
                      </Button>

                      <textarea
                        rows={1}
                        className="box-border min-h-[2.75rem] min-w-0 max-h-[calc(5lh+1rem)] flex-1 resize-y overflow-y-auto rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-2 text-sm leading-normal text-[color:var(--text-primary)] [field-sizing:content] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] disabled:opacity-60"
                        placeholder="Message"
                        title="Enter to send, Shift+Enter for new line"
                        value={draft}
                        disabled={!selectedChannel || sendLoading}
                        ref={messageInputRef}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape' && !e.nativeEvent.isComposing) {
                            e.preventDefault()
                            e.stopPropagation()
                            handleEscapeInChannel()
                            return
                          }
                          if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
                          e.preventDefault()
                          e.currentTarget.form?.requestSubmit()
                        }}
                        onChange={(e) => {
                          const next = e.target.value
                          if ((next ?? '').length === 0) {
                            typingAckStartedRef.current = false
                          } else if ((draft ?? '').length === 0 && next.length > 0 && !typingAckStartedRef.current) {
                            typingAckStartedRef.current = true
                            void ackLastMessageIfUnread()
                          }
                          setDraft(next)
                          setSendError(null)

                          if (!selectedChannel) return

                          const nextTrimmed = (next ?? '').trim()

                          if (!nextTrimmed) return

                          const now = Date.now()
                          const shouldSend = now - lastTypingSentAtRef.current > 10_000
                          if (!shouldSend) return

                          lastTypingSentAtRef.current = now
                          void channelManager
                            .startTyping(selectedChannel.channel_id)
                            .catch(() => {
                              // Best-effort: typing notifications shouldn't break composing.
                            })
                        }}
                      />

                      <Button
                        ref={sendButtonRef}
                        type="submit"
                        size="sm"
                        disabled={!selectedChannel || sendLoading || (!draft?.trim() && !attachment?.file)}
                      >
                        Send
                      </Button>
                    </div>

                    {attachment?.file ? (
                      <div className="mt-2 flex items-center justify-between gap-2 rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-2 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {attachment.kind === 'image' && attachment.previewUrl ? (
                            <img
                              src={attachment.previewUrl}
                              alt=""
                              className="h-10 w-10 rounded-button border border-[color:var(--card-border)] object-cover"
                            />
                          ) : attachment.kind === 'video' && attachment.previewUrl ? (
                            <video
                              src={attachment.previewUrl}
                              muted
                              playsInline
                              preload="metadata"
                              className="h-10 w-10 rounded-button border border-[color:var(--card-border)] object-cover bg-black"
                              aria-hidden
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)]">
                              <span className="material-symbols-outlined text-base" aria-hidden>
                                insert_drive_file
                              </span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-[color:var(--text-primary)]">
                              {attachment.file.name}
                            </div>
                            {attachment.file.type ? (
                              <div className="text-xs text-[color:var(--text-muted)]">{attachment.file.type}</div>
                            ) : null}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="iconSm"
                          variant="text"
                          className="text-[color:var(--text-muted)]"
                          onClick={() => clearAttachment()}
                          aria-label="Remove attachment"
                        >
                          <span className="material-symbols-outlined text-base" aria-hidden>
                            close
                          </span>
                        </Button>
                      </div>
                    ) : null}

                    {sendError && (
                      <div className="mt-2 text-xs text-red-500" role="alert">
                        {sendError}
                      </div>
                    )}
                  </form>
                </div>

                <aside className="hidden w-64 flex-shrink-0 border-l border-[color:var(--card-border)] md:flex md:flex-col">
                  <div className="border-b border-[color:var(--card-border)] px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                          Members
                        </div>
                        <div className="mt-0.5 text-xs text-[color:var(--text-muted)]">
                          {selectedMembers.length}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="gap-1"
                        onClick={() => setAddingMembers(true)}
                        disabled={!canManageMembers}
                      >
                        <span className="material-symbols-outlined text-sm" aria-hidden>
                          person_add
                        </span>
                        Add
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto px-2 py-2">
                    {channelLoading && (
                      <ul className="space-y-2" role="list" aria-label="Loading members">
                        {Array.from({ length: 8 }, (_, i) => (
                          <li key={i} className="flex items-center gap-3 px-2 py-2">
                            <div className="h-9 w-9 rounded-full border border-[color:var(--card-border)] bg-[color:var(--card-bg)] skeleton-pulse" />
                            <div className="h-4 w-28 rounded bg-[color:var(--card-bg)] skeleton-pulse" />
                          </li>
                        ))}
                      </ul>
                    )}
                    {!channelLoading && channelError && (
                      <p className="px-2 py-3 text-sm text-[color:var(--text-muted)]" role="alert">
                        {channelError}
                      </p>
                    )}
                    {!channelLoading && !channelError && selectedMembers.length === 0 && (
                      <p className="px-2 py-3 text-sm text-[color:var(--text-muted)]">
                        No members to show.
                      </p>
                    )}
                    {!channelLoading && !channelError && selectedMembers.length > 0 && (
                      <ul className="space-y-1" role="list" aria-label="Channel members">
                        {selectedMembers.map((m) => (
                          <li key={m.user_id} className="relative">
                            <div className="flex items-center gap-3 rounded-button px-2 py-2 hover:bg-[color:var(--card-bg)]">
                              <UserAvatar
                                userId={m.user_id}
                                src={m.icon_url}
                                alt=""
                                className="h-9 w-9 flex-shrink-0 rounded-full border border-[color:var(--card-border)] object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-[color:var(--text-primary)]">
                                  @{m.username || 'user'}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="text"
                                size="xs"
                                className="ml-1 h-7 w-7 p-0 text-[color:var(--text-muted)]"
                                aria-label="Member actions"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setMemberMenu((prev) =>
                                    prev && prev.userId === m.user_id
                                      ? null
                                      : {
                                          userId: m.user_id,
                                          username: m.username,
                                          x: e.clientX,
                                          y: e.clientY,
                                        },
                                  )
                                }}
                              >
                                <span className="material-symbols-outlined text-base" aria-hidden>
                                  more_vert
                                </span>
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="border-t border-[color:var(--card-border)] px-4 py-3" />
                </aside>
              </div>
            </Card>
          )}
        </section>
      </main>

      <ContextMenu
        open={!!channelMenu}
        onClose={() => setChannelMenu(null)}
        x={channelMenu?.x}
        y={channelMenu?.y}
      >
        {channelMenu && (
          <div className="min-w-[180px] rounded-card border border-[color:var(--card-border)] bg-[color:var(--card-bg)] py-1 text-sm text-[color:var(--text-primary)] shadow-card">
            <div className="px-3 py-2 text-xs text-[color:var(--text-muted)]">
              {channelMenu.name || channelMenu.channelId}
            </div>
            <MenuActionItem
              type="button"
              className="justify-start text-red-500 hover:bg-red-500/10"
              onClick={async () => {
                const id = channelMenu.channelId
                setChannelMenu(null)
                setLeaveError(null)
                setLeaveConfirm({ channelId: id, name: channelMenu.name || channelMenu.channelId })
              }}
              disabled={leaveLoading}
            >
              Leave chat
            </MenuActionItem>
          </div>
        )}
      </ContextMenu>

      <ContextMenu
        open={!!memberMenu}
        onClose={() => setMemberMenu(null)}
        x={memberMenu?.x}
        y={memberMenu?.y}
        preferLeft
      >
        {memberMenu && (
          <MemberContextMenu
            userId={memberMenu.userId}
            channelId={selectedChannelId}
            currentUserId={currentUserId}
            memberUsername={memberMenu.username}
            onRequestLeave={() => {
              setMemberMenu(null)
              setLeaveError(null)
              setLeaveConfirm({
                channelId: selectedChannelId,
                name:
                  selectedChannel?.channel_name ||
                  selectedChannelId ||
                  'this channel',
              })
            }}
            onMemberRemoved={handleMemberRemoved}
            canManageMembers={canManageMembers}
            onClose={() => setMemberMenu(null)}
          />
        )}
      </ContextMenu>

      <CreateChannelModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => loadChannels()}
        maxFriends={15}
        getEncryptedSharedKey={() => ''}
        getEncryptedMemberKey={() => ''}
      />
      <AddChannelMembersModal
        open={addingMembers}
        onClose={() => setAddingMembers(false)}
        channel={selectedChannel}
        channelId={selectedChannelId}
        existingMemberIds={selectedChannel?.channel_members ?? []}
        onMembersAdded={async (newMemberIds) => {
          if (!Array.isArray(newMemberIds) || newMemberIds.length === 0) return

          // Update raw channel member IDs
          setSelectedChannel((prev) =>
            prev
              ? {
                  ...prev,
                  channel_members: [
                    ...(prev.channel_members ?? []),
                    ...newMemberIds.filter(
                      (id) => !(prev.channel_members ?? []).includes(id),
                    ),
                  ],
                }
              : prev,
          )

          try {
            const users = await userManager.fetchUsersBulk(newMemberIds)
            const newProfiles = (users ?? []).map((u) => ({
              user_id: u.user_id,
              username: u?.username ?? '',
              icon_url: u ? getAvatarUrl(u) : null,
            }))
            if (newProfiles.length === 0) return

            setSelectedMembers((prev) => {
              const existingById = new Map((prev ?? []).map((m) => [m.user_id, m]))
              for (const profile of newProfiles) {
                existingById.set(profile.user_id, profile)
              }
              const merged = Array.from(existingById.values())
              merged.sort((a, b) =>
                (a.username || '').localeCompare(b.username || '', undefined, {
                  sensitivity: 'base',
                }),
              )
              return merged
            })
          } catch {
            // Swallow; members will appear after full reload/select
          }
        }}
        maxFriends={15}
      />

      <ConfirmModal
        open={!!leaveConfirm}
        title="Leave channel?"
        description={
          leaveConfirm
            ? `You will stop receiving messages from "${leaveConfirm.name}".`
            : ''
        }
        confirmLabel="Leave"
        cancelLabel="Cancel"
        confirmVariant="danger"
        confirmDisabled={leaveLoading}
        onConfirm={() => {
          if (!leaveConfirm) return
          void handleLeaveChannel(leaveConfirm.channelId)
        }}
        onCancel={() => {
          setLeaveConfirm(null)
          setLeaveError(null)
        }}
      >
        {leaveError && (
          <p className="text-xs text-red-500" role="alert">
            {leaveError}
          </p>
        )}
      </ConfirmModal>
    </PageContainer>
  )
}
