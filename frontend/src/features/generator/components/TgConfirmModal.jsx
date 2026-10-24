/**
 * PaperForge confirm dialog — replaces native window.confirm.
 */
export default function TgConfirmModal({
  open,
  title = "Confirm",
  message = "",
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      className="tg-modal-backdrop tg-confirm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tg-confirm-title"
    >
      <div className="tg-modal tg-confirm-modal">
        <div className="tg-modal-header">
          <h3 id="tg-confirm-title" className="text-base font-bold sm:text-lg">
            {title}
          </h3>
          <button
            type="button"
            className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
        </div>
        <div className="tg-confirm-body">
          {String(message)
            .split("\n")
            .filter((line) => line.length > 0)
            .map((line) => (
              <p key={line}>{line}</p>
            ))}
        </div>
        <div className="tg-modal-footer tg-confirm-footer">
          <button type="button" className="tg-btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={
              danger
                ? "tg-btn-primary tg-btn-primary--danger min-w-28 px-4 py-2.5 text-sm"
                : "tg-btn-primary min-w-28 px-4 py-2.5 text-sm"
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
