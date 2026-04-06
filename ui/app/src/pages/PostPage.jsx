import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import PageContainer from '../components/PageContainer.jsx'
import PostView from '../components/PostView.jsx'
import Button from '../components/Button.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { getCurrentSession } from '../lib/session.js'
import {
  FEED_TYPE_MAIN,
  FEED_TYPE_SHORTS,
  POST_UPDATE_COMPLETED,
  POST_UPDATE_ERROR,
  describePostUpdateType,
  feedTypeMatchesPostType,
  postManager,
} from '../lib/post.js'

/** Current user id from session (localStorage); used only for “is mine”, not for fetching. */
function getSessionUserId() {
  try {
    const s = getCurrentSession()
    const id = s.user_id ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('user_id') : null)
    return id != null && id !== '' ? String(id) : null
  } catch {
    return null
  }
}

export default function PostPage() {
  const { authorId: urlAuthorId, feedType: urlFeedType, postId: urlPostId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const statePost = location.state?.post ?? null
  const [post, setPost] = useState(() => statePost)
  const [loadingPost, setLoadingPost] = useState(false)
  const [postError, setPostError] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [draftBody, setDraftBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [pipelineSteps, setPipelineSteps] = useState(() => [])
  const [likedByMe, setLikedByMe] = useState(false)
  const [likePending, setLikePending] = useState(false)
  const [likeError, setLikeError] = useState(null)

  const sessionUserId = getSessionUserId()

  const feedTypeKey =
    urlFeedType === FEED_TYPE_MAIN || urlFeedType === FEED_TYPE_SHORTS ? urlFeedType : null
  const routeParamsValid = Boolean(urlAuthorId && urlPostId && feedTypeKey)

  const authorId = post?.author_id != null ? String(post.author_id) : null
  const postIdFromPost = post?.post_id != null ? String(post.post_id) : null
  const postIsPrivate = post?.is_private === true

  const postMatchesRoute =
    Boolean(post) &&
    routeParamsValid &&
    postIdFromPost === String(urlPostId) &&
    authorId === String(urlAuthorId) &&
    feedTypeMatchesPostType(feedTypeKey, post.post_type)

  useEffect(() => {
    const next = statePost
    setPost(next)
    setEditMode(false)
    setSaving(false)
    setDeleting(false)
    setConfirmDeleteOpen(false)
    setActionError(null)
    setPostError(null)
    setDraftBody(next?.body != null ? String(next.body) : '')
  }, [location.key, statePost])

  useEffect(() => {
    setLikedByMe(false)
    setLikeError(null)
  }, [urlPostId])

  useEffect(() => {
    if (!routeParamsValid || !feedTypeKey) return

    let cancelled = false
    ;(async () => {
      try {
        setLoadingPost(true)
        setPostError(null)
        const res =
          (await postManager.getPost(String(urlAuthorId), feedTypeKey, String(urlPostId))) ?? null
        if (cancelled) return
        if (res?.success && res.data) {
          const d = res.data
          if (
            String(d.post_id) !== String(urlPostId) ||
            String(d.author_id) !== String(urlAuthorId) ||
            !feedTypeMatchesPostType(feedTypeKey, d.post_type)
          ) {
            setPost(null)
            setPostError('This post does not match the URL.')
          } else {
            setPost(d)
          }
        } else {
          setPost(null)
          setPostError(res?.error?.message ?? 'Could not load post')
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setPost(null)
          setPostError(e?.message ?? 'Could not load post')
        }
      } finally {
        if (!cancelled) setLoadingPost(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [routeParamsValid, feedTypeKey, urlAuthorId, urlPostId])

  /** Async create: gateway `post_update` events until the post is public (buffered in postManager if early). */
  useEffect(() => {
    if (!routeParamsValid || !feedTypeKey) {
      setPipelineSteps([])
      return
    }
    if (!postIdFromPost || postIdFromPost !== String(urlPostId)) {
      setPipelineSteps([])
      return
    }
    if (!postIsPrivate) {
      postManager.clearBufferedPostUpdates(String(urlPostId))
      setPipelineSteps([])
      return
    }

    const syncStepsFromBuffer = () => {
      const types = postManager.getBufferedPostUpdates(String(urlPostId))
      setPipelineSteps(types.map((x) => ({ updateType: x, text: describePostUpdateType(x) })))
    }

    syncStepsFromBuffer()

    const unsub = postManager.subscribePostUpdates(String(urlPostId), (t) => {
      syncStepsFromBuffer()
      if (t === POST_UPDATE_COMPLETED) {
        ;(async () => {
          try {
            const res = await postManager.getPost(String(urlAuthorId), feedTypeKey, String(urlPostId))
            if (res?.success && res.data) {
              setPost(res.data)
              postManager.clearBufferedPostUpdates(String(urlPostId))
            }
          } catch (e) {
            console.error(e)
          }
        })()
      }
    })

    return () => {
      unsub()
    }
  }, [routeParamsValid, feedTypeKey, urlAuthorId, urlPostId, postIdFromPost, postIsPrivate])

  const isMine = Boolean(sessionUserId && authorId && sessionUserId === authorId)

  const pipelineHasError = pipelineSteps.some((s) => s.updateType === POST_UPDATE_ERROR)
  const showPipelineBanner =
    pipelineSteps.length > 0 && (post?.is_private === true || pipelineHasError)

  if (!routeParamsValid) {
    return (
      <PageContainer className="min-h-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[color:var(--card-border)] pb-3">
          <h1 className="sr-only">Post</h1>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-4">
          <p className="text-sm text-[color:var(--text-muted)]" role="alert">
            Invalid post URL. Use{' '}
            <code className="rounded bg-[color:var(--card-bg)] px-1 font-mono text-xs">
              /post/user/&lt;author id&gt;/&lt;feed&gt;/&lt;post id&gt;
            </code>{' '}
            with feed <code className="font-mono">{FEED_TYPE_MAIN}</code> or{' '}
            <code className="font-mono">{FEED_TYPE_SHORTS}</code> (same path shape as{' '}
            <code className="font-mono">getUserPosts</code> / <code className="font-mono">getPost</code>).
          </p>
          <Link
            to="/"
            className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[color:var(--accent)] no-underline hover:underline"
          >
            Back
          </Link>
        </main>
      </PageContainer>
    )
  }

  if (postMatchesRoute) {
    const handleBack = () => {
      try {
        if (window.history.length > 1) navigate(-1)
        else navigate('/', { replace: true })
      } catch {
        navigate('/', { replace: true })
      }
    }
    const handleStartEdit = () => {
      setActionError(null)
      setDraftBody(post?.body != null ? String(post.body) : '')
      setEditMode(true)
    }

    const handleCancelEdit = () => {
      setActionError(null)
      setDraftBody(post?.body != null ? String(post.body) : '')
      setEditMode(false)
    }

    const handleSave = async () => {
      if (!authorId || post?.post_id == null || !feedTypeKey) return
      try {
        setSaving(true)
        setActionError(null)
        const trimmed = typeof draftBody === 'string' ? draftBody.trim() : ''
        const nextBody = trimmed.length > 0 ? trimmed : null
        const res = await postManager.editPost(
          String(urlAuthorId),
          feedTypeKey,
          String(post.post_id),
          nextBody,
        )
        if (!res?.success || !res?.data) {
          setActionError(res?.error?.message ?? 'Could not update post')
          return
        }
        setPost(res.data)
        setEditMode(false)
      } catch (e) {
        console.error(e)
        setActionError(e?.message ?? 'Could not update post')
      } finally {
        setSaving(false)
      }
    }

    const handleLikeToggle = async () => {
      if (!feedTypeKey || post?.post_id == null || likePending) return
      setLikeError(null)
      setLikePending(true)
      try {
        const res = likedByMe
          ? await postManager.unlikePost(String(urlAuthorId), feedTypeKey, String(post.post_id))
          : await postManager.likePost(String(urlAuthorId), feedTypeKey, String(post.post_id))
        if (res?.success) {
          setLikedByMe((v) => !v)
          const refresh = await postManager.getPost(
            String(urlAuthorId),
            feedTypeKey,
            String(urlPostId),
          )
          if (refresh?.success && refresh.data) {
            setPost(refresh.data)
          }
        } else {
          const msg = res?.error?.message ?? 'Could not update like'
          setLikeError(msg)
          console.error(res?.error)
        }
      } catch (e) {
        console.error(e)
        setLikeError(e?.message ?? 'Could not update like')
      } finally {
        setLikePending(false)
      }
    }

    const handleDelete = async () => {
      if (!authorId || post?.post_id == null || !feedTypeKey) return
      try {
        setDeleting(true)
        setActionError(null)
        const res = await postManager.deletePost(String(urlAuthorId), feedTypeKey, String(post.post_id))
        if (!res?.success) {
          setActionError(res?.error?.message ?? 'Could not delete post')
          return
        }
        navigate('/', { replace: true })
      } catch (e) {
        console.error(e)
        setActionError(e?.message ?? 'Could not delete post')
      } finally {
        setDeleting(false)
        setConfirmDeleteOpen(false)
      }
    }

    return (
      <PageContainer className="min-h-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[color:var(--card-border)] pb-3">
          <button
            type="button"
            onClick={handleBack}
            className="mb-2 inline-flex items-center gap-1 border-0 bg-transparent p-0 text-sm font-medium text-[color:var(--accent)] hover:underline"
          >
            <span
              className="material-symbols-outlined text-lg"
              style={{ fontVariationSettings: '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24' }}
              aria-hidden
            >
              arrow_back
            </span>
            Back
          </button>
          <div className="flex items-center justify-between gap-3">
            <h1 className="sr-only">Post</h1>
            {isMine ? (
              <div className="flex items-center gap-2">
                {editMode ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={saving || deleting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSave}
                      disabled={saving || deleting}
                    >
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleStartEdit}
                      disabled={saving || deleting}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setConfirmDeleteOpen(true)}
                      disabled={saving || deleting}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-2">
          {showPipelineBanner ? (
            <div
              role={pipelineHasError ? 'alert' : 'status'}
              aria-live="polite"
              className={
                pipelineHasError
                  ? 'mb-2 rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
                  : 'mb-2 rounded-card border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)]'
              }
            >
              <p className="mb-1 text-xs font-semibold text-[color:var(--text-muted)]">Post status</p>
              <ul className="list-none space-y-1">
                {pipelineSteps.map((step, i) => (
                  <li
                    key={`${i}-${step.updateType}`}
                    className={
                      step.updateType === POST_UPDATE_ERROR ? 'text-red-800 dark:text-red-200' : ''
                    }
                  >
                    {step.text}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {actionError ? (
            <p className="mb-2 text-sm text-red-600" role="alert">
              {actionError}
            </p>
          ) : null}
          {postError ? (
            <p className="mb-2 text-sm text-red-600" role="alert">
              {postError}
            </p>
          ) : null}
          {loadingPost ? (
            <p className="mb-2 text-sm text-[color:var(--text-muted)]" aria-busy="true">
              Loading post…
            </p>
          ) : null}
          {isMine && editMode ? (
            <div className="mb-3 rounded-card border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3">
              <label className="mb-2 block text-xs font-semibold text-[color:var(--text-muted)]">
                Caption
              </label>
              <textarea
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                rows={4}
                className="w-full resize-y rounded-card border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent)]"
                placeholder="Add a caption…"
                disabled={saving || deleting}
              />
              <p className="mt-2 text-xs text-[color:var(--text-muted)]">
                Media cannot be changed yet.
              </p>
            </div>
          ) : null}
          <PostView
            post_id={post.post_id}
            author_id={post.author_id}
            asset_url={post.asset_url}
            post_type={post.post_type}
            body={isMine && editMode ? (draftBody || null) : (post.body ?? null)}
            last_edited={post.last_edited ?? null}
            num_comments={post.num_comments ?? 0}
            num_likes={post.num_likes ?? 0}
            likeInteractive
            likedByMe={likedByMe}
            likePending={likePending}
            likeError={likeError}
            onLikeToggle={handleLikeToggle}
          />
          <ConfirmModal
            open={confirmDeleteOpen}
            title="Delete post?"
            description="This will permanently delete this post. This action cannot be undone."
            confirmLabel={deleting ? 'Deleting…' : 'Delete'}
            cancelLabel="Cancel"
            confirmVariant="danger"
            confirmDisabled={deleting || saving}
            onConfirm={handleDelete}
            onCancel={() => (deleting ? null : setConfirmDeleteOpen(false))}
            labelledById="delete-post-title"
          />
        </main>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[color:var(--card-border)] pb-3">
        <h1 className="sr-only">Post</h1>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-4">
        {loadingPost ? (
          <p className="text-sm text-[color:var(--text-muted)]" aria-busy="true">
            Loading post…
          </p>
        ) : null}
        {postError ? (
          <p className="text-sm text-red-600" role="alert">
            {postError}
          </p>
        ) : null}
        {!loadingPost && !postError && !post ? (
          <p className="text-sm text-[color:var(--text-muted)]">Could not load this post.</p>
        ) : null}
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[color:var(--accent)] no-underline hover:underline"
        >
          Back
        </Link>
      </main>
    </PageContainer>
  )
}
