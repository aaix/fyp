import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
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

  useEffect(() => {
    let cancelled = false

    const checkCurrentAccount = async () => {
      try {
        const session = getCurrentSession()
        const res = await session.getCurrentAccount()
        if (cancelled) return
        setIsLoggedIn(!!res?.success)
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setIsLoggedIn(false)
        }
      }
    }

    checkCurrentAccount()

    return () => {
      cancelled = true
    }
  }, [])

  return [isLoggedIn, () => setIsLoggedIn(true)]
}

function App() {
  const [isLoggedIn, setLoggedIn] = useAuth()

  useEffect(() => {
    if (!isLoggedIn) {
      return
    }

    let cancelled = false
    gatewayFactory().then(async (gateway) => {
      if (cancelled) return
      await gateway.handshake()
      window.gateway = gateway
    })
    return () => {
      cancelled = true
    }
  }, [isLoggedIn])

  if (isLoggedIn === null) {
    return null
  }

  if (!isLoggedIn) {
    return <AuthPage onLogin={() => setLoggedIn()} />
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
