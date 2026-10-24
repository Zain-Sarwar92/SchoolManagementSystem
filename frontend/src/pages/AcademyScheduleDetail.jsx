import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { useAcademyNav } from "../hooks/useAcademyNav.js";
import { toast } from "../components/ui/toast.jsx";
import api from "../services/api.js";
import {
  formatScheduleDate,
  resolveAssignmentStatus,
  statusChipClass,
} from "../utils/testScheduleStatus.js";

function sortClassNames(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function groupSubjectsByTestDate(subjects) {
  const groups = [];
  for (const subject of subjects) {
    const key = new Date(subject.testDate).toISOString();
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(subject);
      continue;
    }
    groups.push({
      key,
      label: formatScheduleDate(subject.testDate),
      items: [subject],
    });
  }
  return groups;
}

function AcademyScheduleDetail() {
  const navItems = useAcademyNav();
  const { id } = useParams();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingSyllabusId, setSavingSyllabusId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/schedules/${id}`);
      setSchedule(data.schedule);
    } catch (err) {
      toast.error(err.response?.data?.message || "Schedule not found");
      navigate("/academy/schedules");
    } finally {
      setLoading(false);
    }
  };

  const saveSyllabus = async (assignmentId, syllabusText, previous) => {
    const next = String(syllabusText || "").trim();
    const prev = String(previous || "").trim();
    if (next === prev) return;
    setSavingSyllabusId(assignmentId);
    try {
      await api.patch(`/schedules/assignments/${assignmentId}/syllabus`, {
        syllabusText: next,
      });
      setSchedule((current) => {
        if (!current) return current;
        return {
          ...current,
          rounds: (current.rounds || []).map((round) => ({
            ...round,
            subjects: (round.subjects || []).map((subject) => ({
              ...subject,
              classes: (subject.classes || []).map((classItem) => ({
                ...classItem,
                assignments: (classItem.assignments || []).map((a) =>
                  a._id === assignmentId ? { ...a, syllabusText: next } : a
                ),
              })),
            })),
          })),
        };
      });
      toast.success("Syllabus saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save syllabus");
    } finally {
      setSavingSyllabusId("");
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const classColumns = useMemo(() => {
    if (!schedule) return [];
    const names = new Set();
    for (const round of schedule.rounds || []) {
      for (const subject of round.subjects || []) {
        for (const classItem of subject.classes || []) {
          if (classItem.class?.name) names.add(classItem.class.name);
        }
      }
    }
    return [...names].sort(sortClassNames);
  }, [schedule]);

  const cancel = async () => {
    if (!window.confirm("Cancel this schedule? Teachers cannot create papers.")) {
      return;
    }
    try {
      await api.post(`/schedules/${id}/cancel`);
      toast.success("Schedule cancelled");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Cancel failed");
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this schedule? Linked papers are kept.")) return;
    try {
      await api.delete(`/schedules/${id}`);
      toast.success("Schedule deleted");
      navigate("/academy/schedules");
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  };

  const summary = schedule?.summary || {};

  return (
    <DashboardLayout title="Schedule" navItems={navItems}>
      {loading || !schedule ? (
        <p className="text-sm text-slate">Loading…</p>
      ) : (
        <div className="space-y-4">
          <section className="sms-surface rounded-2xl p-4 sm:rounded-3xl sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate">
                  Scheduling
                </p>
                <h2 className="font-display text-2xl font-semibold text-navy">
                  {schedule.name}
                </h2>
                <p className="text-sm text-slate">
                  Created by {schedule.createdBy?.name || "—"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/academy/schedules/${schedule._id}/print`}
                  className="rounded-xl bg-navy px-3 py-2 text-sm font-semibold text-blush"
                >
                  Print schedule
                </Link>
                <Link
                  to="/academy/schedules"
                  className="rounded-xl border border-rose/45 bg-white px-3 py-2 text-sm font-semibold text-navy"
                >
                  All schedules
                </Link>
                {schedule.status !== "CANCELLED" ? (
                  <button
                    type="button"
                    onClick={cancel}
                    className="rounded-xl border border-rose/45 bg-white px-3 py-2 text-sm font-semibold text-navy"
                  >
                    Cancel
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={remove}
                  className="rounded-xl border border-rose/60 bg-rose/30 px-3 py-2 text-sm font-semibold text-navy"
                >
                  Delete
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-rose/35 bg-white/90 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-navy">Overall progress</h3>
                  <span
                    className={[
                      "rounded-lg px-2 py-0.5 text-xs font-semibold",
                      statusChipClass(
                        schedule.status === "CANCELLED"
                          ? "default"
                          : summary.overdue > 0
                            ? "OVERDUE"
                            : summary.completed === summary.total &&
                                summary.total > 0
                              ? "COMPLETED"
                              : "PENDING"
                      ),
                    ].join(" ")}
                  >
                    {schedule.status === "CANCELLED"
                      ? "Cancelled"
                      : summary.overdue > 0
                        ? `${summary.overdue} overdue`
                        : summary.completed === summary.total &&
                            summary.total > 0
                          ? "All complete"
                          : "In progress"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate">
                  {summary.roundsCount} round
                  {summary.roundsCount === 1 ? "" : "s"} · {summary.subjectsCount}{" "}
                  subjects · {summary.completed}/{summary.total} tests ready
                </p>
              </div>
              <p className="text-2xl font-semibold text-navy">
                {summary.percent || 0}%
              </p>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-rose/30">
              <div
                className="h-full rounded-full bg-navy"
                style={{ width: `${summary.percent || 0}%` }}
              />
            </div>
          </section>

          {(schedule.rounds || []).map((round) => {
            const dateGroups = groupSubjectsByTestDate(round.subjects || []);
            return (
              <section
                key={round._id}
                className="overflow-hidden rounded-2xl border border-rose/35 bg-white/90"
              >
                <div className="border-b border-rose/30 bg-bg-soft px-4 py-3">
                  <h3 className="font-semibold text-navy">{round.name}</h3>
                  <p className="text-xs text-slate">
                    Grouped by date · teachers + paper status
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-rose/30 text-xs uppercase tracking-wide text-slate">
                        <th className="px-3 py-2 font-semibold">Date</th>
                        <th className="px-3 py-2 font-semibold">Subject</th>
                        {classColumns.map((className) => (
                          <th key={className} className="px-3 py-2 font-semibold">
                            {className}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dateGroups.map((group) =>
                        group.items.map((subject, index) => (
                          <tr
                            key={subject._id}
                            className="border-b border-rose/20 last:border-0"
                          >
                            {index === 0 ? (
                              <td
                                rowSpan={group.items.length}
                                className="align-top px-3 py-2 font-medium text-navy"
                              >
                                {group.label}
                              </td>
                            ) : null}
                            <td className="px-3 py-2 font-medium text-navy">
                              {subject.subjectName}
                            </td>
                            {classColumns.map((className) => {
                              const classItem = (subject.classes || []).find(
                                (c) => c.class?.name === className
                              );
                              if (!classItem) {
                                return (
                                  <td
                                    key={className}
                                    className="px-3 py-2 text-slate"
                                  >
                                    —
                                  </td>
                                );
                              }
                              return (
                                <td key={className} className="px-3 py-2">
                                  <ul className="space-y-1.5">
                                    {(classItem.assignments || []).map((a) => {
                                      const status = resolveAssignmentStatus({
                                        testDate: subject.testDate,
                                        hasCreatedTest: Boolean(
                                          a.test || a.coveredByTest
                                        ),
                                      });
                                      return (
                                        <li
                                          key={a._id}
                                          className="rounded-lg border border-rose/30 bg-bg-soft/70 px-2.5 py-2"
                                        >
                                          <p className="font-medium text-navy">
                                            {a.sectionName || "Section"}
                                            {a.teacher?.name
                                              ? ` · ${a.teacher.name}`
                                              : ""}
                                          </p>
                                          <span
                                            className={[
                                              "mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                                              statusChipClass(status),
                                            ].join(" ")}
                                          >
                                            {status}
                                          </span>
                                          <label className="mt-1.5 block">
                                            <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate">
                                              Syllabus
                                              {savingSyllabusId === a._id
                                                ? " · saving…"
                                                : ""}
                                            </span>
                                            <textarea
                                              key={`${a._id}:${a.syllabusText || ""}`}
                                              defaultValue={a.syllabusText || ""}
                                              rows={2}
                                              placeholder="Add syllabus…"
                                              className="w-full rounded-lg border border-rose/40 bg-white px-2 py-1.5 text-xs text-navy"
                                              onBlur={(e) =>
                                                saveSyllabus(
                                                  a._id,
                                                  e.target.value,
                                                  a.syllabusText
                                                )
                                              }
                                            />
                                          </label>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}

export default AcademyScheduleDetail;
