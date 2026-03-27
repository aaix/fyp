import { useEffect, useRef, useState } from 'react'
import { decryptSymAttachment } from '../lib/keyhandler.js'
import Button from './Button.jsx'
import MediaLightboxModal from './MediaLightboxModal.jsx'

/**
 * Fetches ciphertext from `attachmentUrl`, decrypts with the channel symmetric key, and renders
 * an image, video, or download link. MIME and file name prefer v4 metadata embedded in the
 * ciphertext; `contentMimeType` / `fileName` props (message `mime;fileName` envelope) are fallback
 * for legacy attachments and upload-pending rows.
 */
export default function MessageChannelAttachment({
  attachmentUrl,
  sharedKey,
  contentMimeType,
  fileName,
  onDisplayReady,
}) {
  const [blobMeta, setBlobMeta] = useState({ contentType: null, fileName: null })
  const [previewUrl, setPreviewUrl] = useState(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const objectUrlRef = useRef(null)
  const inlineVideoRef = useRef(null)

  useEffect(() => {
    if (!attachmentUrl || !sharedKey) {
      setLoading(false)
      setPreviewUrl(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(false)
    setPreviewUrl(null)
    setBlobMeta({ contentType: null, fileName: null })

    ;(async () => {
      try {
        const resp = await fetch(attachmentUrl)
        if (!resp.ok) throw new Error('fetch failed')
        const encrypted = await resp.arrayBuffer()
        const { plaintext, contentType: ctFromBlob, fileName: fnFromBlob } =
          await decryptSymAttachment(encrypted, sharedKey)
        const mimeForBlob =
          (ctFromBlob ?? contentMimeType ?? 'application/octet-stream').trim() || 'application/octet-stream'
        const blob = new Blob([plaintext], { type: mimeForBlob })
        const ou = URL.createObjectURL(blob)
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = ou
        if (!cancelled) {
          setBlobMeta({ contentType: ctFromBlob ?? null, fileName: fnFromBlob ?? null })
          setPreviewUrl(ou)
          setLoading(false)
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [attachmentUrl, sharedKey, contentMimeType, fileName])

  useEffect(() => {
    if (!previewUrl || loading || error) return
    const mime = (blobMeta.contentType ?? contentMimeType ?? '').trim()
    const isVisual = mime.startsWith('image/') || mime.startsWith('video/')
    if (isVisual) return
    onDisplayReady?.()
  }, [previewUrl, loading, error, blobMeta.contentType, contentMimeType, onDisplayReady])

  const openLightbox = () => {
    inlineVideoRef.current?.pause?.()
    setLightboxOpen(true)
  }

  if (!attachmentUrl || !sharedKey) return null

  if (loading) {
    return <div className="mt-2 text-sm text-[color:var(--text-muted)]">Loading attachment…</div>
  }

  if (error || !previewUrl) {
    return <div className="mt-2 text-sm text-[color:var(--text-muted)]">Could not load attachment.</div>
  }

  const mime = (blobMeta.contentType ?? contentMimeType ?? '').trim()
  const isImage = mime.startsWith('image/')
  const isVideo = mime.startsWith('video/')
  const isVisualMedia = isImage || isVideo
  const displayName = (blobMeta.fileName ?? fileName ?? '').trim()
  const downloadName = displayName || 'attachment'

  if (isVisualMedia) {
    return (
      <div className="mt-2 space-y-1">
        {displayName ? (
          <div className="truncate text-sm font-medium text-[color:var(--text-primary)]" title={displayName}>
            {displayName}
          </div>
        ) : null}
        <div className="relative max-w-full">
          {isImage ? (
            <button
              type="button"
              className="block w-full max-w-full cursor-zoom-in rounded-button border border-[color:var(--card-border)] p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
              onClick={openLightbox}
              aria-label={displayName ? `View ${displayName} larger` : 'View image larger'}
            >
              <img
                src={previewUrl}
                alt={displayName || 'Attachment'}
                className="max-h-64 w-full object-contain"
                onLoad={() => onDisplayReady?.()}
                decoding="async"
              />
            </button>
          ) : (
            <>
              <video
                ref={inlineVideoRef}
                src={previewUrl}
                controls
                playsInline
                preload="metadata"
                className="max-h-64 w-full rounded-button border border-[color:var(--card-border)] object-contain"
                onLoadedData={() => onDisplayReady?.()}
              />
              <div className="absolute right-2 top-2">
                <Button
                  type="button"
                  size="iconSm"
                  variant="ghost"
                  className="bg-[color:var(--card-bg)]/90 text-[color:var(--text-primary)] shadow-card backdrop-blur-sm hover:bg-[color:var(--card-bg)]"
                  aria-label={displayName ? `Open ${displayName} fullscreen` : 'Open video fullscreen'}
                  onClick={(e) => {
                    e.stopPropagation()
                    openLightbox()
                  }}
                >
                  <span className="material-symbols-outlined text-base" aria-hidden>
                    open_in_full
                  </span>
                </Button>
              </div>
            </>
          )}
        </div>
        <MediaLightboxModal
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          url={previewUrl}
          mime={mime}
          title={displayName || undefined}
        />
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-1">
      {displayName ? (
        <div className="truncate text-sm font-medium text-[color:var(--text-primary)]" title={displayName}>
          {displayName}
        </div>
      ) : null}
      <a
        href={previewUrl}
        download={downloadName}
        className="break-all text-base text-[color:var(--accent)] underline"
      >
        Download
        {mime ? ` (${mime})` : ''}
      </a>
    </div>
  )
}
