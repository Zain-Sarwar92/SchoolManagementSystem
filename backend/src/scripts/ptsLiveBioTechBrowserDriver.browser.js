/**
 * Runs INSIDE authenticated PTS page. Fast TECH subject seeder.
 * window.__ptsSeedBioTech.seed({ subjectId, slug })
 * Defaults: biology-tech 1599
 */
(function () {
  const INGEST = "http://127.0.0.1:8788";
  const PRIORITIES = [1, 2, 3, 4, 5];
  const CHUNK = 24;
  const CONCURRENCY = 10;
  const TYPES = [
    { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
    { id: 12, name: "short", bankType: "short", field: "QA" },
    { id: 13, name: "long", bankType: "long", field: "LONG" },
  ];

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
    const n = Math.min(limit, Math.max(1, items.length));
    await Promise.all(Array.from({ length: n }, () => worker()));
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
    const json = await res.json();
    return json.QuestionsList || [];
  }

  function stripHtmlKeepMedia(html) {
    if (!html) return "";
    let s = String(html);
    s = s.replace(/<\/?p[^>]*>/gi, "");
    s = s.replace(/<br\s*\/?>/gi, " ");
    s = s.replace(/<(?!\/?img\b)[^>]+>/gi, "");
    s = s.replace(/&nbsp;/g, " ");
    s = s.replace(/\r\n/g, " ").replace(/\s+/g, " ").trim();
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
    const en = stripHtmlKeepMedia(opt && opt.EmOption);
    const ur = stripHtmlKeepMedia(opt && opt.UmOption);
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

  function buildBank(subject, slug, hierarchy, rawByType) {
    const chapters = (hierarchy.ChaptersList || []).map((ch, i) => {
      const num = chapterNumber(ch.ChapterName, i);
      const title = chapterTitle(ch.ChapterName);
      const topics = (hierarchy.TopicsList || [])
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
          return { id: id, title: titleT || t.TopicName, _topicId: t.TopicID };
        });
      return { number: num, title: title, topics: topics };
    });

    const topicIdToCode = new Map();
    for (const ch of chapters) {
      for (const t of ch.topics) {
        topicIdToCode.set(t._topicId, { code: t.id, chapter: ch.number });
      }
    }

    const questions = [];
    const counts = { mcq: 0, short: 0, long: 0 };
    const typeTotals = {};
    for (const type of TYPES) {
      for (const raw of rawByType[type.name] || []) {
        const meta = topicIdToCode.get(raw.TopicID) || {
          code: String(raw.TopicRef || "0.0"),
          chapter: 0,
        };
        const en = stripHtmlKeepMedia(raw.EnglishQuestionDetails);
        const ur = stripHtmlKeepMedia(raw.UrduQuestionDetails);
        const sortedOpts = (raw.MultipleOptions || [])
          .slice()
          .sort((a, b) => a.OptionID - b.OptionID);
        const priority = raw.QuestionPeriority || undefined;
        const q = {
          id: raw.QuestionID,
          chapter: meta.chapter,
          topic_id: meta.code,
          type: type.bankType,
          field: type.field,
          subTypeId: type.id,
          source: priority || "Exercise",
          priority: priority,
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
        class: "9TH",
        subject: subject.SubjectName,
        slug: slug,
        chapters: chapters.map(function (c) {
          return {
            number: c.number,
            title: c.title,
            topics: c.topics.map(function (t) {
              return { id: t.id, title: t.title };
            }),
          };
        }),
      },
      allQuestions: {
        board: "PTB",
        class: "9TH",
        subject: subject.SubjectName,
        slug: slug,
        types: TYPES,
        typeTotals: typeTotals,
        total_questions: questions.length,
        counts: counts,
        exportedAt: new Date().toISOString(),
        questions: questions,
      },
      hierarchyMeta: {
        course: { CourseID: 1, name: "PTB" },
        class: { ClassID: 9 },
        subject: subject,
        slug: slug,
        exportTypes: TYPES,
        chapters: hierarchy.ChaptersList,
        topics: hierarchy.TopicsList,
      },
    };
  }

  async function seed(opts) {
    const subjectId = Number((opts && opts.subjectId) || 1599);
    const slug = (opts && opts.slug) || "biology-tech";
    window.__ptsBioTechProgress = "loading " + slug;
    window.__ptsBioTechResult = null;
    window.__ptsBioTechError = null;

    const subjects =
      (await getJson("/AjaxCalling/SubjectsListByClassID", { ClassID: 9 }))
        .SubjectsList || [];
    const subject = subjects.find((s) => s.SubjectID === subjectId);
    if (!subject) throw new Error("SubjectID " + subjectId + " not found");

    const hierarchy = await getJson("/AjaxCalling/ChaptersListBySubjectID", {
      SubjectID: subjectId,
    });
    const topics = hierarchy.TopicsList || [];
    if (!topics.length) throw new Error("No topics for " + subject.SubjectName);

    const rawByType = {};
    const typeTotals = {};
    let doneJobs = 0;
    let totalJobs = 0;

    for (const type of TYPES) {
      const jobs = [];
      for (const pri of PRIORITIES) {
        for (let i = 0; i < topics.length; i += CHUNK) {
          const chunk = topics.slice(i, i + CHUNK);
          jobs.push({
            pri: pri,
            ids: chunk.map((t) => t.TopicID).join(","),
          });
        }
      }
      totalJobs += jobs.length;
      const seen = new Set();
      const bucket = [];
      await mapPool(jobs, CONCURRENCY, async (job) => {
        doneJobs += 1;
        window.__ptsBioTechProgress =
          slug + " " + type.name + " " + doneJobs + "/" + totalJobs;
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
      typeTotals[type.name] = bucket.length;
    }

    window.__ptsBioTechProgress = "posting " + slug;
    const built = buildBank(subject, slug, hierarchy, rawByType);
    const res = await fetch(INGEST + "/subject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: slug,
        syllabus: built.syllabus,
        allQuestions: built.allQuestions,
        meta: {
          subjectId: subjectId,
          hierarchy: built.hierarchyMeta,
          typeTotals: typeTotals,
        },
      }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "ingest failed");
    const result = {
      slug: slug,
      name: subject.SubjectName,
      total: built.allQuestions.total_questions,
      typeTotals: typeTotals,
      ingest: json.row,
    };
    window.__ptsBioTechProgress = "done";
    window.__ptsBioTechResult = result;
    return result;
  }

  window.__ptsSeedBioTech = { TYPES: TYPES, seed: seed };
})();
