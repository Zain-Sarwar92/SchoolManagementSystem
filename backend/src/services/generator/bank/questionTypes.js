/** Shared question-type ordering for syllabus / catalog aggregates. */

const TYPE_ORDER = Object.freeze({ MCQ: 0, SHORT: 1, LONG: 2 });

export function sortQuestionTypes(list) {
  return [...list].sort((a, b) => {
    const od = (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9);
    if (od !== 0) return od;
    return String(a.subType).localeCompare(String(b.subType));
  });
}
