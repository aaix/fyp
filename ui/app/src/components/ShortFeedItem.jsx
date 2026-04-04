import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { postDetailPath } from '../lib/post.js'
import UserAvatar from './UserAvatar.jsx'

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
}) {
  const videoRef = useRef(null)
  const shellRef = useRef(null)
  const userOverlayTimerRef = useRef(null)
  const [userPaused, setUserPaused] = useState(false)
  /** After user tap: `pause` while playing (tap to pause), `play_arrow` while user-paused (tap to play); auto-hides */
  const [userPulseIcon, setUserPulseIcon] = useState(null)
  const [playbackFailed, setPlaybackFailed] = useState(false)
  const postId = post?.post_id != null ? String(post.post_id) : ''
  const authorId = post?.author_id != null ? String(post.author_id) : ''

  const clearUserOverlayTimer = () => {
    if (userOverlayTimerRef.current != null) {
      clearTimeout(userOverlayTimerRef.current)
      userOverlayTimerRef.current = null
    }
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
    }
  }, [isPlaying])

  const onVideoPointerUp = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (suppressVideoToggleRef?.current) return
    if (!audioUnlocked) return

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
    return () => {
      clearUserOverlayTimer()
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
