/**
 * Inject into PTS page. Dumps Class 9–12 subjects + chapter/topic lists.
 * window.__ptsDumpHierarchy()
 */
(function () {
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

  async function dumpClass(classId) {
    const subjects =
      (await getJson("/AjaxCalling/SubjectsListByClassID", { ClassID: classId }))
        .SubjectsList || [];
    const rows = [];
    for (const s of subjects) {
      window.__ptsDumpProgress =
        "class " + classId + " " + s.SubjectName;
      let hierarchy = { ChaptersList: [], TopicsList: [] };
      try {
        hierarchy = await getJson("/AjaxCalling/ChaptersListBySubjectID", {
          SubjectID: s.SubjectID,
        });
      } catch (e) {
        /* keep empty */
      }
      const chapters = hierarchy.ChaptersList || [];
      const topics = hierarchy.TopicsList || [];
      const byCh = {};
      for (const t of topics) {
        const k = String(t.ChapterID);
        if (!byCh[k]) byCh[k] = [];
        byCh[k].push({
          id: t.TopicID,
          name: t.TopicName,
          ref: t.TopicRef || "",
        });
      }
      rows.push({
        id: s.SubjectID,
        name: s.SubjectName,
        category: s.Category || "",
        isTech: /\(TECH\)/i.test(s.SubjectName || ""),
        chapterCount: chapters.length,
        topicCount: topics.length,
        chapters: chapters.map((c) => ({
          id: c.ChapterID,
          name: c.ChapterName,
          topics: byCh[String(c.ChapterID)] || [],
        })),
      });
    }
    return rows;
  }

  async function dumpAll() {
    window.__ptsDumpProgress = "starting";
    window.__ptsDumpResult = null;
    window.__ptsDumpError = null;
    const out = { at: new Date().toISOString(), classes: {} };
    for (const classId of [9, 10, 11, 12]) {
      out.classes[classId] = await dumpClass(classId);
    }
    window.__ptsDumpProgress = "done";
    window.__ptsDumpResult = out;
    return out;
  }

  window.__ptsDumpHierarchy = { dumpAll: dumpAll };
})();
