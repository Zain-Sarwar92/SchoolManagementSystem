/**
 * Shared loading / empty / error panel for TG pages.
 * Keeps copy consistent without changing feature paths.
 */

export default function StatusPanel({
  loading = false,
  error = null,
  empty = false,
  emptyTitle = "Nothing here yet",
  emptyHint = null,
  loadingLabel = "Loading…",
  onRetry = null,
  children = null,
}) {
  if (loading) {
    return (
      <div
        className="tg-surface flex flex-col items-center justify-center gap-2 px-4 py-10 text-center"
        role="status"
        aria-live="polite"
      >
        <span className="inline-block size-8 animate-spin rounded-full border-2 border-tg-sky border-t-tg-blue" />
        <p className="text-sm text-tg-deep/80">{loadingLabel}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tg-surface px-4 py-8 text-center" role="alert">
        <p className="font-display text-base font-bold text-tg-ink">
          Something went wrong
        </p>
        <p className="mt-1 text-sm text-tg-deep/75">{error}</p>
        {onRetry ? (
          <button
            type="button"
            className="tg-btn-primary mt-4 inline-flex px-3 py-2 text-sm"
            onClick={onRetry}
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="tg-surface px-4 py-8 text-center">
        <p className="font-display text-base font-bold text-tg-ink">
          {emptyTitle}
        </p>
        {emptyHint ? (
          <div className="mt-1 text-sm text-tg-deep/75">{emptyHint}</div>
        ) : null}
        {onRetry ? (
          <button
            type="button"
            className="tg-btn-primary mt-4 inline-flex px-3 py-2 text-sm"
            onClick={onRetry}
          >
            Try again
          </button>
        ) : null}
        {children}
      </div>
    );
  }

  return children;
}
