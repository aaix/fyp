import { useState } from 'react'
import { getCurrentSession } from '../lib/session.js'
import { gatewayFactory } from '../lib/gateway.js'

import '../App.css'

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    deviceName: '',
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setError(null)
    setInfo(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)

    const session = getCurrentSession();

    try {
      if (mode === 'signup') {
        const res = await session.signup(formData.username, formData.email)
        if (!res.success || res?.error || res?.message) {
          setError(res.message || res.error?.message || 'Signup failed')
          return
        }
        setMode('login')
        setFormData((prev) => ({ ...prev, email: '' }))
        setInfo('Account created. You can now log in.')
      } else if (mode === 'otherDevice') {
        const gateway = await gatewayFactory()

        const errCallback = (err) => {
          const message =
            err?.message ||
            (typeof err === 'string'
              ? err
              : err?.reason
              ? `Gateway error: ${err.reason}`
              : 'Something went wrong with the device handshake')
          setError(message)
          setLoading(false)
        }

        const otCallback = (oneTimeCode, digest) => {
          setInfo(
            `On your other device, choose the option to add this device and enter the following one-time code: ${oneTimeCode}. ` +
            `After entering the code, check that the following matches on the other device: ${digest}.`
          )
        }

        const successCallback = () => {
          setInfo('This device has been added successfully. You can now log in from this device.')
          setLoading(false)
        }

        await gateway.start_new_device_handshake(
          formData.username,
          formData.deviceName,
          otCallback,
          errCallback,
          successCallback
        )

        // Handshake has been initiated; keep the form usable while waiting.
        setLoading(false)
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
          onLogin()
        } else {
          setError(loginResult || 'Login failed')
        }
      }
    } catch (err) {
      console.error(err);
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
            Continue on this device
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => setMode('signup')}
          >
            Sign up
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'otherDevice' ? 'active' : ''}`}
            onClick={() => setMode('otherDevice')}
          >
            Log in from other device
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          {info && !error && (
            <div className="auth-info" role="status">
              {info}
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
          {mode === 'otherDevice' && (
            <div className="form-group">
              <label htmlFor="deviceName">Device name</label>
              <input
                id="deviceName"
                name="deviceName"
                type="text"
                placeholder="e.g. My Laptop"
                value={formData.deviceName}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
          )}
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Log in' : (mode === 'otherDevice' ? "Start registration" : "Create Account")}
          </button>
        </form>
      </div>
    </div>
  )
}
