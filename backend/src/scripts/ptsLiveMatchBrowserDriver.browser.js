/**
 * PTS page driver: discover subtypes + fetch bank + POST replace ingest.
 * window.__ptsMatch.seedOne({ classId, subjectId, slug?, name? })
 * window.__ptsMatch.seedClass(classId, { onlyIssues?, issueNames? })
 */
(function () {
  const INGEST = "http://127.0.0.1:8791";
  const PRIORITIES = [1, 2, 3, 4, 5];
  const CHUNK = 24;
  const CONCURRENCY = 10;
  const PROBE_MAX = 60;

  const KNOWN = {
    english: [
      { id: 1, name: "mcq-comprehension", bankType: "mcq", field: "COMPREHENSION" },
      { id: 2, name: "mcq-spelling", bankType: "mcq", field: "SPELLING" },
      { id: 3, name: "mcq-meaning", bankType: "mcq", field: "MEANING" },
      { id: 5, name: "mcq-verb", bankType: "mcq", field: "VERB" },
      { id: 6, name: "mcq-grammar", bankType: "mcq", field: "GRAMMAR" },
      { id: 14, name: "short-qa", bankType: "short", field: "QA" },
      { id: 15, name: "long-letters", bankType: "long", field: "LETTER" },
      { id: 21, name: "short-translate-en", bankType: "short", field: "TRANSLATE_EN" },
      { id: 22, name: "short-voice", bankType: "short", field: "VOICE" },
      { id: 26, name: "long-stories", bankType: "long", field: "STORY" },
      { id: 28, name: "long-summary", bankType: "long", field: "SUMMARY" },
      { id: 31, name: "long-dialogues", bankType: "long", field: "DIALOGUE" },
      { id: 34, name: "short-word", bankType: "short", field: "WORD" },
      { id: 36, name: "short-idioms", bankType: "short", field: "IDIOM" },
      { id: 43, name: "long-translate-urdu", bankType: "long", field: "TRANSLATE_UR" },
      { id: 45, name: "long-comprehension-para", bankType: "long", field: "PASSAGE" },
      { id: 47, name: "long-poem-stanzas", bankType: "long", field: "POEM_STANZA" },
    ],
    urdu: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 14, name: "short-qa", bankType: "short", field: "QA" },
      { id: 24, name: "short-correct", bankType: "short", field: "CORRECT" },
      { id: 25, name: "short-idiom", bankType: "short", field: "IDIOM" },
      { id: 42, name: "short-meaning", bankType: "short", field: "MEANING" },
      { id: 19, name: "long-poem", bankType: "long", field: "POEM" },
      { id: 28, name: "long-summary", bankType: "long", field: "SUMMARY" },
      { id: 48, name: "long-passage", bankType: "long", field: "PASSAGE" },
      { id: 15, name: "long-letter", bankType: "long", field: "LETTER" },
      { id: 16, name: "long-application", bankType: "long", field: "APPLICATION" },
      { id: 26, name: "long-story", bankType: "long", field: "STORY" },
      { id: 31, name: "long-dialogue", bankType: "long", field: "DIALOGUE" },
      { id: 30, name: "long-central", bankType: "long", field: "CENTRAL" },
    ],
    science: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
    ],
    islamiyat: [
      { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
      { id: 12, name: "short", bankType: "short", field: "QA" },
      { id: 13, name: "long", bankType: "long", field: "LONG" },
      { id: 18, name: "long-hadith", bankType: "long", field: "HADITH" },
      { id: 57, name: "long-personality", bankType: "long", field: "PERSONALITY" },
    ],
  };

  async function mapPool(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
      while (next < items.length) {
        const i = next;
        next += 1;
        results[i] = await fn(items[i], i);
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, () =>
        worker()
      )
    );
    return results;
  }

  async function getJson(apiPath, params) {
    const u = new URL(apiPath, location.origin);
    for (const [k, v] of Object.entries(params || {}))
      u.searchParams.set(k, String(v));
    const res = await fetch(u.toString(), {
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
    if (!res.ok) throw new Error(apiPath + " " + res.status);
    return res.json();
  }

  async function getQuestions(topicIds, subTypeId, priorityId) {
    const u = new URL("/AjaxCalling/GetQuestions", location.origin);
    u.searchParams.set("TopicIDs", topicIds);
    u.searchParams.set("QuestionSubTypeID", String(subTypeId));
    u.searchParams.set("QuestionPeriorityID", String(priorityId));
    u.searchParams.set("SyllabusType", "0");
    const res = await fetch(u.toString(), {
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
    if (!res.ok) return [];
    try {
      return (await res.json()).QuestionsList || [];
    } catch {
      return [];
    }
  }

  function slugify(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "subject";
  }

  function stripHtml(html) {
    if (!html) return "";
    let s = String(html);
    s = s.replace(/<\/?p[^>]*>/gi, "");
    s = s.replace(/<br\s*\/?>/gi, " ");
    s = s.replace(/<(?!\/?img\b)[^>]+>/gi, "");
    s = s.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    return s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&ldquo;/g, "\u201C")
      .replace(/&rdquo;/g, "\u201D")
      .replace(/&lsquo;/g, "\u2018")
      .replace(/&rsquo;/g, "\u2019")
      .trim();
  }

  function optionText(opt) {
    const en = stripHtml(opt && opt.EmOption);
    const ur = stripHtml(opt && opt.UmOption);
    if (en && ur && en !== ur) return en + " / " + ur;
    return en || ur || "";
  }

  function correctLetter(options) {
    if (!Array.isArray(options)) return null;
    const idx = options.findIndex((o) => o.Answer === true);
    return idx >= 0 ? ["A", "B", "C", "D"][idx] || null : null;
  }

  function titleCase(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\bAnd\b/g, "and")
      .replace(/\bOf\b/g, "of")
      .replace(/\bIn\b/g, "in")
      .replace(/\bFor\b/g, "for")
      .replace(/\bWith\b/g, "with")
      .replace(/\bThe\b/g, "the")
      .replace(/\bTo\b/g, "to")
      .replace(/\bA\b/g, "a");
  }

  function chapterNumber(chapterName, index) {
    const m = String(chapterName || "").match(
      /(?:CHAP(?:TER)?|UNIT|باب|باب نمبر)\s*(\d+)/i
    );
    if (m) return Number(m[1]);
    const m2 = String(chapterName || "").match(/^(\d+)\s*[:.\-]/);
    if (m2) return Number(m2[1]);
    return index + 1;
  }

  function chapterTitle(chapterName) {
    let t = String(chapterName || "")
      .replace(/^(?:CHAP(?:TER)?|UNIT)\s*\d+\s*:\s*/i, "")
      .replace(/^\d+\s*[:.\-]\s*/, "")
      .trim();
    if (/^[\x00-\x7F]+$/.test(t)) return titleCase(t);
    return t;
  }

  function topicCodeFromRef(ref, topicName, chapterNum, ti) {
    if (ref && /^\d+\.\d+[A-Za-z]?$/.test(String(ref).trim()))
      return String(ref).trim();
    const m = String(topicName || "").match(/(\d+)\.(\d+)/);
    if (m) return m[1] + "." + m[2];
    if (/REVIEW/i.test(topicName || "")) return chapterNum + ".R";
    return chapterNum + "." + (ti + 1);
  }

  function hintTypes(subjectName) {
    const n = String(subjectName || "");
    if (/english/i.test(n)) return KNOWN.english;
    if (/اردو|urdu/i.test(n)) return KNOWN.urdu;
    if (/اسلامیات|islamiyat/i.test(n) && !/اختیاری|elective/i.test(n))
      return KNOWN.islamiyat;
    return KNOWN.science;
  }

  function inferType(id, sample) {
    const hasOpts =
      Array.isArray(sample?.MultipleOptions) && sample.MultipleOptions.length > 0;
    if (hasOpts)
      return { id, name: "mcq-" + id, bankType: "mcq", field: id === 1 ? "MCQ" : "MCQ_" + id };
    const en = String(sample?.EnglishQuestionDetails || "");
    if (en.length > 400)
      return { id, name: "long-" + id, bankType: "long", field: "LONG_" + id };
    return { id, name: "short-" + id, bankType: "short", field: "QA_" + id };
  }

  async function discoverTypes(subjectName, topics) {
    const hinted = hintTypes(subjectName);
    const probeIds = [];
    const seen = new Set();
    for (const t of hinted) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        probeIds.push(t.id);
      }
    }
    for (let id = 1; id <= PROBE_MAX; id++) {
      if (!seen.has(id)) {
        seen.add(id);
        probeIds.push(id);
      }
    }
    /* Keep probe URL short — sample first topics only */
    const sampleIds = topics
      .slice(0, Math.min(topics.length, 12))
      .map((t) => t.TopicID)
      .join(",");
    const hintById = Object.fromEntries(hinted.map((t) => [t.id, t]));
    const results = await mapPool(probeIds, CONCURRENCY, async (id) => {
      for (const pri of PRIORITIES) {
        const list = await getQuestions(sampleIds, id, pri);
        if (list.length) return hintById[id] || inferType(id, list[0]);
      }
      return null;
    });
    const found = results.filter(Boolean).sort((a, b) => a.id - b.id);
    return found.length ? found : hinted.slice(0, 3);
  }

  function buildBank(subject, slug, hierarchy, types, rawByType) {
    const rawChapters = [...(hierarchy.ChaptersList || [])];
    const rawTopics = hierarchy.TopicsList || [];
    const knownCh = new Set(rawChapters.map((c) => c.ChapterID));
    /* Attach orphan topics (ChapterID not in ChaptersList) to last listed chapter */
    const fallbackCh =
      rawChapters.length > 0
        ? rawChapters[rawChapters.length - 1].ChapterID
        : null;
    const normalizedTopics = rawTopics.map((t) => {
      if (knownCh.has(t.ChapterID) || fallbackCh == null) return t;
      return { ...t, ChapterID: fallbackCh };
    });
    const chapters = rawChapters.map((ch, i) => {
      const num = chapterNumber(ch.ChapterName, i);
      const title = chapterTitle(ch.ChapterName);
      const topics = normalizedTopics
        .filter((t) => t.ChapterID === ch.ChapterID)
        .map((t, ti) => {
          const id = topicCodeFromRef(t.TopicRef, t.TopicName, num, ti);
          let titleT = String(t.TopicName || "")
            .replace(/^\d+\.\d+\s*/, "")
            .replace(/^E\.X:\s*/i, "Exercise ")
            .trim();
          if (/REVIEW/i.test(t.TopicName || ""))
            titleT = "Review Exercise " + num;
          if (/^[\x00-\x7F]+$/.test(titleT)) titleT = titleCase(titleT);
          return { id, title: titleT || t.TopicName, _topicId: t.TopicID };
        });
      return { number: num, title, topics, _chapterId: ch.ChapterID };
    });

    const topicIdToCode = new Map();
    for (const ch of chapters) {
      for (const t of ch.topics)
        topicIdToCode.set(t._topicId, { code: t.id, chapter: ch.number });
    }

    const questions = [];
    const counts = { mcq: 0, short: 0, long: 0 };
    const typeTotals = {};
    for (const type of types) {
      for (const raw of rawByType[type.name] || []) {
        const meta = topicIdToCode.get(raw.TopicID) || {
          code: String(raw.TopicRef || "0.0"),
          chapter: 0,
        };
        const en = stripHtml(raw.EnglishQuestionDetails);
        const ur = stripHtml(raw.UrduQuestionDetails);
        const sortedOpts = (raw.MultipleOptions || [])
          .slice()
          .sort((a, b) => a.OptionID - b.OptionID);
        const priority = raw.QuestionPeriority || undefined;
        const field = type.field.startsWith("MCQ_")
          ? "MCQ"
          : type.field.startsWith("LONG_")
            ? "LONG"
            : type.field.startsWith("QA_")
              ? "QA"
              : type.field;
        const q = {
          id: raw.QuestionID,
          chapter: meta.chapter,
          topic_id: meta.code,
          type: type.bankType,
          field,
          subTypeId: type.id,
          source: priority || "Exercise",
          priority,
          en: en || ur,
          ur: ur && ur !== en ? ur : undefined,
        };
        if (type.bankType === "mcq") {
          q.optionA = optionText(sortedOpts[0] || {});
          q.optionB = optionText(sortedOpts[1] || {});
          q.optionC = optionText(sortedOpts[2] || {});
          q.optionD = optionText(sortedOpts[3] || {});
          q.correctAnswer = correctLetter(sortedOpts) || undefined;
        }
        questions.push(q);
        counts[type.bankType] = (counts[type.bankType] || 0) + 1;
      }
      typeTotals[type.field] = (rawByType[type.name] || []).length;
    }

    return {
      syllabus: {
        board: "PTB",
        class: String(subject.ClassID || ""),
        subject: subject.SubjectName,
        slug,
        chapters: chapters.map((c) => ({
          number: c.number,
          title: c.title,
          _chapterId: c._chapterId,
          topics: c.topics.map((t) => ({ id: t.id, title: t.title })),
        })),
      },
      allQuestions: {
        board: "PTB",
        class: String(subject.ClassID || ""),
        subject: subject.SubjectName,
        slug,
        types,
        typeTotals,
        total_questions: questions.length,
        counts,
        exportedAt: new Date().toISOString(),
        questions,
      },
      hierarchyMeta: {
        subject,
        slug,
        exportTypes: types,
        chapters: hierarchy.ChaptersList,
        topics: hierarchy.TopicsList,
      },
    };
  }

  async function seedOne(opts) {
    const classId = Number(opts.classId);
    const subjectId = Number(opts.subjectId);
    const subjects =
      (await getJson("/AjaxCalling/SubjectsListByClassID", { ClassID: classId }))
        .SubjectsList || [];
    const subject = subjects.find((s) => s.SubjectID === subjectId);
    if (!subject) throw new Error("Subject " + subjectId + " not in class " + classId);
    const slug = opts.slug || slugify(subject.SubjectName);
    window.__ptsMatchProgress = classId + "/" + slug + " hierarchy";

    const hierarchy = await getJson("/AjaxCalling/ChaptersListBySubjectID", {
      SubjectID: subjectId,
    });
    const topics = hierarchy.TopicsList || [];
    window.__ptsMatchProgress = classId + "/" + slug + " discover";
    /* Always keep subject-known subtypes (English/Urdu/etc) even if probe sample misses them */
    const hinted = hintTypes(subject.SubjectName);
    const discovered = topics.length
      ? await discoverTypes(subject.SubjectName, topics)
      : [];
    const byId = new Map();
    for (const t of [...hinted, ...discovered]) {
      if (!byId.has(t.id)) byId.set(t.id, t);
    }
    const types = [...byId.values()].sort((a, b) => a.id - b.id);

    const rawByType = {};
    let doneJobs = 0;
    let totalJobs = 0;
    for (const type of types) {
      const jobs = [];
      for (const pri of PRIORITIES) {
        for (let i = 0; i < topics.length; i += CHUNK) {
          jobs.push({
            pri,
            ids: topics
              .slice(i, i + CHUNK)
              .map((t) => t.TopicID)
              .join(","),
          });
        }
      }
      totalJobs += jobs.length;
      const seen = new Set();
      const bucket = [];
      await mapPool(jobs, CONCURRENCY, async (job) => {
        doneJobs += 1;
        window.__ptsMatchProgress =
          classId + "/" + slug + " " + type.name + " " + doneJobs + "/" + totalJobs;
        let list = [];
        try {
          list = await getQuestions(job.ids, type.id, job.pri);
        } catch (e) {
          console.warn(e);
        }
        for (const q of list) {
          if (seen.has(q.QuestionID)) continue;
          seen.add(q.QuestionID);
          bucket.push(q);
        }
      });
      rawByType[type.name] = bucket;
    }

    window.__ptsMatchProgress = classId + "/" + slug + " posting";
    const built = buildBank(subject, slug, hierarchy, types, rawByType);
    const res = await fetch(INGEST + "/subject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId,
        subjectId,
        slug,
        syllabus: built.syllabus,
        allQuestions: built.allQuestions,
        meta: { hierarchy: built.hierarchyMeta },
      }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "ingest failed");
    return {
      classId,
      subjectId,
      slug,
      name: subject.SubjectName,
      total: built.allQuestions.total_questions,
      types: types.map((t) => t.id + ":" + t.field),
      ingest: json.row,
    };
  }

  async function seedClass(classId, opts) {
    const onlyNames = (opts && opts.issueNames) || null;
    const subjects =
      (await getJson("/AjaxCalling/SubjectsListByClassID", { ClassID: classId }))
        .SubjectsList || [];
    const liveNames = subjects.map((s) => s.SubjectName);
    await fetch(INGEST + "/remove-extras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, liveNames }),
    });

    const logs = [];
    for (const sub of subjects) {
      if (
        onlyNames &&
        !onlyNames.some(
          (n) =>
            String(n).toLowerCase() === String(sub.SubjectName).toLowerCase()
        )
      ) {
        continue;
      }
      window.__ptsMatchProgress = "seeding " + sub.SubjectName;
      try {
        const r = await seedOne({ classId, subjectId: sub.SubjectID });
        logs.push(r);
        window.__ptsMatchLast = r;
      } catch (e) {
        logs.push({
          classId,
          subjectId: sub.SubjectID,
          name: sub.SubjectName,
          error: String(e.message || e),
        });
      }
    }
    window.__ptsMatchProgress = "done class " + classId;
    window.__ptsMatchLogs = logs;
    return logs;
  }

  window.__ptsMatch = { seedOne, seedClass, slugify };
})();
