import Button from './Button.jsx'

export default function ModalCloseButton({ disabled = false, onClick }) {
  return (
    <Button
      type="button"
      variant="text"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      aria-label="Close"
    >
      <span className="material-symbols-outlined text-xl" aria-hidden>
        close
      </span>
    </Button>
  )
}
