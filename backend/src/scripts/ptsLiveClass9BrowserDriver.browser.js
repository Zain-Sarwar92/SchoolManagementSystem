/**
 * Runs INSIDE the PTS browser page (already authenticated).
 * Fetches Class 9 subjects live and POSTs built banks to local ingest.
 * Exposed as window.__ptsSeedClass9
 */
(function () {
  const INGEST = "http://127.0.0.1:8787";
  const PRIORITIES = [1, 2, 3, 4, 5];
  const CHUNK = 8;

  const SUBJECT_CONFIG = {
    43: {
      slug: "biology",
      types: [
        { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
        { id: 12, name: "short", bankType: "short", field: "QA" },
        { id: 13, name: "long", bankType: "long", field: "LONG" },
      ],
    },
    44: {
      slug: "computer",
      types: [
        { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
        { id: 12, name: "short", bankType: "short", field: "QA" },
        { id: 13, name: "long", bankType: "long", field: "LONG" },
      ],
    },
    45: {
      slug: "chemistry",
      types: [
        { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
        { id: 12, name: "short", bankType: "short", field: "QA" },
        { id: 13, name: "long", bankType: "long", field: "LONG" },
      ],
    },
    46: {
      slug: "physics",
      types: [
        { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
        { id: 12, name: "short", bankType: "short", field: "QA" },
        { id: 13, name: "long", bankType: "long", field: "LONG" },
      ],
    },
    47: {
      slug: "mathematics",
      types: [
        { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
        { id: 12, name: "short", bankType: "short", field: "QA" },
        { id: 13, name: "long", bankType: "long", field: "LONG" },
      ],
    },
    48: {
      slug: "english",
      types: [
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
    },
    50: {
      slug: "urdu-compulsory",
      types: [
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
    },
    51: {
      slug: "islamiyat-compulsory",
      types: [
        { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
        { id: 12, name: "short", bankType: "short", field: "QA" },
        { id: 13, name: "long", bankType: "long", field: "LONG" },
        { id: 18, name: "long-hadith", bankType: "long", field: "HADITH" },
        { id: 57, name: "long-personality", bankType: "long", field: "PERSONALITY" },
      ],
    },
    52: {
      slug: "general-science",
      types: [
        { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
        { id: 12, name: "short", bankType: "short", field: "QA" },
        { id: 13, name: "long", bankType: "long", field: "LONG" },
      ],
    },
    54: {
      slug: "education",
      types: [
        { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
        { id: 12, name: "short", bankType: "short", field: "QA" },
        { id: 13, name: "long", bankType: "long", field: "LONG" },
      ],
    },
    55: {
      slug: "punjabi",
      types: [
        { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
        { id: 14, name: "short-qa", bankType: "short", field: "QA" },
        { id: 15, name: "long-letter", bankType: "long", field: "LETTER" },
        { id: 19, name: "long-poem", bankType: "long", field: "POEM" },
        { id: 26, name: "long-story", bankType: "long", field: "STORY" },
        { id: 28, name: "long-summary", bankType: "long", field: "SUMMARY" },
        { id: 30, name: "long-central", bankType: "long", field: "CENTRAL" },
        { id: 34, name: "short-word", bankType: "short", field: "WORD" },
        { id: 37, name: "short-meaning", bankType: "short", field: "MEANING" },
        { id: 38, name: "singular-plural", bankType: "short", field: "VOCAB" },
        { id: 39, name: "gender", bankType: "short", field: "GENDER" },
        { id: 48, name: "long-passage", bankType: "long", field: "PASSAGE" },
      ],
    },
    56: {
      slug: "islamiyat-elective",
      types: [
        { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
        { id: 12, name: "short", bankType: "short", field: "QA" },
        { id: 13, name: "long", bankType: "long", field: "LONG" },
        { id: 17, name: "long-ayat", bankType: "long", field: "AYAT" },
        { id: 18, name: "long-hadith", bankType: "long", field: "HADITH" },
      ],
    },
    57: {
      slug: "home-economics",
      types: [
        { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
        { id: 12, name: "short", bankType: "short", field: "QA" },
        { id: 13, name: "long", bankType: "long", field: "LONG" },
      ],
    },
    58: {
      slug: "civics",
      types: [
        { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
        { id: 12, name: "short", bankType: "short", field: "QA" },
        { id: 13, name: "long", bankType: "long", field: "LONG" },
      ],
    },
    257: {
      slug: "economics",
      types: [
        { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
        { id: 12, name: "short", bankType: "short", field: "QA" },
        { id: 13, name: "long", bankType: "long", field: "LONG" },
      ],
    },
    308: {
      slug: "tarjuma-quran",
      types: [
        { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
        { id: 12, name: "short", bankType: "short", field: "QA" },
        { id: 13, name: "long", bankType: "long", field: "LONG" },
        { id: 17, name: "long-ayat", bankType: "long", field: "AYAT" },
        { id: 37, name: "short-meaning", bankType: "short", field: "WORD" },
      ],
    },
    311: {
      slug: "ethics",
      types: [
        { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
        { id: 12, name: "short", bankType: "short", field: "QA" },
        { id: 13, name: "long", bankType: "long", field: "LONG" },
      ],
    },
    335: {
      slug: "physical-education",
      types: [
        { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
        { id: 12, name: "short", bankType: "short", field: "QA" },
        { id: 13, name: "long", bankType: "long", field: "LONG" },
      ],
    },
    339: {
      slug: "poultry",
      types: [
        { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
        { id: 12, name: "short", bankType: "short", field: "QA" },
        { id: 13, name: "long", bankType: "long", field: "LONG" },
      ],
    },
    1536: {
      slug: "food-nutrition",
      types: [
        { id: 1, name: "mcq", bankType: "mcq", field: "MCQ" },
        { id: 12, name: "short", bankType: "short", field: "QA" },
        { id: 13, name: "long", bankType: "long", field: "LONG" },
      ],
    },
  };

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
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

  function fieldSource(field, priorityName) {
    const map = {
      SPELLING: "Tick correct spelling",
      MEANING: "Correct meaning of underlined word",
      VERB: "Correct form of verb",
      GRAMMAR: "Tick correct according to grammar",
      TRANSLATE_UR: "Translate into Urdu",
      TRANSLATE_EN: "Translate into English",
      POEM_STANZA: "Poem Stanzas",
      POEM: "Poem Stanzas",
      AYAT: "Ayat / Quranic text",
      HADITH: "Hadith",
      PERSONALITY: "Personalities",
      PASSAGE: "Passage",
      WORD: "Words Into Sentences",
      IDIOM: "Idioms",
      CORRECT: "Sentence correction",
      LETTER: "Letters",
      APPLICATION: "Application",
      STORY: "Stories",
      DIALOGUE: "Dialogues",
      CENTRAL: "Central idea",
      VOICE: "Active & Passive Voice",
      SUMMARY: "Summary",
    };
    if (map[field]) return map[field];
    if (
      field === "COMPREHENSION" ||
      field === "QA" ||
      field === "MCQ" ||
      field === "LONG"
    )
      return priorityName || "Exercise";
    return priorityName || field || "Exercise";
  }

  var PTS_KEEP_TAGS = {
    img: 1,
    br: 1,
    sub: 1,
    sup: 1,
    span: 1,
    strong: 1,
    em: 1,
    b: 1,
    i: 1,
    u: 1,
  };

  function stripHtmlKeepMedia(html) {
    if (!html) return "";
    var s = String(html);
    s = s
      .replace(/<\/p>\s*<p\b[^>]*>/gi, "<br /><br />")
      .replace(/<p\b[^>]*>/gi, "")
      .replace(/<\/p>/gi, "")
      .replace(/<\/div>\s*<div\b[^>]*>/gi, "<br /><br />")
      .replace(/<div\b[^>]*>/gi, "")
      .replace(/<\/div>/gi, "");
    s = s.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, function (full, tag, attrs) {
      var name = String(tag).toLowerCase();
      var closing = full.indexOf("</") === 0;
      if (!PTS_KEEP_TAGS[name]) return "";
      if (closing) return "</" + name + ">";
      if (name === "br") return "<br />";
      if (name === "img") {
        attrs = attrs || "";
        var srcMatch = attrs.match(/\ssrc\s*=\s*(["'])([^"']+)\1/i);
        var src = ((srcMatch && srcMatch[2]) || "").trim().replace(/\\/g, "/");
        if (!src) return "";
        if (src.indexOf("//") === 0) src = "https:" + src;
        var altMatch = attrs.match(/\salt\s*=\s*(["'])([^"']*)\1/i);
        var alt = (altMatch && altMatch[2]) || "";
        return (
          '<img src="' +
          src.replace(/"/g, "&quot;") +
          '" alt="' +
          alt.replace(/"/g, "&quot;") +
          '" />'
        );
      }
      return "<" + name + ">";
    });
    s = s
      .replace(/&nbsp;/gi, "\u00a0")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&#0*39;/g, "'")
      .replace(/&ldquo;/gi, "\u201C")
      .replace(/&rdquo;/gi, "\u201D")
      .replace(/&lsquo;/gi, "\u2018")
      .replace(/&rsquo;/gi, "\u2019")
      .replace(/&amp;/gi, "&");
    return s.replace(/\r\n/g, "\n").trim();
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

  function buildBank(subject, cfg, hierarchy, rawByType) {
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
      return { number: num, title: title, topics: topics, _chapterId: ch.ChapterID };
    });

    const topicIdToCode = new Map();
    for (const ch of chapters) {
      for (const t of ch.topics) {
        topicIdToCode.set(t._topicId, { code: t.id, chapter: ch.number });
      }
    }

    function mapQuestion(raw, bankType, field) {
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
        type: bankType,
        field: field,
        source: fieldSource(field, priority),
        priority: priority,
        en: en || ur,
        ur: ur && ur !== en ? ur : undefined,
      };
      if (bankType === "mcq") {
        q.optionA = optionText(sortedOpts[0] || {});
        q.optionB = optionText(sortedOpts[1] || {});
        q.optionC = optionText(sortedOpts[2] || {});
        q.optionD = optionText(sortedOpts[3] || {});
        q.correctAnswer = correctLetter(sortedOpts) || undefined;
      }
      return q;
    }

    const questions = [];
    const counts = { mcq: 0, short: 0, long: 0 };
    const fieldCounts = {};
    for (const type of cfg.types) {
      for (const raw of rawByType[type.name] || []) {
        const mapped = mapQuestion(raw, type.bankType, type.field);
        questions.push(mapped);
        counts[type.bankType] = (counts[type.bankType] || 0) + 1;
        fieldCounts[type.field] = (fieldCounts[type.field] || 0) + 1;
      }
    }

    return {
      syllabus: {
        board: "Lahore",
        class: "9",
        subject: subject.SubjectName,
        slug: cfg.slug,
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
        board: "Lahore",
        class: "9",
        subject: subject.SubjectName,
        slug: cfg.slug,
        source:
          "PTS PTB Class 9 " +
          subject.SubjectName +
          " (live browser seed " +
          new Date().toISOString() +
          ")",
        total_questions: questions.length,
        counts: counts,
        fieldCounts: fieldCounts,
        questions: questions,
      },
      hierarchyMeta: {
        course: { CourseID: 1, name: "PTB" },
        class: { ClassID: 9 },
        subject: subject,
        slug: cfg.slug,
        exportTypes: cfg.types,
        chapters: hierarchy.ChaptersList,
        topics: hierarchy.TopicsList,
      },
    };
  }

  async function seedOne(subject, cfg, onProgress) {
    const hierarchy = await getJson("/AjaxCalling/ChaptersListBySubjectID", {
      SubjectID: subject.SubjectID,
    });
    const topics = hierarchy.TopicsList || [];
    if (!topics.length) return { slug: cfg.slug, skipped: true, reason: "no topics" };

    const rawByType = {};
    const typeTotals = {};
    for (const type of cfg.types) {
      const bucket = [];
      const seen = new Set();
      for (const pri of PRIORITIES) {
        for (let i = 0; i < topics.length; i += CHUNK) {
          const chunk = topics.slice(i, i + CHUNK);
          const ids = chunk.map((t) => t.TopicID).join(",");
          if (onProgress) {
            onProgress(
              cfg.slug +
                " " +
                type.name +
                " pri=" +
                pri +
                " " +
                (i + 1) +
                "/" +
                topics.length
            );
          }
          let list = [];
          try {
            list = await getQuestions(ids, type.id, pri);
          } catch (e) {
            console.warn(e);
          }
          for (const q of list) {
            if (seen.has(q.QuestionID)) continue;
            seen.add(q.QuestionID);
            bucket.push(q);
          }
          await sleep(60);
        }
      }
      rawByType[type.name] = bucket;
      typeTotals[type.name] = bucket.length;
    }

    const built = buildBank(subject, cfg, hierarchy, rawByType);
    const res = await fetch(INGEST + "/subject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: cfg.slug,
        syllabus: built.syllabus,
        allQuestions: built.allQuestions,
        meta: { hierarchy: built.hierarchyMeta, typeTotals: typeTotals },
      }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "ingest failed");
    return {
      slug: cfg.slug,
      name: subject.SubjectName,
      total: built.allQuestions.total_questions,
      typeTotals: typeTotals,
      ingest: json.row,
    };
  }

  async function seedAll(onlySlug) {
    const subjects = (
      await getJson("/AjaxCalling/SubjectsListByClassID", { ClassID: 9 })
    ).SubjectsList || [];
    const logs = [];
    window.__ptsSeedProgress = "starting";
    for (const sub of subjects) {
      const cfg = SUBJECT_CONFIG[sub.SubjectID];
      if (!cfg) {
        logs.push({ skip: sub.SubjectID, name: sub.SubjectName });
        continue;
      }
      if (onlySlug && cfg.slug !== onlySlug) continue;
      window.__ptsSeedProgress = "seeding " + cfg.slug;
      try {
        const result = await seedOne(sub, cfg, function (p) {
          window.__ptsSeedProgress = p;
        });
        logs.push(result);
        window.__ptsSeedLast = result;
      } catch (e) {
        logs.push({ slug: cfg.slug, error: String(e.message || e) });
      }
    }
    window.__ptsSeedProgress = "done";
    window.__ptsSeedLogs = logs;
    return logs;
  }

  window.__ptsSeedClass9 = { SUBJECT_CONFIG: SUBJECT_CONFIG, seedAll: seedAll, seedOne: seedOne };
  return "pts driver ready";
})();
