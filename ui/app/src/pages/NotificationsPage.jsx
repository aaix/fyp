import { useEffect, useState, useCallback } from 'react'
import PageContainer from '../components/PageContainer.jsx'
import RelationshipRequestRow from '../components/RelationshipRequestRow.jsx'
import { relationshipManager, userManager } from '../lib/user.js'
import { getAvatarUrl } from '../lib/utils.js'

const CURRENT_REQUESTING_PEER = 1
const PEER_REQUESTING_CURRENT = 2

function profileFromResponse(res) {
  const user = res?.data?.user ?? res?.data ?? res
  if (!user) return { username: '', iconUrl: null }
  return {
    username: user.username ?? '',
    iconUrl: user?.user_id ? getAvatarUrl(user) : null,
  }
}

export default function NotificationsPage() {
  const [incoming, setIncoming] = useState([])
  const [sent, setSent] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await relationshipManager.getRelationships()
      if (!res?.success) return
      const relationships = res?.data?.relationships ?? []
      const incomingPeers = relationships
        .filter((r) => Number(r.relationship) === PEER_REQUESTING_CURRENT)
        .map((r) => r.peer_id)
      const sentPeers = relationships
        .filter((r) => Number(r.relationship) === CURRENT_REQUESTING_PEER)
        .map((r) => r.peer_id)

      const fetchProfiles = async (peerIds) => {
        return Promise.all(
          peerIds.map(async (peerId) => {
            try {
              const pr = await userManager.getUserProfile(peerId)
              const { username, iconUrl } = profileFromResponse(pr)
              return { peerId, username, iconUrl }
            } catch {
              return { peerId, username: '', iconUrl: null }
            }
          })
        )
      }

      const [incomingList, sentList] = await Promise.all([
        fetchProfiles(incomingPeers),
        fetchProfiles(sentPeers),
      ])
      setIncoming(incomingList)
      setSent(sentList)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleAccept = async (peerId) => {
    setActionLoading(peerId)
    try {
      const res = await relationshipManager.friendUser(peerId)
      if (res?.success) load()
    } finally {
      setActionLoading(null)
    }
  }

  const handleDecline = async (peerId) => {
    setActionLoading(peerId)
    try {
      await relationshipManager.unfriendUser(peerId)
      load()
    } finally {
      setActionLoading(null)
    }
  }

  const handleRevoke = async (peerId) => {
    setActionLoading(peerId)
    try {
      await relationshipManager.unfriendUser(peerId)
      load()
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <PageContainer>
      <header className="border-b border-[color:var(--card-border)] pb-3">
        <h1 className="text-xl font-bold text-[color:var(--text-primary)]">
          Notifications
        </h1>
      </header>

      {loading ? (
        <div className="space-y-4 pt-4">
          <div className="h-6 w-48 rounded bg-[color:var(--card-bg)] skeleton-pulse" />
          <ul className="space-y-0.5" role="list">
            {Array.from({ length: 3 }, (_, i) => (
              <li
                key={i}
                className="flex items-center gap-3 border-b border-[color:var(--card-border)] px-1 py-2"
              >
                <div className="h-11 w-11 rounded-full border border-[color:var(--card-border)] bg-[color:var(--card-bg)] skeleton-pulse" />
                <div className="h-4 w-32 rounded bg-[color:var(--card-bg)] skeleton-pulse" />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-6 pt-4">
          <section aria-labelledby="incoming-heading">
            <h2
              id="incoming-heading"
              className="mb-2 text-sm font-semibold text-[color:var(--text-muted)]"
            >
              Friend requests
            </h2>
            {incoming.length === 0 ? (
              <p className="text-sm text-[color:var(--text-muted)]">
                No pending requests.
              </p>
            ) : (
              <ul className="space-y-0.5" role="list">
                {incoming.map(({ peerId, username, iconUrl }) => (
                  <RelationshipRequestRow
                    key={peerId}
                    peerId={peerId}
                    username={username}
                    iconUrl={iconUrl}
                    variant="incoming"
                    onAccept={() => handleAccept(peerId)}
                    onDecline={() => handleDecline(peerId)}
                    actionLoading={actionLoading === peerId}
                  />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="sent-heading">
            <h2
              id="sent-heading"
              className="mb-2 text-sm font-semibold text-[color:var(--text-muted)]"
            >
              Sent requests
            </h2>
            {sent.length === 0 ? (
              <p className="text-sm text-[color:var(--text-muted)]">
                No sent requests.
              </p>
            ) : (
              <ul className="space-y-0.5" role="list">
                {sent.map(({ peerId, username, iconUrl }) => (
                  <RelationshipRequestRow
                    key={peerId}
                    peerId={peerId}
                    username={username}
                    iconUrl={iconUrl}
                    variant="sent"
                    onRevoke={() => handleRevoke(peerId)}
                    actionLoading={actionLoading === peerId}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </PageContainer>
  )
}
