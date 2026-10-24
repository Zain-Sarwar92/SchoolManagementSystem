import GenQuestion from "../../../models/generator/GenQuestion.js";
import { buildPoolFilter, mapPoolCard } from "./poolFilter.js";

/** Browse / filter the question bank (capped list + total). */
export async function searchQuestionPool(body = {}) {
  const filter = buildPoolFilter(body);
  const capped = Math.min(Math.max(Number(body.limit) || 2500, 1), 5000);
  const [total, questions] = await Promise.all([
    GenQuestion.countDocuments(filter),
    GenQuestion.find(filter).sort({ createdAt: 1 }).limit(capped).lean(),
  ]);

  return {
    total,
    truncated: total > questions.length,
    questions: questions.map(mapPoolCard),
  };
}
