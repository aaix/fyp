import Button from './Button.jsx'
import useEscapeToClose from './useEscapeToClose.js'

export default function ConfirmModal({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  confirmDisabled = false,
  onConfirm,
  onCancel,
  labelledById,
}) {
  useEscapeToClose(open, onCancel)

  if (!open) return null

  const titleId = labelledById || 'confirm-modal-title'
  const effectiveConfirmVariant = confirmVariant === 'danger' ? 'danger' : 'primary'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-card border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2
            id={titleId}
            className="mb-2 text-lg font-bold text-[color:var(--text-primary)]"
          >
            {title}
          </h2>
        )}
        {(description || children) && (
          <div className="mb-4 text-sm text-[color:var(--text-muted)]">
            {description && <p className="mb-2">{description}</p>}
            {children}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={confirmDisabled}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={effectiveConfirmVariant}
            size="sm"
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

