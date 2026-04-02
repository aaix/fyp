import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Card from './Card.jsx'
import { getCurrentSession } from '../lib/session.js'
import { userManager } from '../lib/user.js'
import { getAvatarUrl } from '../lib/utils.js'
import { POST_TYPE_IMAGE, POST_TYPE_SHORT, POST_TYPE_VIDEO } from '../lib/post.js'
import { postRendersAsImage, postRendersAsVideo } from '../lib/postMedia.js'
import { uuidTimeToUnixMs } from '../utils/timeuuid.js'

/**
 * @typedef {{ username: string, iconUrl: string | null, userId: string | null }} PreviewAuthor
 */

function getSessionUserId() {
  try {
    const s = getCurrentSession()
    const id = s.user_id ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('user_id') : null)
    return id != null && id !== '' ? String(id) : null
  } catch {
    return null
  }
}

function postTypeLabel(postType) {
  const t = Number(postType)
  if (t === POST_TYPE_IMAGE) return 'Photo'
  if (t === POST_TYPE_VIDEO) return 'Video'
  if (t === POST_TYPE_SHORT) return 'Short'
  return 'Post'
}

function PostBodyText({ body }) {
  const ref = useRef(null)
  const [expanded, setExpanded] = useState(false)
  const [clamped, setClamped] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    queueMicrotask(() => {
      if (!body || !el) {
        setClamped(false)
        return
      }
      if (expanded) return
      setClamped(el.scrollHeight > el.clientHeight + 1)
    })
  }, [body, expanded])

  const baseClass =
    'whitespace-pre-wrap px-3 py-3 text-[0.9375rem] leading-relaxed text-[color:var(--text-primary)]'

  const toggle = () => {
    if (!clamped) return
    setExpanded((e) => !e)
  }

  const onKeyDown = (e) => {
    if (!clamped) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle()
    }
  }

  return (
    <p
      ref={ref}
      className={`${baseClass} ${!expanded ? 'line-clamp-3' : ''} ${clamped ? 'cursor-pointer' : ''} ${clamped && !expanded ? 'select-none' : ''}`}
      onClick={clamped ? toggle : undefined}
      onKeyDown={clamped ? onKeyDown : undefined}
      role={clamped ? 'button' : undefined}
      tabIndex={clamped ? 0 : undefined}
      aria-expanded={clamped ? expanded : undefined}
    >
      {body}
    </p>
  )
}

export default function PostView({
  post_id,
  author_id,
  asset_url,
  post_type,
  body,
  last_edited: lastEdited,
  num_comments,
  num_likes,
  className = '',
  isPreview = false,
  previewAuthor = null,
}) {
  const [authorUsername, setAuthorUsername] = useState(() =>
    isPreview && previewAuthor ? previewAuthor.username : '',
  )
  const [authorIconUrl, setAuthorIconUrl] = useState(() =>
    isPreview && previewAuthor ? previewAuthor.iconUrl : null,
  )
  const [authorLoading, setAuthorLoading] = useState(!isPreview || !previewAuthor)
  const [authorError, setAuthorError] = useState(null)

  useEffect(() => {
    if (isPreview && previewAuthor) {
      setAuthorUsername(previewAuthor.username ?? '')
      setAuthorIconUrl(previewAuthor.iconUrl ?? null)
      setAuthorLoading(false)
      setAuthorError(null)
      return
    }

    const id = author_id != null ? String(author_id) : ''
    if (!id) {
      setAuthorLoading(false)
      setAuthorError('Unknown author')
      return
    }

    const sessionUserId = getSessionUserId()
    const isOwnPost = sessionUserId != null && id === sessionUserId

    let cancelled = false
    ;(async () => {
      try {
        setAuthorLoading(true)
        setAuthorError(null)

        if (isOwnPost) {
          const session = getCurrentSession()
          const accountRes = await session.getCurrentAccount()
          if (cancelled) return
          if (accountRes?.success && accountRes.data) {
            const data = accountRes.data
            setAuthorUsername(data.username ?? '')
            setAuthorIconUrl(getAvatarUrl(data))
          } else {
            setAuthorError(accountRes?.error?.message ?? 'Could not load account')
            setAuthorUsername('')
            setAuthorIconUrl(null)
          }
          return
        }

        const users = await userManager.fetchUsersBulk([id])
        if (cancelled) return
        const user = users?.[0]
        if (user) {
          setAuthorUsername(user.username ?? '')
          setAuthorIconUrl(getAvatarUrl(user))
        } else {
          setAuthorError('User not found')
          setAuthorUsername('')
          setAuthorIconUrl(null)
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setAuthorError(e?.message ?? 'Could not load author')
          setAuthorUsername('')
          setAuthorIconUrl(null)
        }
      } finally {
        if (!cancelled) setAuthorLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [author_id, isPreview, previewAuthor])

  const isVideo = postRendersAsVideo(post_type)
  const isImage = postRendersAsImage(post_type)

  let editedLine = null
  if (lastEdited != null && lastEdited !== undefined) {
    const n = Number(lastEdited)
    if (!Number.isNaN(n)) {
      editedLine = new Date(n < 1e12 ? n * 1000 : n).toLocaleString()
    }
  }

  const postedMs = uuidTimeToUnixMs(post_id != null ? String(post_id) : null)
  const postedLine = postedMs ? new Date(postedMs).toLocaleString() : null

  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="flex items-center gap-3 border-b border-[color:var(--card-border)] px-3 py-2.5">
        {authorLoading ? (
          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-[color:var(--card-border)] skeleton-pulse" />
        ) : (
          <img
            src={authorIconUrl || '/icon0.png'}
            alt=""
            className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="truncate font-semibold text-[color:var(--text-primary)]">
              {authorLoading ? '…' : authorUsername || '—'}
            </span>
            <span className="rounded-full bg-[color:var(--tab-active-bg)] px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">
              {postTypeLabel(post_type)}
            </span>
          </div>
          {authorError ? (
            <p className="text-xs text-[color:var(--text-muted)]">{authorError}</p>
          ) : null}
          {editedLine ? (
            <p className="text-xs text-[color:var(--text-muted)]">Edited {editedLine}</p>
          ) : null}
          {postedLine ? (
            <p className="text-xs text-[color:var(--text-muted)]">Posted {postedLine}</p>
          ) : null}
        </div>
      </div>

      <div className="bg-[color:var(--bg)]">
        {asset_url ? (
          isVideo ? (
            <video className="max-h-[70vh] w-full object-contain" controls playsInline src={asset_url} />
          ) : isImage ? (
            <img src={asset_url} alt="" className="max-h-[70vh] w-full object-contain" />
          ) : (
            <p className="px-3 py-6 text-center text-sm text-[color:var(--text-muted)]">
              Unsupported post type
            </p>
          )
        ) : null}
      </div>

      {body ? <PostBodyText key={body} body={body} /> : null}

      <div className="flex items-center gap-6 border-t border-[color:var(--card-border)] px-3 py-2.5 text-sm text-[color:var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="material-symbols-outlined text-lg"
            style={{ fontVariationSettings: '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24' }}
            aria-hidden
          >
            favorite
          </span>
          <span>{num_likes ?? 0}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="material-symbols-outlined text-lg"
            style={{ fontVariationSettings: '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24' }}
            aria-hidden
          >
            chat_bubble
          </span>
          <span>{num_comments ?? 0}</span>
        </span>
      </div>
    </Card>
  )
}
