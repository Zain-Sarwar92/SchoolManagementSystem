import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { useAcademyNav } from "../hooks/useAcademyNav.js";
import { toast } from "../components/ui/toast.jsx";
import api from "../services/api.js";
import { addWorkingDaysYmd } from "../utils/scheduleWorkingDays.js";

function sortByName(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** Local calendar today as YYYY-MM-DD (for date inputs / comparisons). */
function todayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function AcademyScheduleNew() {
  const navItems = useAcademyNav();
  const navigate = useNavigate();
  const [catalogClasses, setCatalogClasses] = useState([]);
  const [hasAnySection, setHasAnySection] = useState(true);
  const [testGeneratorOnly, setTestGeneratorOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  const [name, setName] = useState("");
  const [classIds, setClassIds] = useState([]);
  const [sectionIds, setSectionIds] = useState([]);
  const [subjectNames, setSubjectNames] = useState([]);
  const [subjectDates, setSubjectDates] = useState({});
  const [roundCount, setRoundCount] = useState(1);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/schedules/catalog");
        const classes = (data.catalog || []).flatMap((board) => board.classes || []);
        // Dedupe by classId if multiple boards ever appear
        const byId = new Map();
        for (const klass of classes) byId.set(klass.classId, klass);
        const sorted = [...byId.values()].sort((a, b) =>
          sortByName(a.className, b.className)
        );
        setCatalogClasses(sorted);
        setHasAnySection(Boolean(data.hasAnySection));
        setTestGeneratorOnly(Boolean(data.testGeneratorOnly));
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load catalog");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedClasses = useMemo(
    () =>
      catalogClasses
        .filter((row) => classIds.includes(row.classId))
        .sort((a, b) => sortByName(a.className, b.className)),
    [catalogClasses, classIds]
  );

  const sectionIdSet = useMemo(() => new Set(sectionIds), [sectionIds]);

  const availableSubjects = useMemo(() => {
    const names = new Set();
    for (const classItem of selectedClasses) {
      for (const subject of classItem.subjects) names.add(subject.subjectName);
    }
    return [...names].sort(sortByName);
  }, [selectedClasses]);

  function toggleClass(id) {
    setClassIds((current) => {
      const next = current.includes(id)
        ? current.filter((row) => row !== id)
        : [...current, id];
      const selected = catalogClasses.filter((c) => next.includes(c.classId));
      // Test Generator–only: auto-pick default sections (no Sections module)
      if (testGeneratorOnly) {
        setSectionIds(selected.flatMap((c) => c.sections.map((s) => s.id)));
      } else {
        const allowedSections = new Set(
          selected.flatMap((c) => c.sections.map((s) => s.id))
        );
        setSectionIds((sections) =>
          sections.filter((sid) => allowedSections.has(sid))
        );
      }
      setSubjectNames([]);
      setSubjectDates({});
      return next;
    });
  }

  function toggleSection(id) {
    setSectionIds((current) =>
      current.includes(id)
        ? current.filter((row) => row !== id)
        : [...current, id]
    );
  }

  function toggleSubject(subjectName) {
    setSubjectNames((current) => {
      if (current.includes(subjectName)) {
        setSubjectDates((dates) => {
          const next = { ...dates };
          delete next[subjectName];
          return next;
        });
        return current.filter((row) => row !== subjectName);
      }
      return [...current, subjectName].sort(sortByName);
    });
  }

  function selectAllSubjects() {
    if (!availableSubjects.length) {
      toast.error("No subjects available for selected classes");
      return;
    }
    setSubjectNames([...availableSubjects].sort(sortByName));
  }

  function clearSubjects() {
    setSubjectNames([]);
    setSubjectDates({});
  }

  function buildPayload() {
    if (name.trim().length < 2) throw new Error("Enter a schedule name.");
    if (!classIds.length) throw new Error("Select at least one class.");
    if (!sectionIds.length) throw new Error("Select at least one section.");
    if (!subjectNames.length) throw new Error("Select at least one subject.");

    const minDate = todayYmd();
    for (const subjectName of subjectNames) {
      const dateValue = subjectDates[subjectName]?.trim();
      if (!dateValue) {
        throw new Error(`Set a date for ${subjectName}.`);
      }
      if (dateValue < minDate) {
        throw new Error(
          `${subjectName}: test date must be today or a future date.`
        );
      }
    }

    const rounds = Array.from(
      { length: Math.max(1, roundCount) },
      (_, order) => {
        const subjects = subjectNames.map((subjectName) => {
          const baseDate = subjectDates[subjectName].trim();
          const testDate =
            order === 0 ? baseDate : addWorkingDaysYmd(baseDate, order * 7);
          if (testDate < minDate) {
            throw new Error(
              `${subjectName} (Round ${order + 1}): date must be today or a future date.`
            );
          }

          const classAssignments = selectedClasses
            .map((classItem) => {
              const subject = classItem.subjects.find(
                (s) => s.subjectName === subjectName
              );
              if (!subject) return null;
              const sections = classItem.sections.filter((s) =>
                sectionIdSet.has(s.id)
              );
              if (!sections.length) return null;
              return {
                classId: classItem.classId,
                subjectId: subject.subjectId,
                sectionAssignments: sections.map((section) => ({
                  sectionId: section.id,
                  teacherId:
                    subject.teachersBySectionId[section.id]?.[0]?.id || null,
                })),
              };
            })
            .filter(Boolean);

          if (!classAssignments.length) {
            throw new Error(`${subjectName}: no class/section mapping.`);
          }

          return { subjectName, testDate, classAssignments };
        });

        return {
          name: `Round ${order + 1}`,
          order,
          subjects,
        };
      }
    );

    return { name: name.trim(), rounds };
  }

  async function onSubmit() {
    try {
      const payload = buildPayload();
      setPending(true);
      const { data } = await api.post("/schedules", payload);
      toast.success("Schedule created.");
      navigate(`/academy/schedules/${data.schedule._id}/print`);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to create schedule."
      );
    } finally {
      setPending(false);
    }
  }

  const chipOn =
    "rounded-xl border border-navy/40 bg-navy/10 px-3 py-2 text-sm font-semibold text-navy";
  const chipOff =
    "rounded-xl border border-rose/35 bg-bg-soft/80 px-3 py-2 text-sm font-medium text-slate";

  return (
    <DashboardLayout title="Create schedule" navItems={navItems}>
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl font-semibold text-navy">
              Create Test Schedule
            </h2>
            <p className="text-sm text-slate">
              {testGeneratorOnly
                ? "Pick class, subjects, and dates — like a paper generator schedule."
                : "Name, classes, sections, subjects, dates — teachers optional."}
            </p>
          </div>
          <Link
            to="/academy/schedules"
            className="rounded-xl border border-rose/45 bg-white px-3 py-2 text-sm font-semibold text-navy"
          >
            Back
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-slate">Loading catalog…</p>
        ) : !hasAnySection && !testGeneratorOnly ? (
          <div className="rounded-2xl border border-rose/35 bg-white p-8 text-center">
            <p className="font-semibold text-navy">No sections yet</p>
            <p className="mt-1 text-sm text-slate">
              Create sections before building a schedule.
            </p>
            <Link
              to="/academy/sections"
              className="mt-4 inline-flex rounded-xl bg-navy px-3 py-2 text-sm font-semibold text-blush"
            >
              Create Section
            </Link>
          </div>
        ) : catalogClasses.length === 0 ? (
          <div className="rounded-2xl border border-rose/35 bg-white p-8 text-center">
            <p className="font-semibold text-navy">No curriculum yet</p>
            <p className="mt-1 text-sm text-slate">
              {testGeneratorOnly
                ? "Curriculum could not be loaded. Refresh and try again."
                : "Add active classes with sections first."}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-rose/35 bg-white p-5 sm:p-6">
            <div className="space-y-5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate">
                  Schedule name *
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mid Term / Round tests"
                  className="h-11 w-full rounded-xl border border-rose/50 bg-bg-soft px-3"
                />
              </label>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">
                  Classes *
                </p>
                <div className="flex flex-wrap gap-2">
                  {catalogClasses.map((klass) => {
                    const on = classIds.includes(klass.classId);
                    return (
                      <button
                        key={klass.classId}
                        type="button"
                        onClick={() => toggleClass(klass.classId)}
                        className={on ? chipOn : chipOff}
                      >
                        {klass.className}
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedClasses.length && !testGeneratorOnly ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">
                    Sections *
                  </p>
                  <div className="space-y-3">
                    {selectedClasses.map((klass) => (
                      <div key={klass.classId}>
                        <p className="mb-1.5 text-sm font-semibold text-navy">
                          {klass.className}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {klass.sections.map((section) => {
                            const on = sectionIds.includes(section.id);
                            return (
                              <button
                                key={section.id}
                                type="button"
                                onClick={() => toggleSection(section.id)}
                                className={on ? chipOn : chipOff}
                              >
                                {section.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {sectionIds.length || (testGeneratorOnly && classIds.length) ? (
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate">
                      Subjects *
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={selectAllSubjects}
                        className="rounded-lg border border-navy/30 bg-navy/5 px-2.5 py-1 text-xs font-semibold text-navy"
                      >
                        Select all
                        {availableSubjects.length
                          ? ` (${availableSubjects.length})`
                          : ""}
                      </button>
                      {subjectNames.length ? (
                        <button
                          type="button"
                          onClick={clearSubjects}
                          className="rounded-lg border border-rose/40 bg-white px-2.5 py-1 text-xs font-semibold text-slate"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableSubjects.map((subjectName) => {
                      const on = subjectNames.includes(subjectName);
                      return (
                        <button
                          key={subjectName}
                          type="button"
                          onClick={() => toggleSubject(subjectName)}
                          className={on ? chipOn : chipOff}
                        >
                          {subjectName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {subjectNames.length ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">
                    Subject dates (Round 1) *
                  </p>
                  <p className="mb-2 text-xs text-slate">
                    Dates must be today or later.
                  </p>
                  <div className="overflow-hidden rounded-xl border border-rose/35">
                    <div className="hidden grid-cols-[minmax(0,1fr)_minmax(9rem,11rem)] gap-0 border-b border-rose/30 bg-bg-soft px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate sm:grid">
                      <span>Subject</span>
                      <span>Date</span>
                    </div>
                    <ul className="divide-y divide-rose/25">
                      {subjectNames.map((subjectName) => (
                        <li
                          key={subjectName}
                          className="grid grid-cols-1 items-stretch gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,11rem)] sm:items-center sm:gap-0"
                        >
                          <span className="truncate text-sm font-semibold text-navy sm:pr-3">
                            {subjectName}
                          </span>
                          <input
                            type="date"
                            min={todayYmd()}
                            value={subjectDates[subjectName] || ""}
                            onChange={(e) =>
                              setSubjectDates((current) => ({
                                ...current,
                                [subjectName]: e.target.value,
                              }))
                            }
                            className="h-10 w-full rounded-lg border border-rose/50 bg-bg-soft px-2 text-sm text-navy"
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              <label className="block max-w-[12rem]">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate">
                  Rounds
                </span>
                <input
                  type="number"
                  min={1}
                  value={roundCount}
                  onChange={(e) =>
                    setRoundCount(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="h-11 w-full rounded-xl border border-rose/50 bg-bg-soft px-3"
                />
                <span className="mt-1 block text-xs text-slate">
                  Round 2+ dates = +7 working days each (Sundays skipped).
                </span>
              </label>

              <button
                type="button"
                onClick={onSubmit}
                disabled={pending}
                className="w-full rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-blush disabled:opacity-60 sm:w-auto"
              >
                {pending ? "Creating…" : "Create schedule"}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default AcademyScheduleNew;
