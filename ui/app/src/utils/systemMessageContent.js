/** Align with shared/py/grpc/message.py MessageType */
export const SYSTEM_MSG_ADD_MEMBERS = 2
export const SYSTEM_MSG_REMOVE_MEMBER = 3
export const SYSTEM_MSG_EDIT_CHANNEL_NAME = 4
export const SYSTEM_MSG_EDIT_CHANNEL_ICON = 5
export const SYSTEM_MSG_CREATE_CHANNEL = 6

// API: base64 UTF-8; gateway may send the same or plain text (e.g. comma-separated hex ids).
export function decodeSystemMessageContent(content) {
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
    if (typeof content === 'string') return content.trim()
    return null
  }
}

/** Compare UUIDs whether stored as `xxxxxxxx-xxxx-...` or 32-char hex (remove-member system messages use hex). */
export function uuidHexKey(s) {
  if (s == null) return ''
  return String(s).trim().toLowerCase().replace(/-/g, '')
}

export function uuidFrom32Hex(key) {
  if (!key || key.length !== 32) return null
  return `${key.slice(0, 8)}-${key.slice(8, 12)}-${key.slice(12, 16)}-${key.slice(16, 20)}-${key.slice(20)}`
}

/** SYSTEM_ADD_MEMBERS content: comma-separated user ids (32-char hex, no hyphens). */
export function parseCommaSeparatedUserIds(rawText) {
  if (!rawText?.trim()) return []
  return rawText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
