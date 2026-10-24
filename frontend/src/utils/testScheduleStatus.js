import { addWorkingDays } from "./scheduleWorkingDays.js";

export function resolveAssignmentStatus({ testDate, hasCreatedTest, now = new Date() }) {
  if (hasCreatedTest) return "COMPLETED";
  const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round(
    (start(new Date(testDate)).getTime() - start(now).getTime()) /
      (24 * 60 * 60 * 1000)
  );
  if (days < 0) return "OVERDUE";
  return "UPCOMING";
}

export function formatScheduleDate(date) {
  const d = new Date(date);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const rest = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${weekday} ${rest}`;
}

/** Compact print format, e.g. "Wed, 19-08-26". */
export function formatScheduleDateShort(date) {
  const d = new Date(date);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${weekday}, ${day}-${month}-${year}`;
}

/** Checked papers go back 4 working days after the test (Sunday off). */
export const RETURN_WORKING_DAYS = 4;

export function returningDateForTest(testDate) {
  return addWorkingDays(new Date(testDate), RETURN_WORKING_DAYS);
}

export function shortClassLabel(className) {
  const match = String(className || "")
    .trim()
    .match(/(\d+[A-Za-z]*)\s*$/);
  return match?.[1] ?? String(className || "").trim();
}

export function statusChipClass(status) {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
    case "OVERDUE":
      return "bg-rose/50 text-navy ring-1 ring-rose/70";
    case "PENDING":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200";
    case "UPCOMING":
      return "bg-sky-50 text-sky-900 ring-1 ring-sky-200";
    default:
      return "bg-bg-soft text-slate ring-1 ring-rose/30";
  }
}
