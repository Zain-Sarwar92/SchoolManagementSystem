/** Shared helpers for result gazette / compile print tables. */

export function formatMarks(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return (Math.round(Number(n) * 10) / 10).toFixed(1);
}

/** Short group codes for the Group column (Bio, Comp, …). */
export function shortGroupLabel(group) {
  if (!group) return "—";
  const map = {
    biology: "Bio",
    computer: "Comp",
    pre_medical: "PreM",
    pre_engineering: "PreE",
    ics: "ICS",
  };
  if (map[group]) return map[group];
  const raw = String(group).trim();
  return raw.length <= 4 ? raw : raw.slice(0, 4);
}

/** Strip seed tags like BioBlue / CompRed from student names. */
export function cleanStudentName(name) {
  return String(name || "")
    .replace(/\s+(Bio|Comp|Chem)[A-Za-z0-9]*$/i, "")
    .trim();
}

/** Strip trailing roll digits that were appended to father names in seed data. */
export function cleanFatherName(name) {
  return String(name || "")
    .replace(/\s+\d{3,}$/, "")
    .trim();
}

export function shortRoundLabel(label = "") {
  const cleaned = String(label).trim();
  const match = cleaned.match(/round\s*(\d+)/i);
  if (match) return `R${match[1]}`;
  return cleaned.length > 10 ? `${cleaned.slice(0, 8)}…` : cleaned || "—";
}
