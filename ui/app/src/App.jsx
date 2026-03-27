import { useState, useEffect, useCallback } from 'react'
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
    default:
      if (pathname.startsWith('/user/')) {
        return null
      }
      return 'App'
  }
}

function App() {
  const [isLoggedIn, gatewayUrl, completeLogin] = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (!isLoggedIn) {
      return
    }

    let cancelled = false
    if (!gatewayUrl) {
      return
    }

    gatewayFactory(gatewayUrl).then(async (gateway) => {
      if (cancelled) return
      await gateway.handshake()
      window.gateway = gateway
    })
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

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/account/settings" element={<SettingsPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/user/:userId" element={<UserPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
