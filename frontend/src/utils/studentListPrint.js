export function todayInputValue(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function academicSession(date = new Date()) {
  const year = date.getFullYear();
  const start = date.getMonth() >= 3 ? year : year - 1;
  return `${start}-${start + 1}`;
}

export function isSessionLabel(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{4})$/);
  if (!match) return false;
  return Number(match[2]) === Number(match[1]) + 1;
}

/** e.g. 2026-2027 → 2027-2028 */
export function nextSessionLabel(session) {
  const match = String(session || "").match(/^(\d{4})-(\d{4})$/);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) return "";
  const start = Number(match[1]) + 1;
  return `${start}-${start + 1}`;
}

/** Newest first, including one year ahead of the current session. */
export function sessionChoices(fromYear = 2020, date = new Date()) {
  const currentStart = Number(academicSession(date).slice(0, 4));
  const choices = [];
  for (let year = currentStart + 1; year >= fromYear; year -= 1) {
    choices.push(`${year}-${year + 1}`);
  }
  return choices;
}

export function sortByRoll(a = "", b = "") {
  const na = String(a).match(/\d+/);
  const nb = String(b).match(/\d+/);
  if (na && nb) {
    const diff = Number(na[0]) - Number(nb[0]);
    if (diff !== 0) return diff;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

export function printHeaderDefaults(searchParams) {
  return {
    title: searchParams.get("title") || "Student List",
    session: searchParams.get("session") || academicSession(),
    subject: searchParams.get("subject") || "",
    exam: searchParams.get("exam") || "",
    listDate: searchParams.get("date") || todayInputValue(),
    totalMarks: searchParams.get("totalMarks") || "",
  };
}

export const PRINT_INPUT_CLASS =
  "w-full rounded-xl border border-rose/60 bg-bg-soft px-3 py-2 text-sm text-navy outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/40";
