import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PageContainer from '../components/PageContainer.jsx'
import Card from '../components/Card.jsx'
import CreateChannelModal from '../components/CreateChannelModal.jsx'
import AddChannelMembersModal from '../components/AddChannelMembersModal.jsx'
import ContextMenu from '../components/ContextMenu.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import Button from '../components/Button.jsx'
import ClickableRow from '../components/ClickableRow.jsx'
import MenuActionItem from '../components/MenuActionItem.jsx'
import Message from '../components/Message.jsx'
import { getCurrentSession } from '../lib/session.js'
import { channelManager, messageManager } from '../lib/chat.js'
import { decryptB64Sym } from '../lib/keyhandler.js'
import { userManager } from '../lib/user.js'
import { getAvatarUrl, getDefaultChannelUrl, userContentUrl } from '../lib/utils.js'
import MemberContextMenu from '../components/MemberContextMenu.jsx'

export default function MessagesPage() {
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [selectedChannelId, setSelectedChannelId] = useState(null)
  const [selectedChannel, setSelectedChannel] = useState(null)
  const selectedChannelIdRef = useRef(null)
  const [selectedMembers, setSelectedMembers] = useState([])
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

  const [draft, setDraft] = useState('')
  const [sendLoading, setSendLoading] = useState(false)
  const [sendError, setSendError] = useState(null)

  // Typing indicators for the currently open channel.
  // Keeps a 10s timeout per user; cleared immediately when that user sends a message.
  const [typingByUserId, setTypingByUserId] = useState({})
  const typingTimersRef = useRef(new Map()) // user_id(string) -> { timeoutId, seq }
  const lastTypingSentAtRef = useRef(0)

  // For now attachments/images are UI-only; `messageManager.sendMessage()` does not upload them.
  const [attachment, setAttachment] = useState(null) // { kind: 'file'|'image', file, previewUrl? }
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const bottomRef = useRef(null)
  const messageInputRef = useRef(null)

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

    setMessages((prev) => {
      const prevList = prev ?? []
      if (prevList.some((m) => m.message_id === incomingMessage.message_id)) return prevList
      // New gateway-created messages are newest; keep newest 50.
      return [...prevList, incomingMessage].slice(-50)
    })
  }, [])

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

  const loadMessages = useCallback(async () => {
    if (!selectedChannel) return
    setMessagesLoading(true)
    setMessagesError(null)
    try {
      const res = await messageManager.getMessages(selectedChannel, null, 50)
      if (!res?.success) {
        setMessagesError(res?.error?.message ?? 'Could not load messages')
        setMessages([])
        return
      }

      const raw = res?.data?.messages ?? []
      const settled = await Promise.allSettled(raw)
      const ok = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value)
      setMessages(ok)
    } catch (e) {
      console.error(e)
      setMessagesError(e?.message ?? 'Could not load messages')
      setMessages([])
    } finally {
      setMessagesLoading(false)
    }
  }, [selectedChannel])

  useEffect(() => {
    if (!selectedChannelId) {
      setMessages([])
      setMessagesError(null)
      return
    }
    if (!selectedChannel) {
      setMessages([])
      setMessagesError(null)
      return
    }
    void loadMessages()
  }, [selectedChannelId, selectedChannel, loadMessages])

  // Keep `messageManager` in sync with the currently selected channel so it can decrypt
  // incoming gateway events and emit only relevant messages.
  useEffect(() => {
    messageManager.setActiveChannel(selectedChannel)
    return () => {
      messageManager.setActiveChannel(null)
    }
  }, [selectedChannel])

  useEffect(() => {
    messageManager.setOnMessageCreate(handleIncomingMessage)
    return () => {
      messageManager.setOnMessageCreate(null)
    }
  }, [handleIncomingMessage])

  useEffect(() => {
    channelManager.setOnUserTyping(handleUserTyping)
    return () => channelManager.setOnUserTyping(null)
  }, [handleUserTyping])

  // Focus the message input when a channel is opened.
  useEffect(() => {
    if (!selectedChannelId || !selectedChannel) return
    // Wait a tick so the input is mounted and enabled.
    const t = setTimeout(() => {
      messageInputRef.current?.focus?.()
    }, 0)
    return () => clearTimeout(t)
  }, [selectedChannelId, selectedChannel])

  useEffect(() => {
    if (!bottomRef.current) return
    if (messagesLoading) return
    bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messagesLoading, messages.length])

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
      const list = res?.data?.channels ?? []
      list.sort((a, b) => (b.last_accessed || 0) - (a.last_accessed || 0))
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
          const next = [...list, { ...channel, last_accessed: channel.last_accessed ?? Math.floor(Date.now() / 1000) }]
          next.sort((a, b) => (b.last_accessed || 0) - (a.last_accessed || 0))
          return next
        }
        const next = list.map((c) => (c.channel_id === channel.channel_id ? { ...c, ...channel } : c))
        next.sort((a, b) => (b.last_accessed || 0) - (a.last_accessed || 0))
        return next
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
    return () => {
      for (const { timeoutId } of typingTimersRef.current.values()) clearTimeout(timeoutId)
      typingTimersRef.current.clear()
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
        const channel = res?.data
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
        prev && updated ? { ...updated, shared_key: updated.shared_key ?? prev.shared_key } : updated,
      )
      setChannels((prev) =>
        (prev ?? []).map((ch) => (ch.channel_id === updated.channel_id ? updated : ch)),
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
        setDraft('')
        setSendError(null)
        setSendLoading(false)
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
        <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden border-b border-[color:var(--card-border)] pb-3 md:w-80 md:flex-none md:border-b-0 md:pb-0 md:overflow-y-auto lg:w-96">
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
                              {ch.last_accessed ? `Last opened: ${formatRelativeFromSeconds(ch.last_accessed)}` : ''}
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
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
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

              <div className="flex min-h-0 flex-1 overflow-hidden">
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
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

                    {!messagesLoading && !messagesError && typingDisplay && (
                      <div className="mb-2 text-xs text-[color:var(--text-muted)]" aria-live="polite">
                        {typingDisplay}
                      </div>
                    )}

                    {!messagesLoading && !messagesError && messages.length === 0 && (
                      <div className="flex h-full items-center justify-center py-10">
                        <p className="text-sm text-[color:var(--text-muted)]">No messages yet.</p>
                      </div>
                    )}

                    {!messagesLoading && !messagesError && messages.length > 0 && (
                      <ul className="space-y-2" role="list" aria-label="Messages">
                        {messages.map((m) => {
                          const author = selectedMembers.find((u) => u.user_id === m.author_id) ?? null
                          const isOwn = currentUserId && m.author_id === currentUserId
                          return <Message key={m.message_id} message={m} author={author} isOwn={!!isOwn} />
                        })}
                        <li ref={bottomRef} className="h-0 list-none" />
                      </ul>
                    )}
                  </div>

                  <form
                    className="border-t border-[color:var(--card-border)] p-3"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (!selectedChannel) return
                      if (sendLoading) return

                      setSendError(null)
                      const trimmed = (draft ?? '').trim()
                      let finalText = trimmed

                      if (!finalText && attachment?.file?.name) {
                        finalText = attachment.file.name
                      }

                      if (!finalText) return

                      const payload = {
                        content: new TextEncoder().encode(finalText).buffer,
                      }

                      setSendLoading(true)
                      Promise.resolve()
                        .then(() => messageManager.sendMessage(selectedChannel, payload))
                        .then(async (res) => {
                          if (!res?.success) {
                            setSendError(res?.error?.message ?? 'Could not send message')
                            return
                          }

                          // Avoid re-fetching the whole message history: decrypt + append locally.
                          const created = res?.data

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
                            if (prevList.some((m) => m.message_id === newMessage.message_id)) {
                              return prevList
                            }
                            // `messageManager.getMessages()` returns oldest-first, so append.
                            return [...prevList, newMessage].slice(-50)
                          })

                          setDraft('')
                          clearAttachment()
                          // Keep typing; focus input after successful send.
                          setTimeout(() => {
                            messageInputRef.current?.focus?.()
                          }, 0)
                        })
                        .catch((err) => {
                          console.error(err)
                          setSendError(err?.message ?? 'Could not send message')
                        })
                        .finally(() => setSendLoading(false))
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        clearAttachment()
                        setAttachment({ kind: 'file', file })
                        e.target.value = ''
                      }}
                    />
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        clearAttachment()
                        const previewUrl = URL.createObjectURL(file)
                        setAttachment({ kind: 'image', file, previewUrl })
                        e.target.value = ''
                      }}
                    />

                    <div className="flex items-center gap-2">
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
                        aria-label="Attach image"
                        disabled={!selectedChannel || sendLoading}
                        onClick={() => imageInputRef.current?.click()}
                      >
                        <span className="material-symbols-outlined text-base" aria-hidden>
                          image
                        </span>
                      </Button>

                      <input
                        type="text"
                        className="w-full rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] disabled:opacity-60"
                        placeholder="Message"
                        value={draft}
                        disabled={!selectedChannel || sendLoading}
                        ref={messageInputRef}
                        onChange={(e) => {
                          const next = e.target.value
                          setDraft(next)
                          setSendError(null)

                          if (!selectedChannel) return

                          const prevTrimmed = (draft ?? '').trim()
                          const nextTrimmed = (next ?? '').trim()

                          // If the input is empty, reset so the next keystroke re-triggers typing.
                          if (!nextTrimmed) {
                            lastTypingSentAtRef.current = 0
                            return
                          }

                          const now = Date.now()
                          const prevWasEmpty = !prevTrimmed
                          const shouldSend = prevWasEmpty || now - lastTypingSentAtRef.current > 2_000
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
                        type="submit"
                        size="sm"
                        disabled={!selectedChannel || sendLoading || (!draft?.trim() && !attachment?.file?.name)}
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
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)]">
                              <span className="material-symbols-outlined text-base" aria-hidden>
                                insert_drive_file
                              </span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-[color:var(--text-primary)]">{attachment.file.name}</div>
                            {(!draft || !draft.trim()) && (
                              <div className="text-xs text-[color:var(--text-muted)]">
                                Upload not supported yet; sending filename as text.
                              </div>
                            )}
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
                              {m.icon_url ? (
                                <img
                                  src={m.icon_url}
                                  alt=""
                                  className="h-9 w-9 flex-shrink-0 rounded-full border border-[color:var(--card-border)] object-cover"
                                />
                              ) : (
                                <div className="h-9 w-9 flex-shrink-0 rounded-full border border-[color:var(--card-border)] bg-[color:var(--card-bg)]" />
                              )}
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
