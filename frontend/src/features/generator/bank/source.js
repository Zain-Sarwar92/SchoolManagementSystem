/** Question-bank source filter labels (Exercise / Additional / All). */

export const SOURCE_OPTIONS = Object.freeze([
  { value: "ALL", label: "All (Smart Syllabus)" },
  { value: "EXERCISE", label: "Exercise" },
  { value: "ADDITIONAL", label: "Additional" },
]);

export function sourceKind(source) {
  const s = String(source || "").toLowerCase();
  if (s.includes("exercise")) return "exercise";
  if (s.includes("additional")) return "additional";
  return "other";
}

export function sourceLabel(source) {
  const kind = sourceKind(source);
  if (kind === "exercise") return "Exercise";
  if (kind === "additional") return "Additional";
  return String(source || "").trim() || "Other";
}

/** Compact badge text for pool rows (mobile-friendly). */
export function sourceLabelShort(source) {
  const kind = sourceKind(source);
  if (kind === "exercise") return "Ex";
  if (kind === "additional") return "Add";
  return "Other";
}
