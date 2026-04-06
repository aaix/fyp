import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { postDetailPath, postManager } from '../lib/post.js'
import UserAvatar from './UserAvatar.jsx'

function formatShortCount(n) {
  const x = Number(n)
  if (!Number.isFinite(x) || x < 0) return '0'
  if (x < 1000) return String(Math.floor(x))
  if (x < 10_000) return `${(x / 1000).toFixed(1).replace(/\.0$/, '')}k`
  if (x < 1_000_000) return `${Math.floor(x / 1000)}k`
  return `${(x / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
}

/** Auto-hide after user pauses (play_arrow). */
const OVERLAY_HIDE_AFTER_PAUSE_MS = 1000
/** Auto-hide after user resumes (pause glyph) — shorter so it doesn’t sit on top of playing video. */
const OVERLAY_HIDE_AFTER_RESUME_MS = 450

/**
 * Full-viewport short clip: one snap per screen; inner scroll when video + caption exceed viewport.
 * Audio plays when active only after user gesture; tap video to pause/resume. Desktop: object-contain.
 *
 * @param {object} props
 * @param {object} props.post
 * @param {string} props.feedType
 * @param {{ username: string, iconUrl: string | null } | null | undefined} props.authorPreview
 * @param {boolean} props.isPlaying
 * @param {boolean} props.audioUnlocked - user has scrolled or interacted (required for audible autoplay)
 * @param {React.MutableRefObject<boolean>} props.suppressVideoToggleRef - skip one tap after unlock
 * @param {HTMLElement | null} props.scrollRoot
 * @param {(postId: string, ratio: number) => void} props.onVisibilityChange
 * @param {(postId: string, partial: object) => void} [props.patchPost] - merge fields into feed item after like
 */
export default function ShortFeedItem({
  post,
  feedType,
  authorPreview = null,
  isPlaying,
  audioUnlocked,
  suppressVideoToggleRef,
  scrollRoot,
  onVisibilityChange,
  patchPost,
}) {
  const videoRef = useRef(null)
  const shellRef = useRef(null)
  const userOverlayTimerRef = useRef(null)
  const [userPaused, setUserPaused] = useState(false)
  /** After user tap: `pause` while playing (tap to pause), `play_arrow` while user-paused (tap to play); auto-hides */
  const [userPulseIcon, setUserPulseIcon] = useState(null)
  const [playbackFailed, setPlaybackFailed] = useState(false)
  const [likePending, setLikePending] = useState(false)
  const tapTimerRef = useRef(null)
  const tapCountRef = useRef(0)
  const postId = post?.post_id != null ? String(post.post_id) : ''
  const authorId = post?.author_id != null ? String(post.author_id) : ''
  const likedByMe = post?.liked_by_me === true
  const numLikes = (() => {
    const x = post?.num_likes
    const n = typeof x === 'number' ? x : Number(x)
    return Number.isFinite(n) ? n : 0
  })()

  const clearUserOverlayTimer = () => {
    if (userOverlayTimerRef.current != null) {
      clearTimeout(userOverlayTimerRef.current)
      userOverlayTimerRef.current = null
    }
  }

  const clearTapTimer = () => {
    if (tapTimerRef.current != null) {
      clearTimeout(tapTimerRef.current)
      tapTimerRef.current = null
    }
  }

  const handleLikeToggle = async () => {
    if (likePending || !patchPost || !feedType || !postId || !authorId) return
    setLikePending(true)
    try {
      const res = likedByMe
        ? await postManager.unlikePost(authorId, feedType, postId)
        : await postManager.likePost(authorId, feedType, postId)
      if (res?.success) {
        patchPost(postId, {
          liked_by_me: !likedByMe,
          num_likes: Math.max(0, numLikes + (likedByMe ? -1 : 1)),
        })
      } else {
        console.error(res?.error)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLikePending(false)
    }
  }

  const handleDoubleTapLike = async () => {
    if (likePending || !patchPost || !feedType || !postId || !authorId) return
    if (post?.liked_by_me === true) return
    setLikePending(true)
    try {
      const res = await postManager.likePost(authorId, feedType, postId)
      if (res?.success) {
        patchPost(postId, {
          liked_by_me: true,
          num_likes: Math.max(0, numLikes + 1),
        })
      } else {
        console.error(res?.error)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLikePending(false)
    }
  }

  const performSingleTapPauseToggle = () => {
    setUserPaused((p) => {
      const next = !p
      clearUserOverlayTimer()
      setUserPulseIcon(next ? 'play_arrow' : 'pause')
      const hideMs = next ? OVERLAY_HIDE_AFTER_PAUSE_MS : OVERLAY_HIDE_AFTER_RESUME_MS
      userOverlayTimerRef.current = window.setTimeout(() => {
        setUserPulseIcon(null)
        userOverlayTimerRef.current = null
      }, hideMs)
      return next
    })
  }

  useEffect(() => {
    const el = shellRef.current
    if (!el || !postId) return
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0]
        if (e) onVisibilityChange(postId, e.intersectionRatio)
      },
      {
        root: scrollRoot ?? null,
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
      },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [postId, scrollRoot, onVisibilityChange])

  const shouldPlay = Boolean(isPlaying && audioUnlocked && !userPaused)

  useEffect(() => {
    const v = videoRef.current
    if (!v || !post?.asset_url) return

    if (!shouldPlay) {
      v.pause()
      return
    }

    const tryPlay = async () => {
      v.muted = false
      try {
        await v.play()
        setPlaybackFailed(false)
      } catch {
        v.pause()
        setPlaybackFailed(true)
      }
    }

    void tryPlay()
  }, [shouldPlay, post?.asset_url])

  /** Inactive / waiting / autoplay blocked — show play arrow; stays until state changes */
  const externalStatusIcon = useMemo(() => {
    if (!isPlaying) return 'play_arrow'
    if (!audioUnlocked) return 'play_arrow'
    if (shouldPlay && playbackFailed) return 'play_arrow'
    return null
  }, [isPlaying, audioUnlocked, shouldPlay, playbackFailed])

  useEffect(() => {
    if (!isPlaying) {
      clearUserOverlayTimer()
      clearTapTimer()
      tapCountRef.current = 0
    }
  }, [isPlaying])

  const onVideoPointerUp = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (suppressVideoToggleRef?.current) return
    if (!audioUnlocked) return

    tapCountRef.current += 1
    if (tapCountRef.current === 1) {
      tapTimerRef.current = window.setTimeout(() => {
        if (tapCountRef.current === 1) {
          performSingleTapPauseToggle()
        }
        tapCountRef.current = 0
        tapTimerRef.current = null
      }, 280)
    } else if (tapCountRef.current === 2) {
      clearTapTimer()
      tapCountRef.current = 0
      void handleDoubleTapLike()
    }
  }

  useEffect(() => {
    return () => {
      clearUserOverlayTimer()
      clearTapTimer()
    }
  }, [])

  /** Drop user tap overlay when this clip is not the active one (external row takes over). */
  const statusIcon = externalStatusIcon ?? (isPlaying ? userPulseIcon : null)

  const caption =
    post?.body && String(post.body).trim().length > 0 ? String(post.body).trim() : null

  if (!postId || !authorId) {
    return null
  }

  return (
    <section
      ref={shellRef}
      data-short-item
      data-post-id={postId}
      className="flex snap-start flex-col overflow-hidden bg-black max-md:h-[calc(100dvh-var(--bottom-nav-height))] max-md:min-h-[calc(100dvh-var(--bottom-nav-height))] md:h-full md:min-h-full"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch]">
        <div className="relative flex w-full shrink-0 items-center justify-center bg-black px-1 py-2 md:min-h-0 md:flex-[1_1_0%] md:basis-0 md:px-4 md:py-4">
          {post.asset_url ? (
            <>
              <video
                ref={videoRef}
                className="block cursor-pointer bg-black max-md:max-h-[min(75dvh,calc(100dvh-var(--bottom-nav-height)-6rem))] max-md:w-full max-md:object-cover md:mx-auto md:h-auto md:max-h-[min(calc(100dvh-8rem),100%)] md:w-auto md:max-w-full md:object-contain"
                src={post.asset_url}
                loop
                playsInline
                preload="metadata"
                disablePictureInPicture
                controlsList="nodownload nopictureinpicture"
                onPointerUp={onVideoPointerUp}
                onPlaying={() => {
                  setPlaybackFailed(false)
                  clearUserOverlayTimer()
                  setUserPulseIcon(null)
                }}
              />
              {statusIcon ? (
                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 transition-opacity duration-100"
                  aria-hidden
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-black/55 shadow-lg">
                    <span
                      className="material-symbols-outlined block text-[2.5rem] leading-none text-white"
                      style={{ fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24' }}
                    >
                      {statusIcon}
                    </span>
                  </div>
                </div>
              ) : null}
              {patchPost ? (
                <div className="absolute right-2 bottom-24 z-20 flex flex-col items-center gap-0.5 md:bottom-28">
                  <button
                    type="button"
                    disabled={likePending}
                    aria-label={likedByMe ? 'Unlike' : 'Like'}
                    aria-pressed={likedByMe}
                    onClick={(ev) => {
                      ev.preventDefault()
                      ev.stopPropagation()
                      void handleLikeToggle()
                    }}
                    className="flex h-12 w-12 shrink-0 touch-manipulation items-center justify-center rounded-full border-0 bg-black/45 p-0 text-white shadow-lg backdrop-blur-sm transition active:scale-95 disabled:opacity-50"
                  >
                    <span
                      className="material-symbols-outlined text-[2rem] leading-none"
                      style={{
                        fontVariationSettings: likedByMe
                          ? '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24'
                          : '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24',
                      }}
                    >
                      favorite
                    </span>
                  </button>
                  <span className="max-w-[3rem] truncate text-center text-xs font-semibold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                    {formatShortCount(numLikes)}
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex min-h-[40dvh] w-full items-center justify-center text-sm text-white/70 md:min-h-[50dvh]">
              No media
            </div>
          )}
        </div>

        <Link
          to={postDetailPath(authorId, feedType, postId)}
          state={{ post }}
          className="shrink-0 bg-gradient-to-b from-black/90 via-black/95 to-black px-4 pb-6 pt-4 text-[color:inherit] no-underline md:pb-8"
          aria-label={caption ? `Open short: ${caption.slice(0, 80)}` : 'Open short'}
        >
          <div className="flex max-w-full items-start gap-3">
            <UserAvatar
              userId={authorId}
              src={authorPreview?.iconUrl ?? null}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full border-2 border-white/40 object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">
                {authorPreview?.username
                  ? `@${String(authorPreview.username).replace(/^@+/, '')}`
                  : '…'}
              </p>
              {caption ? (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/90">
                  {caption}
                </p>
              ) : null}
            </div>
          </div>
        </Link>
      </div>
    </section>
  )
}
