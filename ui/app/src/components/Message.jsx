import { memo } from 'react'
import { userContentUrl } from '../lib/utils.js'

// Extract a Unix timestamp (ms) from a time-based UUID (UUID v1 / "timeuuid").
// Works with UUIDs generated from Scylla/UUID time-based schemes.
function uuidTimeToUnixMs(uuid) {
  if (!uuid || typeof uuid !== 'string') return null

  // Expected: xxxxxxxx-xxxx-1xxx-[89ab]xxx-xxxxxxxxxxxx (UUID v1)
  const hex = uuid.replace(/-/g, '').toLowerCase()
  if (hex.length !== 32) return null

  const version = parseInt(hex[12], 16) // 13th hex char includes version nibble
  if (version !== 1) return null

  const timeLow = BigInt(`0x${hex.slice(0, 8)}`)
  const timeMid = BigInt(`0x${hex.slice(8, 12)}`)
  const timeHiAndVersion = BigInt(`0x${hex.slice(12, 16)}`)

  // 60-bit timestamp: time_low (32) + time_mid (16) + time_hi_and_version (12)
  const timestamp100ns = (timeHiAndVersion & 0x0fffn) << 48n | timeMid << 32n | timeLow

  // UUID epoch offset: 1582-10-15 to 1970-01-01 in 100ns intervals
  const UUID_EPOCH_OFFSET_100NS = 122192928000000000n
  const unix100ns = timestamp100ns - UUID_EPOCH_OFFSET_100NS
  if (unix100ns < 0n) return null

  // Convert 100ns to milliseconds
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

  if (sameLocalDay(created, now)) {
    return { label: hhmm, full }
  }

  if (sameLocalDay(created, yesterday)) {
    return { label: `Yesterday at ${hhmm}`, full }
  }

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
    // Handle typed array / DataView cases defensively
    if (ArrayBuffer.isView(content)) {
      return new TextDecoder().decode(content)
    }
    return String(content)
  } catch {
    return null
  }
}

function Message({ message, author, isOwn }) {
  const text = decodeMessageContent(message?.content)
  const createdMs = uuidTimeToUnixMs(message?.message_id)
  const { label: timeLabel, full: fullTimeLabel } = formatMessageTimestamp(createdMs)

  const avatarUrl = author?.icon_url || null
  const authorLabel = author?.username ? `@${author.username}` : 'Unknown'

  const hasAttachment = !!message?.attachment_asset_id
  const maybeImage = hasAttachment && message?.message_type === 1

  return (
    <li className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex w-full min-w-0 gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="mt-1 h-8 w-8 flex-shrink-0 rounded-full border border-[color:var(--card-border)] object-cover"
          />
        ) : (
          <div className="mt-1 h-8 w-8 flex-shrink-0 rounded-full border border-[color:var(--card-border)] bg-[color:var(--card-bg)]" />
        )}

        <div
          className={`min-w-0 max-w-[80%] rounded-card border border-[color:var(--card-border)] px-3 py-2 flex-shrink ${
            isOwn ? 'bg-[color:var(--tab-active-bg)]' : 'bg-[color:var(--card-bg)]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-xs font-semibold text-[color:var(--text-primary)]">
              {authorLabel}
            </div>
            {timeLabel ? (
              <div className="flex-shrink-0 text-[11px] text-[color:var(--text-muted)]">
                <span title={fullTimeLabel} className="cursor-help">
                  {timeLabel}
                </span>
              </div>
            ) : null}
          </div>

          {text ? (
            <div className="mt-1 break-all whitespace-pre-wrap break-words text-sm text-[color:var(--text-primary)]">
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
                <div className="text-sm text-[color:var(--text-muted)]">
                  Attachment: {String(message.attachment_asset_id)}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export default memo(Message)

