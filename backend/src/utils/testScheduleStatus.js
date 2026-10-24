export const PENDING_WINDOW_DAYS = 7;

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from, to) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/**
 * COMPLETED only when a paper is linked — completedAt alone is ignored.
 */
export function resolveAssignmentStatus({
  testDate,
  hasCreatedTest,
  now = new Date(),
}) {
  if (hasCreatedTest) return "COMPLETED";
  const daysUntil = daysBetween(now, new Date(testDate));
  if (daysUntil < 0) return "OVERDUE";
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

export function statusChipClass(status) {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
    case "OVERDUE":
      return "bg-rose/40 text-navy ring-1 ring-rose/60";
    case "PENDING":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200";
    case "UPCOMING":
      return "bg-sky-50 text-sky-900 ring-1 ring-sky-200";
    default:
      return "bg-bg-soft text-slate ring-1 ring-rose/30";
  }
}
