import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { toast } from "../components/ui/toast.jsx";
import api from "../services/api.js";
import {
  cleanFatherName,
  cleanStudentName,
  formatMarks,
  shortGroupLabel,
} from "../utils/resultPrint.js";

function AcademyResultGazettePrint() {
  const { sectionId, examId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(
          `/results/sections/${sectionId}/exams/${examId}/gazette`
        );
        if (!cancelled) setPayload(data);
      } catch (err) {
        if (!cancelled) {
          toast.error(err.response?.data?.message || "Failed to load gazette");
          navigate(`/academy/results/sections/${sectionId}/exams/${examId}`, {
            replace: true,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sectionId, examId, navigate]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-slate">
        Loading gazette…
      </div>
    );
  }

  if (!payload) return null;

  const { academy, section, exam, columns, rows } = payload;
  const complete = rows.filter((row) => row.complete).length;
  const passed = rows.filter((row) => row.passed).length;
  const backHref = `/academy/results/sections/${sectionId}/exams/${examId}`;

  return (
    <div className="print-page student-list-print min-h-screen bg-bg-soft px-3 py-4 sm:px-6">
      <div className="no-print mx-auto mb-4 flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <Link
          to={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate hover:text-navy"
        >
          <ArrowLeft className="size-4" />
          Back to exam
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-blush"
        >
          <Printer className="size-4" />
          Print / Save PDF
        </button>
      </div>

      <article className="student-list-sheet mx-auto max-w-6xl rounded-2xl border border-rose/40 bg-white p-4 shadow-sm sm:p-6">
        <header className="mb-4 border-b border-rose/40 pb-4 text-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {academy?.logo ? (
              <img
                src={academy.logo}
                alt=""
                className="size-14 object-contain"
              />
            ) : null}
            <div>
              <h1 className="font-display text-2xl font-semibold text-navy">
                {academy?.name || "Academy"}
              </h1>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate">
                Result Sheet
              </p>
            </div>
          </div>
          <p className="mt-2 font-display text-lg text-navy">{exam.name}</p>
          <dl className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-slate">
            <div>
              <dt className="inline font-medium text-navy">Class: </dt>
              <dd className="inline">{section?.class?.name}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-navy">Section: </dt>
              <dd className="inline">{section?.name}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-navy">Session: </dt>
              <dd className="inline">{exam.session}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-navy">Passed: </dt>
              <dd className="inline">
                {passed}/{complete}
              </dd>
            </div>
          </dl>
        </header>

        {columns.length === 0 ? (
          <p className="py-8 text-center text-slate">No subject marks entered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="gazette-table w-full border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-blush/50 text-navy">
                  <th className="border border-rose/40 px-2 py-1.5">Roll</th>
                  <th className="border border-rose/40 px-2 py-1.5">Student</th>
                  <th className="border border-rose/40 px-2 py-1.5">Father</th>
                  <th className="border border-rose/40 px-2 py-1.5">Group</th>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className="border border-rose/40 px-2 py-1.5 text-center"
                    >
                      {column.label}
                    </th>
                  ))}
                  <th className="border border-rose/40 px-2 py-1.5">T.Marks</th>
                  <th className="border border-rose/40 px-2 py-1.5">Obt</th>
                  <th className="border border-rose/40 px-2 py-1.5">%</th>
                  <th className="border border-rose/40 px-2 py-1.5">Pos</th>
                  <th className="border border-rose/40 px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="odd:bg-white even:bg-blush/20">
                    <td className="border border-rose/30 px-2 py-1 font-medium">
                      {row.rollNumber}
                    </td>
                    <td className="border border-rose/30 px-2 py-1 whitespace-nowrap">
                      {cleanStudentName(row.name)}
                    </td>
                    <td className="border border-rose/30 px-2 py-1 whitespace-nowrap">
                      {cleanFatherName(row.fatherName)}
                    </td>
                    <td className="border border-rose/30 px-2 py-1 text-center">
                      {shortGroupLabel(row.group)}
                    </td>
                    {row.cells.map((cell, i) => (
                      <td
                        key={`${row.id}-${columns[i]?.key || i}`}
                        className="border border-rose/30 px-2 py-1 text-center"
                      >
                        {cell.display}
                      </td>
                    ))}
                    <td className="border border-rose/30 px-2 py-1 text-center">
                      {row.maxTotal > 0 ? formatMarks(row.maxTotal) : "—"}
                    </td>
                    <td className="border border-rose/30 px-2 py-1 text-center font-medium">
                      {row.maxTotal > 0 ? formatMarks(row.obtainedTotal) : "—"}
                    </td>
                    <td className="border border-rose/30 px-2 py-1 text-center">
                      {row.percent == null ? "—" : formatMarks(row.percent)}
                    </td>
                    <td className="border border-rose/30 px-2 py-1 text-center font-medium">
                      {row.position ?? "—"}
                    </td>
                    <td className="border border-rose/30 px-2 py-1 text-center">
                      {!row.complete
                        ? "—"
                        : row.passed
                          ? "Pass"
                          : "Fail"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="mt-10 grid gap-8 text-sm text-slate sm:grid-cols-3">
          <div className="border-t border-navy/40 pt-2 text-center">Checked by</div>
          <div className="border-t border-navy/40 pt-2 text-center">Controller</div>
          <div className="border-t border-navy/40 pt-2 text-center">Principal</div>
        </footer>
      </article>
    </div>
  );
}

export default AcademyResultGazettePrint;
