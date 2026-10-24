/* Run on PTS Generate Paper page (Class 10 English, logged in). */
(async () => {
  function stripHtml(html) {
    if (!html) return "";
    return String(html)
      .replace(/<\/?p[^>]*>/gi, "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<(?!\/?img\b)[^>]+>/gi, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&ldquo;/gi, "\u201C")
      .replace(/&rdquo;/gi, "\u201D")
      .replace(/&lsquo;/gi, "\u2018")
      .replace(/&rsquo;/gi, "\u2019")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\s+/g, " ")
      .trim();
  }
  function optionText(opt) {
    return stripHtml((opt && (opt.EmOption || opt.UmOption)) || "") || "—";
  }
  function correctLetter(opts) {
    const sorted = (opts || []).slice().sort((a, b) => a.OptionID - b.OptionID);
    const idx = sorted.findIndex((o) => o.Answer);
    return idx >= 0 ? "ABCD"[idx] : "A";
  }
  function chapterNumber(name, i) {
    const m = String(name || "").match(/UNIT\s*(\d+)/i);
    if (m) return Number(m[1]);
    const r = String(name || "").match(/REVIEW\s*(\d+)/i);
    if (r) return Number(r[1]) === 1 ? 6 : 12;
    if (/ENGLISH B/i.test(name || "")) return 15;
    if (/FORMS OF VERBS|TENSES/i.test(name || "")) return 13;
    return i + 1;
  }
  function topicCode(ref, chapterNum, ti) {
    const r = String(ref || "").trim();
    if (/^\d+$/.test(r)) return `${chapterNum}.${r}`;
    if (/^\d+\.\d+$/.test(r)) return r;
    return `${chapterNum}.${ti + 1}`;
  }

  const hier = await (
    await fetch("/AjaxCalling/GetSyllabus?ClassID=10&SubjectID=64", {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      credentials: "include",
    })
  ).json();
  const chaptersList = hier.ChaptersList || [];
  const topicsList = hier.TopicsList || [];
  const chMeta = new Map();
  chaptersList.forEach((ch, i) => {
    chMeta.set(ch.ChapterID, {
      number: chapterNumber(ch.ChapterName, i),
      title: ch.ChapterName,
    });
  });
  const topicMeta = new Map();
  const byChapter = new Map();
  for (const t of topicsList) {
    if (!byChapter.has(t.ChapterID)) byChapter.set(t.ChapterID, []);
    byChapter.get(t.ChapterID).push(t);
  }
  for (const [chId, list] of byChapter) {
    const ch = chMeta.get(chId) || { number: 0, title: "Unknown" };
    list.forEach((t, ti) => {
      topicMeta.set(t.TopicID, {
        chapter: ch.number,
        chapterTitle: String(ch.title)
          .replace(/^UNIT\s*\d+:\s*/i, "")
          .trim(),
        topic_id: topicCode(t.TopicRef, ch.number, ti),
        topicTitle: String(t.TopicName || "")
          .replace(/^\d+(\.\d+)?\s*/, "")
          .trim(),
      });
    });
  }

  const topicIds = topicsList.map((t) => t.TopicID).join(",");
  const types = [
    { id: 5, field: "VERB", bankType: "mcq" },
    { id: 23, field: "DI", bankType: "short" },
    { id: 27, field: "ESSAYS", bankType: "long" },
    { id: 35, field: "PAIR", bankType: "short" },
  ];
  const questions = [];
  const typeTotals = {};
  for (const type of types) {
    const ids = new Set();
    for (const pri of [1, 2, 3, 7]) {
      const u = `/AjaxCalling/GetQuestions?TopicIDs=${encodeURIComponent(
        topicIds
      )}&QuestionSubTypeID=${type.id}&QuestionPeriorityID=${pri}&SyllabusType=0`;
      const r = await fetch(u, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
        credentials: "include",
      });
      const j = await r.json();
      for (const raw of j.QuestionsList || []) {
        if (ids.has(raw.QuestionID)) continue;
        ids.add(raw.QuestionID);
        const meta = topicMeta.get(raw.TopicID) || {
          chapter: 13,
          chapterTitle: "Forms of Verbs",
          topic_id: "13.1",
          topicTitle: raw.TopicName || "Topic",
        };
        const en = stripHtml(raw.EnglishQuestionDetails);
        const ur = stripHtml(raw.UrduQuestionDetails);
        const sortedOpts = (raw.MultipleOptions || [])
          .slice()
          .sort((a, b) => a.OptionID - b.OptionID);
        const q = {
          id: raw.QuestionID,
          chapter: meta.chapter,
          chapterTitle: meta.chapterTitle,
          topic_id: meta.topic_id,
          topicTitle: meta.topicTitle,
          type: type.bankType,
          field: type.field,
          subTypeId: type.id,
          source: raw.QuestionPeriority || "Exercise",
          en: en || ur || ".",
          ur: ur && ur !== en ? ur : undefined,
        };
        if (type.bankType === "mcq") {
          q.optionA = optionText(sortedOpts[0] || {});
          q.optionB = optionText(sortedOpts[1] || {});
          q.optionC = optionText(sortedOpts[2] || {});
          q.optionD = optionText(sortedOpts[3] || {});
          q.correctAnswer = correctLetter(sortedOpts);
        }
        questions.push(q);
      }
    }
    typeTotals[type.field] = ids.size;
  }

  const res = await fetch("http://127.0.0.1:8795/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questions,
      typeTotals,
      exportedAt: new Date().toISOString(),
    }),
  });
  const text = await res.text();
  console.log("SYNC_RESULT", text);
  return text;
})();
