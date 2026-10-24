import { httpError } from "../httpError.js";

/** API card shape for pool search / pick results. */
export function mapPoolCard(q) {
  if (!q) return null;
  return {
    id: String(q._id),
    type: q.type,
    subType: q.subType,
    text: q.text,
    textUrdu: q.textUrdu,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    correctAnswer: q.correctAnswer,
    marks: q.marks,
    source: q.source,
    topicId: String(q.topic),
    chapterId: String(q.chapter),
  };
}

/**
 * Shared Mongo filter for search + pick.
 * Supports topic/chapter scope, subtype(s), source, excludeIds.
 */
export function buildPoolFilter({
  subjectId,
  topicIds = [],
  chapterIds = [],
  type,
  subType,
  subTypes,
  source = "ALL",
  excludeIds = [],
}) {
  if (!subjectId || !type) {
    throw httpError(400, "subjectId and type are required");
  }

  const filter = {
    subject: subjectId,
    type,
    isActive: true,
  };
  const subtypeList = Array.isArray(subTypes)
    ? subTypes.map((s) => String(s).toUpperCase()).filter(Boolean)
    : subType
      ? [String(subType).toUpperCase()]
      : [];
  if (subtypeList.length === 1) {
    filter.subType = subtypeList[0];
  } else if (subtypeList.length > 1) {
    filter.subType = { $in: subtypeList };
  }
  if (Array.isArray(topicIds) && topicIds.length) {
    filter.topic = { $in: topicIds };
  } else if (Array.isArray(chapterIds) && chapterIds.length) {
    filter.chapter = { $in: chapterIds };
  }
  if (Array.isArray(excludeIds) && excludeIds.length) {
    filter._id = { $nin: excludeIds };
  }
  if (source && source !== "ALL") {
    filter.source = new RegExp(String(source), "i");
  }
  return filter;
}
