import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { DeviceManager } from '../lib/session.js'
import { timeFromUUIDv1 } from '../lib/utils.js'
import './SettingsPage.css'

const deviceManager = new DeviceManager()

function normalizeDevice(apiDevice) {
  return {
    id: apiDevice.device_id,
    name: apiDevice.device_name ?? 'Unnamed device',
    createdAt: timeFromUUIDv1(apiDevice.device_id).toLocaleString(),
    publicKey: apiDevice.device_public_key,
  }
}

export default function SettingsPage() {
  const [devices, setDevices] = useState([])
  const [expandedDeviceId, setExpandedDeviceId] = useState(null)
  const [devicesLoading, setDevicesLoading] = useState(true)
  const [devicesError, setDevicesError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setDevicesLoading(true)
    setDevicesError(null)
    deviceManager
      .getDevices()
      .then((data) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : data?.devices ?? []
        setDevices(list.map(normalizeDevice))
      })
      .catch((err) => {
        if (cancelled) return
        setDevicesError(err?.message ?? 'Failed to load devices')
        setDevices([])
      })
      .finally(() => {
        if (!cancelled) setDevicesLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const handleDeviceClick = (deviceId) => {
    setExpandedDeviceId((current) => (current === deviceId ? null : deviceId))
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <Link to="/account" className="settings-back" aria-label="Back to account">
          <span className="material-symbols-outlined" aria-hidden>arrow_back</span>
        </Link>
        <h1 className="settings-title">Settings</h1>
      </header>
      <main className="settings-content">
        <div className="settings-sections">
          <section className="settings-tile" aria-label="Devices">
            <header className="settings-tile-header">
              <div className="settings-tile-title-group">
                <span className="material-symbols-outlined settings-tile-icon" aria-hidden>
                  devices
                </span>
                <div>
                  <h2 className="settings-tile-title">Devices</h2>
                  <p className="settings-tile-subtitle">Manage where your account is trusted.</p>
                </div>
              </div>
              <span className="settings-tile-chip">Security</span>
            </header>
            <div className="settings-tile-body">
              {devicesLoading ? (
                <p className="settings-empty">Loading devices…</p>
              ) : devicesError ? (
                <p className="settings-error">{devicesError}</p>
              ) : devices.length === 0 ? (
                <p className="settings-empty">No devices added yet.</p>
              ) : (
                <ul className="devices-list">
                  {devices.map((device) => (
                    <li
                      key={device.id}
                      className={`device-row ${
                        expandedDeviceId === device.id ? 'device-row-expanded' : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="device-row-main"
                        onClick={() => handleDeviceClick(device.id)}
                      >
                        <div className="device-row-text">
                          <span className="device-name">{device.name}</span>
                          <span className="device-created-at">
                            Added {device.createdAt ?? '—'}
                          </span>
                        </div>
                        <span className="material-symbols-outlined device-expand-icon" aria-hidden>
                          {expandedDeviceId === device.id ? 'expand_less' : 'chevron_right'}
                        </span>
                      </button>
                      {expandedDeviceId === device.id && (
                        <div className="device-public-key">
                          <span className="device-public-key-label">Public key</span>
                          <code className="device-public-key-value">
                            {device.publicKey ?? 'Not available'}
                          </code>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="settings-tile settings-tile-placeholder" aria-label="Additional settings">
            <header className="settings-tile-header">
              <div className="settings-tile-title-group">
                <span className="material-symbols-outlined settings-tile-icon" aria-hidden>
                  tune
                </span>
                <div>
                  <h2 className="settings-tile-title">More controls</h2>
                  <p className="settings-tile-subtitle">
                    Additional powerful settings will appear here.
                  </p>
                </div>
              </div>
            </header>
          </section>
        </div>
      </main>
    </div>
  )
}
