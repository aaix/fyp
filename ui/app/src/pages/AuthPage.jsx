import { useEffect, useState } from 'react'
import { getCurrentSession } from '../lib/session.js'
import { gatewayFactory } from '../lib/gateway.js'
import Button from '../components/Button.jsx'
import FormInput from '../components/FormInput.jsx'
import Card from '../components/Card.jsx'
import logoAz7 from '../assets/logo-az7.svg'

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

  useEffect(() => {
    document.title = 'az7 | Sign in'
  }, [])

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
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--bg)] px-4 py-8">
      <Card className="w-full max-w-md overflow-hidden rounded-card">
        <div className="flex flex-col border-b border-[color:var(--card-border)]">
          <div className="flex flex-col items-center gap-2 px-6 pt-6 pb-4">
            <img src={logoAz7} alt="az7" className="h-10 w-auto" />
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
              Private messaging
            </p>
          </div>
          <div className="flex">
            <Button
              type="button"
              variant="tab"
              size="sm"
              className={`flex-1 rounded-none px-6 py-3 ${
                mode === 'login'
                  ? 'border-[color:var(--accent)] bg-[color:var(--tab-active-bg)] text-[color:var(--accent)]'
                  : 'border-transparent'
              }`}
              onClick={() => setMode('login')}
            >
              Continue on this device
            </Button>
            <Button
              type="button"
              variant="tab"
              size="sm"
              className={`flex-1 rounded-none px-6 py-3 ${
                mode === 'signup'
                  ? 'border-[color:var(--accent)] bg-[color:var(--tab-active-bg)] text-[color:var(--accent)]'
                  : 'border-transparent'
              }`}
              onClick={() => setMode('signup')}
            >
              Sign up
            </Button>
            <Button
              type="button"
              variant="tab"
              size="sm"
              className={`flex-1 rounded-none px-6 py-3 ${
                mode === 'otherDevice'
                  ? 'border-[color:var(--accent)] bg-[color:var(--tab-active-bg)] text-[color:var(--accent)]'
                  : 'border-transparent'
              }`}
              onClick={() => setMode('otherDevice')}
            >
              Log in from other device
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-b-card p-6">
          {error && (
            <div
              className="rounded-button border border-red-900/60 bg-red-900/10 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}
          {info && !error && (
            <div
              className="rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-2 text-sm text-[color:var(--text-muted)]"
              role="status"
            >
              {info}
            </div>
          )}
          <FormInput
            label="Username"
            name="username"
            placeholder="Your username"
            value={formData.username}
            onChange={handleChange}
            autoComplete="username"
            required
            disabled={loading}
          />
          {mode === 'signup' && (
            <FormInput
              label="Email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              required
              disabled={loading}
            />
          )}
          {mode === 'otherDevice' && (
            <FormInput
              label="Device name"
              name="deviceName"
              placeholder="e.g. My Laptop"
              value={formData.deviceName}
              onChange={handleChange}
              required
              disabled={loading}
            />
          )}
          <Button type="submit" className="mt-2 w-full" disabled={loading}>
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Log in'
                : mode === 'otherDevice'
                  ? 'Start registration'
                  : 'Create Account'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
