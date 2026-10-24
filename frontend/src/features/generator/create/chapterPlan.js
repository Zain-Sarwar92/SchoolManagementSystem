/** Multi-chapter MCQ/Short/Long quota planner helpers. */

const ALL_TYPES = ["MCQ", "SHORT", "LONG"];

export { ALL_TYPES };

/** Sum available MCQ/SHORT/LONG for a chapter (optionally filtered by topic ids). */
function chapterTypeTotals(chapter, topicIds) {
  const topicSet = topicIds instanceof Set ? topicIds : new Set(topicIds || []);
  const topics = topicSet.size
    ? (chapter?.topics || []).filter((t) => topicSet.has(t.id))
    : chapter?.topics || [];
  return topics.reduce(
    (acc, topic) => ({
      MCQ: acc.MCQ + (topic.countsByType?.MCQ || 0),
      SHORT: acc.SHORT + (topic.countsByType?.SHORT || 0),
      LONG: acc.LONG + (topic.countsByType?.LONG || 0),
    }),
    { MCQ: 0, SHORT: 0, LONG: 0 }
  );
}

function emptyChapterPlanRow(chapterId) {
  return {
    chapterId,
    mcqCount: "",
    shortCount: "",
    longCount: "",
  };
}

export function initChapterPlan(chapters = []) {
  return chapters.map((c) => emptyChapterPlanRow(c.id));
}

export function buildChapterPlanRows(chapterPlan, selectedChapters, selectedTopicIds) {
  const planByChapter = new Map(
    (chapterPlan || []).map((item) => [item.chapterId, item])
  );
  const topicSet = new Set(selectedTopicIds || []);
  return (selectedChapters || []).map((chapter) => {
    const available = chapterTypeTotals(chapter, topicSet);
    const plan = planByChapter.get(chapter.id);
    const requested = {
      MCQ: typeof plan?.mcqCount === "number" ? plan.mcqCount : 0,
      SHORT: typeof plan?.shortCount === "number" ? plan.shortCount : 0,
      LONG: typeof plan?.longCount === "number" ? plan.longCount : 0,
    };
    return {
      chapter,
      available,
      requested,
      total: requested.MCQ + requested.SHORT + requested.LONG,
    };
  });
}

export function plannerTotalsFromRows(rows) {
  return (rows || []).reduce(
    (acc, row) => ({
      MCQ: acc.MCQ + (row.requested?.MCQ || 0),
      SHORT: acc.SHORT + (row.requested?.SHORT || 0),
      LONG: acc.LONG + (row.requested?.LONG || 0),
    }),
    { MCQ: 0, SHORT: 0, LONG: 0 }
  );
}

export function plannedCountForType(chapterPlan, type) {
  return (chapterPlan || []).reduce((sum, item) => {
    const value =
      type === "MCQ"
        ? item.mcqCount
        : type === "SHORT"
          ? item.shortCount
          : item.longCount;
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
}

export function plannedQuotaForChapter(chapterPlan, chapterId, type) {
  const item = (chapterPlan || []).find((row) => row.chapterId === chapterId);
  if (!item) return null;
  const value =
    type === "MCQ"
      ? item.mcqCount
      : type === "SHORT"
        ? item.shortCount
        : item.longCount;
  return typeof value === "number" ? value : 0;
}

/** Quotas for one question type (non-zero only). */
export function chapterQuotasForType(chapterPlan, type) {
  return (chapterPlan || [])
    .map((item) => ({
      chapterId: item.chapterId,
      count: plannedQuotaForChapter(chapterPlan, item.chapterId, type) ?? 0,
    }))
    .filter((item) => item.count > 0);
}

export function updateChapterPlanCount(prev, chapterId, type, value) {
  return (prev || []).map((item) =>
    item.chapterId !== chapterId
      ? item
      : {
          ...item,
          ...(type === "MCQ"
            ? { mcqCount: value }
            : type === "SHORT"
              ? { shortCount: value }
              : { longCount: value }),
        }
  );
}

export function clearChapterPlanCounts(prev) {
  return (prev || []).map((item) => ({
    ...item,
    mcqCount: "",
    shortCount: "",
    longCount: "",
  }));
}

export function autofillChapterPlan(selectedChapters, selectedTopicIds) {
  const topicSet = new Set(selectedTopicIds || []);
  return (selectedChapters || []).map((chapter) => {
    const available = chapterTypeTotals(chapter, topicSet);
    return {
      chapterId: chapter.id,
      mcqCount: available.MCQ > 0 ? 1 : "",
      shortCount: available.SHORT > 0 ? 1 : "",
      longCount: available.LONG > 0 ? 1 : "",
    };
  });
}

export function validateChapterPlan(rows, plannerQuestionTotal) {
  if (!rows?.length) return "Select at least one chapter first.";
  if (!plannerQuestionTotal) {
    return "Enter the required question counts for each chapter and type.";
  }
  for (const row of rows) {
    if (row.requested.MCQ > row.available.MCQ) {
      return `${row.chapter.name}: only ${row.available.MCQ} MCQ available`;
    }
    if (row.requested.SHORT > row.available.SHORT) {
      return `${row.chapter.name}: only ${row.available.SHORT} Short available`;
    }
    if (row.requested.LONG > row.available.LONG) {
      return `${row.chapter.name}: only ${row.available.LONG} Long available`;
    }
  }
  return null;
}

/** Topic usage map from questions already on the paper (and optional draft). */
export function buildTopicUsage(questions = []) {
  const usage = {};
  for (const q of questions) {
    const tid = q?.topicId;
    if (!tid) continue;
    usage[tid] = (usage[tid] || 0) + 1;
  }
  return usage;
}
