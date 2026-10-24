import { ALL_TYPES } from "./chapterPlan.js";
import { TYPE_META } from "../utils/paperBlueprint.js";

/**
 * Popup: per-chapter MCQ / Short / Long counts for classic 3-type subjects.
 */
export default function ChapterQuotaModal({
  open,
  subjectName,
  className,
  rows,
  totals,
  questionTotal,
  onUpdate,
  onAutofill,
  onClear,
  onCancel,
  onContinue,
}) {
  if (!open) return null;

  return (
    <div className="tg-modal-backdrop" role="dialog" aria-modal="true">
      <div className="tg-modal tg-chapter-quota-modal">
        <div className="tg-modal-header">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/75">
              Chapter planner
            </p>
            <h3 className="truncate text-base font-bold sm:text-lg">
              {className} — {subjectName}
            </h3>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>

        <div className="tg-chapter-quota-body">

          <div className="tg-chapter-quota-actions">
            <button type="button" className="tg-btn-ghost" onClick={onAutofill}>
              Auto fill
            </button>
            <button type="button" className="tg-btn-ghost" onClick={onClear}>
              Clear
            </button>
          </div>

          <div className="tg-chapter-quota-summary">
            <div>
              <span>MCQ</span>
              <strong>{totals.MCQ}</strong>
            </div>
            <div>
              <span>Short</span>
              <strong>{totals.SHORT}</strong>
            </div>
            <div>
              <span>Long</span>
              <strong>{totals.LONG}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{questionTotal}</strong>
            </div>
          </div>

          <div className="tg-chapter-quota-table-wrap">
            <table className="tg-chapter-quota-table">
              <thead>
                <tr>
                  <th>Chapter</th>
                  <th>MCQ</th>
                  <th>Short</th>
                  <th>Long</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.chapter.id}>
                    <td>
                      <p className="tg-chapter-quota-name">{row.chapter.name}</p>
                      <p className="tg-chapter-quota-meta">
                        {row.available.MCQ}/{row.available.SHORT}/
                        {row.available.LONG} avail
                      </p>
                    </td>
                    {ALL_TYPES.map((type) => {
                      const available = row.available[type];
                      const value =
                        row.requested[type] > 0 ? row.requested[type] : "";
                      return (
                        <td key={type}>
                          <input
                            type="number"
                            min={0}
                            max={available}
                            inputMode="numeric"
                            disabled={available === 0}
                            value={value}
                            aria-label={`${row.chapter.name} ${TYPE_META[type].short}`}
                            onChange={(e) => {
                              const raw = e.target.value;
                              onUpdate(
                                row.chapter.id,
                                type,
                                raw === ""
                                  ? ""
                                  : Math.min(
                                      available,
                                      Math.max(0, Number(raw))
                                    )
                              );
                            }}
                            className="tg-field h-10 w-full min-w-18 px-2 text-center text-sm"
                          />
                          <em className="tg-chapter-quota-avail">
                            {available} avail
                          </em>
                        </td>
                      );
                    })}
                    <td>
                      <strong>{row.total}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="tg-modal-footer">
          <div>
            <p className="text-sm text-tg-ink/75">
              <strong className="text-tg-ink">{questionTotal}</strong> questions
              planned
            </p>
            {questionTotal < 1 ? (
              <p className="tg-chapter-quota-hint">
                Enter at least one question count to continue.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="tg-btn-primary min-w-40 px-4 py-2.5 text-sm disabled:opacity-50"
            onClick={onContinue}
            disabled={questionTotal < 1}
          >
            Continue → Select Questions
          </button>
        </div>
      </div>
    </div>
  );
}
