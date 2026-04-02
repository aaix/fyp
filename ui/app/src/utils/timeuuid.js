/**
 * Extract Unix epoch milliseconds from a UUIDv1 / TimeUUID string.
 * Returns null if not a valid v1 UUID.
 *
 * @param {string | null | undefined} uuid
 * @returns {number | null}
 */
export function uuidTimeToUnixMs(uuid) {
  if (!uuid || typeof uuid !== 'string') return null
  const hex = uuid.replace(/-/g, '').toLowerCase()
  if (hex.length !== 32) return null
  const version = parseInt(hex[12], 16)
  if (version !== 1) return null
  const timeLow = BigInt(`0x${hex.slice(0, 8)}`)
  const timeMid = BigInt(`0x${hex.slice(8, 12)}`)
  const timeHiAndVersion = BigInt(`0x${hex.slice(12, 16)}`)
  const timestamp100ns = ((timeHiAndVersion & 0x0fffn) << 48n) | (timeMid << 32n) | timeLow
  const UUID_EPOCH_OFFSET_100NS = 122192928000000000n
  const unix100ns = timestamp100ns - UUID_EPOCH_OFFSET_100NS
  if (unix100ns < 0n) return null
  return Number(unix100ns / 10000n)
}

