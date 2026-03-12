import { useEffect, useState } from 'react'

export default function ContextMenu({
  open,
  onClose,
  x,
  y,
  children,
  preferLeft = false,
  preferUp = false,
}) {
  const [position, setPosition] = useState({ x, y, anchorRight: false, anchorBottom: false })

  useEffect(() => {
    if (!open || x == null || y == null) return

    const margin = 8
    const approxWidth = 220
    const approxHeight = 160
    const vw = window.innerWidth || 0
    const vh = window.innerHeight || 0

    let px = x
    let py = y
    let anchorRight = false
    let anchorBottom = false

    if (preferLeft || px + approxWidth > vw - margin) {
      anchorRight = true
      px = Math.min(vw - margin, Math.max(margin, px))
    }

    if (preferUp || py + approxHeight > vh - margin) {
      anchorBottom = true
      py = Math.min(vh - margin, Math.max(margin, py))
    }

    setPosition({ x: px, y: py, anchorRight, anchorBottom })
  }, [open, x, y, preferLeft, preferUp])

  if (!open || position.x == null || position.y == null) return null

  return (
    <div
      className="fixed inset-0 z-40"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault()
        onClose?.()
      }}
    >
      <div
        className="absolute z-50"
        style={{
          top: position.y,
          left: position.x,
          transform: `${position.anchorRight ? 'translateX(-100%)' : ''} ${
            position.anchorBottom ? 'translateY(-100%)' : ''
          }`.trim(),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

