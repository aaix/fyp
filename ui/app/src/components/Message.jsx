import { memo } from 'react'
import { userContentUrl } from '../lib/utils.js'

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
  const timeLabel = message?.last_edited ? formatRelativeFromSeconds(message.last_edited) : ''

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
              <div className="flex-shrink-0 text-[11px] text-[color:var(--text-muted)]">{timeLabel}</div>
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
                message?.bucket ? (
                  <img
                    src={userContentUrl(message.bucket, message.attachment_asset_id, 'webp')}
                    alt="Attachment"
                    className="max-h-64 w-full rounded-button border border-[color:var(--card-border)] object-contain"
                  />
                ) : (
                  <div className="text-sm text-[color:var(--text-muted)]">Attachment unavailable</div>
                )
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

