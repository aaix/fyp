import { useEffect } from 'react'
import Button from './Button.jsx'
import useEscapeToClose from './useEscapeToClose.js'

export default function MediaLightboxModal({ open, onClose, url, mime, title }) {
  useEscapeToClose(open, onClose)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || !url) return null

  const isVideo = (mime || '').trim().startsWith('video/')

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Media preview'}
      onClick={onClose}
    >
      <div className="absolute right-3 top-3 z-10" onClick={(e) => e.stopPropagation()}>
        <Button
          type="button"
          variant="ghost"
          size="iconSm"
          className="text-white hover:bg-white/10"
          onClick={onClose}
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-2xl" aria-hidden>
            close
          </span>
        </Button>
      </div>
      <div
        className="flex max-h-full max-w-full items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video
            src={url}
            controls
            autoPlay
            playsInline
            className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] rounded-button"
          />
        ) : (
          <img
            src={url}
            alt={title || 'Attachment'}
            className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] object-contain"
          />
        )}
      </div>
    </div>
  )
}
