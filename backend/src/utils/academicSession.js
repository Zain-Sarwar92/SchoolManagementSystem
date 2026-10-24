/** Academic year starts in April. October 2026 → "2026-2027". */
export const currentAcademicSession = (date = new Date()) => {
  const year = date.getFullYear();
  const start = date.getMonth() >= 3 ? year : year - 1;
  return `${start}-${start + 1}`;
};

export const parseSession = (value) => {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{4})$/);
  if (!match) return "";
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end !== start + 1 || start < 1990 || start > 2100) return "";
  return `${start}-${end}`;
};

export const resolveSession = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return currentAcademicSession();
  const parsed = parseSession(raw);
  if (!parsed) {
    const error = new Error("Session must look like 2025-2026");
    error.statusCode = 400;
    throw error;
  }
  return parsed;
};

export const sessionStartYear = (session = "") => Number(String(session).slice(0, 4));

/** e.g. 2026-2027 → 2027-2028 */
export const nextSessionLabel = (session) => {
  const start = sessionStartYear(session);
  if (!Number.isFinite(start)) return "";
  return `${start + 1}-${start + 2}`;
};
