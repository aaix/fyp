import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { postDetailPath } from '../lib/post.js'
import UserAvatar from './UserAvatar.jsx'

/**
 * Full-viewport short clip: one snap per screen; inner scroll when video + caption exceed viewport.
 * Desktop: video uses object-contain (no crop). Mobile: immersive cover; content sits above bottom nav via parent height.
 *
 * @param {object} props
 * @param {object} props.post
 * @param {string} props.feedType
 * @param {{ username: string, iconUrl: string | null } | null | undefined} props.authorPreview
 * @param {boolean} props.isPlaying
 * @param {HTMLElement | null} props.scrollRoot
 * @param {(postId: string, ratio: number) => void} props.onVisibilityChange
 */
export default function ShortFeedItem({
  post,
  feedType,
  authorPreview = null,
  isPlaying,
  scrollRoot,
  onVisibilityChange,
}) {
  const videoRef = useRef(null)
  const shellRef = useRef(null)
  const postId = post?.post_id != null ? String(post.post_id) : ''
  const authorId = post?.author_id != null ? String(post.author_id) : ''

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

  useEffect(() => {
    const v = videoRef.current
    if (!v || !post?.asset_url) return
    if (isPlaying) {
      v.play().catch(() => {})
    } else {
      v.pause()
    }
  }, [isPlaying, post?.asset_url])

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
      <Link
        to={postDetailPath(authorId, feedType, postId)}
        state={{ post }}
        className="flex min-h-0 flex-1 flex-col overflow-hidden text-[color:inherit] no-underline"
        aria-label={caption ? `Open short: ${caption.slice(0, 80)}` : 'Open short'}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch]">
          <div className="flex w-full shrink-0 items-center justify-center bg-black px-1 py-2 md:min-h-0 md:flex-[1_1_0%] md:basis-0 md:px-4 md:py-4">
            {post.asset_url ? (
              <video
                ref={videoRef}
                className="block bg-black max-md:max-h-[min(75dvh,calc(100dvh-var(--bottom-nav-height)-6rem))] max-md:w-full max-md:object-cover md:mx-auto md:h-auto md:max-h-[min(calc(100dvh-8rem),100%)] md:w-auto md:max-w-full md:object-contain"
                src={post.asset_url}
                muted
                loop
                playsInline
                preload="metadata"
              />
            ) : (
              <div className="flex min-h-[40dvh] w-full items-center justify-center text-sm text-white/70 md:min-h-[50dvh]">
                No media
              </div>
            )}
          </div>

          <div className="shrink-0 bg-gradient-to-b from-black/90 via-black/95 to-black px-4 pb-6 pt-4 text-white md:pb-8">
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
          </div>
        </div>
      </Link>
    </section>
  )
}
