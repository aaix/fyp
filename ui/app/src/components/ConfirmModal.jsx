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
  if (!open) return null

  const titleId = labelledById || 'confirm-modal-title'

  const confirmClasses =
    confirmVariant === 'danger'
      ? 'bg-red-600 text-white hover:bg-red-500'
      : 'bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent-hover)]'

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
          <button
            type="button"
            className="rounded-button border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-1.5 text-sm font-semibold text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--card-bg)]/80 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onCancel}
            disabled={confirmDisabled}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`rounded-button px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${confirmClasses}`}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

