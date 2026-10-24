import { SCIENCE_GROUPS, GROUP_LABELS as SCIENCE_GROUP_LABELS } from "./scienceCurriculum.js";

export const MAJORS = ["science", "arts"];

export const MAJOR_LABELS = {
  science: "Science",
  arts: "Arts",
};

export const ARTS_GROUPS = ["arts_general", "arts_humanities", "arts_commerce"];

export const ARTS_GROUP_LABELS = {
  arts_general: "General Arts",
  arts_humanities: "Humanities",
  arts_commerce: "Commerce",
};

export const ALL_GROUPS = [...SCIENCE_GROUPS, ...ARTS_GROUPS];

export const GROUP_LABELS = {
  ...SCIENCE_GROUP_LABELS,
  ...ARTS_GROUP_LABELS,
};

export const groupsForMajor = (major) => {
  if (major === "science") return [...SCIENCE_GROUPS];
  if (major === "arts") return [...ARTS_GROUPS];
  return [];
};

export const isGroupValidForMajor = (group, major) =>
  groupsForMajor(major).includes(group);

/**
 * Infer numeric grade 1–12 from a class display name (e.g. "Class 9", "9th").
 * Fallback only — prefer Class.gradeLevel via resolveClassGrade.
 */
export const inferGradeFromClassName = (name = "") => {
  const text = String(name).trim();
  if (!text) return null;

  const patterns = [
    /(?:class|grade|year)\s*(1[0-2]|[1-9])(?:st|nd|rd|th)?/i,
    /\b(1[0-2]|[1-9])(?:st|nd|rd|th)\b/i,
    /\b(1[0-2]|[1-9])\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const n = Number(match[1]);
      if (n >= 1 && n <= 12) return n;
    }
  }

  return null;
};

/** Prefer stored Class.gradeLevel; fall back to parsing the class name. */
export const resolveClassGrade = (schoolClass) => {
  if (!schoolClass) return null;
  const stored = Number(schoolClass.gradeLevel);
  if (Number.isFinite(stored) && stored >= 1 && stored <= 12) return stored;
  return inferGradeFromClassName(schoolClass.name);
};

export const majorLabel = (major) => MAJOR_LABELS[major] || major || "—";
