import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Trash2 } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { useAcademyNav } from "../hooks/useAcademyNav.js";
import { toast } from "../components/ui/toast.jsx";
import api from "../services/api.js";

function AcademyResultSection() {
  const navItems = useAcademyNav();
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState(null);
  const [exams, setExams] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/results/sections/${sectionId}`);
      setSection(data.section);
      setExams(data.exams || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load section exams");
      navigate("/academy/results", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  const handleDeleteExam = async (exam) => {
    const ok = window.confirm(
      `Delete result for ${section?.name} in "${exam.name}"? Marks for this section will be cleared.`
    );
    if (!ok) return;
    try {
      await api.delete(`/results/sections/${sectionId}/exams/${exam._id}`);
      toast.success("Section result cleared");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete");
    }
  };

  const className = section?.class?.name || "Class";

  return (
    <DashboardLayout title="Results" navItems={navItems}>
      <section className="sms-surface rounded-2xl p-4 sm:rounded-3xl sm:p-6">
        <Link
          to="/academy/results"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate transition hover:text-navy"
        >
          <ArrowLeft className="size-4" />
          All classes
        </Link>

        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">
            {className}
          </p>
          <h2 className="font-display text-2xl font-semibold text-navy">
            {loading ? "…" : `${section?.name || ""} results`}
          </h2>
          <p className="mt-0.5 text-sm text-slate">
            Exams created for this section. To add more sections to an exam, use{" "}
            <Link to="/academy/results" className="font-medium text-navy underline">
              Results hub
            </Link>
            .
            {section ? ` · ${section.studentCount} students` : ""}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate">Loading exams…</p>
        ) : exams.length === 0 ? (
          <div className="rounded-xl border border-dashed border-rose/50 bg-white/60 px-4 py-8 text-center text-sm text-slate">
            No exams for this section yet.{" "}
            <Link to="/academy/results" className="font-medium text-navy underline">
              Create an exam
            </Link>{" "}
            and select this section.
          </div>
        ) : (
          <div className="sms-list">
            {exams.map((exam) => (
              <div
                key={exam._id}
                className="sms-row flex-col items-stretch gap-3 sm:flex-row sm:items-center"
              >
                <Link
                  to={`/academy/results/sections/${sectionId}/exams/${exam._id}`}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-semibold text-navy">
                      {exam.name}
                    </h3>
                    <p className="text-sm text-slate">
                      Session {exam.session} · Pass {exam.passPercent}% ·{" "}
                      {exam.subjectsWithMarks}/{exam.subjectCount} subjects with
                      marks
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-slate" />
                </Link>
                <button
                  type="button"
                  onClick={() => handleDeleteExam(exam)}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-rose/50 px-3 text-sm font-medium text-navy transition hover:bg-rose/40"
                  title="Clear this section's marks"
                >
                  <Trash2 className="size-3.5" />
                  Clear
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}

export default AcademyResultSection;
