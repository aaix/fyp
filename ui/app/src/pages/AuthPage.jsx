import { useEffect, useState } from 'react'
import { getCurrentSession } from '../lib/session.js'
import { findGatewayForUser, gatewayFactory } from '../lib/gateway.js'
import Button from '../components/Button.jsx'
import FormInput from '../components/FormInput.jsx'
import Card from '../components/Card.jsx'

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
  const [pairingDetails, setPairingDetails] = useState(null)

  useEffect(() => {
    document.title = 'az7 | Sign in'
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setError(null)
    setInfo(null)
    setPairingDetails(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setPairingDetails(null)
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
        const trimmedUsername = formData.username.trim()
        if (!trimmedUsername) {
          setError('Username is required')
          setLoading(false)
          return
        }
        const gatewayUrl = await findGatewayForUser(trimmedUsername)
        const gateway = await gatewayFactory(gatewayUrl)

        const errCallback = (err) => {
          const message =
            err?.message ||
            (typeof err === 'string'
              ? err
              : err?.reason
              ? `Gateway error: ${err.reason}`
              : 'Something went wrong with the device handshake')
          setPairingDetails(null)
          setError(message)
          setLoading(false)
        }

        const otCallback = (oneTimeCode, digest) => {
          setInfo(null)
          setPairingDetails({ code: String(oneTimeCode), digest: String(digest) })
        }

        const successCallback = () => {
          setPairingDetails(null)
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
          await onLogin()
        } else {
          setError(loginResult || 'Login failed')
        }
      }
    } catch (err) {
      console.error(err);
      setPairingDetails(null)
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
            <img src="/logo.webp" alt="az7" className="h-10 w-auto" />
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
              onClick={() => {
                setMode('login')
                setPairingDetails(null)
              }}
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
              onClick={() => {
                setMode('signup')
                setPairingDetails(null)
              }}
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
              onClick={() => {
                setMode('otherDevice')
                setPairingDetails(null)
              }}
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
          {pairingDetails && !error && (
            <section
              className="rounded-button border border-[color:var(--accent)]/40 bg-[color:var(--card-bg)] px-4 py-4"
              role="status"
              aria-labelledby="pairing-region-title"
              aria-live="polite"
            >
              <h2
                id="pairing-region-title"
                className="sr-only"
              >
                Add this device: enter the one-time code on your other device
              </h2>
              <p
                id="pairing-instructions"
                className="m-0 text-sm leading-relaxed text-[color:var(--text-primary)]"
              >
                <span className="sr-only">
                  On your signed-in device, go to Account, then Settings, then Devices.{' '}
                </span>
                On your signed-in device, go to{' '}
                <span className="font-semibold">Account</span>
                <span className="text-[color:var(--text-muted)]" aria-hidden="true">
                  {' '}
                  &gt;{' '}
                </span>
                <span className="font-semibold">Settings</span>
                <span className="text-[color:var(--text-muted)]" aria-hidden="true">
                  {' '}
                  &gt;{' '}
                </span>
                <span className="font-semibold">Devices</span>
                , then register this device and enter this code:
              </p>
              <div className="mt-4 flex flex-col items-center gap-1">
                <p
                  className="m-0 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--text-muted)]"
                >
                  One-time code
                </p>
                <p
                  className="m-0 max-w-full break-all text-center font-mono text-3xl font-semibold leading-tight tracking-[0.12em] text-[color:var(--accent)] sm:text-4xl"
                >
                  {pairingDetails.code}
                </p>
              </div>
              <p className="m-0 mt-4 text-[0.7rem] leading-snug text-[color:var(--text-muted)] opacity-80">
                After you enter the code, do NOT add the device if the following fingerprint does not match:
                {' '}
                <span className="break-all font-mono text-[0.65rem] font-normal text-[color:var(--text-muted)] opacity-70">
                  {pairingDetails.digest}
                </span>
              </p>
            </section>
          )}
          {info && !error && !pairingDetails && (
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
