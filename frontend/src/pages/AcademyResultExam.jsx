import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  FileSpreadsheet,
  Plus,
  Trash2,
} from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { useAcademyNav } from "../hooks/useAcademyNav.js";
import { toast } from "../components/ui/toast.jsx";
import api from "../services/api.js";

function AcademyResultExam() {
  const navItems = useAcademyNav();
  const { sectionId, examId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState(null);
  const [exam, setExam] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [available, setAvailable] = useState([]);
  const [selectedAdd, setSelectedAdd] = useState([]);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/results/sections/${sectionId}/exams/${examId}`
      );
      setSection(data.section);
      setExam(data.exam);
      setSubjects(data.subjects || []);
      setAvailable(data.availableSubjects || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load exam");
      navigate(`/academy/results/sections/${sectionId}`, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, examId]);

  const readyCount = subjects.filter((s) => s.ready).length;

  const toggleAdd = (id) => {
    setSelectedAdd((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAddSubjects = async () => {
    if (!selectedAdd.length) {
      toast.error("Select at least one subject");
      return;
    }
    setAdding(true);
    try {
      await api.post(`/results/sections/${sectionId}/exams/${examId}/subjects`, {
        subjectIds: selectedAdd,
      });
      toast.success("Subjects added");
      setSelectedAdd([]);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add subjects");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteSubject = async (assessment) => {
    const ok = window.confirm(
      `Remove "${assessment.subjectName}" and its marks from this exam?`
    );
    if (!ok) return;
    try {
      await api.delete(`/results/assessments/${assessment._id}`);
      toast.success("Subject removed");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove subject");
    }
  };

  const handleClearAll = async () => {
    const ok = window.confirm(
      `Delete all marks for ${section?.name} in "${exam?.name}"?`
    );
    if (!ok) return;
    try {
      await api.delete(`/results/sections/${sectionId}/exams/${examId}`);
      toast.success("Result cleared");
      navigate(`/academy/results/sections/${sectionId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to clear result");
    }
  };

  return (
    <DashboardLayout title="Results" navItems={navItems}>
      <section className="sms-surface rounded-2xl p-4 sm:rounded-3xl sm:p-6">
        <Link
          to={`/academy/results/sections/${sectionId}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate transition hover:text-navy"
        >
          <ArrowLeft className="size-4" />
          Section exams
        </Link>

        {loading ? (
          <p className="text-sm text-slate">Loading exam…</p>
        ) : (
          <>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate">
                  {section?.class?.name} · {section?.name} · Session {exam?.session}
                </p>
                <h2 className="font-display text-2xl font-semibold text-navy">
                  {exam?.name}
                </h2>
                <p className="mt-0.5 text-sm text-slate">
                  {readyCount}/{subjects.length} subjects with marks ·{" "}
                  {section?.studentCount || 0} students
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {readyCount > 0 ? (
                  <Link
                    to={`/academy/results/sections/${sectionId}/exams/${examId}/gazette`}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-blush transition hover:bg-slate"
                  >
                    <FileSpreadsheet className="size-4" />
                    Generate Result
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-navy/40 px-4 text-sm font-semibold text-blush"
                    title="Enter marks in at least one subject first"
                  >
                    Generate Result
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose/50 px-4 text-sm font-semibold text-navy transition hover:bg-rose/40"
                >
                  <Trash2 className="size-4" />
                  Delete
                </button>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 font-display text-lg font-semibold text-navy">
                Subjects
              </h3>
              {subjects.length === 0 ? (
                <p className="rounded-xl border border-dashed border-rose/50 bg-white/60 px-4 py-6 text-center text-sm text-slate">
                  No subjects yet. Add subjects below (or enroll students so defaults can load).
                </p>
              ) : (
                <div className="sms-list">
                  {subjects.map((row) => (
                    <div
                      key={row._id}
                      className="sms-row flex-col items-stretch gap-3 sm:flex-row sm:items-center"
                    >
                      <Link
                        to={`/academy/results/assessments/${row._id}/marks`}
                        className="flex min-w-0 flex-1 flex-col gap-0.5"
                      >
                        <span className="font-display text-base font-semibold text-navy">
                          {row.subjectName}
                        </span>
                        <span className="text-sm text-slate">
                          Total {row.totalMarks} · {row.entered}/{row.enrolledCount}{" "}
                          entered
                        </span>
                      </Link>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/academy/results/assessments/${row._id}/marks`}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-navy px-3 text-sm font-semibold text-blush"
                        >
                          Enter marks
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubject(row)}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-rose/50 px-3 text-sm text-navy hover:bg-rose/40"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {available.length > 0 && (
              <div className="rounded-2xl border border-rose/40 bg-blush/25 p-4">
                <h3 className="font-display text-lg font-semibold text-navy">
                  Add subject
                </h3>
                <p className="mt-0.5 mb-3 text-sm text-slate">
                  Suggested subjects match student enrollments.
                </p>
                <div className="mb-3 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                  {available.map((subject) => {
                    const checked = selectedAdd.includes(subject._id);
                    return (
                      <label
                        key={subject._id}
                        className={[
                          "inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                          checked
                            ? "border-navy bg-navy text-blush"
                            : "border-rose/50 bg-white text-navy hover:bg-blush",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleAdd(subject._id)}
                        />
                        {subject.name}
                        {subject.suggested ? (
                          <span className="text-[10px] uppercase opacity-70">
                            enrolled
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={handleAddSubjects}
                  disabled={adding || !selectedAdd.length}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-blush disabled:opacity-50"
                >
                  <Plus className="size-4" />
                  {adding ? "Adding…" : "Add selected"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </DashboardLayout>
  );
}

export default AcademyResultExam;
