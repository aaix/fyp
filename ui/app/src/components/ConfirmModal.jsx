import React from 'react'

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

  const confirmClassName =
    confirmVariant === 'danger'
      ? 'modal-btn modal-btn-danger'
      : 'modal-btn modal-btn-primary'

  const titleId = labelledById || 'confirm-modal-title'

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onCancel}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
        )}
        {(description || children) && (
          <div className="modal-body">
            {description && <p>{description}</p>}
            {children}
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="modal-btn modal-btn-cancel"
            onClick={onCancel}
            disabled={confirmDisabled}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmClassName}
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

