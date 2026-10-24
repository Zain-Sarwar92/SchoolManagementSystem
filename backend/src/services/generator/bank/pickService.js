import GenQuestion from "../../../models/generator/GenQuestion.js";
import {
  selectQuestions,
  selectByChapterQuotas,
} from "../../../utils/distributionEngine.js";
import { buildPoolFilter, mapPoolCard } from "./poolFilter.js";

/**
 * Auto-select questions: BALANCED (topic spread) or RANDOM.
 * Optional chapterQuotas for per-chapter counts.
 */
export async function pickRandomQuestions(body = {}) {
  const {
    count = 10,
    mode = "BALANCED",
    chapterQuotas = [],
    topicUsage = {},
  } = body;
  const filter = buildPoolFilter(body);

  const rows = await GenQuestion.find(filter).lean();
  const pool = rows.map((q) => ({
    id: String(q._id),
    topicId: String(q.topic),
    chapterId: String(q.chapter),
    type: q.type,
    marks: q.marks,
    raw: q,
  }));

  const pickMode = mode === "RANDOM" ? "RANDOM" : "BALANCED";
  const usage =
    topicUsage && typeof topicUsage === "object" && !Array.isArray(topicUsage)
      ? Object.fromEntries(
          Object.entries(topicUsage).map(([k, v]) => [
            String(k),
            Number(v) || 0,
          ])
        )
      : {};
  const selectionOptions = { topicUsage: usage };

  let picked;
  if (Array.isArray(chapterQuotas) && chapterQuotas.length) {
    picked = selectByChapterQuotas(
      pool,
      chapterQuotas.map((q) => ({
        chapterId: String(q.chapterId),
        count: Number(q.count) || 0,
      })),
      pickMode,
      selectionOptions
    );
  } else {
    picked = selectQuestions(
      pool,
      Number(count) || 0,
      pickMode,
      selectionOptions
    );
  }

  const byId = new Map(pool.map((p) => [p.id, p.raw]));
  return {
    questions: picked.map((p) => mapPoolCard(byId.get(p.id))).filter(Boolean),
  };
}
