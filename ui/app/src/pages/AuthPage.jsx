import { useState } from 'react'
import { Session } from '../lib/session.js'
import '../App.css'

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [formData, setFormData] = useState({
    username: '',
    email: '',
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const session = new Session()

    try {
      if (mode === 'signup') {
        const res = await session.signup(formData.username, formData.email)
        if (res?.error || res?.message) {
          setError(res.message || res.error?.message || 'Signup failed')
          return
        }
        setMode('login')
        setFormData((prev) => ({ ...prev, email: '' }))
      } else {
        const handshakeResult = await session.doAccountKeyHandshake(
          formData.username
        )
        if (handshakeResult) {
          setError(handshakeResult.message || 'Handshake failed')
          return
        }
        const loginResult = await session.login(formData.username)
        if (loginResult === true) {
          window.session = session
          onLogin()
        } else {
          setError(loginResult || 'Login failed')
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            Log in
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => setMode('signup')}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              placeholder="Your username"
              value={formData.username}
              onChange={handleChange}
              autoComplete="username"
              required
              disabled={loading}
            />
          </div>
          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>
          )}
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
