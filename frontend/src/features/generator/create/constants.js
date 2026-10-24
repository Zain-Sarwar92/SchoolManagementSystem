/** Generate-paper wizard steps + shared option lists. */

export const WIZARD_STEPS = [
  { id: "board", label: "Board" },
  { id: "class", label: "Class" },
  { id: "subject", label: "Subject" },
  { id: "chapters", label: "Syllabus" },
  { id: "paper", label: "Paper" },
];

export const PART_META = {
  objective: { en: "Objective Part", ur: "حصہ معروضی" },
  subjective: { en: "Subjective Part", ur: "حصہ انشائیہ" },
};

export const MEDIUM_OPTIONS = [
  { value: "BOTH", label: "Dual" },
  { value: "ENGLISH", label: "English" },
  { value: "URDU", label: "Urdu" },
];
