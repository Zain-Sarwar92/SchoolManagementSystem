import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Layers,
  Pencil,
  Plus,
  Power,
  Trash2,
  X,
} from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import CustomSelect from "../components/ui/CustomSelect.jsx";
import { toast } from "../components/ui/toast.jsx";
import { superAdminNavItems } from "../constants/superAdminNav.js";
import { curriculumApi } from "../features/super-admin/curriculumApi.js";

const emptyQuestionForm = {
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
};

function ModalShell({ title, subtitle, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-navy/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        className={[
          "max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-rose/40 bg-white p-4 shadow-[0_20px_50px_rgb(31_34_50_/0.25)] sm:rounded-3xl sm:p-6",
          wide ? "max-w-3xl" : "max-w-lg",
        ].join(" ")}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-navy">{title}</h2>
            {subtitle ? <p className="text-sm text-slate">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl p-2 text-slate transition hover:bg-blush hover:text-navy"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, wide }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-sm font-medium text-navy">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-rose/60 bg-bg-soft px-4 py-2.5 text-navy outline-none transition focus:border-lavender focus:ring-2 focus:ring-lavender/40";

function SuperAdminCurriculum() {
  const [stats, setStats] = useState(null);
  const [level, setLevel] = useState("boards");
  const [trail, setTrail] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [qFilter, setQFilter] = useState({ type: "", q: "", isActive: "true" });
  const [qPage, setQPage] = useState(1);
  const [qMeta, setQMeta] = useState({ total: 0, pages: 1 });

  const currentParent = trail[trail.length - 1] || null;

  const loadStats = useCallback(async () => {
    try {
      const { data } = await curriculumApi.stats();
      setStats(data.stats);
    } catch {
      /* non-blocking */
    }
  }, []);

  const loadLevel = useCallback(async () => {
    setLoading(true);
    try {
      if (level === "boards") {
        const { data } = await curriculumApi.listBoards();
        setItems(data.boards || []);
      } else if (level === "classes") {
        const { data } = await curriculumApi.listClasses(currentParent.id);
        setItems(data.classes || []);
      } else if (level === "subjects") {
        const { data } = await curriculumApi.listSubjects(currentParent.id);
        setItems(data.subjects || []);
      } else if (level === "chapters") {
        const { data } = await curriculumApi.listChapters(currentParent.id);
        setItems(data.chapters || []);
      } else if (level === "topics") {
        const { data } = await curriculumApi.listTopics(currentParent.id);
        setItems(data.topics || []);
      } else if (level === "questions") {
        const subjectStep = trail.find((t) => t.level === "subjects");
        const chapterStep = trail.find((t) => t.level === "chapters");
        const topicStep = trail.find((t) => t.level === "topics");
        const params = {
          page: qPage,
          limit: 25,
          subjectId: subjectStep?.id,
          chapterId: chapterStep?.id,
          topicId: topicStep?.id,
        };
        if (qFilter.type) params.type = qFilter.type;
        if (qFilter.q.trim()) params.q = qFilter.q.trim();
        if (qFilter.isActive) params.isActive = qFilter.isActive;
        const { data } = await curriculumApi.listQuestions(params);
        setItems(data.questions || []);
        setQMeta({ total: data.total || 0, pages: data.pages || 1 });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load curriculum");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [level, currentParent, trail, qPage, qFilter]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadLevel();
  }, [loadLevel]);

  const titles = useMemo(
    () => ({
      boards: { title: "Boards / Syllabus", add: "Add Board", empty: "No boards yet" },
      classes: { title: "Classes", add: "Add Class", empty: "No classes in this board" },
      subjects: { title: "Subjects", add: "Add Subject", empty: "No subjects in this class" },
      chapters: { title: "Chapters", add: "Add Chapter", empty: "No chapters yet" },
      topics: { title: "Topics", add: "Add Topic", empty: "No topics in this chapter" },
      questions: { title: "Questions", add: "Add Question", empty: "No questions found" },
    }),
    []
  );

  const goInto = (item) => {
    const nextMap = {
      boards: "classes",
      classes: "subjects",
      subjects: "chapters",
      chapters: "topics",
      topics: "questions",
    };
    const next = nextMap[level];
    if (!next) return;
    setTrail((prev) => [
      ...prev,
      { level, id: item._id || item.id, name: item.name, raw: item },
    ]);
    setLevel(next);
    setQPage(1);
    setEditing(null);
    setFormOpen(false);
  };

  const jumpTo = (index) => {
    if (index < 0) {
      setTrail([]);
      setLevel("boards");
    } else {
      const nextTrail = trail.slice(0, index + 1);
      const last = nextTrail[nextTrail.length - 1];
      const nextLevelMap = {
        boards: "classes",
        classes: "subjects",
        subjects: "chapters",
        chapters: "topics",
        topics: "questions",
      };
      setTrail(nextTrail);
      setLevel(nextLevelMap[last.level]);
    }
    setQPage(1);
    setFormOpen(false);
  };

  const openCreate = () => {
    setEditing(null);
    if (level === "boards") setForm({ name: "", code: "", subtitle: "Syllabus", sortOrder: 100 });
    else if (level === "classes") setForm({ name: "", gradeLevel: "" });
    else if (level === "subjects") setForm({ name: "", slug: "", imageUrl: "" });
    else if (level === "chapters") setForm({ name: "", order: "" });
    else if (level === "topics") setForm({ name: "", order: "", code: "" });
    else setForm({ ...emptyQuestionForm });
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    if (level === "boards") {
      setForm({
        name: item.name || "",
        code: item.code || "",
        subtitle: item.subtitle || "Syllabus",
        sortOrder: item.sortOrder ?? 100,
      });
    } else if (level === "classes") {
      setForm({
        name: item.name || "",
        gradeLevel: item.gradeLevel ?? "",
      });
    } else if (level === "subjects") {
      setForm({
        name: item.name || "",
        slug: item.slug || "",
        imageUrl: item.imageUrl || "",
      });
    } else if (level === "chapters") {
      setForm({ name: item.name || "", order: item.order ?? 0 });
    } else if (level === "topics") {
      setForm({ name: item.name || "", order: item.order ?? 0, code: item.code || "" });
    } else {
      setForm({
        type: item.type || "MCQ",
        subType: item.subType || "",
        text: item.text || "",
        textUrdu: item.textUrdu || "",
        optionA: item.optionA || "",
        optionB: item.optionB || "",
        optionC: item.optionC || "",
        optionD: item.optionD || "",
        correctAnswer: item.correctAnswer || "A",
        marks: item.marks ?? 1,
        source: item.source || "manual",
        isActive: item.isActive !== false,
      });
    }
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (level === "boards") {
        const body = {
          name: form.name.trim(),
          code: form.code.trim(),
          subtitle: form.subtitle.trim() || "Syllabus",
          sortOrder: Number(form.sortOrder) || 100,
        };
        if (editing) await curriculumApi.updateBoard(editing._id, body);
        else await curriculumApi.createBoard(body);
      } else if (level === "classes") {
        const body = {
          name: form.name.trim(),
          gradeLevel: form.gradeLevel === "" ? null : Number(form.gradeLevel),
          boardId: currentParent.id,
        };
        if (editing) await curriculumApi.updateClass(editing._id, body);
        else await curriculumApi.createClass(body);
      } else if (level === "subjects") {
        const body = {
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          imageUrl: form.imageUrl.trim(),
          classId: currentParent.id,
        };
        if (editing) await curriculumApi.updateSubject(editing._id, body);
        else await curriculumApi.createSubject(body);
      } else if (level === "chapters") {
        const body = {
          name: form.name.trim(),
          order: form.order === "" ? undefined : Number(form.order),
          subjectId: currentParent.id,
        };
        if (editing) await curriculumApi.updateChapter(editing._id, body);
        else await curriculumApi.createChapter(body);
      } else if (level === "topics") {
        const body = {
          name: form.name.trim(),
          order: form.order === "" ? undefined : Number(form.order),
          code: form.code.trim(),
          chapterId: currentParent.id,
        };
        if (editing) await curriculumApi.updateTopic(editing._id, body);
        else await curriculumApi.createTopic(body);
      } else if (level === "questions") {
        const topicStep = trail.find((t) => t.level === "topics");
        if (!topicStep && !editing) {
          toast.error("Open a topic before adding questions");
          setSubmitting(false);
          return;
        }
        const body = {
          ...form,
          subType: form.subType.trim() || null,
          text: form.text.trim(),
          textUrdu: form.textUrdu.trim() || null,
          marks: Number(form.marks) || 1,
          topicId: topicStep?.id,
        };
        if (editing) await curriculumApi.updateQuestion(editing._id, body);
        else await curriculumApi.createQuestion(body);
      }
      toast.success(editing ? "Updated" : "Created");
      closeForm();
      await Promise.all([loadLevel(), loadStats()]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item) => {
    const label = item.name || item.text?.slice(0, 40) || "item";
    const needsCascade = level !== "questions";
    const msg = needsCascade
      ? `Delete "${label}"? If it has children, they will be removed too.`
      : `Permanently delete this question?`;
    if (!window.confirm(msg)) return;

    try {
      if (level === "boards") await curriculumApi.deleteBoard(item._id, true);
      else if (level === "classes") await curriculumApi.deleteClass(item._id, true);
      else if (level === "subjects") await curriculumApi.deleteSubject(item._id, true);
      else if (level === "chapters") await curriculumApi.deleteChapter(item._id, true);
      else if (level === "topics") await curriculumApi.deleteTopic(item._id, true);
      else await curriculumApi.deleteQuestion(item._id);
      toast.success("Deleted");
      await Promise.all([loadLevel(), loadStats()]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  };

  const toggleQuestionActive = async (item) => {
    try {
      await curriculumApi.setQuestionActive(item._id, !item.isActive);
      toast.success(item.isActive ? "Deactivated" : "Activated");
      await loadLevel();
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    }
  };

  const meta = titles[level];
  const canDrill = level !== "questions";

  return (
    <DashboardLayout title="Super Admin" navItems={superAdminNavItems}>
      <div className="space-y-4 sm:space-y-6">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Boards", value: stats?.boards },
            { label: "Classes", value: stats?.classes },
            { label: "Subjects", value: stats?.subjects },
            { label: "Chapters", value: stats?.chapters },
            { label: "Topics", value: stats?.topics },
            { label: "Active Qs", value: stats?.activeQuestions },
          ].map((card) => (
            <article key={card.label} className="sms-item-card rounded-2xl p-3 sm:p-4">
              <p className="text-xs text-slate">{card.label}</p>
              <p className="font-display text-2xl text-navy">
                {card.value === undefined ? "—" : card.value}
              </p>
            </article>
          ))}
        </section>

        <section className="sms-surface rounded-2xl p-4 sm:rounded-3xl sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-display text-xl text-navy">{meta.title}</h2>
              <nav className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate" aria-label="Breadcrumb">
                <button
                  type="button"
                  onClick={() => jumpTo(-1)}
                  className="cursor-pointer rounded-md px-1 py-0.5 font-medium text-navy hover:bg-blush"
                >
                  All boards
                </button>
                {trail.map((step, idx) => (
                  <span key={`${step.level}-${step.id}`} className="inline-flex items-center gap-1">
                    <ChevronRight className="size-3.5 opacity-60" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => jumpTo(idx)}
                      className="max-w-[10rem] cursor-pointer truncate rounded-md px-1 py-0.5 font-medium text-navy hover:bg-blush"
                    >
                      {step.name}
                    </button>
                  </span>
                ))}
              </nav>
            </div>
            <button
              type="button"
              onClick={openCreate}
              disabled={level === "questions" && !trail.some((t) => t.level === "topics")}
              className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-navy px-4 py-2.5 text-sm font-semibold text-blush transition hover:bg-slate disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <Plus className="size-4" aria-hidden="true" />
              {meta.add}
            </button>
          </div>

          {level === "questions" && (
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <CustomSelect
                label="Type"
                value={qFilter.type}
                onChange={(next) => {
                  setQFilter((p) => ({ ...p, type: next }));
                  setQPage(1);
                }}
                options={[
                  { value: "", label: "All types" },
                  { value: "MCQ", label: "MCQ" },
                  { value: "SHORT", label: "Short" },
                  { value: "LONG", label: "Long" },
                ]}
                searchable={false}
              />
              <CustomSelect
                label="Status"
                value={qFilter.isActive}
                onChange={(next) => {
                  setQFilter((p) => ({ ...p, isActive: next }));
                  setQPage(1);
                }}
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
                  value={qFilter.q}
                  onChange={(e) => setQFilter((p) => ({ ...p, q: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setQPage(1);
                  }}
                  placeholder="Search question text…"
                />
              </Field>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate">Loading…</p>
          ) : items.length === 0 ? (
            <p className="rounded-2xl bg-blush/70 px-4 py-6 text-sm text-slate">{meta.empty}</p>
          ) : level === "questions" ? (
            <div className="space-y-3">
              {items.map((q) => (
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
                      onClick={() => toggleQuestionActive(q)}
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
              {qMeta.pages > 1 && (
                <div className="flex items-center justify-between pt-2 text-sm">
                  <p className="text-slate">
                    Page {qPage} / {qMeta.pages} · {qMeta.total} total
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={qPage <= 1}
                      onClick={() => setQPage((p) => Math.max(1, p - 1))}
                      className="rounded-xl border border-rose/50 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={qPage >= qMeta.pages}
                      onClick={() => setQPage((p) => p + 1)}
                      className="rounded-xl border border-rose/50 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="min-w-[560px] w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-rose/40 text-slate">
                    <th className="px-2 py-3 font-medium">Name</th>
                    <th className="px-2 py-3 font-medium">Meta</th>
                    <th className="px-2 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id} className="border-b border-rose/20 align-top">
                      <td className="px-2 py-3">
                        {canDrill ? (
                          <button
                            type="button"
                            onClick={() => goInto(item)}
                            className="inline-flex max-w-full cursor-pointer items-center gap-2 text-left font-medium text-navy hover:underline"
                          >
                            {level === "boards" ? (
                              <BookOpen className="size-4 shrink-0 text-slate" />
                            ) : (
                              <Layers className="size-4 shrink-0 text-slate" />
                            )}
                            <span className="truncate">{item.name}</span>
                            <ChevronRight className="size-4 shrink-0 opacity-50" />
                          </button>
                        ) : (
                          <span className="font-medium text-navy">{item.name}</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-xs text-slate">
                        {level === "boards" && (
                          <>
                            {item.code || "—"} · {item.classCount ?? 0} classes
                          </>
                        )}
                        {level === "classes" && (
                          <>
                            Grade {item.gradeLevel ?? "—"} · {item.subjectCount ?? 0} subjects
                          </>
                        )}
                        {level === "subjects" && (
                          <>
                            {item.slug} · {item.chapterCount ?? 0} ch · {item.questionCount ?? 0} qs
                          </>
                        )}
                        {level === "chapters" && (
                          <>
                            Order {item.order ?? 0} · {item.topicCount ?? 0} topics ·{" "}
                            {item.questionCount ?? 0} qs
                          </>
                        )}
                        {level === "topics" && (
                          <>
                            Order {item.order ?? 0}
                            {item.code ? ` · ${item.code}` : ""} · {item.questionCount ?? 0} qs
                          </>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="cursor-pointer rounded-xl border border-rose/50 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-blush"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="cursor-pointer rounded-xl border border-rose/50 px-3 py-1.5 text-xs font-semibold text-[#a33b4a] hover:bg-blush"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {formOpen && (
        <ModalShell
          title={editing ? `Edit ${meta.title.slice(0, -1) || "item"}` : meta.add}
          subtitle={currentParent ? `Under: ${currentParent.name}` : undefined}
          onClose={closeForm}
          wide={level === "questions"}
        >
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            {level === "boards" && (
              <>
                <Field label="Name *" wide>
                  <input
                    required
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </Field>
                <Field label="Code">
                  <input
                    className={inputClass}
                    value={form.code}
                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                    placeholder="PTB"
                  />
                </Field>
                <Field label="Subtitle">
                  <input
                    className={inputClass}
                    value={form.subtitle}
                    onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
                  />
                </Field>
                <Field label="Sort order">
                  <input
                    type="number"
                    className={inputClass}
                    value={form.sortOrder}
                    onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
                  />
                </Field>
              </>
            )}

            {level === "classes" && (
              <>
                <Field label="Name *" wide>
                  <input
                    required
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="9TH"
                  />
                </Field>
                <Field label="Grade level (1–12)">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    className={inputClass}
                    value={form.gradeLevel}
                    onChange={(e) => setForm((p) => ({ ...p, gradeLevel: e.target.value }))}
                  />
                </Field>
              </>
            )}

            {level === "subjects" && (
              <>
                <Field label="Name *" wide>
                  <input
                    required
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </Field>
                <Field label="Slug">
                  <input
                    className={inputClass}
                    value={form.slug}
                    onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                    placeholder="auto from name if empty"
                  />
                </Field>
                <Field label="Image URL" wide>
                  <input
                    className={inputClass}
                    value={form.imageUrl}
                    onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
                  />
                </Field>
              </>
            )}

            {level === "chapters" && (
              <>
                <Field label="Name *" wide>
                  <input
                    required
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </Field>
                <Field label="Order">
                  <input
                    type="number"
                    className={inputClass}
                    value={form.order}
                    onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))}
                  />
                </Field>
              </>
            )}

            {level === "topics" && (
              <>
                <Field label="Name *" wide>
                  <input
                    required
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </Field>
                <Field label="Order">
                  <input
                    type="number"
                    className={inputClass}
                    value={form.order}
                    onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))}
                  />
                </Field>
                <Field label="Code">
                  <input
                    className={inputClass}
                    value={form.code}
                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                  />
                </Field>
              </>
            )}

            {level === "questions" && (
              <>
                <CustomSelect
                  label="Type"
                  required
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
                    placeholder="Optional e.g. QA, SPELLING"
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
                    className={inputClass}
                    value={form.textUrdu}
                    onChange={(e) => setForm((p) => ({ ...p, textUrdu: e.target.value }))}
                    dir="rtl"
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
                <Field label="Source">
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
              </>
            )}

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
                {submitting ? "Saving…" : editing ? "Save changes" : "Create"}
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </DashboardLayout>
  );
}

export default SuperAdminCurriculum;
