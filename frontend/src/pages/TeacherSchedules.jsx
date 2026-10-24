import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { useTeacherNav } from "../hooks/useAcademyNav.js";
import { toast } from "../components/ui/toast.jsx";
import api from "../services/api.js";
import { statusChipClass } from "../utils/testScheduleStatus.js";

function TeacherSchedules() {
  const navItems = useTeacherNav();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [paperForm, setPaperForm] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/schedules/my-assignments");
      setAssignments(data.assignments || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCount = assignments.filter((a) => a.status !== "COMPLETED").length;

  const saveSyllabus = async (assignmentId, syllabusText) => {
    setBusyId(assignmentId);
    try {
      await api.patch(`/schedules/my-assignments/${assignmentId}/syllabus`, {
        syllabusText,
      });
      toast.success("Syllabus saved");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setBusyId("");
    }
  };

  const createPaper = async (e) => {
    e.preventDefault();
    if (!paperForm) return;
    setBusyId(paperForm.assignmentId);
    try {
      await api.post(
        `/schedules/my-assignments/${paperForm.assignmentId}/paper`,
        {
          title: paperForm.title,
          totalMarks: paperForm.totalMarks,
          durationMinutes: paperForm.durationMinutes,
          instructions: paperForm.instructions,
          syllabusNote: paperForm.syllabusNote,
        }
      );
      toast.success("Paper created — assignment completed");
      setPaperForm(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Create failed");
    } finally {
      setBusyId("");
    }
  };

  const deletePaper = async (assignmentId) => {
    if (!window.confirm("Delete paper? Assignment will reopen.")) return;
    setBusyId(assignmentId);
    try {
      await api.delete(`/schedules/my-assignments/${assignmentId}/paper`);
      toast.success("Paper deleted");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    } finally {
      setBusyId("");
    }
  };

  return (
    <DashboardLayout title="My tests" navItems={navItems}>
      <div className="space-y-4">
        <section className="sms-surface rounded-2xl p-4 sm:rounded-3xl sm:p-5">
          <h2 className="font-display text-2xl font-semibold text-navy">
            My Assigned Tests
          </h2>
          <p className="text-sm text-slate">
            Create a paper when ready. Exam date is locked to the schedule.
          </p>
        </section>

        {loading ? (
          <p className="text-sm text-slate">Loading…</p>
        ) : assignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-rose/40 bg-white/80 px-4 py-12 text-center">
            <CalendarClock className="mx-auto size-8 text-slate" />
            <p className="mt-2 font-semibold text-navy">No assigned tests</p>
            <p className="text-sm text-slate">
              When your academy admin schedules a test for you, it will appear
              here.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-rose/35 bg-white/90 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate">Total</p>
                <p className="mt-1 text-2xl font-semibold text-navy">
                  {assignments.length}
                </p>
              </div>
              <div className="rounded-2xl border border-rose/35 bg-white/90 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate">
                  Needs action
                </p>
                <p className="mt-1 text-2xl font-semibold text-navy">{openCount}</p>
              </div>
              <div className="rounded-2xl border border-rose/35 bg-white/90 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate">
                  Completed
                </p>
                <p className="mt-1 text-2xl font-semibold text-navy">
                  {assignments.length - openCount}
                </p>
              </div>
            </div>

            <ul className="space-y-3">
              {assignments.map((row) => (
                <li
                  key={row.assignmentId}
                  className="rounded-2xl border border-rose/35 bg-white/90 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-navy">
                          {row.subjectName}
                        </h3>
                        <span
                          className={[
                            "rounded-lg px-2 py-0.5 text-xs font-semibold",
                            statusChipClass(row.status),
                          ].join(" ")}
                        >
                          {row.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate">
                        {row.scheduleName} · {row.roundName} · {row.className}{" "}
                        {row.sectionName}
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-navy">
                        {row.testDateLabel}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {row.test ? (
                        <button
                          type="button"
                          disabled={busyId === row.assignmentId}
                          onClick={() => deletePaper(row.assignmentId)}
                          className="rounded-lg border border-rose/50 px-3 py-1.5 text-xs font-semibold text-navy disabled:opacity-60"
                        >
                          Delete paper
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setPaperForm({
                              assignmentId: row.assignmentId,
                              title: `${row.subjectName} — ${row.scheduleName}`,
                              totalMarks: 50,
                              durationMinutes: 60,
                              instructions: "",
                              syllabusNote: row.syllabusText || "",
                              lockedDate: row.testDateLabel,
                            })
                          }
                          className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-blush"
                        >
                          Create paper
                        </button>
                      )}
                    </div>
                  </div>

                  <label className="mt-3 block text-sm">
                    <span className="mb-1 block text-xs font-semibold uppercase text-slate">
                      Syllabus (visible to admin)
                    </span>
                    <textarea
                      defaultValue={row.syllabusText || ""}
                      rows={2}
                      className="w-full rounded-xl border border-rose/40 bg-bg-soft px-3 py-2 text-sm"
                      onBlur={(e) => {
                        if (e.target.value !== (row.syllabusText || "")) {
                          saveSyllabus(row.assignmentId, e.target.value);
                        }
                      }}
                    />
                  </label>

                  {row.test ? (
                    <p className="mt-2 text-xs text-slate">
                      Paper: {row.test.title}
                      {row.test.totalMarks != null
                        ? ` · ${row.test.totalMarks} marks`
                        : ""}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {paperForm ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy/40 p-3 backdrop-blur-sm">
          <form
            onSubmit={createPaper}
            className="w-full max-w-md space-y-3 rounded-2xl border border-rose/40 bg-white p-4 shadow-xl"
          >
            <h3 className="font-display text-lg font-semibold text-navy">
              Create paper
            </h3>
            <p className="text-xs text-slate">
              Exam date locked: <strong>{paperForm.lockedDate}</strong>
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Title *</span>
              <input
                required
                value={paperForm.title}
                onChange={(e) =>
                  setPaperForm((p) => ({ ...p, title: e.target.value }))
                }
                className="w-full rounded-xl border border-rose/50 bg-bg-soft px-3 py-2"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Total marks</span>
                <input
                  type="number"
                  min={0}
                  value={paperForm.totalMarks}
                  onChange={(e) =>
                    setPaperForm((p) => ({
                      ...p,
                      totalMarks: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-xl border border-rose/50 bg-bg-soft px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Duration (min)</span>
                <input
                  type="number"
                  min={1}
                  value={paperForm.durationMinutes}
                  onChange={(e) =>
                    setPaperForm((p) => ({
                      ...p,
                      durationMinutes: Number(e.target.value) || 60,
                    }))
                  }
                  className="w-full rounded-xl border border-rose/50 bg-bg-soft px-3 py-2"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Instructions</span>
              <textarea
                rows={2}
                value={paperForm.instructions}
                onChange={(e) =>
                  setPaperForm((p) => ({ ...p, instructions: e.target.value }))
                }
                className="w-full rounded-xl border border-rose/50 bg-bg-soft px-3 py-2"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPaperForm(null)}
                className="rounded-xl border border-rose/45 px-3 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyId === paperForm.assignmentId}
                className="rounded-xl bg-navy px-3 py-2 text-sm font-semibold text-blush disabled:opacity-60"
              >
                Save paper
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

export default TeacherSchedules;
