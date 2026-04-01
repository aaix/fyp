import { Link, useLocation, useParams } from 'react-router-dom'
import PageContainer from '../components/PageContainer.jsx'
import PostView from '../components/PostView.jsx'

export default function PostPage() {
  const { postId } = useParams()
  const location = useLocation()
  const post = location.state?.post

  const idFromState = post?.post_id != null ? String(post.post_id) : null
  const matchesParam = idFromState != null && postId != null && idFromState === postId

  if (post && matchesParam) {
    return (
      <PageContainer>
        <header className="border-b border-[color:var(--card-border)] pb-3">
          <Link
            to="/"
            className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--accent)] no-underline hover:underline"
          >
            <span
              className="material-symbols-outlined text-lg"
              style={{ fontVariationSettings: '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24' }}
              aria-hidden
            >
              arrow_back
            </span>
            Back to feed
          </Link>
          <h1 className="text-xl font-bold text-[color:var(--text-primary)]">Post</h1>
        </header>
        <main className="flex flex-1 flex-col overflow-y-auto pt-2">
          <PostView
            post_id={post.post_id}
            author_id={post.author_id}
            asset_url={post.asset_url}
            post_type={post.post_type}
            content_type={post.content_type}
            body={post.body ?? null}
            last_edited={post.last_edited ?? null}
            num_comments={post.num_comments ?? 0}
            num_likes={post.num_likes ?? 0}
          />
        </main>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <header className="border-b border-[color:var(--card-border)] pb-3">
        <h1 className="text-xl font-bold text-[color:var(--text-primary)]">Post</h1>
      </header>
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto pt-4">
        <p className="text-[color:var(--text-primary)]">
          This post cannot be loaded from a direct link yet. Open it from the feed after a post list is available, or
          return to the app after creating a post.
        </p>
        {postId ? (
          <p className="text-sm text-[color:var(--text-muted)]">
            Requested id: <span className="font-mono">{postId}</span>
          </p>
        ) : null}
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[color:var(--accent)] no-underline hover:underline"
        >
          Back to feed
        </Link>
      </main>
    </PageContainer>
  )
}
