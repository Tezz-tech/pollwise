import { Button, Modal } from './ui.jsx';

/** A confirm step for anything that changes access or sends something (DESIGN §7). */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  tone = 'primary',
  busy = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-lg">
        <p className="text-pw-body text-ink600">{body}</p>
        <div className="flex justify-end gap-md">
          <Button tone="quiet" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button tone={tone} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
