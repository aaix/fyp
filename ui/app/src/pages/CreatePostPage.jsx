import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageContainer from '../components/PageContainer.jsx'
import PostView from '../components/PostView.jsx'
import ToggleSwitch from '../components/ToggleSwitch.jsx'
import Button from '../components/Button.jsx'
import {
  FEED_TYPE_MAIN,
  FEED_TYPE_SHORTS,
  POST_TYPE_IMAGE,
  POST_TYPE_SHORT,
  POST_TYPE_VIDEO,
  postDetailPath,
  postManager,
} from '../lib/post.js'
import { getCurrentSession } from '../lib/session.js'
import { getAvatarUrl } from '../lib/utils.js'

function resolvePreviewPostType(feedType, file) {
  if (!file) return POST_TYPE_IMAGE
  const ct = file.type || ''
  if (feedType === FEED_TYPE_SHORTS) return POST_TYPE_SHORT
  if (ct.startsWith('video/')) return POST_TYPE_VIDEO
  return POST_TYPE_IMAGE
}

function fileMatchesFeed(feedType, file) {
  if (!file) return true
  const ct = file.type || ''
  if (feedType === FEED_TYPE_SHORTS) return ct.startsWith('video/')
  return ct.startsWith('image/') || ct.startsWith('video/')
}

export default function CreatePostPage() {
  const navigate = useNavigate()
  const [caption, setCaption] = useState('')
  const [feedType, setFeedType] = useState(FEED_TYPE_MAIN)
  const [file, setFile] = useState(null)
  const [previewAuthor, setPreviewAuthor] = useState(null)
  const [accountLoading, setAccountLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  const isShorts = feedType === FEED_TYPE_SHORTS
  const accept = isShorts ? 'video/*' : 'image/*,video/*'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const session = getCurrentSession()
        const res = await session.getCurrentAccount()
        if (cancelled) return
        if (res?.success && res.data) {
          const data = res.data
          setPreviewAuthor({
            username: data.username ?? '',
            iconUrl: getAvatarUrl(data),
            userId: data.user_id ?? null,
          })
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) setPreviewAuthor({ username: '', iconUrl: null, userId: null })
      } finally {
        if (!cancelled) setAccountLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file])

  const handleFeedToggle = (nextIsShorts) => {
    const next = nextIsShorts ? FEED_TYPE_SHORTS : FEED_TYPE_MAIN
    setFeedType(next)
    setFile((prev) => {
      if (!prev) return null
      return fileMatchesFeed(next, prev) ? prev : null
    })
  }

  const handleFileChange = (e) => {
    const f = e.target.files?.[0] ?? null
    setError(null)
    if (!f) {
      setFile(null)
      return
    }
    if (!fileMatchesFeed(feedType, f)) {
      setError(isShorts ? 'Shorts must be a video file.' : 'Choose an image or video.')
      setFile(null)
      e.target.value = ''
      return
    }
    setFile(f)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file || !previewAuthor?.userId) {
      setError('Choose a file to post.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const trimmed = caption.trim()
      const res = await postManager.createPost(
        trimmed.length > 0 ? trimmed : null,
        file,
        file.type,
        feedType,
      )
      if (!res?.success || !res.data) {
        const msg = res?.error?.message ?? 'Could not create post'
        console.error('createPost failed:', res)
        setError(msg)
        return
      }
      const post = res.data
      const id = post.post_id != null ? String(post.post_id) : ''
      const aid = post.author_id != null ? String(post.author_id) : ''
      if (!id || !aid) {
        console.error('createPost: missing post_id or author_id in response', post)
        setError('Invalid response from server.')
        return
      }
      navigate(postDetailPath(aid, feedType, id), { state: { post } })
    } catch (err) {
      console.error(err)
      setError(err?.message ?? 'Could not create post')
    } finally {
      setSubmitting(false)
    }
  }

  const captionForPreview = caption.trim()
  const previewPostType = resolvePreviewPostType(feedType, file)

  return (
    <PageContainer className="min-h-0 flex-1 overflow-y-auto">
      <header className="flex-shrink-0 border-b border-[color:var(--card-border)] pb-3">
        <h1 className="text-xl font-bold text-[color:var(--text-primary)]">Create post</h1>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">
          Add a caption, pick the feed type, and attach media.
        </p>
      </header>

      <form className="flex flex-shrink-0 flex-col gap-4 pt-2" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[color:var(--text-primary)]">Caption (optional)</span>
          <textarea
            value={caption}
            onChange={(ev) => setCaption(ev.target.value)}
            rows={3}
            maxLength={4096}
            placeholder="Write something…"
            className="min-h-[5rem] w-full resize-y rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-2 text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-focus)]"
          />
        </label>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-[color:var(--text-primary)]">Feed</span>
          <div className="flex items-center gap-3">
            <span className={`text-sm ${!isShorts ? 'font-semibold text-[color:var(--text-primary)]' : 'text-[color:var(--text-muted)]'}`}>
              Regular
            </span>
            <ToggleSwitch
              checked={isShorts}
              onChange={handleFeedToggle}
              ariaLabel="Shorts feed"
              onLabel="Shorts"
              offLabel="Regular"
            />
            <span className={`text-sm ${isShorts ? 'font-semibold text-[color:var(--text-primary)]' : 'text-[color:var(--text-muted)]'}`}>
              Shorts
            </span>
          </div>
        </div>
        <p className="text-xs text-[color:var(--text-muted)]">
          {isShorts
            ? 'Shorts accept video only.'
            : 'Regular posts accept images or videos.'}
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[color:var(--text-primary)]">Attachment</span>
          <input
            key={accept}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="text-sm text-[color:var(--text-primary)] file:mr-3 file:rounded-button file:border-0 file:bg-[color:var(--accent)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[color:var(--bg)] hover:file:bg-[color:var(--accent-hover)]"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" disabled={submitting || !file || accountLoading || !previewAuthor?.userId}>
          {submitting ? 'Posting…' : 'Post'}
        </Button>
      </form>

      <section className="flex flex-shrink-0 flex-col gap-2 border-t border-[color:var(--card-border)] pt-4 pb-1">
        <h2 className="text-sm font-semibold text-[color:var(--text-muted)]">Preview</h2>
        {file && previewUrl && previewAuthor ? (
          <PostView
            isPreview
            previewAuthor={previewAuthor}
            post_id="00000000-0000-0000-0000-000000000000"
            author_id={previewAuthor.userId}
            asset_url={previewUrl}
            post_type={previewPostType}
            body={captionForPreview.length > 0 ? captionForPreview : null}
            last_edited={null}
            num_comments={0}
            num_likes={0}
          />
        ) : (
          <p className="text-sm text-[color:var(--text-muted)]">
            {accountLoading ? 'Loading…' : 'Choose a file to see a preview.'}
          </p>
        )}
      </section>
    </PageContainer>
  )
}
