import { useCallback, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AuthPage from './pages/AuthPage.jsx'
import AppLayout from './components/AppLayout.jsx'
import HomePage from './pages/HomePage.jsx'
import MessagesPage from './pages/MessagesPage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import SearchPage from './pages/SearchPage.jsx'
import UserPage from './pages/UserPage.jsx'
import NotificationsPage from './pages/NotificationsPage.jsx'
import CreatePostPage from './pages/CreatePostPage.jsx'
import PostPage from './pages/PostPage.jsx'

import { gatewayFactory } from './lib/gateway.js'
import { getCurrentSession } from './lib/session.js'


function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(null)
  const [gatewayUrl, setGatewayUrl] = useState(null)

  useEffect(() => {
    let cancelled = false

    const checkCurrentAccount = async () => {
      try {
        const session = getCurrentSession()
        const res = await session.getCurrentAccount()
        if (cancelled) return
        setGatewayUrl(res?.data?.assigned_gateway ?? null)
        setIsLoggedIn(!!res?.success)
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setGatewayUrl(null)
          setIsLoggedIn(false)
        }
      }
    }

    checkCurrentAccount()

    return () => {
      cancelled = true
    }
  }, [])

  const completeLogin = useCallback(async () => {
    try {
      const session = getCurrentSession()
      const res = await session.getCurrentAccount()
      setGatewayUrl(res?.data?.assigned_gateway ?? null)
      setIsLoggedIn(!!res?.success)
    } catch (e) {
      console.error(e)
      setGatewayUrl(null)
      setIsLoggedIn(false)
    }
  }, [])

  return [isLoggedIn, gatewayUrl, completeLogin]
}

function getTitleFromPathname(pathname) {
  switch (pathname) {
    case '/':
      return 'Feed'
    case '/messages':
      return 'Messages'
    case '/account':
      return 'Account'
    case '/account/settings':
      return 'Settings'
    case '/search':
      return 'Search'
    case '/notifications':
      return 'Notifications'
    case '/create-post':
      return 'Create post'
    default:
      if (pathname.startsWith('/user/')) {
        return null
      }
      if (pathname.startsWith('/post/')) {
        return 'Post'
      }
      return 'App'
  }
}

function App() {
  const [isLoggedIn, gatewayUrl, completeLogin] = useAuth()
  /** false until `handshake_promise` resolves for the current gateway (see gateway.js). */
  const [gatewayHandshakeReady, setGatewayHandshakeReady] = useState(false)
  const location = useLocation()

  useEffect(() => {
    if (!isLoggedIn || !gatewayUrl) {
      return
    }

    let cancelled = false
    // Reset gate for each (isLoggedIn, gatewayUrl) so a new login always re-handshakes.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- must clear before awaiting handshake_promise
    setGatewayHandshakeReady(false)

    ;(async () => {
      try {
        const gateway = await gatewayFactory(gatewayUrl)
        if (cancelled) return
        await gateway.handshake()
        await gateway.handshake_promise
        if (cancelled) return
        window.gateway = gateway
        setGatewayHandshakeReady(true)
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setGatewayHandshakeReady(true)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isLoggedIn, gatewayUrl])

  useEffect(() => {
    if (!isLoggedIn) {
      return
    }

    const routeTitle = getTitleFromPathname(location.pathname)
    if (!routeTitle) {
      return
    }

    document.title = `az7 | ${routeTitle}`
  }, [isLoggedIn, location.pathname])

  if (isLoggedIn === null) {
    return null
  }

  if (!isLoggedIn) {
    return <AuthPage onLogin={completeLogin} />
  }

  const waitingForGatewayHandshake =
    Boolean(isLoggedIn && gatewayUrl) && !gatewayHandshakeReady
  if (waitingForGatewayHandshake) {
    return (
      <div
        className="flex min-h-dvh w-full flex-col items-center justify-center gap-3 bg-[color:var(--bg)] px-4 text-center"
        aria-busy="true"
        aria-live="polite"
      >
        <p className="text-sm text-[color:var(--text-muted)]">Connecting to gateway…</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/account/settings" element={<SettingsPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/create-post" element={<CreatePostPage />} />
        <Route path="/post/user/:authorId/:feedType/:postId" element={<PostPage />} />
        <Route path="/user/:userId" element={<UserPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
