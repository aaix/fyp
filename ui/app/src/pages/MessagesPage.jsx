import { useCallback, useEffect, useMemo, useState } from 'react'
import PageContainer from '../components/PageContainer.jsx'
import Card from '../components/Card.jsx'
import CreateChannelModal from '../components/CreateChannelModal.jsx'
import { channelManager } from '../lib/chat.js'
import { userManager } from '../lib/user.js'
import { getAvatarUrl, getDefaultChannelUrl, userContentUrl } from '../lib/utils.js'

export default function MessagesPage() {
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [selectedChannelId, setSelectedChannelId] = useState(null)
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [selectedMembers, setSelectedMembers] = useState([])
  const [channelLoading, setChannelLoading] = useState(false)
  const [channelError, setChannelError] = useState(null)

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

  const selectChannel = useCallback(
    async (channelId) => {
      if (!isDesktop) return
      setSelectedChannelId(channelId)
      setSelectedChannel(null)
      setSelectedMembers([])
      setChannelLoading(true)
      setChannelError(null)
      try {
        const res = await channelManager.getChannel(channelId)
        if (!res?.success) {
          setChannelError(res?.error?.message ?? 'Could not load channel')
          return
        }
        const channel = res?.data
        setSelectedChannel(channel)

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
        setChannelError(e?.message ?? 'Could not load channel')
      } finally {
        setChannelLoading(false)
      }
    },
    [isDesktop],
  )

  return (
    <PageContainer>
      <header className="flex items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-3">
        <h1 className="text-xl font-bold text-[color:var(--text-primary)]">Messages</h1>
        <button
          type="button"
          className="rounded-button flex items-center gap-2 bg-[color:var(--accent)] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--accent-hover)]"
          onClick={() => setCreateOpen(true)}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            add
          </span>
          Create
        </button>
      </header>
      <main className="min-h-0 flex-1 pt-2 md:flex md:gap-3 md:overflow-hidden">
        <section className="flex min-h-0 flex-1 flex-col gap-2 md:max-w-sm md:flex-none md:overflow-y-auto">
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
                <button
                  type="button"
                  className="rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-1.5 text-sm font-semibold text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--card-bg)]/80"
                  onClick={loadChannels}
                >
                  Retry
                </button>
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
            <ul className="space-y-2" role="list" aria-label="Channels">
              {channels.map((ch) => {
                const isSelected = isDesktop && selectedChannelId === ch.channel_id
                const iconSrc = getChannelIconSrc(ch)
                return (
                  <li key={ch.channel_id}>
                    <button
                      type="button"
                      className={`w-full text-left ${isDesktop ? '' : 'cursor-default'}`}
                      onClick={() => selectChannel(ch.channel_id)}
                      disabled={!isDesktop}
                    >
                      <Card
                        className={`px-4 py-3 transition-colors ${isSelected ? 'border-[color:var(--accent)]' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={iconSrc}
                            alt=""
                            className="h-10 w-10 flex-shrink-0 rounded-full border border-[color:var(--card-border)] object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                              {ch.channel_name}
                            </div>
                            <div className="mt-0.5 text-xs text-[color:var(--text-muted)]">
                              {ch.last_accessed ? `Last opened: ${formatRelativeFromSeconds(ch.last_accessed)}` : ''}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </button>
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
                  <div className="truncate text-base font-bold text-[color:var(--text-primary)]">
                    {selectedChannel?.channel_name ?? '…'}
                  </div>
                  <div className="mt-0.5 text-xs text-[color:var(--text-muted)]">
                    {selectedChannelId}
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 overflow-hidden">
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6">
                    <p className="text-sm text-[color:var(--text-muted)]">
                      Messages will appear here.
                    </p>
                  </div>
                  <div className="border-t border-[color:var(--card-border)] p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="w-full rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
                        placeholder="Message (coming soon)…"
                        disabled
                      />
                      <button
                        type="button"
                        className="rounded-button bg-[color:var(--accent)] px-3 py-2 text-sm font-semibold text-white opacity-60"
                        disabled
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>

                <aside className="hidden w-64 flex-shrink-0 border-l border-[color:var(--card-border)] md:block">
                  <div className="border-b border-[color:var(--card-border)] px-4 py-3">
                    <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                      Members
                    </div>
                    <div className="mt-0.5 text-xs text-[color:var(--text-muted)]">
                      {selectedMembers.length}
                    </div>
                  </div>
                  <div className="h-full overflow-y-auto px-2 py-2">
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
                          <li key={m.user_id}>
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
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </aside>
              </div>
            </Card>
          )}
        </section>
      </main>

      <CreateChannelModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => loadChannels()}
        maxFriends={15}
        getEncryptedSharedKey={() => ''}
        getEncryptedMemberKey={() => ''}
      />
    </PageContainer>
  )
}
