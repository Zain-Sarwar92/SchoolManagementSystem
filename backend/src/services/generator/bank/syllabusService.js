import GenSubject from "../../../models/generator/GenSubject.js";
import GenChapter from "../../../models/generator/GenChapter.js";
import GenTopic from "../../../models/generator/GenTopic.js";
import GenQuestion from "../../../models/generator/GenQuestion.js";
import { httpError } from "../httpError.js";
import { sortQuestionTypes } from "./questionTypes.js";

/**
 * Subject syllabus: chapters → topics + per-topic / subject question-type counts.
 */
export async function getSubjectSyllabus(subjectId) {
  const subject = await GenSubject.findById(subjectId).lean();
  if (!subject) {
    throw httpError(404, "Subject not found");
  }

  const chapters = await GenChapter.find({ subject: subject._id })
    .sort({ order: 1 })
    .lean();
  const chapterIds = chapters.map((c) => c._id);
  const topics = await GenTopic.find({ chapter: { $in: chapterIds } })
    .sort({ order: 1 })
    .lean();
  const counts = await GenQuestion.aggregate([
    {
      $match: {
        subject: subject._id,
        isActive: true,
      },
    },
    {
      $group: {
        _id: { topic: "$topic", type: "$type", subType: "$subType" },
        count: { $sum: 1 },
      },
    },
  ]);

  const countMap = new Map();
  const subjectTypeMap = new Map();

  for (const row of counts) {
    const key = String(row._id.topic);
    const cur = countMap.get(key) || {
      MCQ: 0,
      SHORT: 0,
      LONG: 0,
      total: 0,
      bySubType: {},
      typeMap: new Map(),
    };
    cur[row._id.type] = (cur[row._id.type] || 0) + row.count;
    cur.total += row.count;
    const st = String(row._id.subType || row._id.type || "").toUpperCase();
    cur.bySubType[st] = (cur.bySubType[st] || 0) + row.count;
    const tk = `${row._id.type}::${st}`;
    const tPrev = cur.typeMap.get(tk) || {
      type: row._id.type,
      subType: st,
      count: 0,
    };
    tPrev.count += row.count;
    cur.typeMap.set(tk, tPrev);
    countMap.set(key, cur);

    const sk = `${row._id.type}::${st}`;
    const prev = subjectTypeMap.get(sk) || {
      type: row._id.type,
      subType: st,
      count: 0,
    };
    prev.count += row.count;
    subjectTypeMap.set(sk, prev);
  }

  const questionTypes = sortQuestionTypes([...subjectTypeMap.values()]);

  const topicsByChapter = new Map();
  for (const topic of topics) {
    const key = String(topic.chapter);
    const list = topicsByChapter.get(key) || [];
    const c = countMap.get(String(topic._id)) || {
      MCQ: 0,
      SHORT: 0,
      LONG: 0,
      total: 0,
      bySubType: {},
      typeMap: new Map(),
    };
    list.push({
      id: String(topic._id),
      name: topic.name,
      order: topic.order,
      code: topic.code,
      questionCount: c.total,
      countsByType: { MCQ: c.MCQ, SHORT: c.SHORT, LONG: c.LONG },
      countsBySubType: c.bySubType,
      questionTypes: sortQuestionTypes([...(c.typeMap?.values?.() || [])]),
    });
    topicsByChapter.set(key, list);
  }

  return {
    subject: {
      id: String(subject._id),
      name: subject.name,
      slug: subject.slug,
    },
    questionTypes,
    chapters: chapters.map((ch) => ({
      id: String(ch._id),
      name: ch.name,
      order: ch.order,
      topics: topicsByChapter.get(String(ch._id)) || [],
    })),
  };
}
