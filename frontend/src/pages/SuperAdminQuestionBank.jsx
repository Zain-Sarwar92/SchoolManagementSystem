import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Power, Trash2, X } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import CustomSelect from "../components/ui/CustomSelect.jsx";
import { toast } from "../components/ui/toast.jsx";
import { superAdminNavItems } from "../constants/superAdminNav.js";
import { curriculumApi } from "../features/super-admin/curriculumApi.js";

const emptyForm = {
  type: "MCQ",
  subType: "",
  text: "",
  textUrdu: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctAnswer: "A",
  marks: 1,
  source: "manual",
  isActive: true,
  topicId: "",
};

const inputClass =
  "w-full rounded-2xl border border-rose/60 bg-bg-soft px-4 py-2.5 text-navy outline-none transition focus:border-lavender focus:ring-2 focus:ring-lavender/40";

function Field({ label, children, wide }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-sm font-medium text-navy">{label}</label>
      {children}
    </div>
  );
}

function SuperAdminQuestionBank() {
  const [boards, setBoards] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [topicOptions, setTopicOptions] = useState([]);

  const [boardId, setBoardId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const [summary, setSummary] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingQs, setLoadingQs] = useState(false);

  const [filter, setFilter] = useState({
    type: "",
    subType: "",
    isActive: "true",
    q: "",
  });
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const selectedSubject = useMemo(
    () => subjects.find((s) => String(s._id) === String(subjectId)) || null,
    [subjects, subjectId]
  );

  const loadBoards = useCallback(async () => {
    setLoadingTree(true);
    try {
      const { data } = await curriculumApi.listBoards();
      const list = data.boards || [];
      setBoards(list);
      if (list.length === 1) setBoardId(String(list[0]._id));
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't load boards");
    } finally {
      setLoadingTree(false);
    }
  }, []);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  useEffect(() => {
    if (!boardId) {
      setClasses([]);
      setClassId("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await curriculumApi.listClasses(boardId);
        if (cancelled) return;
        const list = data.classes || [];
        setClasses(list);
        setClassId((prev) =>
          list.some((c) => String(c._id) === String(prev)) ? prev : ""
        );
      } catch (err) {
        if (!cancelled) {
          toast.error(err.response?.data?.message || "Couldn't load classes");
          setClasses([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  useEffect(() => {
    if (!classId) {
      setSubjects([]);
      setSubjectId("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await curriculumApi.listSubjects(classId);
        if (cancelled) return;
        const list = data.subjects || [];
        setSubjects(list);
        setSubjectId((prev) =>
          list.some((s) => String(s._id) === String(prev)) ? prev : ""
        );
      } catch (err) {
        if (!cancelled) {
          toast.error(err.response?.data?.message || "Couldn't load subjects");
          setSubjects([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const loadSummary = useCallback(async () => {
    if (!subjectId) {
      setSummary(null);
      return;
    }
    try {
      const { data } = await curriculumApi.subjectQuestionSummary(subjectId);
      setSummary(data.summary || null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't load bank summary");
      setSummary(null);
    }
  }, [subjectId]);

  const loadQuestions = useCallback(async () => {
    if (!subjectId) {
      setQuestions([]);
      setMeta({ total: 0, pages: 1 });
      return;
    }
    setLoadingQs(true);
    try {
      const { data } = await curriculumApi.listQuestions({
        subjectId,
        type: filter.type || undefined,
        subType: filter.subType || undefined,
        isActive: filter.isActive === "" ? undefined : filter.isActive,
        q: searchQ.trim() || undefined,
        page,
        limit: 25,
      });
      setQuestions(data.questions || []);
      setMeta({
        total: data.total || 0,
        pages: data.pages || 1,
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't load questions");
      setQuestions([]);
    } finally {
      setLoadingQs(false);
    }
  }, [subjectId, filter.type, filter.subType, filter.isActive, searchQ, page]);

  useEffect(() => {
    setPage(1);
  }, [subjectId, filter.type, filter.subType, filter.isActive, searchQ]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const loadTopicsForSubject = useCallback(async () => {
    if (!subjectId) {
      setTopicOptions([]);
      return [];
    }
    try {
      const { data: chData } = await curriculumApi.listChapters(subjectId);
      const chapters = chData.chapters || [];
      const nested = await Promise.all(
        chapters.map(async (ch) => {
          const { data } = await curriculumApi.listTopics(ch._id);
          return (data.topics || []).map((t) => ({
            value: String(t._id),
            label: `${ch.name} · ${t.name}`,
          }));
        })
      );
      const opts = nested.flat();
      setTopicOptions(opts);
      return opts;
    } catch {
      setTopicOptions([]);
      return [];
    }
  }, [subjectId]);

  const openCreate = async () => {
    if (!subjectId) {
      toast.error("Select a subject first");
      return;
    }
    const opts = await loadTopicsForSubject();
    if (!opts.length) {
      toast.error("Add chapters and topics in Curriculum first");
      return;
    }
    setEditing(null);
    setForm({ ...emptyForm, topicId: opts[0].value });
    setFormOpen(true);
  };

  const openEdit = async (q) => {
    await loadTopicsForSubject();
    setEditing(q);
    setForm({
      type: q.type || "MCQ",
      subType: q.subType || "",
      text: q.text || "",
      textUrdu: q.textUrdu || "",
      optionA: q.optionA || "",
      optionB: q.optionB || "",
      optionC: q.optionC || "",
      optionD: q.optionD || "",
      correctAnswer: q.correctAnswer || "A",
      marks: q.marks ?? 1,
      source: q.source || "manual",
      isActive: q.isActive !== false,
      topicId: q.topic?._id ? String(q.topic._id) : String(q.topic || ""),
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.text.trim()) {
      toast.error("Enter question text");
      return;
    }
    if (!editing && !form.topicId) {
      toast.error("Select a topic");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        type: form.type,
        subType: form.subType.trim() || null,
        text: form.text.trim(),
        textUrdu: form.textUrdu.trim() || null,
        optionA: form.optionA,
        optionB: form.optionB,
        optionC: form.optionC,
        optionD: form.optionD,
        correctAnswer: form.correctAnswer,
        marks: Number(form.marks) || 1,
        source: form.source.trim() || "manual",
        isActive: form.isActive !== false,
        topicId: form.topicId || undefined,
      };
      if (editing) {
        await curriculumApi.updateQuestion(editing._id, body);
        toast.success("Question updated");
      } else {
        await curriculumApi.createQuestion(body);
        toast.success("Question added");
      }
      closeForm();
      await Promise.all([loadSummary(), loadQuestions()]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't save question");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (q) => {
    try {
      await curriculumApi.setQuestionActive(q._id, !q.isActive);
      toast.success(q.isActive ? "Question deactivated" : "Question activated");
      await Promise.all([loadSummary(), loadQuestions()]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't update status");
    }
  };

  const handleDelete = async (q) => {
    if (!window.confirm("Permanently delete this question?")) return;
    try {
      await curriculumApi.deleteQuestion(q._id);
      toast.success("Question deleted");
      await Promise.all([loadSummary(), loadQuestions()]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't delete question");
    }
  };

  const boardOptions = boards.map((b) => ({
    value: String(b._id),
    label: b.name,
  }));
  const classOptions = classes.map((c) => ({
    value: String(c._id),
    label: c.name,
  }));
  const subjectOptions = subjects.map((s) => ({
    value: String(s._id),
    label: `${s.name}${s.questionCount != null ? ` (${s.questionCount})` : ""}`,
  }));

  const subTypeOptions = useMemo(() => {
    const keys = Object.keys(summary?.bySubType || {}).filter((k) => k && k !== "(none)");
    return [
      { value: "", label: "All sub-types" },
      ...keys.map((k) => ({ value: k, label: `${k} (${summary.bySubType[k]})` })),
    ];
  }, [summary]);

  return (
    <DashboardLayout title="Super Admin" navItems={superAdminNavItems}>
      <div className="space-y-4 sm:space-y-6">
        <section className="sms-surface rounded-2xl p-4 sm:rounded-3xl sm:p-5">
          <div className="mb-4">
            <h1 className="font-display text-2xl text-navy">Question Bank</h1>
            <p className="text-sm text-slate">
              Browse and edit questions by class and subject. Counts show MCQ / Short / Long.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <CustomSelect
              label="Board"
              value={boardId}
              onChange={(next) => {
                setBoardId(next);
                setClassId("");
                setSubjectId("");
              }}
              options={[
                { value: "", label: loadingTree ? "Loading…" : "Select board" },
                ...boardOptions,
              ]}
              searchable={boardOptions.length > 6}
            />
            <CustomSelect
              label="Class"
              value={classId}
              onChange={(next) => {
                setClassId(next);
                setSubjectId("");
              }}
              options={[
                { value: "", label: boardId ? "Select class" : "Pick a board first" },
                ...classOptions,
              ]}
              searchable={classOptions.length > 6}
              disabled={!boardId}
            />
            <CustomSelect
              label="Subject"
              value={subjectId}
              onChange={setSubjectId}
              options={[
                { value: "", label: classId ? "Select subject" : "Pick a class first" },
                ...subjectOptions,
              ]}
              searchable={subjectOptions.length > 6}
              disabled={!classId}
            />
          </div>
        </section>

        {subjectId && summary ? (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Total", value: summary.total },
              { label: "Active", value: summary.active },
              { label: "Inactive", value: summary.inactive },
              { label: "MCQ", value: summary.byType?.MCQ ?? 0 },
              { label: "Short", value: summary.byType?.SHORT ?? 0 },
              { label: "Long", value: summary.byType?.LONG ?? 0 },
            ].map((card) => (
              <article key={card.label} className="sms-item-card rounded-2xl p-3 sm:p-4">
                <p className="text-xs text-slate">{card.label}</p>
                <p className="font-display text-2xl text-navy">{card.value}</p>
              </article>
            ))}
          </section>
        ) : null}

        {subjectId ? (
          <section className="sms-surface rounded-2xl p-4 sm:rounded-3xl sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-display text-xl text-navy">
                  {selectedSubject?.name || summary?.subject?.name || "Questions"}
                </h2>
                <p className="text-xs text-slate">
                  {meta.total} matching · page {page} / {meta.pages}
                </p>
              </div>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-2xl bg-navy px-4 py-2.5 text-sm font-semibold text-blush hover:bg-slate sm:w-auto"
              >
                Add question
              </button>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CustomSelect
                label="Type"
                value={filter.type}
                onChange={(next) => setFilter((p) => ({ ...p, type: next }))}
                options={[
                  { value: "", label: "All types" },
                  { value: "MCQ", label: `MCQ (${summary?.byType?.MCQ ?? 0})` },
                  { value: "SHORT", label: `Short (${summary?.byType?.SHORT ?? 0})` },
                  { value: "LONG", label: `Long (${summary?.byType?.LONG ?? 0})` },
                ]}
                searchable={false}
              />
              <CustomSelect
                label="Sub-type"
                value={filter.subType}
                onChange={(next) => setFilter((p) => ({ ...p, subType: next }))}
                options={subTypeOptions}
                searchable={subTypeOptions.length > 6}
              />
              <CustomSelect
                label="Status"
                value={filter.isActive}
                onChange={(next) => setFilter((p) => ({ ...p, isActive: next }))}
                options={[
                  { value: "", label: "All" },
                  { value: "true", label: "Active" },
                  { value: "false", label: "Inactive" },
                ]}
                searchable={false}
              />
              <Field label="Search">
                <input
                  className={inputClass}
                  value={filter.q}
                  onChange={(e) => setFilter((p) => ({ ...p, q: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setSearchQ(filter.q.trim());
                    }
                  }}
                  placeholder="Search… then press Enter"
                />
              </Field>
            </div>

            {loadingQs ? (
              <p className="text-sm text-slate">Loading questions…</p>
            ) : questions.length === 0 ? (
              <p className="rounded-2xl bg-blush/70 px-4 py-6 text-sm text-slate">
                No questions match these filters.
              </p>
            ) : (
              <div className="space-y-3">
                {questions.map((q) => (
                  <article
                    key={q._id}
                    className="rounded-2xl border border-rose/30 bg-bg-soft/60 p-3 sm:p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-lavender/30 px-2 py-0.5 text-[11px] font-semibold text-navy">
                        {q.type}
                        {q.subType ? ` · ${q.subType}` : ""}
                      </span>
                      <span className="text-[11px] text-slate">{q.marks} mark(s)</span>
                      {!q.isActive && (
                        <span className="rounded-full bg-rose/50 px-2 py-0.5 text-[11px] font-semibold text-navy">
                          Inactive
                        </span>
                      )}
                      <span className="text-[11px] text-slate">
                        {q.chapter?.name || "—"} / {q.topic?.name || "—"}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-navy">{q.text}</p>
                    {q.type === "MCQ" && (
                      <ul className="mt-2 grid gap-1 text-xs text-slate sm:grid-cols-2">
                        {["A", "B", "C", "D"].map((letter) => (
                          <li key={letter}>
                            <span className="font-semibold text-navy">{letter}.</span>{" "}
                            {q[`option${letter}`] || "—"}
                            {q.correctAnswer === letter ? " ✓" : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(q)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-rose/50 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-blush"
                      >
                        <Pencil className="size-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(q)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-rose/50 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-blush"
                      >
                        <Power className="size-3.5" />
                        {q.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(q)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-rose/50 px-3 py-1.5 text-xs font-semibold text-[#a33b4a] hover:bg-blush"
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </button>
                    </div>
                  </article>
                ))}

                {meta.pages > 1 && (
                  <div className="flex items-center justify-between pt-2 text-sm">
                    <p className="text-slate">
                      Page {page} / {meta.pages}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="rounded-xl border border-rose/50 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        disabled={page >= meta.pages}
                        onClick={() => setPage((p) => p + 1)}
                        className="rounded-xl border border-rose/50 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        ) : (
          <section className="sms-surface rounded-2xl p-6 text-sm text-slate sm:rounded-3xl">
            Select a board, class, and subject to browse the question bank.
          </section>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-navy/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-rose/40 bg-white p-4 shadow-[0_20px_50px_rgb(31_34_50_/0.25)] sm:rounded-3xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl text-navy">
                  {editing ? "Edit question" : "Add question"}
                </h2>
                <p className="text-sm text-slate">
                  {selectedSubject?.name || "Question bank"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="cursor-pointer rounded-xl p-2 text-slate transition hover:bg-blush hover:text-navy"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <CustomSelect
                label="Topic *"
                value={form.topicId}
                onChange={(next) => setForm((p) => ({ ...p, topicId: next }))}
                options={[
                  { value: "", label: "Select topic" },
                  ...topicOptions,
                ]}
                searchable={topicOptions.length > 8}
              />
              <CustomSelect
                label="Type"
                value={form.type}
                onChange={(next) => setForm((p) => ({ ...p, type: next }))}
                options={[
                  { value: "MCQ", label: "MCQ" },
                  { value: "SHORT", label: "Short" },
                  { value: "LONG", label: "Long" },
                ]}
                searchable={false}
              />
              <Field label="Sub-type">
                <input
                  className={inputClass}
                  value={form.subType}
                  onChange={(e) => setForm((p) => ({ ...p, subType: e.target.value }))}
                  placeholder="Optional e.g. QA"
                />
              </Field>
              <Field label="Marks">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className={inputClass}
                  value={form.marks}
                  onChange={(e) => setForm((p) => ({ ...p, marks: e.target.value }))}
                />
              </Field>
              <Field label="Question text *" wide>
                <textarea
                  required
                  rows={4}
                  className={inputClass}
                  value={form.text}
                  onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
                />
              </Field>
              <Field label="Urdu text" wide>
                <textarea
                  rows={3}
                  dir="rtl"
                  className={inputClass}
                  value={form.textUrdu}
                  onChange={(e) => setForm((p) => ({ ...p, textUrdu: e.target.value }))}
                />
              </Field>
              {form.type === "MCQ" && (
                <>
                  {["A", "B", "C", "D"].map((letter) => (
                    <Field key={letter} label={`Option ${letter} *`}>
                      <input
                        required
                        className={inputClass}
                        value={form[`option${letter}`]}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, [`option${letter}`]: e.target.value }))
                        }
                      />
                    </Field>
                  ))}
                  <CustomSelect
                    label="Correct answer"
                    value={form.correctAnswer}
                    onChange={(next) => setForm((p) => ({ ...p, correctAnswer: next }))}
                    options={["A", "B", "C", "D"].map((v) => ({ value: v, label: v }))}
                    searchable={false}
                  />
                </>
              )}
              <Field label="Source" wide>
                <input
                  className={inputClass}
                  value={form.source}
                  onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-navy sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.isActive !== false}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="size-4 accent-navy"
                />
                Active in paper generator pool
              </label>
              <div className="flex flex-col-reverse gap-3 pt-2 sm:col-span-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  className="min-h-11 w-full cursor-pointer rounded-2xl border border-rose/50 px-4 py-2.5 text-sm font-semibold text-navy hover:bg-blush sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-11 w-full cursor-pointer rounded-2xl bg-navy px-4 py-2.5 text-sm font-semibold text-blush hover:bg-slate disabled:opacity-60 sm:w-auto"
                >
                  {submitting ? "Saving…" : editing ? "Save changes" : "Add question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default SuperAdminQuestionBank;
