import { PRINT_INPUT_CLASS } from "../utils/studentListPrint.js";

/**
 * Shared editable header fields for single + batch student list print.
 */
function StudentListPrintHeader({
  title,
  session,
  subject,
  exam,
  listDate,
  totalMarks,
  onChange,
  hint = "These fields print on every sheet header.",
}) {
  const set = (key) => (e) => onChange(key, e.target.value);

  return (
    <div className="no-print mb-4 rounded-2xl border border-rose/40 bg-white p-4 shadow-[0_8px_24px_rgb(31_34_50_/0.05)] sm:p-5">
      <p className="text-sm font-semibold text-navy">Fill details before printing</p>
      <p className="mt-1 text-xs text-slate">{hint}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-navy">List title</span>
          <input className={PRINT_INPUT_CLASS} value={title} onChange={set("title")} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-navy">Session</span>
          <input className={PRINT_INPUT_CLASS} value={session} onChange={set("session")} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-navy">Subject</span>
          <input
            className={PRINT_INPUT_CLASS}
            value={subject}
            onChange={set("subject")}
            placeholder="e.g. Mathematics"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-navy">Exam</span>
          <input
            className={PRINT_INPUT_CLASS}
            value={exam}
            onChange={set("exam")}
            placeholder="e.g. Mid Term"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-navy">Date</span>
          <input
            type="date"
            className={PRINT_INPUT_CLASS}
            value={listDate}
            onChange={set("listDate")}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-navy">Total marks</span>
          <input
            className={PRINT_INPUT_CLASS}
            value={totalMarks}
            onChange={set("totalMarks")}
            placeholder="e.g. 30"
          />
        </label>
      </div>
    </div>
  );
}

export default StudentListPrintHeader;
