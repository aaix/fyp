import { useEffect, useRef, useState } from 'react'
import { channelManager } from '../lib/chat.js'
import { decryptSymAttachment } from '../lib/keyhandler.js'
import { getDefaultChannelUrl } from '../lib/utils.js'

const sharedKeyPromiseByChannelId = new Map()

function sharedKeyPromiseFor(channel, sharedKeyProp) {
  if (sharedKeyProp) return Promise.resolve(sharedKeyProp)
  const id = channel?.channel_id
  if (id == null) return Promise.reject(new Error('Missing channel id'))
  const key = String(id)
  if (!sharedKeyPromiseByChannelId.has(key)) {
    sharedKeyPromiseByChannelId.set(key, channelManager.channelGetSharedKey(channel))
  }
  return sharedKeyPromiseByChannelId.get(key)
}

/**
 * `channel_icon` is the URL of the ciphertext (same encryption model as message attachments).
 * Fetches that URL, decrypts with `decryptSymAttachment` and the channel symmetric key, then renders via a blob URL.
 */
export default function ChannelIcon({ channel, sharedKey, className = '', alt = '' }) {
  const [src, setSrc] = useState(() =>
    channel?.channel_id != null ? getDefaultChannelUrl(channel.channel_id) : '',
  )
  const objectUrlRef = useRef(null)
  const channelRef = useRef(channel)
  channelRef.current = channel

  useEffect(() => {
    const ch = channelRef.current
    const cid = ch?.channel_id
    if (cid == null) {
      setSrc('')
      return
    }

    const defaultSrc = getDefaultChannelUrl(cid)
    if (!ch?.channel_icon) {
      setSrc(defaultSrc)
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const key = await sharedKeyPromiseFor(ch, sharedKey)
        if (cancelled || !key) return

        const assetUrl = typeof ch.channel_icon === 'string' ? ch.channel_icon.trim() : ''
        if (!assetUrl) throw new Error('Missing channel_icon URL')
        const resp = await fetch(assetUrl)
        if (!resp.ok) throw new Error(`Icon fetch failed (${resp.status})`)
        const encrypted = await resp.arrayBuffer()
        const { plaintext, contentType } = await decryptSymAttachment(encrypted, key)
        if (cancelled) return

        const mime = (contentType && String(contentType).trim()) || 'image/webp'
        const blob = new Blob([plaintext], { type: mime })
        const ou = URL.createObjectURL(blob)
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = ou
        setSrc(ou)
      } catch (err) {
        console.error(err)
        if (!cancelled) setSrc(defaultSrc)
      }
    })()

    return () => {
      cancelled = true
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [channel?.channel_id, channel?.channel_icon, channel?.encrypted_channel_key, sharedKey])

  if (!src) {
    return (
      <div
        className={`rounded-full border border-[color:var(--card-border)] bg-[color:var(--card-bg)] ${className}`}
        aria-hidden
      />
    )
  }

  return <img src={src} alt={alt} className={className} />
}
