import Card from '../../components/Card.jsx'
import Button from '../../components/Button.jsx'
import ClickableRow from '../../components/ClickableRow.jsx'
import ChannelIcon from '../../components/ChannelIcon.jsx'
import { channelListUnreadCount, uuidV1UnixMs } from './messagesPageUtils.js'

export default function MessagesSidebar({
  show,
  loading,
  error,
  channels,
  channelTotalCounters,
  isDesktop,
  selectedChannelId,
  onCreateOpen,
  onSelectChannel,
  onOpenChannelMenu,
  onReload,
  formatRelativeFromSeconds,
}) {
  return (
    <section
      className={`${show ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col gap-3 overflow-x-hidden border-b border-[color:var(--card-border)] pb-3 md:w-64 md:flex-none md:border-b-0 md:pb-0 md:overflow-y-auto lg:w-80`}
    >
      <div className="flex items-center justify-between gap-2 px-1 md:px-0">
        <h1 className="text-lg font-bold text-[color:var(--text-primary)]">Messages</h1>
        <Button type="button" size="sm" className="text-xs" onClick={onCreateOpen}>
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
            <Button type="button" variant="ghost" size="sm" onClick={onReload}>
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
            const sidebarUnread = channelListUnreadCount(ch, channelTotalCounters)
            return (
              <li key={ch.channel_id} className="min-w-0">
                <ClickableRow
                  type="button"
                  className="w-full overflow-hidden px-0 py-0 hover:bg-transparent"
                  onClick={() => onSelectChannel(ch.channel_id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    onOpenChannelMenu({
                      channelId: ch.channel_id,
                      x: e.clientX,
                      y: e.clientY,
                      name: ch.channel_name,
                    })
                  }}
                >
                  <Card
                    className={`w-full overflow-hidden px-4 py-3 transition-colors hover:bg-[color:var(--tab-active-bg)]/60 ${isSelected ? 'border-[color:var(--accent)]' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <ChannelIcon
                        channel={ch}
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
                            return ms != null
                              ? `Last read: ${formatRelativeFromSeconds(Math.floor(ms / 1000))}`
                              : ''
                          })()}
                        </div>
                      </div>
                      {sidebarUnread > 0 ? (
                        <span
                          className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)] px-1.5 text-[11px] font-semibold tabular-nums text-white"
                          aria-label={`${sidebarUnread} unread`}
                        >
                          {sidebarUnread > 99 ? '99+' : sidebarUnread}
                        </span>
                      ) : null}
                    </div>
                  </Card>
                </ClickableRow>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
