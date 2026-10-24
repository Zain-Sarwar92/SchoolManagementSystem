/** Generate-paper create module — constants, helpers, blocks, catalog hook. */

export { WIZARD_STEPS, PART_META, MEDIUM_OPTIONS } from "./constants.js";
export {
  sectionQNumber,
  makeSectionKey,
  subjectIconFor,
  shortClassBadge,
  topicTitleWithoutCode,
} from "./helpers.js";
export {
  QuestionText,
  McqOptionsRow,
  PaperQuestionBlock,
} from "./QuestionBlocks.jsx";
export { useGeneratorCatalog } from "./useGeneratorCatalog.js";
export { default as ChapterQuotaModal } from "./ChapterQuotaModal.jsx";
export {
  ALL_TYPES,
  initChapterPlan,
  buildChapterPlanRows,
  plannerTotalsFromRows,
  plannedCountForType,
  plannedQuotaForChapter,
  chapterQuotasForType,
  updateChapterPlanCount,
  clearChapterPlanCounts,
  autofillChapterPlan,
  validateChapterPlan,
  buildTopicUsage,
} from "./chapterPlan.js";
