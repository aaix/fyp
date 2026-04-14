import { useEffect, useState } from 'react'
import Button from './Button.jsx'

function isStandaloneDisplayMode() {
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  return window.navigator?.standalone === true
}

export default function InstallPwaPrompt() {
  const [installPromptEvent, setInstallPromptEvent] = useState(null)
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneDisplayMode())
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    const displayModeMedia = window.matchMedia?.('(display-mode: standalone)')
    const refreshStandaloneState = () => setIsStandalone(isStandaloneDisplayMode())
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setInstallPromptEvent(e)
      refreshStandaloneState()
    }
    const handleAppInstalled = () => {
      setInstallPromptEvent(null)
      setInstalling(false)
      refreshStandaloneState()
    }

    refreshStandaloneState()
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    displayModeMedia?.addEventListener?.('change', refreshStandaloneState)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      displayModeMedia?.removeEventListener?.('change', refreshStandaloneState)
    }
  }, [])

  const promptInstall = async () => {
    if (!installPromptEvent || installing) return
    setInstalling(true)
    try {
      await installPromptEvent.prompt()
      await installPromptEvent.userChoice
      setInstallPromptEvent(null)
    } catch (err) {
      console.error(err)
    } finally {
      setInstalling(false)
    }
  }

  if (isStandalone || !installPromptEvent) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+max(0.75rem,env(safe-area-inset-bottom)))] z-40 flex justify-center px-4 md:inset-x-auto md:bottom-4 md:right-4">
      <div className="pointer-events-auto rounded-card border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-2 shadow-card">
        <Button
          type="button"
          size="sm"
          className="text-xs"
          onClick={() => {
            void promptInstall()
          }}
          disabled={installing}
        >
          {installing ? 'Preparing install…' : 'Install app'}
        </Button>
      </div>
    </div>
  )
}
