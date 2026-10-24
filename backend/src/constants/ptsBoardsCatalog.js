/**
 * PTS Select Syllabus boards (CourseID) + classes — matches paktestsolution.com.
 * Used by seed script + stub catalog fallback.
 */

export const PTS_BOARD_CATALOG = [
  {
    ptsCourseId: 1,
    code: "PTB",
    name: "PTB",
    subtitle: "Syllabus",
    sortOrder: 1,
    imageUrl:
      "https://paktestsolution.com/images/subjects/638685002268142513.png",
    /** Legacy Mongo name before PTS rename */
    aliases: ["Punjab Textbook"],
    classes: [
      { ptsClassId: 1, name: "ONE", gradeLevel: 1 },
      { ptsClassId: 2, name: "TWO", gradeLevel: 2 },
      { ptsClassId: 3, name: "THREE", gradeLevel: 3 },
      { ptsClassId: 4, name: "FOUR", gradeLevel: 4 },
      { ptsClassId: 5, name: "5TH", gradeLevel: 5 },
      { ptsClassId: 6, name: "6TH", gradeLevel: 6 },
      { ptsClassId: 7, name: "7TH", gradeLevel: 7 },
      { ptsClassId: 8, name: "8TH", gradeLevel: 8 },
      {
        ptsClassId: 9,
        name: "9TH",
        gradeLevel: 9,
        aliases: ["Class 9"],
      },
      {
        ptsClassId: 10,
        name: "10TH",
        gradeLevel: 10,
        aliases: ["Class 10"],
      },
      {
        ptsClassId: 11,
        name: "INTER-I",
        gradeLevel: 11,
        aliases: ["Class 11"],
      },
      {
        ptsClassId: 12,
        name: "INTER-II",
        gradeLevel: 12,
        aliases: ["Class 12"],
      },
      { ptsClassId: 36, name: "OLD BOOKS", gradeLevel: null },
    ],
  },
  {
    ptsCourseId: 2,
    code: "AFAQ",
    name: "AFAQ SNC",
    subtitle: "Syllabus",
    sortOrder: 2,
    imageUrl:
      "https://paktestsolution.com/images/subjects/638685002353912668.png",
    classes: [
      { ptsClassId: 13, name: "ONE", gradeLevel: 1 },
      { ptsClassId: 14, name: "TWO", gradeLevel: 2 },
      { ptsClassId: 15, name: "THREE", gradeLevel: 3 },
      { ptsClassId: 16, name: "FOUR", gradeLevel: 4 },
      { ptsClassId: 17, name: "5TH", gradeLevel: 5 },
      { ptsClassId: 37, name: "6TH", gradeLevel: 6 },
      { ptsClassId: 38, name: "7TH", gradeLevel: 7 },
    ],
  },
  {
    ptsCourseId: 3,
    code: "OXFORD",
    name: "OXFORD SNC",
    subtitle: "Syllabus",
    sortOrder: 3,
    imageUrl:
      "https://paktestsolution.com/images/subjects/638985320807545481.png",
    classes: [
      { ptsClassId: 21, name: "ONE", gradeLevel: 1 },
      { ptsClassId: 22, name: "TWO", gradeLevel: 2 },
      { ptsClassId: 23, name: "THREE", gradeLevel: 3 },
      { ptsClassId: 24, name: "FOUR", gradeLevel: 4 },
      { ptsClassId: 25, name: "5TH", gradeLevel: 5 },
      { ptsClassId: 46, name: "6TH", gradeLevel: 6 },
      { ptsClassId: 47, name: "7TH", gradeLevel: 7 },
    ],
  },
  {
    ptsCourseId: 4,
    code: "GOHAR",
    name: "GOHAR SNC",
    subtitle: "Syllabus",
    sortOrder: 4,
    imageUrl:
      "https://paktestsolution.com/images/subjects/638971582888021935.png",
    classes: [
      { ptsClassId: 39, name: "ONE", gradeLevel: 1 },
      { ptsClassId: 40, name: "TWO", gradeLevel: 2 },
      { ptsClassId: 41, name: "THREE", gradeLevel: 3 },
      { ptsClassId: 42, name: "FOUR", gradeLevel: 4 },
      { ptsClassId: 43, name: "5TH", gradeLevel: 5 },
      { ptsClassId: 44, name: "6TH", gradeLevel: 6 },
      { ptsClassId: 45, name: "7TH", gradeLevel: 7 },
    ],
  },
  {
    ptsCourseId: 5,
    code: "BA",
    name: "B.A",
    subtitle: "Syllabus",
    sortOrder: 5,
    imageUrl:
      "https://paktestsolution.com/images/subjects/638685002576869275.png",
    classes: [
      { ptsClassId: 34, name: "3RD YEAR", gradeLevel: null },
      { ptsClassId: 35, name: "4TH YEAR", gradeLevel: null },
    ],
  },
];
