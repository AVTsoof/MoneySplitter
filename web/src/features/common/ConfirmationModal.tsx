import { useEffect, useRef } from 'react'
import './ConfirmationModal.css'

type ConfirmationModalProps = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open && dialog.showModal) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      className="confirmation-modal"
      open
      aria-labelledby="confirmation-title"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <div className="confirmation-modal-content">
        <h2 id="confirmation-title">{title}</h2>
        <p>{description}</p>
        <div className="confirmation-actions">
          <button type="button" className="confirmation-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="confirmation-destructive" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
