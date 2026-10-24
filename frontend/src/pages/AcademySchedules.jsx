import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { useAcademyNav } from "../hooks/useAcademyNav.js";
import { toast } from "../components/ui/toast.jsx";
import api from "../services/api.js";
import { formatScheduleDate } from "../utils/testScheduleStatus.js";

function AcademySchedules() {
  const navItems = useAcademyNav();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/schedules");
      setSchedules(data.schedules || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load schedules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (schedule) => {
    if (!window.confirm(`Delete schedule “${schedule.name}”?`)) return;
    try {
      await api.delete(`/schedules/${schedule._id}`);
      toast.success("Schedule deleted");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  };

  return (
    <DashboardLayout title="Schedules" navItems={navItems}>
      <div className="space-y-4">
        <section className="sms-surface flex flex-wrap items-start justify-between gap-3 rounded-2xl p-4 sm:rounded-3xl sm:p-5">
          <div>
            <h2 className="font-display text-2xl font-semibold text-navy">
              Test Schedules
            </h2>
            <p className="text-sm text-slate">
              Create exam date plans and papers — curriculum is built-in.
            </p>
          </div>
          <Link
            to="/academy/schedules/new"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-navy px-3 text-sm font-semibold text-blush"
          >
            <Plus className="size-4" />
            Create schedule
          </Link>
        </section>

        {loading ? (
          <p className="text-sm text-slate">Loading…</p>
        ) : schedules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-rose/40 bg-white/80 px-4 py-12 text-center">
            <CalendarClock className="mx-auto size-8 text-slate" />
            <p className="mt-2 font-semibold text-navy">No schedules yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate">
              Pick class, subjects, and dates to start.
            </p>
            <Link
              to="/academy/schedules/new"
              className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-navy px-3 text-sm font-semibold text-blush"
            >
              <Plus className="size-4" />
              Create schedule
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {schedules.map((schedule) => {
              const summary = schedule.summary || {};
              const subjectChips = [
                ...new Set(
                  (schedule.rounds || [])
                    .flatMap((r) => r.subjects || [])
                    .map((s) => s.subjectName)
                ),
              ].slice(0, 8);

              return (
                <li
                  key={schedule._id}
                  className="rounded-2xl border border-rose/35 bg-white/90 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-display text-lg font-semibold text-navy">
                          {schedule.name}
                        </h3>
                        {schedule.status === "CANCELLED" ? (
                          <span className="rounded-lg bg-bg-soft px-2 py-0.5 text-xs font-semibold text-slate ring-1 ring-rose/30">
                            Cancelled
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-slate">
                        {summary.roundsCount || 0} round
                        {(summary.roundsCount || 0) === 1 ? "" : "s"} ·{" "}
                        {subjectChips.length || summary.subjectsCount || 0}{" "}
                        subject
                        {(subjectChips.length || summary.subjectsCount || 0) ===
                        1
                          ? ""
                          : "s"}
                        {summary.earliestDate
                          ? ` · starts ${formatScheduleDate(summary.earliestDate)}`
                          : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {subjectChips.map((name) => (
                          <span
                            key={name}
                            className="rounded-lg bg-bg-soft px-2 py-0.5 text-xs text-navy ring-1 ring-rose/30"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link
                        to={`/academy/schedules/${schedule._id}/print`}
                        className="inline-flex min-h-9 items-center rounded-lg bg-navy px-3 text-xs font-semibold text-blush"
                      >
                        Open
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove(schedule)}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-rose/60 bg-rose/25 px-3 text-xs font-semibold text-navy"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
}

export default AcademySchedules;
