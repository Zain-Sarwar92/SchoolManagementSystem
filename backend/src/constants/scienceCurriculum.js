/** Science Major group keys */
export const SCIENCE_GROUPS = [
  "biology",
  "computer",
  "pre_medical",
  "pre_engineering",
  "ics",
];

export const SCIENCE_GRADES = [9, 10, 11, 12];

/** Groups available per grade */
export const GROUPS_BY_GRADE = {
  9: ["biology", "computer"],
  10: ["biology", "computer"],
  11: ["pre_medical", "pre_engineering", "ics"],
  12: ["pre_medical", "pre_engineering", "ics"],
};

export const GROUP_LABELS = {
  biology: "Biology",
  computer: "Computer",
  pre_medical: "Pre-Medical",
  pre_engineering: "Pre-Engineering",
  ics: "ICS",
};

/**
 * Exact Science Major packages: grade → group → subject names (ordered)
 */
export const SCIENCE_CURRICULUM_PACKAGES = [
  {
    gradeLevel: 9,
    group: "biology",
    subjects: [
      "English",
      "Urdu",
      "Mathematics",
      "Physics",
      "Chemistry",
      "Biology",
      "Islamiyat",
      "Tarjuma-tul-Quran-ul-Majeed",
    ],
  },
  {
    gradeLevel: 9,
    group: "computer",
    subjects: [
      "English",
      "Urdu",
      "Mathematics",
      "Physics",
      "Chemistry",
      "Computer Science",
      "Islamiyat",
      "Tarjuma-tul-Quran-ul-Majeed",
    ],
  },
  {
    gradeLevel: 10,
    group: "biology",
    subjects: [
      "English",
      "Urdu",
      "Mathematics",
      "Physics",
      "Chemistry",
      "Biology",
      "Pakistan Studies",
      "Tarjuma-tul-Quran-ul-Majeed",
    ],
  },
  {
    gradeLevel: 10,
    group: "computer",
    subjects: [
      "English",
      "Urdu",
      "Mathematics",
      "Physics",
      "Chemistry",
      "Computer Science",
      "Pakistan Studies",
      "Tarjuma-tul-Quran-ul-Majeed",
    ],
  },
  {
    gradeLevel: 11,
    group: "pre_medical",
    subjects: [
      "English",
      "Urdu",
      "Physics",
      "Chemistry",
      "Biology",
      "Islamiyat / Ethics",
      "Tarjuma-tul-Quran-ul-Majeed",
    ],
  },
  {
    gradeLevel: 11,
    group: "pre_engineering",
    subjects: [
      "English",
      "Urdu",
      "Mathematics",
      "Physics",
      "Chemistry",
      "Islamiyat / Ethics",
      "Tarjuma-tul-Quran-ul-Majeed",
    ],
  },
  {
    gradeLevel: 11,
    group: "ics",
    subjects: [
      "English",
      "Urdu",
      "Mathematics",
      "Physics",
      "Computer Science",
      "Islamiyat / Ethics",
      "Tarjuma-tul-Quran-ul-Majeed",
    ],
  },
  {
    gradeLevel: 12,
    group: "pre_medical",
    subjects: [
      "English",
      "Urdu",
      "Physics",
      "Chemistry",
      "Biology",
      "Pakistan Studies",
      "Tarjuma-tul-Quran-ul-Majeed",
    ],
  },
  {
    gradeLevel: 12,
    group: "pre_engineering",
    subjects: [
      "English",
      "Urdu",
      "Mathematics",
      "Physics",
      "Chemistry",
      "Pakistan Studies",
      "Tarjuma-tul-Quran-ul-Majeed",
    ],
  },
  {
    gradeLevel: 12,
    group: "ics",
    subjects: [
      "English",
      "Urdu",
      "Mathematics",
      "Physics",
      "Computer Science",
      "Pakistan Studies",
      "Tarjuma-tul-Quran-ul-Majeed",
    ],
  },
];

export const groupsForGrade = (gradeLevel) => {
  const n = Number(gradeLevel);
  return GROUPS_BY_GRADE[n] || [];
};

export const isGroupValidForGrade = (group, gradeLevel) =>
  groupsForGrade(gradeLevel).includes(group);
