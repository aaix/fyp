import { useEffect } from 'react'

export default function useEscapeToClose(open, onClose) {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose?.()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])
}
