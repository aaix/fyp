import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { DeviceManager } from '../lib/session.js'
import { gatewayFactory } from '../lib/gateway.js'
import { timeFromUUIDv1 } from '../lib/utils.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
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

function fetchDevices(setDevices, setDevicesLoading, setDevicesError) {
  setDevicesLoading(true)
  setDevicesError(null)
  deviceManager
    .getDevices()
    .then((res) => {
      if (res.success) {
        const data = res.data

        const list = Array.isArray(data) ? data : data?.devices ?? []

        setDevices(list.map(normalizeDevice))
      } else {
        setDevicesError(res.error?.message ?? 'Failed to load devices')
        setDevices([])
      }
    })
    .finally(() => setDevicesLoading(false))
}

export default function SettingsPage() {
  const [devices, setDevices] = useState([])
  const [expandedDeviceId, setExpandedDeviceId] = useState(null)
  const [devicesLoading, setDevicesLoading] = useState(true)
  const [devicesError, setDevicesError] = useState(null)
  const [deviceToDelete, setDeviceToDelete] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerError, setRegisterError] = useState(null)
  const [registerInfo, setRegisterInfo] = useState(null)
  const [registerCode, setRegisterCode] = useState('')
  const [registerCodeModalOpen, setRegisterCodeModalOpen] = useState(false)
  const [registerConfirmDetails, setRegisterConfirmDetails] = useState(null)
  const registerConfirmResolverRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setDevicesLoading(true)
    setDevicesError(null)
    fetchDevices(
      (devices) => { if (!cancelled) setDevices(devices) },
      (loading) => { if (!cancelled) setDevicesLoading(loading) },
      (error) => { if (!cancelled) setDevicesError(error) },
    )
    return () => { cancelled = true }
  }, [])

  const openDeleteModal = (device, e) => {
    e?.stopPropagation?.()
    setDeviceToDelete(device)
    setDeleteError(null)
  }

  const closeDeleteModal = () => {
    if (!deleteLoading) {
      setDeviceToDelete(null)
      setDeleteError(null)
    }
  }

  const confirmDeleteDevice = async () => {
    if (!deviceToDelete || deleteLoading) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await deviceManager.deleteDevice(deviceToDelete.id);
      if (!res.success) {
        setDeleteError(res.error?.message ?? 'Failed to remove device')
        return
      }
      setDeviceToDelete(null)
      fetchDevices(setDevices, setDevicesLoading, setDevicesError)
    
    } finally {
      setDeleteLoading(false)
    }
  }

  const startRegisterNewDeviceWithCode = async (code) => {
    if (!code) return

    setRegisterError(null)
    setRegisterInfo(null)
    setRegisterLoading(true)

    try {
      const gateway = await gatewayFactory()

      const confirmCallback = ({ device_name, device_gateway_id }) => {
        return new Promise((resolve) => {
          registerConfirmResolverRef.current = resolve
          setRegisterConfirmDetails({
            deviceName: device_name,
            deviceId: device_gateway_id,
          })
        })
      }

      const errorCallback = (message) => {
        setRegisterError(message || 'Failed to register new device')
        setRegisterLoading(false)
      }

      const successCallback = (deviceName) => {
        setRegisterInfo(`Device "${deviceName}" has been added successfully.`)
        setRegisterLoading(false)
        fetchDevices(setDevices, setDevicesLoading, setDevicesError)
      }

      await gateway.register_new_device(code, confirmCallback, errorCallback, successCallback)
    } catch (err) {
      setRegisterError(err?.message || 'Failed to start device registration')
      setRegisterLoading(false)
    }
  }

  const handleRegisterNewDevice = () => {
    if (registerLoading) return
    setRegisterError(null)
    setRegisterInfo(null)
    setRegisterCode('')
    setRegisterCodeModalOpen(true)
  }

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
              <div className="settings-tile-actions">
                <button
                  type="button"
                  className="settings-primary-btn"
                  onClick={handleRegisterNewDevice}
                  disabled={registerLoading}
                >
                  {registerLoading ? 'Registering…' : 'Register new device'}
                </button>
                <span className="settings-tile-chip">Security</span>
              </div>
            </header>
            <div className="settings-tile-body">
              {registerError && <p className="settings-error">{registerError}</p>}
              {registerInfo && !registerError && (
                <p className="settings-info">{registerInfo}</p>
              )}
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
                      <div className="device-row-main">
                        <button
                          type="button"
                          className="device-row-trigger"
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
                        <button
                          type="button"
                          className="device-delete-btn"
                          onClick={() => openDeleteModal(device)}
                          title="Remove device"
                          aria-label={`Remove ${device.name}`}
                        >
                          <span className="material-symbols-outlined" aria-hidden>delete</span>
                        </button>
                      </div>
                      {expandedDeviceId === device.id && (
                        <div className="device-public-key">
                          <span className="device-public-key-label">Public key</span>
                          <pre>
                            <code className="device-public-key-value">
                              {device.publicKey ?? 'Not available'}
                            </code>
                          </pre>
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

      {deviceToDelete && (
        <ConfirmModal
          open={!!deviceToDelete}
          title="Remove device?"
          confirmLabel={deleteLoading ? 'Removing…' : 'Remove'}
          cancelLabel="Cancel"
          confirmVariant="danger"
          confirmDisabled={deleteLoading}
          onConfirm={confirmDeleteDevice}
          onCancel={closeDeleteModal}
          labelledById="delete-device-title"
        >
          <p>
            This will revoke access for <strong>{deviceToDelete.name}</strong>. You can add it again
            later.
          </p>
          {deleteError && <p className="settings-error modal-error">{deleteError}</p>}
        </ConfirmModal>
      )}

      <ConfirmModal
        open={!!registerConfirmDetails}
        title="Confirm new device"
        confirmLabel="Looks good"
        cancelLabel="Cancel"
        confirmVariant="primary"
        onConfirm={() => {
          if (registerConfirmResolverRef.current) {
            registerConfirmResolverRef.current(true)
            registerConfirmResolverRef.current = null
          }
          setRegisterConfirmDetails(null)
        }}
        onCancel={() => {
          if (registerConfirmResolverRef.current) {
            registerConfirmResolverRef.current(false)
            registerConfirmResolverRef.current = null
          }
          setRegisterConfirmDetails(null)
          setRegisterInfo('Device registration was cancelled.')
        }}
      >
        {registerConfirmDetails && (
          <div className="confirm-device-details">
            <p>Please confirm this matches what you see on your other device:</p>
            <dl>
              <div className="confirm-device-row">
                <dt>Device name</dt>
                <dd>{registerConfirmDetails.deviceName}</dd>
              </div>
              <div className="confirm-device-row">
                <dt>Device ID</dt>
                <dd>{registerConfirmDetails.deviceId}</dd>
              </div>
            </dl>
          </div>
        )}
      </ConfirmModal>

      <ConfirmModal
        open={registerCodeModalOpen}
        title="Enter code from other device"
        confirmLabel="Continue"
        cancelLabel="Cancel"
        confirmVariant="primary"
        confirmDisabled={registerLoading}
        onConfirm={() => {
          const trimmed = registerCode.trim()
          if (!trimmed) {
            setRegisterError('Please enter the code shown on your other device.')
            return
          }
          setRegisterCodeModalOpen(false)
          startRegisterNewDeviceWithCode(trimmed)
        }}
        onCancel={() => {
          if (registerLoading) return
          setRegisterCodeModalOpen(false)
        }}
      >
        <div className="input-modal-body">
          <p>Enter the one-time code displayed on your other device to link this one.</p>
          <label className="input-modal-label" htmlFor="register-code-input">
            Code
            <input
              id="register-code-input"
              type="text"
              value={registerCode}
              onChange={(e) => setRegisterCode(e.target.value)}
              placeholder="e.g. 1234-5678"
              autoComplete="one-time-code"
            />
          </label>
        </div>
      </ConfirmModal>
    </div>
  )
}
