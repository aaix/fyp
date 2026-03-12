import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { userManager, mapSearchResponseToUserList } from '../lib/user.js'
import { useDebouncedValue } from '../lib/useDebounce.js'
import PageContainer from '../components/PageContainer.jsx'
import Button from '../components/Button.jsx'

const SEARCH_DEBOUNCE_MS = 150
const MIN_QUERY_LENGTH = 2

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const navigate = useNavigate()
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS)

  const runSearch = useCallback(async (q) => {
    if (q.length < MIN_QUERY_LENGTH) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await userManager.searchUsers(q)
      const raw = res?.success ? (res?.data ?? []) : []
      setUsers(mapSearchResponseToUserList(raw))
    } catch (err) {
      console.error(err)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debouncedQuery.length < MIN_QUERY_LENGTH) {
      setUsers([])
      setSearched(false)
      return
    }
    runSearch(debouncedQuery)
  }, [debouncedQuery, runSearch])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (query.trim().length >= MIN_QUERY_LENGTH) runSearch(query.trim())
  }

  const handleUserClick = (user) => {
    navigate(`/user/${user.user_id}`, { state: { user } })
  }

  return (
    <PageContainer>
      <header className="border-b border-[color:var(--card-border)] pb-3">
        <h1 className="text-xl font-bold text-[color:var(--text-primary)]">Search users</h1>
      </header>
      <form
        className="flex flex-shrink-0 gap-2 border-b border-[color:var(--card-border)] pb-3 pt-3"
        onSubmit={handleSubmit}
      >
        <input
          type="search"
          className="flex-1 rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
          placeholder="Search by username..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search by username"
          minLength={2}
        />
        <Button
          type="submit"
          variant="ghost"
          className="px-3 py-2 text-sm"
          disabled={loading}
        >
          {loading ? 'Searching…' : 'Search'}
        </Button>
      </form>
      <div className="flex flex-1 flex-col overflow-y-auto pt-2">
        {loading && (
          <ul className="mt-1 space-y-1" role="list" aria-label="Loading">
            {Array.from({ length: 5 }, (_, i) => (
              <li
                key={i}
                className="flex items-center gap-3 border-b border-[color:var(--card-border)] px-1 py-2"
              >
                <div className="h-11 w-11 rounded-full border border-[color:var(--card-border)] bg-[color:var(--card-bg)] skeleton-pulse" />
                <div className="h-4 w-32 rounded bg-[color:var(--card-bg)] skeleton-pulse" />
              </li>
            ))}
          </ul>
        )}
        {!loading && searched && users.length === 0 && (
          <p className="mt-3 text-sm text-[color:var(--text-muted)]">No users found.</p>
        )}
        {!loading && users.length > 0 && (
          <ul className="mt-2 space-y-0.5" role="list">
            {users.map((user) => (
              <li key={user.user_id}>
                <Button
                  type="button"
                  variant="text"
                  size="sm"
                  className="w-full justify-start gap-3 rounded-none border-b border-[color:var(--card-border)] px-1 py-2 text-left text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--card-bg)]"
                  onClick={() => handleUserClick(user)}
                >
                  {user.icon_url ? (
                    <img
                      src={user.icon_url}
                      alt={user.username ? `${user.username}'s avatar` : 'User avatar'}
                      className="h-11 w-11 flex-shrink-0 rounded-full border border-[color:var(--card-border)] object-cover"
                    />
                  ) : (
                    <div className="h-11 w-11 flex-shrink-0 rounded-full border border-[color:var(--card-border)] bg-[color:var(--card-bg)]" />
                  )}
                  <span className="font-medium">@{user.username}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageContainer>
  )
}
