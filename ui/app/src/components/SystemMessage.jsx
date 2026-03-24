import { memo, useEffect, useMemo, useState } from 'react'
import { userManager } from '../lib/user.js'

/** Align with shared/py/grpc/message.py MessageType */
export const SYSTEM_MSG_ADD_MEMBERS = 2
export const SYSTEM_MSG_REMOVE_MEMBER = 3
export const SYSTEM_MSG_EDIT_CHANNEL_NAME = 4
export const SYSTEM_MSG_EDIT_CHANNEL_ICON = 5
export const SYSTEM_MSG_CREATE_CHANNEL = 6

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

// Synchronous decode for initial render (content from API is base64 string)
function decodeSystemContentSync(content) {
  if (content == null) return null
  try {
    if (typeof content === 'string') {
      const bytes = Uint8Array.from(atob(content), (c) => c.charCodeAt(0))
      return new TextDecoder().decode(bytes)
    }
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

/** Compare UUIDs whether stored as `xxxxxxxx-xxxx-...` or 32-char hex (remove-member system messages use hex). */
function uuidHexKey(s) {
  if (s == null) return ''
  return String(s).trim().toLowerCase().replace(/-/g, '')
}

function uuidFrom32Hex(key) {
  if (!key || key.length !== 32) return null
  return `${key.slice(0, 8)}-${key.slice(8, 12)}-${key.slice(12, 16)}-${key.slice(16, 20)}-${key.slice(20)}`
}

/**
 * @returns {string|null} `@username` or null if not in members/profiles (caller may fetch).
 */
function resolveUserLabel(userIdStr, selectedMembers, authorProfilesById) {
  if (!userIdStr) return null
  const key = uuidHexKey(userIdStr)
  if (key.length === 32 && /^[0-9a-f]+$/.test(key)) {
    const fromMembers = selectedMembers?.find((m) => uuidHexKey(m.user_id) === key)
    if (fromMembers?.username) return `@${fromMembers.username}`

    const profiles = authorProfilesById ?? {}
    for (const [id, p] of Object.entries(profiles)) {
      if (uuidHexKey(id) === key && p?.username) return `@${p.username}`
    }
    return null
  }

  const fromMembers = selectedMembers?.find((m) => String(m.user_id) === userIdStr)
  if (fromMembers?.username) return `@${fromMembers.username}`
  const fromProfiles = authorProfilesById?.[userIdStr]
  if (fromProfiles?.username) return `@${fromProfiles.username}`
  return null
}

function SystemMessage({ message, selectedMembers, authorProfilesById }) {
  const createdMs = uuidTimeToUnixMs(message?.message_id)
  const timeLabel = createdMs
    ? new Date(createdMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
    : ''

  const rawText = decodeSystemContentSync(message?.content)
  const type = message?.message_type

  const [removalResolvedLabel, setRemovalResolvedLabel] = useState(null)

  useEffect(() => {
    const clear = () => queueMicrotask(() => setRemovalResolvedLabel(null))

    if (type !== SYSTEM_MSG_REMOVE_MEMBER) {
      clear()
      return
    }
    const uid = rawText?.trim()
    if (!uid) {
      clear()
      return
    }

    const sync = resolveUserLabel(uid, selectedMembers, authorProfilesById)
    if (sync) {
      clear()
      return
    }

    const key = uuidHexKey(uid)
    if (key.length !== 32 || !/^[0-9a-f]+$/.test(key)) {
      clear()
      return
    }

    const canonId = uuidFrom32Hex(key)
    if (!canonId) {
      clear()
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const users = await userManager.fetchUsersBulk([canonId])
        const u = users?.[0]
        if (cancelled) return
        if (u?.username) setRemovalResolvedLabel(`@${u.username}`)
        else queueMicrotask(() => setRemovalResolvedLabel(null))
      } catch {
        if (!cancelled) queueMicrotask(() => setRemovalResolvedLabel(null))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [type, rawText, selectedMembers, authorProfilesById])

  const actorLabel =
    message?.author_id == null
      ? 'Someone'
      : resolveUserLabel(String(message.author_id), selectedMembers, authorProfilesById) ?? 'Someone'

  const line = useMemo(() => {
    switch (type) {
      case SYSTEM_MSG_ADD_MEMBERS:
        return rawText
          ? `${actorLabel} added members · ${rawText}`
          : `${actorLabel} added members to the channel.`
      case SYSTEM_MSG_REMOVE_MEMBER: {
        const uid = rawText?.trim()
        const targetLabel =
          removalResolvedLabel ?? (uid ? resolveUserLabel(uid, selectedMembers, authorProfilesById) : null)
        return targetLabel
          ? `${actorLabel} removed ${targetLabel} from the channel.`
          : `${actorLabel} removed a member from the channel.`
      }
      case SYSTEM_MSG_EDIT_CHANNEL_NAME:
        return rawText
          ? `${actorLabel} changed the channel name to “${rawText}”.`
          : `${actorLabel} updated the channel name.`
      case SYSTEM_MSG_EDIT_CHANNEL_ICON:
        return `${actorLabel} updated the channel icon.`
      case SYSTEM_MSG_CREATE_CHANNEL:
        return `${actorLabel} created the channel.`
      default:
        return rawText ? `${actorLabel}: ${rawText}` : `${actorLabel} — system message`
    }
  }, [type, rawText, selectedMembers, authorProfilesById, actorLabel, removalResolvedLabel])

  return (
    <li className="flex w-full min-w-0 max-w-full justify-center overflow-x-hidden py-1" role="listitem">
      <div
        className="max-w-full min-w-0 rounded-full border border-[color:var(--card-border)] bg-[color:var(--card-bg)]/80 px-4 py-1.5 text-center text-xs break-words text-[color:var(--text-muted)] [overflow-wrap:anywhere]"
        title={createdMs ? new Date(createdMs).toLocaleString() : undefined}
      >
        <span className="text-[color:var(--text-primary)]/90">{line}</span>
        {timeLabel ? <span className="ml-2 opacity-70">{timeLabel}</span> : null}
      </div>
    </li>
  )
}

export default memo(SystemMessage)
