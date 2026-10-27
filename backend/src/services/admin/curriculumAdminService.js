import GenBoard from "../../models/generator/GenBoard.js";
import GenClass from "../../models/generator/GenClass.js";
import GenSubject from "../../models/generator/GenSubject.js";
import GenChapter from "../../models/generator/GenChapter.js";
import GenTopic from "../../models/generator/GenTopic.js";
import GenQuestion from "../../models/generator/GenQuestion.js";
import { httpError } from "../generator/httpError.js";
import { slugify } from "../../utils/helpers.js";

function oid(id) {
  return String(id || "");
}

function pickDefined(src, keys) {
  const out = {};
  for (const key of keys) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  return out;
}

async function assertBoard(id) {
  const board = await GenBoard.findById(id);
  if (!board) throw httpError(404, "Board not found");
  return board;
}

async function assertClass(id) {
  const klass = await GenClass.findById(id);
  if (!klass) throw httpError(404, "Class not found");
  return klass;
}

async function assertSubject(id) {
  const subject = await GenSubject.findById(id);
  if (!subject) throw httpError(404, "Subject not found");
  return subject;
}

async function assertChapter(id) {
  const chapter = await GenChapter.findById(id);
  if (!chapter) throw httpError(404, "Chapter not found");
  return chapter;
}

async function assertTopic(id) {
  const topic = await GenTopic.findById(id);
  if (!topic) throw httpError(404, "Topic not found");
  return topic;
}

/** Overview counts for Super Admin curriculum home. */
export async function getBankStats() {
  const [boards, classes, subjects, chapters, topics, questions, activeQuestions] =
    await Promise.all([
      GenBoard.countDocuments(),
      GenClass.countDocuments(),
      GenSubject.countDocuments(),
      GenChapter.countDocuments(),
      GenTopic.countDocuments(),
      GenQuestion.countDocuments(),
      GenQuestion.countDocuments({ isActive: true }),
    ]);

  return {
    boards,
    classes,
    subjects,
    chapters,
    topics,
    questions,
    activeQuestions,
    inactiveQuestions: questions - activeQuestions,
  };
}

/* ─── Boards ─── */

export async function listBoards() {
  const boards = await GenBoard.find().sort({ sortOrder: 1, name: 1 }).lean();
  const withCounts = await Promise.all(
    boards.map(async (board) => {
      const classCount = await GenClass.countDocuments({ board: board._id });
      return { ...board, classCount };
    })
  );
  return withCounts;
}

export async function createBoard(body) {
  const name = String(body.name || "").trim();
  if (!name) throw httpError(400, "Board name is required");

  try {
    const board = await GenBoard.create({
      name,
      code: String(body.code || "").trim(),
      subtitle: String(body.subtitle || "Syllabus").trim() || "Syllabus",
      ptsCourseId:
        body.ptsCourseId === null || body.ptsCourseId === "" || body.ptsCourseId === undefined
          ? null
          : Number(body.ptsCourseId),
      imageUrl: String(body.imageUrl || "").trim(),
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 100,
    });
    return board.toObject();
  } catch (err) {
    if (err?.code === 11000) throw httpError(400, "A board with this name already exists");
    throw err;
  }
}

export async function updateBoard(id, body) {
  const board = await assertBoard(id);
  const patch = pickDefined(body, ["name", "code", "subtitle", "imageUrl", "sortOrder", "ptsCourseId"]);
  if (patch.name !== undefined) {
    patch.name = String(patch.name).trim();
    if (!patch.name) throw httpError(400, "Board name is required");
  }
  if (patch.code !== undefined) patch.code = String(patch.code).trim();
  if (patch.subtitle !== undefined) {
    patch.subtitle = String(patch.subtitle).trim() || "Syllabus";
  }
  if (patch.imageUrl !== undefined) patch.imageUrl = String(patch.imageUrl).trim();
  if (patch.sortOrder !== undefined) patch.sortOrder = Number(patch.sortOrder) || 100;
  if (patch.ptsCourseId !== undefined) {
    patch.ptsCourseId =
      patch.ptsCourseId === null || patch.ptsCourseId === ""
        ? null
        : Number(patch.ptsCourseId);
  }

  Object.assign(board, patch);
  try {
    await board.save();
  } catch (err) {
    if (err?.code === 11000) throw httpError(400, "A board with this name already exists");
    throw err;
  }
  return board.toObject();
}

export async function deleteBoard(id, { cascade = false } = {}) {
  const board = await assertBoard(id);
  const classes = await GenClass.find({ board: board._id }).select("_id").lean();
  if (classes.length && !cascade) {
    throw httpError(
      400,
      `Board has ${classes.length} class(es). Pass cascade=true to delete everything under it.`
    );
  }

  if (classes.length) {
    const classIds = classes.map((c) => c._id);
    const subjects = await GenSubject.find({ class: { $in: classIds } }).select("_id").lean();
    const subjectIds = subjects.map((s) => s._id);
    const chapters = await GenChapter.find({ subject: { $in: subjectIds } }).select("_id").lean();
    const chapterIds = chapters.map((c) => c._id);
    const topics = await GenTopic.find({ chapter: { $in: chapterIds } }).select("_id").lean();
    const topicIds = topics.map((t) => t._id);

    await GenQuestion.deleteMany({
      $or: [{ subject: { $in: subjectIds } }, { topic: { $in: topicIds } }],
    });
    await GenTopic.deleteMany({ _id: { $in: topicIds } });
    await GenChapter.deleteMany({ _id: { $in: chapterIds } });
    await GenSubject.deleteMany({ _id: { $in: subjectIds } });
    await GenClass.deleteMany({ _id: { $in: classIds } });
  }

  await GenBoard.findByIdAndDelete(board._id);
  return { deleted: true, id: oid(board._id) };
}

/* ─── Classes ─── */

export async function listClasses(boardId) {
  await assertBoard(boardId);
  const classes = await GenClass.find({ board: boardId })
    .sort({ gradeLevel: 1, name: 1 })
    .lean();
  return Promise.all(
    classes.map(async (klass) => ({
      ...klass,
      subjectCount: await GenSubject.countDocuments({ class: klass._id }),
    }))
  );
}

export async function createClass(body) {
  const boardId = body.boardId || body.board;
  await assertBoard(boardId);
  const name = String(body.name || "").trim();
  if (!name) throw httpError(400, "Class name is required");

  let gradeLevel = null;
  if (body.gradeLevel !== undefined && body.gradeLevel !== null && body.gradeLevel !== "") {
    gradeLevel = Number(body.gradeLevel);
    if (!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 12) {
      throw httpError(400, "gradeLevel must be 1–12 or empty");
    }
  }

  try {
    const klass = await GenClass.create({
      board: boardId,
      name,
      gradeLevel,
      ptsClassId:
        body.ptsClassId === null || body.ptsClassId === "" || body.ptsClassId === undefined
          ? null
          : Number(body.ptsClassId),
    });
    return klass.toObject();
  } catch (err) {
    if (err?.code === 11000) throw httpError(400, "This class already exists on the board");
    throw err;
  }
}

export async function updateClass(id, body) {
  const klass = await assertClass(id);
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) throw httpError(400, "Class name is required");
    klass.name = name;
  }
  if (body.gradeLevel !== undefined) {
    if (body.gradeLevel === null || body.gradeLevel === "") {
      klass.gradeLevel = null;
    } else {
      const gradeLevel = Number(body.gradeLevel);
      if (!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 12) {
        throw httpError(400, "gradeLevel must be 1–12 or empty");
      }
      klass.gradeLevel = gradeLevel;
    }
  }
  if (body.ptsClassId !== undefined) {
    klass.ptsClassId =
      body.ptsClassId === null || body.ptsClassId === "" ? null : Number(body.ptsClassId);
  }
  try {
    await klass.save();
  } catch (err) {
    if (err?.code === 11000) throw httpError(400, "This class already exists on the board");
    throw err;
  }
  return klass.toObject();
}

export async function deleteClass(id, { cascade = false } = {}) {
  const klass = await assertClass(id);
  const subjects = await GenSubject.find({ class: klass._id }).select("_id").lean();
  if (subjects.length && !cascade) {
    throw httpError(
      400,
      `Class has ${subjects.length} subject(s). Pass cascade=true to delete everything under it.`
    );
  }

  if (subjects.length) {
    const subjectIds = subjects.map((s) => s._id);
    const chapters = await GenChapter.find({ subject: { $in: subjectIds } }).select("_id").lean();
    const chapterIds = chapters.map((c) => c._id);
    const topics = await GenTopic.find({ chapter: { $in: chapterIds } }).select("_id").lean();
    const topicIds = topics.map((t) => t._id);
    await GenQuestion.deleteMany({
      $or: [{ subject: { $in: subjectIds } }, { topic: { $in: topicIds } }],
    });
    await GenTopic.deleteMany({ _id: { $in: topicIds } });
    await GenChapter.deleteMany({ _id: { $in: chapterIds } });
    await GenSubject.deleteMany({ _id: { $in: subjectIds } });
  }

  await GenClass.findByIdAndDelete(klass._id);
  return { deleted: true, id: oid(klass._id) };
}

/* ─── Subjects ─── */

export async function listSubjects(classId) {
  await assertClass(classId);
  const subjects = await GenSubject.find({ class: classId }).sort({ name: 1 }).lean();
  return Promise.all(
    subjects.map(async (subject) => {
      const [chapterCount, questionCount] = await Promise.all([
        GenChapter.countDocuments({ subject: subject._id }),
        GenQuestion.countDocuments({ subject: subject._id, isActive: true }),
      ]);
      return { ...subject, chapterCount, questionCount };
    })
  );
}

export async function createSubject(body) {
  const classId = body.classId || body.class;
  await assertClass(classId);
  const name = String(body.name || "").trim();
  if (!name) throw httpError(400, "Subject name is required");
  const slug = String(body.slug || slugify(name) || "subject")
    .trim()
    .toLowerCase();

  try {
    const subject = await GenSubject.create({
      class: classId,
      name,
      slug,
      imageUrl: String(body.imageUrl || "").trim(),
    });
    return subject.toObject();
  } catch (err) {
    if (err?.code === 11000) {
      throw httpError(400, "Subject name or slug already exists in this class");
    }
    throw err;
  }
}

export async function updateSubject(id, body) {
  const subject = await assertSubject(id);
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) throw httpError(400, "Subject name is required");
    subject.name = name;
  }
  if (body.slug !== undefined) {
    const slug = String(body.slug).trim().toLowerCase();
    if (!slug) throw httpError(400, "Slug is required");
    subject.slug = slug;
  }
  if (body.imageUrl !== undefined) subject.imageUrl = String(body.imageUrl).trim();

  try {
    await subject.save();
  } catch (err) {
    if (err?.code === 11000) {
      throw httpError(400, "Subject name or slug already exists in this class");
    }
    throw err;
  }
  return subject.toObject();
}

export async function deleteSubject(id, { cascade = false } = {}) {
  const subject = await assertSubject(id);
  const chapters = await GenChapter.find({ subject: subject._id }).select("_id").lean();
  const questionCount = await GenQuestion.countDocuments({ subject: subject._id });
  if ((chapters.length || questionCount) && !cascade) {
    throw httpError(
      400,
      `Subject has ${chapters.length} chapter(s) and ${questionCount} question(s). Pass cascade=true to delete all.`
    );
  }

  if (chapters.length || questionCount) {
    const chapterIds = chapters.map((c) => c._id);
    const topics = await GenTopic.find({ chapter: { $in: chapterIds } }).select("_id").lean();
    const topicIds = topics.map((t) => t._id);
    await GenQuestion.deleteMany({ subject: subject._id });
    await GenTopic.deleteMany({ _id: { $in: topicIds } });
    await GenChapter.deleteMany({ _id: { $in: chapterIds } });
  }

  await GenSubject.findByIdAndDelete(subject._id);
  return { deleted: true, id: oid(subject._id) };
}

/* ─── Chapters ─── */

export async function listChapters(subjectId) {
  await assertSubject(subjectId);
  const chapters = await GenChapter.find({ subject: subjectId }).sort({ order: 1, name: 1 }).lean();
  return Promise.all(
    chapters.map(async (chapter) => {
      const [topicCount, questionCount] = await Promise.all([
        GenTopic.countDocuments({ chapter: chapter._id }),
        GenQuestion.countDocuments({ chapter: chapter._id, isActive: true }),
      ]);
      return { ...chapter, topicCount, questionCount };
    })
  );
}

export async function createChapter(body) {
  const subjectId = body.subjectId || body.subject;
  await assertSubject(subjectId);
  const name = String(body.name || "").trim();
  if (!name) throw httpError(400, "Chapter name is required");

  let order = Number(body.order);
  if (!Number.isFinite(order)) {
    const last = await GenChapter.findOne({ subject: subjectId }).sort({ order: -1 }).lean();
    order = (last?.order ?? 0) + 1;
  }

  try {
    const chapter = await GenChapter.create({ subject: subjectId, name, order });
    return chapter.toObject();
  } catch (err) {
    if (err?.code === 11000) throw httpError(400, "Chapter already exists in this subject");
    throw err;
  }
}

export async function updateChapter(id, body) {
  const chapter = await assertChapter(id);
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) throw httpError(400, "Chapter name is required");
    chapter.name = name;
  }
  if (body.order !== undefined) chapter.order = Number(body.order) || 0;

  try {
    await chapter.save();
  } catch (err) {
    if (err?.code === 11000) throw httpError(400, "Chapter already exists in this subject");
    throw err;
  }
  return chapter.toObject();
}

export async function deleteChapter(id, { cascade = false } = {}) {
  const chapter = await assertChapter(id);
  const topics = await GenTopic.find({ chapter: chapter._id }).select("_id").lean();
  const questionCount = await GenQuestion.countDocuments({ chapter: chapter._id });
  if ((topics.length || questionCount) && !cascade) {
    throw httpError(
      400,
      `Chapter has ${topics.length} topic(s) and ${questionCount} question(s). Pass cascade=true to delete all.`
    );
  }

  if (topics.length || questionCount) {
    const topicIds = topics.map((t) => t._id);
    await GenQuestion.deleteMany({ chapter: chapter._id });
    await GenTopic.deleteMany({ _id: { $in: topicIds } });
  }

  await GenChapter.findByIdAndDelete(chapter._id);
  return { deleted: true, id: oid(chapter._id) };
}

/* ─── Topics ─── */

export async function listTopics(chapterId) {
  await assertChapter(chapterId);
  const topics = await GenTopic.find({ chapter: chapterId }).sort({ order: 1, name: 1 }).lean();
  return Promise.all(
    topics.map(async (topic) => ({
      ...topic,
      questionCount: await GenQuestion.countDocuments({ topic: topic._id, isActive: true }),
    }))
  );
}

export async function createTopic(body) {
  const chapterId = body.chapterId || body.chapter;
  await assertChapter(chapterId);
  const name = String(body.name || "").trim();
  if (!name) throw httpError(400, "Topic name is required");

  let order = Number(body.order);
  if (!Number.isFinite(order)) {
    const last = await GenTopic.findOne({ chapter: chapterId }).sort({ order: -1 }).lean();
    order = (last?.order ?? 0) + 1;
  }

  try {
    const topic = await GenTopic.create({
      chapter: chapterId,
      name,
      order,
      code: String(body.code || "").trim(),
    });
    return topic.toObject();
  } catch (err) {
    if (err?.code === 11000) throw httpError(400, "Topic already exists in this chapter");
    throw err;
  }
}

export async function updateTopic(id, body) {
  const topic = await assertTopic(id);
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) throw httpError(400, "Topic name is required");
    topic.name = name;
  }
  if (body.order !== undefined) topic.order = Number(body.order) || 0;
  if (body.code !== undefined) topic.code = String(body.code).trim();

  try {
    await topic.save();
  } catch (err) {
    if (err?.code === 11000) throw httpError(400, "Topic already exists in this chapter");
    throw err;
  }
  return topic.toObject();
}

export async function deleteTopic(id, { cascade = false } = {}) {
  const topic = await assertTopic(id);
  const questionCount = await GenQuestion.countDocuments({ topic: topic._id });
  if (questionCount && !cascade) {
    throw httpError(
      400,
      `Topic has ${questionCount} question(s). Pass cascade=true to delete them too.`
    );
  }
  if (questionCount) await GenQuestion.deleteMany({ topic: topic._id });
  await GenTopic.findByIdAndDelete(topic._id);
  return { deleted: true, id: oid(topic._id) };
}

/* ─── Questions ─── */

export async function listQuestions(query = {}) {
  const filter = {};
  if (query.subjectId) filter.subject = query.subjectId;
  if (query.chapterId) filter.chapter = query.chapterId;
  if (query.topicId) filter.topic = query.topicId;
  if (query.type) filter.type = String(query.type).toUpperCase();
  if (query.subType) filter.subType = String(query.subType);
  if (query.isActive === "true" || query.isActive === true) filter.isActive = true;
  if (query.isActive === "false" || query.isActive === false) filter.isActive = false;

  if (query.q) {
    const q = String(query.q).trim();
    if (q) {
      filter.$or = [
        { text: { $regex: q, $options: "i" } },
        { textUrdu: { $regex: q, $options: "i" } },
        { externalKey: { $regex: q, $options: "i" } },
      ];
    }
  }

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
  const skip = (page - 1) * limit;

  const [total, items] = await Promise.all([
    GenQuestion.countDocuments(filter),
    GenQuestion.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("topic", "name")
      .populate("chapter", "name order")
      .lean(),
  ]);

  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
    questions: items,
  };
}

export async function getQuestion(id) {
  const question = await GenQuestion.findById(id)
    .populate("topic", "name")
    .populate("chapter", "name order")
    .populate("subject", "name slug")
    .lean();
  if (!question) throw httpError(404, "Question not found");
  return question;
}

export async function createQuestion(body) {
  const topicId = body.topicId || body.topic;
  const topic = await assertTopic(topicId);
  const chapter = await assertChapter(topic.chapter);
  const subject = await assertSubject(chapter.subject);

  const type = String(body.type || "").toUpperCase();
  if (!["MCQ", "SHORT", "LONG"].includes(type)) {
    throw httpError(400, "type must be MCQ, SHORT, or LONG");
  }
  const text = String(body.text || "").trim();
  if (!text) throw httpError(400, "Question text is required");

  if (type === "MCQ") {
    const opts = [body.optionA, body.optionB, body.optionC, body.optionD].map((v) =>
      String(v || "").trim()
    );
    if (opts.some((o) => !o)) throw httpError(400, "MCQ requires optionA–D");
  }

  const question = await GenQuestion.create({
    topic: topic._id,
    chapter: chapter._id,
    subject: subject._id,
    type,
    subType: body.subType ? String(body.subType).trim() : null,
    text,
    textUrdu: body.textUrdu ? String(body.textUrdu).trim() : null,
    optionA: body.optionA ? String(body.optionA).trim() : null,
    optionB: body.optionB ? String(body.optionB).trim() : null,
    optionC: body.optionC ? String(body.optionC).trim() : null,
    optionD: body.optionD ? String(body.optionD).trim() : null,
    correctAnswer: body.correctAnswer ? String(body.correctAnswer).trim() : null,
    marks: Number.isFinite(Number(body.marks)) ? Number(body.marks) : 1,
    source: body.source ? String(body.source).trim() : "manual",
    externalKey: body.externalKey ? String(body.externalKey).trim() : undefined,
    isActive: body.isActive === false ? false : true,
  });

  return question.toObject();
}

export async function updateQuestion(id, body) {
  const question = await GenQuestion.findById(id);
  if (!question) throw httpError(404, "Question not found");

  if (body.topicId || body.topic) {
    const topic = await assertTopic(body.topicId || body.topic);
    const chapter = await assertChapter(topic.chapter);
    const subject = await assertSubject(chapter.subject);
    question.topic = topic._id;
    question.chapter = chapter._id;
    question.subject = subject._id;
  }

  if (body.type !== undefined) {
    const type = String(body.type).toUpperCase();
    if (!["MCQ", "SHORT", "LONG"].includes(type)) {
      throw httpError(400, "type must be MCQ, SHORT, or LONG");
    }
    question.type = type;
  }
  if (body.subType !== undefined) {
    question.subType = body.subType ? String(body.subType).trim() : null;
  }
  if (body.text !== undefined) {
    const text = String(body.text).trim();
    if (!text) throw httpError(400, "Question text is required");
    question.text = text;
  }
  if (body.textUrdu !== undefined) {
    question.textUrdu = body.textUrdu ? String(body.textUrdu).trim() : null;
  }
  for (const key of ["optionA", "optionB", "optionC", "optionD", "correctAnswer", "source"]) {
    if (body[key] !== undefined) {
      question[key] = body[key] ? String(body[key]).trim() : null;
    }
  }
  if (body.marks !== undefined) question.marks = Number(body.marks) || 0;
  if (body.isActive !== undefined) question.isActive = Boolean(body.isActive);
  if (body.externalKey !== undefined) {
    question.externalKey = body.externalKey ? String(body.externalKey).trim() : undefined;
  }

  try {
    await question.save();
  } catch (err) {
    if (err?.code === 11000) throw httpError(400, "externalKey already exists");
    throw err;
  }
  return question.toObject();
}

export async function setQuestionActive(id, isActive) {
  const question = await GenQuestion.findById(id);
  if (!question) throw httpError(404, "Question not found");
  question.isActive = Boolean(isActive);
  await question.save();
  return question.toObject();
}

export async function deleteQuestion(id) {
  const question = await GenQuestion.findById(id);
  if (!question) throw httpError(404, "Question not found");
  await GenQuestion.findByIdAndDelete(question._id);
  return { deleted: true, id: oid(question._id) };
}
