import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import PageContainer from '../components/PageContainer.jsx'
import PostView from '../components/PostView.jsx'
import Button from '../components/Button.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { getCurrentSession } from '../lib/session.js'
import {
  FEED_TYPE_MAIN,
  FEED_TYPE_SHORTS,
  POST_TYPE_SHORT,
  POST_UPDATE_COMPLETED,
  POST_UPDATE_ERROR,
  describePostUpdateType,
  postManager,
} from '../lib/post.js'

const authorStorageKey = (postId) => `postPage.author:${postId}`

function readStoredAuthorId(postId) {
  if (!postId || typeof sessionStorage === 'undefined') return null
  try {
    const v = sessionStorage.getItem(authorStorageKey(postId))
    return v != null && v !== '' ? String(v) : null
  } catch {
    return null
  }
}

function writeStoredAuthorId(postId, authorId) {
  if (!postId || authorId == null || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(authorStorageKey(postId), String(authorId))
  } catch {
    /* ignore quota / private mode */
  }
}

function clearStoredAuthorId(postId) {
  if (!postId || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(authorStorageKey(postId))
  } catch {
    /* ignore */
  }
}

/** Current user id from session (localStorage); no account/profile API call. */
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
  const { postId } = useParams()
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

  const sessionUserId = getSessionUserId()

  const idFromState = post?.post_id != null ? String(post.post_id) : null
  const matchesParam = idFromState != null && postId != null && idFromState === postId
  const authorId = post?.author_id != null ? String(post.author_id) : null
  const feedTypeFromPost =
    post?.post_type != null && Number(post.post_type) === POST_TYPE_SHORT ? FEED_TYPE_SHORTS : FEED_TYPE_MAIN

  const postIdFromPost = post?.post_id != null ? String(post.post_id) : null
  const postIsPrivate = post?.is_private === true
  const authorForPipelineRefetch = post?.author_id != null ? String(post.author_id) : null

  /** API route is GET /user/{author}/post/{id}; URL only has postId, so we persist author after first load. */
  const authorIdForFetch = useMemo(() => {
    if (!postId) return null
    if (post?.author_id != null) return String(post.author_id)
    const stored = readStoredAuthorId(postId)
    if (stored) return stored
    return sessionUserId
  }, [postId, post?.author_id, sessionUserId])

  useEffect(() => {
    // Keep post in sync if navigated from another tile without unmounting.
    const next = statePost
    setPost(next)
    setEditMode(false)
    setSaving(false)
    setDeleting(false)
    setConfirmDeleteOpen(false)
    setActionError(null)
    setPostError(null)
    setDraftBody(next?.body != null ? String(next.body) : '')
    if (next?.author_id != null && postId) {
      writeStoredAuthorId(postId, next.author_id)
    }
  }, [location.key, statePost, postId])

  // Always refetch from API (e.g. hard refresh) — no reliance on stale client state.
  useEffect(() => {
    if (!postId || !authorIdForFetch) return

    let cancelled = false
    ;(async () => {
      try {
        setLoadingPost(true)
        setPostError(null)
        // Direct links don't include feed type; try feed first, then shorts.
        const res =
          (await postManager.getPost(String(authorIdForFetch), FEED_TYPE_MAIN, String(postId))) ??
          null
        let effective = res
        if (!effective?.success) {
          effective = await postManager.getPost(String(authorIdForFetch), FEED_TYPE_SHORTS, String(postId))
        }
        if (cancelled) return
        if (effective?.success && effective.data) {
          setPost(effective.data)
          if (effective.data.author_id != null) {
            writeStoredAuthorId(postId, effective.data.author_id)
          }
        } else {
          setPost(null)
          setPostError(effective?.error?.message ?? 'Could not load post')
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
  }, [postId, authorIdForFetch])

  /** Async create: gateway `post_update` events until the post is public (buffered in postManager if early). */
  useEffect(() => {
    if (!postId || !postIdFromPost || postIdFromPost !== String(postId)) {
      setPipelineSteps([])
      return
    }
    if (!postIsPrivate) {
      postManager.clearBufferedPostUpdates(String(postId))
      setPipelineSteps([])
      return
    }

    const syncStepsFromBuffer = () => {
      const types = postManager.getBufferedPostUpdates(String(postId))
      setPipelineSteps(types.map((x) => ({ updateType: x, text: describePostUpdateType(x) })))
    }

    syncStepsFromBuffer()

    const unsub = postManager.subscribePostUpdates(String(postId), (t) => {
      syncStepsFromBuffer()
      if (t === POST_UPDATE_COMPLETED) {
        ;(async () => {
          const aid = authorForPipelineRefetch ?? readStoredAuthorId(postId) ?? sessionUserId
          if (!aid) return
          try {
            let res = await postManager.getPost(String(aid), FEED_TYPE_MAIN, String(postId))
            if (!res?.success) {
              res = await postManager.getPost(String(aid), FEED_TYPE_SHORTS, String(postId))
            }
            if (res?.success && res.data) {
              setPost(res.data)
              if (res.data.author_id != null) {
                writeStoredAuthorId(postId, res.data.author_id)
              }
              postManager.clearBufferedPostUpdates(String(postId))
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
  }, [postId, postIdFromPost, postIsPrivate, authorForPipelineRefetch, sessionUserId])

  const isMine = Boolean(sessionUserId && authorId && sessionUserId === authorId)

  const pipelineHasError = pipelineSteps.some((s) => s.updateType === POST_UPDATE_ERROR)
  const showPipelineBanner =
    pipelineSteps.length > 0 && (post?.is_private === true || pipelineHasError)

  if (post && (matchesParam || (postId != null && String(post.post_id) === String(postId)))) {
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
      if (!authorId || post?.post_id == null) return
      try {
        setSaving(true)
        setActionError(null)
        const trimmed = typeof draftBody === 'string' ? draftBody.trim() : ''
        const nextBody = trimmed.length > 0 ? trimmed : null
        const res = await postManager.editPost(authorId, feedTypeFromPost, String(post.post_id), nextBody)
        if (!res?.success || !res?.data) {
          setActionError(res?.error?.message ?? 'Could not update post')
          return
        }
        setPost(res.data)
        if (postId && res.data.author_id != null) {
          writeStoredAuthorId(postId, res.data.author_id)
        }
        setEditMode(false)
      } catch (e) {
        console.error(e)
        setActionError(e?.message ?? 'Could not update post')
      } finally {
        setSaving(false)
      }
    }

    const handleDelete = async () => {
      if (!authorId || post?.post_id == null) return
      try {
        setDeleting(true)
        setActionError(null)
        const res = await postManager.deletePost(authorId, feedTypeFromPost, String(post.post_id))
        if (!res?.success) {
          setActionError(res?.error?.message ?? 'Could not delete post')
          return
        }
        if (postId) clearStoredAuthorId(postId)
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
      <PageContainer>
        <header className="border-b border-[color:var(--card-border)] pb-3">
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
            <h1 className="text-xl font-bold text-[color:var(--text-primary)]">Post</h1>
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
        <main className="flex flex-1 flex-col overflow-y-auto pt-2">
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
                      step.updateType === POST_UPDATE_ERROR
                        ? 'text-red-800 dark:text-red-200'
                        : ''
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

  const missingAuthor = Boolean(postId && !authorIdForFetch)

  return (
    <PageContainer>
      <header className="border-b border-[color:var(--card-border)] pb-3">
        <h1 className="text-xl font-bold text-[color:var(--text-primary)]">Post</h1>
      </header>
      <main className="flex flex-1 flex-col gap-3 overflow-y-auto pt-4">
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
        {missingAuthor && !loadingPost ? (
          <p className="text-sm text-[color:var(--text-muted)]">
            Open this post from the feed or a profile once so we can load it (author id is required for the URL you
            have).
          </p>
        ) : null}
        {!loadingPost && !postError && !missingAuthor && !post ? (
          <p className="text-sm text-[color:var(--text-muted)]">Loading…</p>
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
