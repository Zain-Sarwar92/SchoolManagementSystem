import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "../components/ui/toast.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api.js";
import {
  formatScheduleDateShort,
  resolveAssignmentStatus,
  returningDateForTest,
  shortClassLabel,
} from "../utils/testScheduleStatus.js";

const FIELD_OPTIONS = [
  { key: "date", label: "Date" },
  { key: "returnDate", label: "Returning date" },
  { key: "subject", label: "Subject" },
  { key: "teachers", label: "Class teachers" },
  { key: "syllabus", label: "Section syllabus columns" },
  { key: "status", label: "Status" },
];

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sortClassNames(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function sortSectionNames(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function collectClassSections(items) {
  const map = new Map();
  for (const item of items) {
    const set = map.get(item.className) || new Set();
    for (const name of item.sectionNames || []) {
      if (name?.trim()) set.add(name.trim());
    }
    if (!set.size) set.add("General");
    map.set(item.className, set);
  }
  return map;
}

function buildPrintModel(schedule) {
  const allSubjects = (schedule.rounds || []).flatMap((r) => r.subjects || []);
  const classSections = collectClassSections(
    allSubjects.flatMap((subjectItem) =>
      (subjectItem.classes || []).map((classItem) => ({
        className: classItem.class?.name || "—",
        sectionNames: (classItem.assignments || []).map((a) => a.sectionName),
      }))
    )
  );

  const classColumns = [...classSections.keys()].sort(sortClassNames);
  const sectionColumns = classColumns.flatMap((className) => {
    const sections = [...(classSections.get(className) || [])].sort(
      sortSectionNames
    );
    const classShort = shortClassLabel(className);
    return sections.map((sectionName) => ({
      key: `${className}::${sectionName}`,
      className,
      sectionName,
      label: `${classShort} ${sectionName}`,
    }));
  });

  const rows = [];
  const blocks = [];

  for (const round of schedule.rounds || []) {
    blocks.push({
      kind: "round",
      key: `round-${round._id}`,
      title: round.name,
    });

    for (const subjectItem of round.subjects || []) {
      const byClass = {};
      for (const classItem of subjectItem.classes || []) {
        const className = classItem.class?.name || "—";
        const teachers = (classItem.assignments || []).map((assignment) => {
          const status = resolveAssignmentStatus({
            testDate: subjectItem.testDate,
            hasCreatedTest: Boolean(assignment.test || assignment.coveredByTest),
          });
          return {
            assignmentId: String(assignment._id),
            name: assignment.teacher?.name || "—",
            sectionName: assignment.sectionName || "General",
            syllabusText: assignment.syllabusText || "",
            status,
          };
        });
        teachers.sort((a, b) => sortSectionNames(a.sectionName, b.sectionName));
        byClass[className] = { teachers };
      }

      const id = String(subjectItem._id);
      rows.push({
        id,
        dateLabel: formatScheduleDateShort(subjectItem.testDate),
        returnLabel: formatScheduleDateShort(
          returningDateForTest(subjectItem.testDate)
        ),
        subjectName: subjectItem.subjectName,
        byClass,
      });
      blocks.push({ kind: "data", key: `data-${id}`, rowId: id });
    }
  }

  return { classColumns, sectionColumns, rows, blocks };
}

function findSectionEntry(row, className, sectionName) {
  const teachers = row.byClass[className]?.teachers || [];
  return (
    teachers.find(
      (t) => t.sectionName.toLowerCase() === sectionName.toLowerCase()
    ) || null
  );
}

function AcademySchedulePrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [scheduleName, setScheduleName] = useState("");
  const [classColumns, setClassColumns] = useState([]);
  const [sectionColumns, setSectionColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [fields, setFields] = useState({
    date: true,
    returnDate: true,
    subject: true,
    teachers: false,
    syllabus: true,
    status: false,
  });
  const [savingSyllabusId, setSavingSyllabusId] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/schedules/${id}`);
        const model = buildPrintModel(data.schedule);
        setScheduleName(data.schedule.name);
        setClassColumns(model.classColumns);
        setSectionColumns(model.sectionColumns);
        setRows(model.rows);
        setBlocks(model.blocks);
      } catch (err) {
        toast.error(err.response?.data?.message || "Schedule not found");
        navigate("/academy/schedules");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  async function saveSyllabus(assignmentId, syllabusText, previous) {
    const next = String(syllabusText || "").trim();
    const prev = String(previous || "").trim();
    if (!assignmentId || next === prev) return;
    setSavingSyllabusId(assignmentId);
    try {
      await api.patch(`/schedules/assignments/${assignmentId}/syllabus`, {
        syllabusText: next,
      });
      setRows((current) =>
        current.map((row) => ({
          ...row,
          byClass: Object.fromEntries(
            Object.entries(row.byClass || {}).map(([className, cell]) => [
              className,
              {
                teachers: (cell.teachers || []).map((t) =>
                  t.assignmentId === assignmentId
                    ? { ...t, syllabusText: next }
                    : t
                ),
              },
            ])
          ),
        }))
      );
      toast.success("Syllabus saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save syllabus");
    } finally {
      setSavingSyllabusId("");
    }
  }

  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const organizationName = user?.academy?.name || "Academy";

  const selectedCount = FIELD_OPTIONS.filter((f) => fields[f.key]).length;

  const colSpan = useMemo(() => {
    let n = 0;
    if (fields.date) n += 1;
    if (fields.returnDate) n += 1;
    if (fields.subject) n += 1;
    if (fields.teachers) n += classColumns.length;
    if (fields.syllabus) n += sectionColumns.length;
    return Math.max(n, 1);
  }, [fields, classColumns, sectionColumns]);

  function toggle(key) {
    setFields((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  }

  function insertRoundAt(index) {
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index, 0, {
        key: `round-${newKey()}`,
        kind: "round",
        title: "Round 1",
      });
      return next;
    });
  }

  function insertRoundAtTop() {
    setBlocks((prev) => {
      const next = [...prev];
      const firstDataIndex = next.findIndex((b) => b.kind === "data");
      const at = firstDataIndex === -1 ? next.length : firstDataIndex;
      next.splice(at, 0, {
        key: `round-${newKey()}`,
        kind: "round",
        title: "Round 1",
      });
      return next;
    });
  }

  function updateRoundTitle(key, title) {
    setBlocks((prev) =>
      prev.map((block) =>
        block.kind === "round" && block.key === key ? { ...block, title } : block
      )
    );
  }

  function removeRound(key) {
    setBlocks((prev) => prev.filter((block) => block.key !== key));
  }

  const renderItems = useMemo(() => {
    const items = [];
    let index = 0;
    while (index < blocks.length) {
      const block = blocks[index];
      if (block.kind === "round") {
        items.push({ kind: "round", block, index });
        index += 1;
        continue;
      }
      const row = rowById.get(block.rowId);
      if (!row) {
        index += 1;
        continue;
      }
      const entries = [{ key: block.key, row }];
      let next = index + 1;
      while (next < blocks.length) {
        const candidate = blocks[next];
        if (candidate.kind !== "data") break;
        const candidateRow = rowById.get(candidate.rowId);
        if (!candidateRow || candidateRow.dateLabel !== row.dateLabel) break;
        entries.push({ key: candidate.key, row: candidateRow });
        next += 1;
      }
      items.push({
        kind: "group",
        key: block.key,
        dateLabel: row.dateLabel,
        returnLabel: row.returnLabel,
        entries,
        index,
      });
      index = next;
    }
    return items;
  }, [blocks, rowById]);

  function renderRowCells(row) {
    return (
      <>
        {fields.subject ? (
          <td className="schedule-col-subject w-[6.5rem] max-w-[6.5rem] border border-navy/15 px-1.5 py-2 align-top text-xs font-semibold text-navy">
            {row.subjectName}
          </td>
        ) : null}
        {classColumns.map((className) => {
          if (!fields.teachers) return null;
          const cell = row.byClass[className];
          const teacherNames = [
            ...new Set(
              (cell?.teachers || []).map((t) => t.name.trim()).filter(Boolean)
            ),
          ];
          return (
            <td
              key={`${row.id}-${className}-teachers`}
              className="border border-navy/15 px-3 py-2.5 align-top text-navy"
            >
              {teacherNames.length ? (
                <p className="font-semibold text-navy">
                  {teacherNames.join(", ")}
                </p>
              ) : (
                <span className="text-slate">—</span>
              )}
            </td>
          );
        })}
        {sectionColumns.map((sectionCol) => {
          if (!fields.syllabus) return null;
          const entry = findSectionEntry(
            row,
            sectionCol.className,
            sectionCol.sectionName
          );
          return (
            <td
              key={`${row.id}-${sectionCol.key}-syllabus`}
              className="min-w-[8rem] border border-navy/15 px-3 py-2.5 align-top text-navy"
            >
              {!entry ? (
                <span className="text-slate">—</span>
              ) : (
                <div>
                  <textarea
                    key={`${entry.assignmentId}:${entry.syllabusText || ""}`}
                    defaultValue={entry.syllabusText || ""}
                    rows={2}
                    placeholder="Add syllabus…"
                    className="no-print w-full rounded-lg border border-rose/40 bg-bg-soft px-2 py-1.5 text-xs text-navy"
                    onBlur={(e) =>
                      saveSyllabus(
                        entry.assignmentId,
                        e.target.value,
                        entry.syllabusText
                      )
                    }
                  />
                  <p className="print-only-syllabus m-0 text-xs leading-snug text-navy">
                    {entry.syllabusText?.trim()
                      ? entry.syllabusText.trim()
                      : "Not added"}
                  </p>
                  {savingSyllabusId === entry.assignmentId ? (
                    <p className="no-print mt-0.5 text-[10px] text-slate">
                      Saving…
                    </p>
                  ) : null}
                  {fields.status ? (
                    <p className="mt-1 text-[11px] text-slate">{entry.status}</p>
                  ) : null}
                </div>
              )}
            </td>
          );
        })}
      </>
    );
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-slate">
        Loading print preview…
      </div>
    );
  }

  return (
    <div className="print-page schedule-print-page min-h-screen bg-bg-soft px-3 py-4 sm:px-6">
      <div className="print-toolbar no-print mx-auto mb-4 flex max-w-none flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link
            to="/academy/schedules"
            className="rounded-xl border border-rose/45 bg-white px-3 py-2 text-sm font-semibold text-navy"
          >
            All schedules
          </Link>
        </div>
        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={() => window.print()}
          className="rounded-xl bg-navy px-3 py-2 text-sm font-semibold text-blush disabled:opacity-60"
        >
          Print / Save PDF
        </button>
      </div>

      <div className="no-print mx-auto mb-4 max-w-none rounded-2xl border border-rose/35 bg-white p-4 sm:p-5">
        <p className="text-sm font-semibold text-navy">1. Select fields to print</p>
        <p className="mt-1 text-sm text-slate">
          Edit syllabus in the section columns (blur to save). Toggle columns
          below, then Print / Save PDF.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {FIELD_OPTIONS.map((opt) => {
            const checked = fields[opt.key];
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => toggle(opt.key)}
                className={
                  checked
                    ? "rounded-full border border-navy/40 bg-navy/10 px-3.5 py-2 text-sm font-semibold text-navy"
                    : "rounded-full border border-rose/40 bg-white px-3.5 py-2 text-sm font-medium text-slate"
                }
              >
                {checked ? "✓ " : ""}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="no-print mx-auto mb-5 max-w-none rounded-2xl border border-rose/35 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-navy">
              2. Preview — rounds come from the schedule
            </p>
            <p className="mt-1 text-sm text-slate">
              Round headers are loaded from saved rounds. You can still add extra
              divider lines before printing if needed.
            </p>
          </div>
          <button
            type="button"
            onClick={insertRoundAtTop}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose/45 bg-bg-soft px-3 py-2 text-sm font-semibold text-navy"
          >
            <Plus className="size-3.5" />
            Add line at top
          </button>
        </div>
      </div>

      <div className="schedule-print-sheet mx-auto max-w-none rounded-2xl border border-rose/35 bg-white p-5 sm:p-6">
        <div className="mb-4 border-b border-rose/30 pb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate">
            Test Schedule · Preview
          </p>
          <h1 className="mt-1 font-display text-xl font-semibold text-navy">
            {scheduleName}
          </h1>
          <p className="mt-1 text-sm text-slate">{organizationName}</p>
        </div>

        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate">
            No rows to print on this schedule.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="schedule-print-table min-w-full border-collapse text-left text-sm">
              <thead>
                <tr>
                  {fields.date ? (
                    <th className="schedule-col-datepair w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] border border-navy/20 bg-bg-soft px-1.5 py-2 text-xs font-semibold text-navy">
                      Date
                    </th>
                  ) : null}
                  {fields.returnDate ? (
                    <th className="schedule-col-datepair w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] border border-navy/20 bg-bg-soft px-1.5 py-2 text-xs font-semibold text-navy">
                      Returning date
                    </th>
                  ) : null}
                  {fields.subject ? (
                    <th className="schedule-col-subject w-[6.5rem] max-w-[6.5rem] border border-navy/20 bg-bg-soft px-1.5 py-2 text-xs font-semibold text-navy">
                      Subject
                    </th>
                  ) : null}
                  {classColumns.map((className) =>
                    fields.teachers ? (
                      <th
                        key={`${className}-teachers`}
                        className="min-w-[7rem] whitespace-nowrap border border-navy/20 bg-bg-soft px-3 py-2.5 font-semibold text-navy"
                      >
                        {shortClassLabel(className)} Teacher
                      </th>
                    ) : null
                  )}
                  {sectionColumns.map((sectionCol) =>
                    fields.syllabus ? (
                      <th
                        key={`${sectionCol.key}-syllabus`}
                        className="min-w-[7rem] whitespace-nowrap border border-navy/20 bg-bg-soft px-3 py-2.5 font-semibold text-navy"
                      >
                        {sectionCol.label}
                      </th>
                    ) : null
                  )}
                </tr>
              </thead>
              <tbody>
                {renderItems.map((item) => {
                  if (item.kind === "round") {
                    const block = item.block;
                    return (
                      <Fragment key={block.key}>
                        <tr className="schedule-print-round-row">
                          <td
                            colSpan={colSpan}
                            className="border border-navy/20 bg-[#eef6f4] px-3 py-2.5"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                value={block.title}
                                onChange={(e) =>
                                  updateRoundTitle(block.key, e.target.value)
                                }
                                className="no-print h-9 max-w-md rounded-lg border border-navy/25 bg-white px-3 font-semibold text-navy"
                                placeholder="e.g. Round 1 / Mid Term"
                              />
                              <p className="print-only-round-title m-0 text-sm font-bold uppercase tracking-wide text-navy">
                                {block.title.trim() || "Untitled section"}
                              </p>
                              <button
                                type="button"
                                className="no-print inline-flex size-9 items-center justify-center rounded-lg border border-rose/40 bg-white text-[#b42318]"
                                aria-label="Remove round line"
                                onClick={() => removeRound(block.key)}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        <tr className="no-print">
                          <td colSpan={colSpan} className="border-0 px-0 py-1">
                            <button
                              type="button"
                              onClick={() => insertRoundAt(item.index + 1)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-navy hover:bg-blush/50"
                            >
                              <Plus className="size-3" />
                              Add line below
                            </button>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  }

                  return (
                    <Fragment key={item.key}>
                      {item.entries.map((entry, entryIndex) => (
                        <tr key={entry.key}>
                          {fields.date && entryIndex === 0 ? (
                            <td
                              rowSpan={item.entries.length}
                              className="schedule-col-datepair w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] border border-navy/15 px-1.5 py-2 align-top text-xs text-navy"
                            >
                              {item.dateLabel}
                            </td>
                          ) : null}
                          {fields.returnDate && entryIndex === 0 ? (
                            <td
                              rowSpan={item.entries.length}
                              className="schedule-col-datepair w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] border border-navy/15 px-1.5 py-2 align-top text-xs text-navy"
                            >
                              {item.returnLabel}
                            </td>
                          ) : null}
                          {renderRowCells(entry.row)}
                        </tr>
                      ))}
                      <tr className="no-print">
                        <td colSpan={colSpan} className="border-0 px-0 py-1">
                          <button
                            type="button"
                            onClick={() =>
                              insertRoundAt(item.index + item.entries.length)
                            }
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-navy hover:bg-blush/50"
                          >
                            <Plus className="size-3" />
                            Add line below
                          </button>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="print-screen-hint no-print mx-auto mt-4 max-w-none text-sm text-slate">
        Review the preview, edit round lines if needed, then Print / Save PDF.
        What you see on screen (selected fields and round lines) is what will
        print.
      </p>
    </div>
  );
}

export default AcademySchedulePrint;
