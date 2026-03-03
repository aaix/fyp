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

import { gatewayFactory } from './lib/gateway.js'


function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('session'))

  useEffect(() => {
    const check = () => setIsLoggedIn(!!localStorage.getItem('session'))
    window.addEventListener('storage', check)
    return () => window.removeEventListener('storage', check)
  }, [])

  return [isLoggedIn, () => setIsLoggedIn(true)]
}

function App() {
  const [isLoggedIn, setLoggedIn] = useAuth()

  useEffect(() => {
    let cancelled = false
    gatewayFactory().then(async (gateway) => {
      if (cancelled) return
      await gateway.handshake()
      window.gateway = gateway
    })
    return () => {
      cancelled = true
    }
  }, [])

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
        <Route path="/user/:userId" element={<UserPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
