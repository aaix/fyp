import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { userManager, mapSearchResponseToUserList } from '../lib/user.js'
import { useDebouncedValue } from '../lib/useDebounce.js'
import './SearchPage.css'

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
    <div className="search-page">
      <header className="search-header">
        <h1 className="search-title">Search users</h1>
      </header>
      <form className="search-form" onSubmit={handleSubmit}>
        <input
          type="search"
          className="search-input"
          placeholder="Search by username..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search by username"
          minLength={2}
        />
        <button type="submit" className="search-submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>
      <div className="search-results">
        {loading && (
          <ul className="search-user-list" role="list" aria-label="Loading">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="search-user-row search-user-row-skeleton">
                <div className="search-user-avatar skeleton-pulse" />
                <div className="search-user-username-skeleton skeleton-pulse" />
              </li>
            ))}
          </ul>
        )}
        {!loading && searched && users.length === 0 && (
          <p className="search-status">No users found.</p>
        )}
        {!loading && users.length > 0 && (
          <ul className="search-user-list" role="list">
            {users.map((user) => (
              <li key={user.user_id}>
                <button
                  type="button"
                  className="search-user-row"
                  onClick={() => handleUserClick(user)}
                >
                  <div
                    className="search-user-avatar"
                    style={
                      user.icon_url
                        ? { backgroundImage: `url(${user.icon_url})`, backgroundSize: 'cover' }
                        : undefined
                    }
                  />
                  <span className="search-user-username">@{user.username}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
