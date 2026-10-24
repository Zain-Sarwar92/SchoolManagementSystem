import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  FileSpreadsheet,
  Plus,
  Printer,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { useAcademyNav } from "../hooks/useAcademyNav.js";
import { toast } from "../components/ui/toast.jsx";
import api from "../services/api.js";
import { cleanStudentName } from "../utils/resultPrint.js";

function SectionChecklist({
  classes,
  selected,
  onToggle,
  onToggleClass,
  loading,
}) {
  if (loading) {
    return <p className="text-sm text-slate">Loading sections…</p>;
  }
  if (!classes.length) {
    return (
      <p className="rounded-xl border border-dashed border-rose/50 px-3 py-4 text-center text-sm text-slate">
        No sections yet. Add classes/sections first.
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {classes.map((klass) => {
        const ids = (klass.sections || []).map((s) => String(s._id));
        const picked = ids.filter((id) => selected.has(id)).length;
        const allOn = ids.length > 0 && picked === ids.length;
        return (
          <div
            key={klass._id}
            className="rounded-xl border border-rose/35 bg-white px-3 py-2.5"
          >
            <label className="mb-1 flex cursor-pointer items-center justify-between gap-2">
              <span className="text-sm font-semibold text-navy">
                {klass.name}
              </span>
              <input
                type="checkbox"
                checked={allOn}
                onChange={() => onToggleClass(klass)}
                className="size-4 accent-navy"
                title="Select all in this class"
              />
            </label>
            <ul className="space-y-0.5">
              {(klass.sections || []).map((section) => {
                const id = String(section._id);
                return (
                  <li key={id}>
                    <label className="flex min-h-8 cursor-pointer items-center justify-between gap-2 rounded-lg px-1.5 text-sm text-navy hover:bg-blush/50">
                      <span>
                        {section.name}
                        <span className="ml-1 text-slate">
                          ({section.studentCount})
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={selected.has(id)}
                        onChange={() => onToggle(id)}
                        className="size-4 accent-navy"
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function AcademyResults() {
  const navItems = useAcademyNav();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);
  const [session, setSession] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [panel, setPanel] = useState(null); // 'create' | 'compile' | 'student' | null
  const [selected, setSelected] = useState(() => new Set());
  const [compileSections, setCompileSections] = useState(() => new Set());
  const [compileExams, setCompileExams] = useState(() => new Set());
  const [combineSections, setCombineSections] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentHits, setStudentHits] = useState([]);
  const [studentSearching, setStudentSearching] = useState(false);
  const [pickedStudent, setPickedStudent] = useState(null);
  const [studentExams, setStudentExams] = useState([]);
  const [studentExamIds, setStudentExamIds] = useState(() => new Set());
  const [studentLoading, setStudentLoading] = useState(false);
  const studentSearchSeq = useRef(0);
  const [form, setForm] = useState({
    name: "",
    session: "",
    examDate: "",
    passPercent: 33,
  });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/results/hub");
      setClasses(data.classes || []);
      setExams(data.exams || []);
      setSession(data.session || "");
      setForm((prev) => ({
        ...prev,
        session: prev.session || data.session || "",
      }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load results hub");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const allSectionIds = useMemo(
    () =>
      classes.flatMap((klass) =>
        (klass.sections || []).map((section) => String(section._id)),
      ),
    [classes],
  );

  const toggleInSet = (setter) => (sectionId) => {
    const id = String(sectionId);
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleClassInSet = (setter) => (klass) => {
    const ids = (klass.sections || []).map((s) => String(s._id));
    setter((prev) => {
      const next = new Set(prev);
      const allOn = ids.every((id) => next.has(id));
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error("Exam name is required (at least 2 characters)");
      return;
    }
    if (selected.size === 0) {
      toast.error("Select at least one section");
      return;
    }
    const passPct = Number(form.passPercent);
    if (!Number.isFinite(passPct) || passPct < 1 || passPct > 100) {
      toast.error("Pass percent must be between 1 and 100");
      return;
    }
    const examSession = form.session || session;
    const existing = exams.find(
      (exam) =>
        String(exam.name || "").trim().toLowerCase() ===
          form.name.trim().toLowerCase() &&
        String(exam.session || "") === String(examSession || ""),
    );
    if (existing) {
      const ok = window.confirm(
        `Exam "${form.name.trim()}" already exists for session ${examSession}.\n\nUpdate it and seed the selected sections?`,
      );
      if (!ok) return;
    }
    setSubmitting(true);
    try {
      const sectionIds = [...selected];
      const { data } = await api.post("/results/exams", {
        name: form.name.trim(),
        session: examSession,
        examDate: form.examDate || undefined,
        passPercent: Number(form.passPercent) || 33,
        sectionIds,
      });
      if (data.existed || data.updated) {
        toast.success(
          data.message ||
            `Updated existing exam for ${sectionIds.length} section(s)`,
        );
      } else {
        toast.success(
          data.message ||
            `Exam ready for ${sectionIds.length} section${sectionIds.length === 1 ? "" : "s"}`,
        );
      }
      setForm((prev) => ({ ...prev, name: "", examDate: "" }));
      setSelected(new Set());
      setPanel(null);
      await load();
      if (sectionIds.length === 1 && data.exam?._id) {
        navigate(
          `/academy/results/sections/${sectionIds[0]}/exams/${data.exam._id}`,
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create exam");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompile = () => {
    if (compileSections.size === 0) {
      toast.error("Select at least one section");
      return;
    }
    if (compileExams.size === 0) {
      toast.error("Select at least one exam / round");
      return;
    }
    const params = new URLSearchParams({
      sections: [...compileSections].join(","),
      exams: [...compileExams].join(","),
    });
    if (combineSections && compileSections.size > 1) {
      params.set("combine", "1");
    }
    navigate(`/academy/results/compile?${params.toString()}`);
  };

  const handleGenerateExam = (exam) => {
    const sectionIds = (exam.sections || []).map((s) => String(s._id));
    if (!sectionIds.length) {
      toast.error("This exam has no sections yet");
      return;
    }
    const params = new URLSearchParams({
      sections: sectionIds.join(","),
      exams: String(exam._id),
    });
    navigate(`/academy/results/compile?${params.toString()}`);
  };

  const resetStudentPanel = () => {
    setStudentQuery("");
    setStudentHits([]);
    setPickedStudent(null);
    setStudentExams([]);
    setStudentExamIds(new Set());
    setStudentSearching(false);
    setStudentLoading(false);
  };

  const openPanel = (name) => {
    setPanel((current) => {
      const next = current === name ? null : name;
      if (next !== "student") resetStudentPanel();
      return next;
    });
  };

  useEffect(() => {
    if (panel !== "student") return undefined;
    const q = studentQuery.trim();
    if (q.length < 1) {
      setStudentHits([]);
      setStudentSearching(false);
      return undefined;
    }
    const seq = ++studentSearchSeq.current;
    setStudentSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/students", {
          params: {
            q,
            status: "active",
            limit: 20,
            includeSubjects: 0,
          },
        });
        if (seq === studentSearchSeq.current) {
          setStudentHits(data.students || []);
        }
      } catch (err) {
        if (seq === studentSearchSeq.current) {
          setStudentHits([]);
          toast.error(err.response?.data?.message || "Student search failed");
        }
      } finally {
        if (seq === studentSearchSeq.current) setStudentSearching(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [studentQuery, panel]);

  const pickStudent = async (student) => {
    setPickedStudent(student);
    setStudentHits([]);
    setStudentQuery("");
    setStudentLoading(true);
    setStudentExams([]);
    setStudentExamIds(new Set());
    try {
      const { data } = await api.get(
        `/results/students/${student._id}/report`,
      );
      const available = data.availableExams || [];
      setStudentExams(available);
      setStudentExamIds(new Set(available.map((e) => String(e._id))));
      if (!available.length) {
        toast.error("No marked exams found for this student yet");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to load student rounds",
      );
      setPickedStudent(null);
    } finally {
      setStudentLoading(false);
    }
  };

  const handleStudentPrint = () => {
    if (!pickedStudent) {
      toast.error("Select a student first");
      return;
    }
    if (studentExamIds.size === 0) {
      toast.error("Select at least one round");
      return;
    }
    const params = new URLSearchParams({
      exams: [...studentExamIds].join(","),
    });
    navigate(
      `/academy/results/students/${pickedStudent._id}/print?${params.toString()}`,
    );
  };

  const handleDeleteExam = async (exam) => {
    const ok = window.confirm(
      `Delete exam "${exam.name}" for all sections? All marks will be removed.`,
    );
    if (!ok) return;
    try {
      await api.delete(`/results/exams/${exam._id}`);
      toast.success("Exam deleted");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete exam");
    }
  };

  return (
    <DashboardLayout title="Results" navItems={navItems}>
      <section className="sms-surface rounded-2xl p-4 sm:rounded-3xl sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold text-navy">
              Results
            </h2>
            <p className="mt-0.5 text-sm text-slate">
              Create exams, enter marks, combine rounds
              {session ? ` · ${session}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openPanel("create")}
              className={[
                "inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition",
                panel === "create"
                  ? "bg-navy text-blush"
                  : "border border-rose/50 bg-white text-navy hover:bg-blush",
              ].join(" ")}
            >
              <Plus className="size-4" />
              New exam
            </button>
            <button
              type="button"
              onClick={() => openPanel("compile")}
              className={[
                "inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition",
                panel === "compile"
                  ? "bg-navy text-blush"
                  : "border border-rose/50 bg-white text-navy hover:bg-blush",
              ].join(" ")}
            >
              <FileSpreadsheet className="size-4" />
              Compile
            </button>
            <button
              type="button"
              onClick={() => openPanel("student")}
              className={[
                "inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition",
                panel === "student"
                  ? "bg-navy text-blush"
                  : "border border-rose/50 bg-white text-navy hover:bg-blush",
              ].join(" ")}
            >
              <UserRound className="size-4" />
              Student report
            </button>
          </div>
        </div>

        {panel === "create" ? (
          <form
            onSubmit={handleCreate}
            className="mb-5 rounded-2xl border border-rose/40 bg-blush/25 p-4"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-semibold text-navy">
                  New exam
                </h3>
                <p className="text-sm text-slate">
                  Name the exam and tick the sections it covers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanel(null)}
                className="grid size-8 place-items-center rounded-lg text-slate hover:bg-white hover:text-navy"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-navy">Name</span>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Round 1"
                  className="w-full rounded-xl border border-rose/50 bg-white px-3 py-2.5 text-navy outline-none focus:border-navy"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-navy">
                  Session
                </span>
                <input
                  value={form.session}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, session: e.target.value }))
                  }
                  className="w-full rounded-xl border border-rose/50 bg-white px-3 py-2.5 text-navy outline-none focus:border-navy"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-navy">Pass %</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.passPercent}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, passPercent: e.target.value }))
                  }
                  className="w-full rounded-xl border border-rose/50 bg-white px-3 py-2.5 text-navy outline-none focus:border-navy"
                />
              </label>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-navy">
                  Sections · {selected.size}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setSelected(
                      selected.size === allSectionIds.length
                        ? new Set()
                        : new Set(allSectionIds),
                    )
                  }
                  className="text-xs font-medium text-navy underline"
                >
                  {selected.size === allSectionIds.length
                    ? "Clear"
                    : "Select all"}
                </button>
              </div>
              <SectionChecklist
                classes={classes}
                selected={selected}
                onToggle={toggleInSet(setSelected)}
                onToggleClass={toggleClassInSet(setSelected)}
                loading={loading}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || selected.size === 0}
              className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-navy px-4 text-sm font-semibold text-blush disabled:opacity-60"
            >
              <Plus className="size-4" />
              {submitting ? "Creating…" : "Create exam"}
            </button>
          </form>
        ) : null}

        {panel === "compile" ? (
          <div className="mb-5 rounded-2xl border border-rose/40 bg-blush/25 p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-semibold text-navy">
                  Compile results
                </h3>
                <p className="text-sm text-slate">
                  Default: each section on its own page. Optionally merge all
                  selected sections into one sheet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanel(null)}
                className="grid size-8 place-items-center rounded-lg text-slate hover:bg-white hover:text-navy"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-navy">
                Sections · {compileSections.size}
              </p>
              <SectionChecklist
                classes={classes}
                selected={compileSections}
                onToggle={toggleInSet(setCompileSections)}
                onToggleClass={toggleClassInSet(setCompileSections)}
                loading={loading}
              />
            </div>

            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-navy">
                Rounds · {compileExams.size}
              </p>
              {exams.length === 0 ? (
                <p className="text-sm text-slate">Create an exam first.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {exams.map((exam) => {
                    const id = String(exam._id);
                    const on = compileExams.has(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleInSet(setCompileExams)(id)}
                        className={[
                          "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                          on
                            ? "border-navy bg-navy text-blush"
                            : "border-rose/50 bg-white text-navy hover:bg-blush",
                        ].join(" ")}
                      >
                        {exam.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <label
              className={[
                "mb-4 flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition",
                combineSections
                  ? "border-navy/40 bg-white"
                  : "border-rose/40 bg-white/70 hover:bg-white",
                compileSections.size < 2 ? "opacity-60" : "",
              ].join(" ")}
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-navy"
                checked={combineSections}
                disabled={compileSections.size < 2}
                onChange={(e) => setCombineSections(e.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium text-navy">
                  Combine sections into one sheet
                </span>
                <span className="block text-xs text-slate">
                  {compileSections.size < 2
                    ? "Select 2+ sections to enable."
                    : "One list with a Sec column. Leave off for separate pages."}
                </span>
              </span>
            </label>

            <button
              type="button"
              onClick={handleCompile}
              disabled={compileSections.size === 0 || compileExams.size === 0}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-navy px-4 text-sm font-semibold text-blush disabled:opacity-60"
            >
              <FileSpreadsheet className="size-4" />
              {combineSections && compileSections.size > 1
                ? "Open combined sheet"
                : "Open sheet"}
            </button>
          </div>
        ) : null}

        {panel === "student" ? (
          <div className="mb-5 rounded-2xl border border-rose/40 bg-blush/25 p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-semibold text-navy">
                  Student report
                </h3>
                <p className="text-sm text-slate">
                  Search a student, pick the round for the detail sheet.
                  Accumulative summary always lists every round they appeared
                  in.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPanel(null);
                  resetStudentPanel();
                }}
                className="grid size-8 place-items-center rounded-lg text-slate hover:bg-white hover:text-navy"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {!pickedStudent ? (
              <div>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-navy">
                    Find student
                  </span>
                  <span className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate" />
                    <input
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                      placeholder="Name, roll, father, phone…"
                      className="w-full rounded-xl border border-rose/50 bg-white py-2.5 pl-9 pr-3 text-navy outline-none focus:border-navy"
                      autoFocus
                    />
                  </span>
                </label>
                <div className="mt-2">
                  {studentSearching ? (
                    <p className="text-sm text-slate">Searching…</p>
                  ) : studentQuery.trim() && studentHits.length === 0 ? (
                    <p className="text-sm text-slate">No students matched.</p>
                  ) : studentHits.length > 0 ? (
                    <ul className="max-h-64 overflow-auto rounded-xl border border-rose/40 bg-white">
                      {studentHits.map((student) => (
                        <li key={student._id}>
                          <button
                            type="button"
                            onClick={() => pickStudent(student)}
                            className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-blush/50"
                          >
                            <span>
                              <span className="block text-sm font-semibold text-navy">
                                {cleanStudentName(student.name)}
                              </span>
                              <span className="block text-xs text-slate">
                                Roll {student.rollNumber}
                                {student.fatherName
                                  ? ` · ${student.fatherName}`
                                  : ""}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-medium text-slate">
                              {student.class?.name || "—"}{" "}
                              {student.section?.name || ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate">
                      Type at least one character to search.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-rose/40 bg-white px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-navy">
                      {cleanStudentName(pickedStudent.name)}
                    </p>
                    <p className="text-xs text-slate">
                      Roll {pickedStudent.rollNumber}
                      {pickedStudent.fatherName
                        ? ` · ${pickedStudent.fatherName}`
                        : ""}{" "}
                      · {pickedStudent.class?.name || "—"}{" "}
                      {pickedStudent.section?.name || ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPickedStudent(null);
                      setStudentExams([]);
                      setStudentExamIds(new Set());
                    }}
                    className="text-xs font-medium text-navy underline"
                  >
                    Change student
                  </button>
                </div>

                {studentLoading ? (
                  <p className="text-sm text-slate">Loading rounds…</p>
                ) : studentExams.length === 0 ? (
                  <p className="text-sm text-slate">
                    No marked rounds for this student yet.
                  </p>
                ) : (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-navy">
                        Detail round(s) · {studentExamIds.size}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setStudentExamIds(
                            studentExamIds.size === studentExams.length
                              ? new Set()
                              : new Set(
                                  studentExams.map((e) => String(e._id)),
                                ),
                          )
                        }
                        className="text-xs font-medium text-navy underline"
                      >
                        {studentExamIds.size === studentExams.length
                          ? "Clear"
                          : "Select all"}
                      </button>
                    </div>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {studentExams.map((exam) => {
                        const id = String(exam._id);
                        const on = studentExamIds.has(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => toggleInSet(setStudentExamIds)(id)}
                            className={[
                              "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                              on
                                ? "border-navy bg-navy text-blush"
                                : "border-rose/50 bg-white text-navy hover:bg-blush",
                            ].join(" ")}
                          >
                            {exam.name}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={handleStudentPrint}
                      disabled={studentExamIds.size === 0}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-navy px-4 text-sm font-semibold text-blush disabled:opacity-60"
                    >
                      <Printer className="size-4" />
                      Open / print report
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ) : null}

        <h3 className="mb-3 font-display text-lg font-semibold text-navy">
          Exams
        </h3>

        {loading ? (
          <p className="text-sm text-slate">Loading…</p>
        ) : exams.length === 0 ? (
          <div className="rounded-xl border border-dashed border-rose/45 px-4 py-10 text-center text-sm text-slate">
            No exams yet. Use{" "}
            <span className="font-medium text-navy">New exam</span> to start.
          </div>
        ) : (
          <ul className="space-y-2">
            {exams.map((exam) => (
              <li
                key={exam._id}
                className="rounded-2xl border border-rose/35 bg-white/80 px-4 py-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-display text-base font-semibold text-navy">
                      {exam.name}
                    </p>
                    <p className="text-xs text-slate">
                      {exam.session} · Pass {exam.passPercent}% ·{" "}
                      {exam.sectionCount || 0} section
                      {(exam.sectionCount || 0) === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleGenerateExam(exam)}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-rose/45 bg-blush/50 px-2.5 text-xs font-semibold text-navy transition hover:bg-navy hover:text-blush"
                      title="Generate result for all sections"
                    >
                      <FileSpreadsheet className="size-3.5" />
                      Generate
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteExam(exam)}
                      className="grid size-8 place-items-center rounded-lg text-slate hover:bg-rose/40 hover:text-navy"
                      title="Delete exam"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                {(exam.sections || []).length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {exam.sections.map((section) => (
                      <Link
                        key={section._id}
                        to={`/academy/results/sections/${section._id}/exams/${exam._id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-blush/60 px-2.5 py-1 text-xs font-medium text-navy transition hover:bg-navy hover:text-blush"
                      >
                        {section.className} {section.name}
                        <ChevronRight className="size-3 opacity-70" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate">No sections linked.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardLayout>
  );
}

export default AcademyResults;
