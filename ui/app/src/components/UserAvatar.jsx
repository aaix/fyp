import { useState } from 'react'
import { getDefaultAvatarUrl } from '../lib/utils.js'

/**
 * @param {Object} props
 * @param {string | null | undefined} props.userId
 * @param {string | null | undefined} props.src
 * @param {string} [props.alt]
 * @param {string} [props.className]
 * @param {boolean} [props.loading]
 */
function UserAvatarInner({ userId, src, alt = '', className = '', loading = false }) {
  const primary = src ?? null
  const fallback = userId ? getDefaultAvatarUrl(userId) : null
  const [useFallback, setUseFallback] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)

  const pulse = loading ? 'skeleton-pulse' : ''

  if (fallbackFailed || (!primary && !fallback)) {
    return (
      <div
        className={`rounded-full border border-[color:var(--card-border)] bg-[color:var(--card-bg)] ${pulse} ${className}`.trim()}
        aria-hidden={!alt}
      />
    )
  }

  const displaySrc = useFallback ? fallback : primary || fallback
  if (!displaySrc) {
    return (
      <div
        className={`rounded-full border border-[color:var(--card-border)] bg-[color:var(--card-bg)] ${pulse} ${className}`.trim()}
        aria-hidden={!alt}
      />
    )
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={`${pulse} ${className}`.trim()}
      onError={() => {
        if (!useFallback && fallback && displaySrc !== fallback) {
          setUseFallback(true)
        } else {
          setFallbackFailed(true)
        }
      }}
    />
  )
}

/**
 * User profile image: tries `src`, then on error falls back to `getDefaultAvatarUrl(userId)`.
 * Remounts when `userId` or `src` changes so load state resets.
 */
export default function UserAvatar(props) {
  return (
    <UserAvatarInner
      key={`${props.userId ?? ''}\0${props.src ?? ''}`}
      {...props}
    />
  )
}
