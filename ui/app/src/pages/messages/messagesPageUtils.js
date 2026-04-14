export function decodeReplyPreviewContent(content) {
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
  } catch (err) {
    console.error(err)
    return null
  }
}

export function truncateReplyPreview(s, n = 200) {
  if (!s) return ''
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

export function canonicalChannelMemberId(raw, { uuidHexKey, uuidFrom32Hex }) {
  const key = uuidHexKey(raw)
  if (key.length === 32 && /^[0-9a-f]+$/.test(key)) {
    return uuidFrom32Hex(key) ?? String(raw).trim()
  }
  return String(raw).trim()
}

/** 100ns ticks since UUID epoch (RFC 4122 v1); used to compare message ids when the acked row is missing. */
export function uuidV1Ticks(uuid) {
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

export function uuidV1UnixMs(uuid) {
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
export function formatAckedSinceForUnreadBar(ms) {
  const d = new Date(ms)
  const now = new Date()
  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (sameCalendarDay(d, now)) return timeStr
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameCalendarDay(d, yesterday)) return `yesterday at ${timeStr}`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Unread = channel total counter − per-user acked counter (`last_acked_ctr`). */
export function channelListUnreadCount(ch, totalByChannelId) {
  const total = totalByChannelId[String(ch.channel_id)] ?? 0
  const acked = typeof ch.last_acked_ctr === 'number' ? ch.last_acked_ctr : 0
  return Math.max(0, total - acked)
}

export function sortChannelsForSidebar(list, totalByChannelId) {
  return [...list].sort((a, b) => {
    const ua = channelListUnreadCount(a, totalByChannelId)
    const ub = channelListUnreadCount(b, totalByChannelId)
    if (ub !== ua) return ub - ua
    const ta = uuidV1Ticks(a.last_acked_message_id) ?? 0n
    const tb = uuidV1Ticks(b.last_acked_message_id) ?? 0n
    if (tb > ta) return 1
    if (tb < ta) return -1
    return 0
  })
}

export function countUnreadMessages(msgs, ackId) {
  const ackTicks = uuidV1Ticks(ackId)
  return (msgs ?? []).filter((m) => {
    const t = uuidV1Ticks(m.message_id)
    if (t === null) return false
    if (ackTicks === null) return true
    return t > ackTicks
  }).length
}

/** Pixels from bottom to treat as “still at bottom” for auto-scroll. */
export const SCROLL_BOTTOM_THRESHOLD_PX = 120

/**
 * True when scroller is at/near bottom. Shared for consistent read-ack and auto-scroll behavior.
 */
export function isNearBottom(root, thresholdPx = SCROLL_BOTTOM_THRESHOLD_PX) {
  if (!root) return false
  return root.scrollHeight - root.scrollTop - root.clientHeight < thresholdPx
}
