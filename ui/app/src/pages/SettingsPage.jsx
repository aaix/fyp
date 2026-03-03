import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { DeviceManager } from '../lib/session.js'
import { gatewayFactory } from '../lib/gateway.js'
import { timeFromUUIDv1 } from '../lib/utils.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import PageContainer from '../components/PageContainer.jsx'

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
  const [deviceToEdit, setDeviceToEdit] = useState(null)
  const [editDeviceName, setEditDeviceName] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState(null)
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

  const openEditModal = (device, e) => {
    e?.stopPropagation?.()
    setDeviceToEdit(device)
    setEditDeviceName(device.name ?? '')
    setEditError(null)
  }

  const closeEditModal = () => {
    if (!editLoading) {
      setDeviceToEdit(null)
      setEditDeviceName('')
      setEditError(null)
    }
  }

  const confirmEditDevice = async () => {
    if (!deviceToEdit || editLoading) return
    const trimmed = editDeviceName.trim()
    if (!trimmed) {
      setEditError('Device name cannot be empty.')
      return
    }
    setEditLoading(true)
    setEditError(null)
    try {
      const res = await deviceManager.updateDevice(deviceToEdit.id, trimmed)
      if (!res.success) {
        setEditError(res.error?.message ?? 'Failed to rename device')
        return
      }
      setDeviceToEdit(null)
      setEditDeviceName('')
      fetchDevices(setDevices, setDevicesLoading, setDevicesError)
    } finally {
      setEditLoading(false)
    }
  }

  const startRegisterNewDeviceWithCode = async (code) => {
    if (!code) return

    setRegisterError(null)
    setRegisterInfo(null)
    setRegisterLoading(true)

    try {
      const gateway = await gatewayFactory()

      const confirmCallback = ({ device_name, digest }) => {
        return new Promise((resolve) => {
          registerConfirmResolverRef.current = resolve
          setRegisterConfirmDetails({
            deviceName: device_name,
            digest: digest,
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
    <PageContainer>
      <header className="flex items-center gap-3 border-b border-[color:var(--card-border)] pb-3">
        <Link
          to="/account"
          className="flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--text-primary)] no-underline transition-colors hover:bg-[color:var(--card-bg)] hover:text-[color:var(--accent)]"
          aria-label="Back to account"
        >
          <span className="material-symbols-outlined text-xl" aria-hidden>
            arrow_back
          </span>
        </Link>
        <h1 className="m-0 text-xl font-bold text-[color:var(--text-primary)]">Settings</h1>
      </header>
      <main className="flex flex-1 flex-col overflow-y-auto pt-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section
            className="rounded-card border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-5 shadow-subtle"
            aria-label="Devices"
          >
            <header className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-[color:var(--accent)]" aria-hidden>
                  devices
                </span>
                <div>
                  <h2 className="m-0 text-[1.05rem] font-semibold text-[color:var(--text-primary)]">
                    Devices
                  </h2>
                  <p className="mt-[0.15rem] text-xs text-[color:var(--text-muted)]">
                    Manage where your account is trusted.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-pill bg-[color:var(--accent)] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)] transition-transform transition-shadow hover:bg-[color:var(--accent-hover)] hover:shadow-[0_14px_28px_rgba(15,23,42,0.2)] disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none"
                  onClick={handleRegisterNewDevice}
                  disabled={registerLoading}
                >
                  {registerLoading ? 'Registering…' : 'Register new device'}
                </button>
                <span className="rounded-pill bg-[color:var(--tab-active-bg)] px-2 py-0.5 text-[0.7rem] font-medium text-[color:var(--accent)]">
                  Security
                </span>
              </div>
            </header>
            <div className="mt-1 text-sm">
              {registerError && (
                <p className="text-sm text-red-600">{registerError}</p>
              )}
              {registerInfo && !registerError && (
                <p className="text-sm text-[color:var(--text-muted)]">{registerInfo}</p>
              )}
              {devicesLoading ? (
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  Loading devices…
                </p>
              ) : devicesError ? (
                <p className="mt-1 text-sm text-red-600">{devicesError}</p>
              ) : devices.length === 0 ? (
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  No devices added yet.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {devices.map((device) => (
                    <li
                      key={device.id}
                      className={`rounded-[12px] border border-transparent transition-colors ${
                        expandedDeviceId === device.id
                          ? 'border-[color:var(--card-border)] bg-[rgba(148,163,184,0.04)]'
                          : ''
                      }`}
                    >
                      <div className="flex w-full items-center gap-1">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-[12px] px-2.5 py-2 text-left text-sm text-[color:var(--text-primary)] transition-colors hover:bg-[rgba(148,163,184,0.08)]"
                          onClick={() => handleDeviceClick(device.id)}
                        >
                          <div className="min-w-0">
                            <span className="block truncate text-[0.95rem] font-medium">
                              {device.name}
                            </span>
                            <span className="mt-0.5 block text-[0.78rem] text-[color:var(--text-muted)]">
                              Added {device.createdAt ?? '—'}
                            </span>
                          </div>
                          <span className="material-symbols-outlined text-[1.35rem] text-[color:var(--text-muted)]" aria-hidden>
                            {expandedDeviceId === device.id ? 'expand_less' : 'chevron_right'}
                          </span>
                        </button>
                        <div className="mr-1 flex items-center gap-1">
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-[rgba(37,99,235,0.12)] hover:text-[color:var(--accent)]"
                            onClick={(e) => openEditModal(device, e)}
                            title="Rename device"
                            aria-label={`Rename ${device.name}`}
                          >
                            <span className="material-symbols-outlined text-sm" aria-hidden>
                              edit
                            </span>
                          </button>
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-[rgba(185,28,28,0.12)] hover:text-red-700"
                            onClick={(e) => openDeleteModal(device, e)}
                            title="Remove device"
                            aria-label={`Remove ${device.name}`}
                          >
                            <span className="material-symbols-outlined text-sm" aria-hidden>
                              delete
                            </span>
                          </button>
                        </div>
                      </div>
                      {expandedDeviceId === device.id && (
                        <div className="flex flex-col gap-1 px-3 pb-3 pt-1.5">
                          <span className="text-[0.78rem] uppercase tracking-[0.06em] text-[color:var(--text-muted)]">
                            Public key
                          </span>
                          <pre className="max-h-48 overflow-auto rounded-lg bg-[rgba(15,23,42,0.85)] px-2 py-1.5 text-[0.76rem] leading-[1.35] text-slate-200">
                            <code className="break-all font-mono">
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

          <section
            className="rounded-card border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-5 opacity-70 shadow-subtle"
            aria-label="Additional settings"
          >
            <header className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl text-[color:var(--accent)]" aria-hidden>
                tune
              </span>
              <div>
                <h2 className="m-0 text-[1.05rem] font-semibold text-[color:var(--text-primary)]">
                  More controls
                </h2>
                <p className="mt-[0.15rem] text-xs text-[color:var(--text-muted)]">
                  Additional powerful settings will appear here.
                </p>
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
          {deleteError && (
            <p className="mt-2 text-sm text-red-600">
              {deleteError}
            </p>
          )}
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
          <div className="flex flex-col gap-2 text-sm text-[color:var(--text-muted)]">
            <p>Please confirm this matches what you see on your other device:</p>
            <dl className="m-0">
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-[color:var(--text-primary)]">Device name</dt>
                <dd className="m-0 break-all font-mono text-xs">
                  {registerConfirmDetails.deviceName}
                </dd>
              </div>
              <div className="mt-1 flex justify-between gap-4">
                <dt className="font-semibold text-[color:var(--text-primary)]">Device digest</dt>
                <dd className="m-0 break-all font-mono text-xs">
                  {registerConfirmDetails.digest}
                </dd>
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
        <div className="flex flex-col gap-3 text-sm text-[color:var(--text-muted)]">
          <p>Enter the one-time code displayed on your other device to link this one.</p>
          <label
            className="flex flex-col gap-1 text-sm text-[color:var(--text-primary)]"
            htmlFor="register-code-input"
          >
            Code
            <input
              id="register-code-input"
              type="text"
              value={registerCode}
              onChange={(e) => setRegisterCode(e.target.value)}
              placeholder="e.g. 12345678"
              autoComplete="one-time-code"
              className="rounded-button border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)] hover:border-[color:var(--input-border-hover)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-focus)]"
            />
          </label>
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={!!deviceToEdit}
        title="Rename device"
        confirmLabel={editLoading ? 'Saving…' : 'Save'}
        cancelLabel="Cancel"
        confirmVariant="primary"
        confirmDisabled={editLoading}
        onConfirm={confirmEditDevice}
        onCancel={closeEditModal}
      >
        <div className="flex flex-col gap-3 text-sm text-[color:var(--text-muted)]">
          <p>Choose a new name for this device.</p>
          <label
            className="flex flex-col gap-1 text-sm text-[color:var(--text-primary)]"
            htmlFor="edit-device-name-input"
          >
            Name
            <input
              id="edit-device-name-input"
              type="text"
              value={editDeviceName}
              onChange={(e) => setEditDeviceName(e.target.value)}
              placeholder="e.g. Alice’s laptop"
              className="rounded-button border border-[color:var(--input-border)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)] hover:border-[color:var(--input-border-hover)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-focus)]"
            />
          </label>
          {editError && (
            <p className="text-sm text-red-600">
              {editError}
            </p>
          )}
        </div>
      </ConfirmModal>
    </PageContainer>
  )
}
