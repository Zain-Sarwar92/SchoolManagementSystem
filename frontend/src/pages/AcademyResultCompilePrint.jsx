import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { toast } from "../components/ui/toast.jsx";
import api from "../services/api.js";
import {
  cleanFatherName,
  cleanStudentName,
  formatMarks,
  shortGroupLabel,
  shortRoundLabel,
} from "../utils/resultPrint.js";

function GazetteSheet({ academy, sheet, session, passPercent }) {
  const complete = (sheet.rows || []).filter((row) => row.complete).length;
  const passed = (sheet.rows || []).filter((row) => row.passed).length;
  const columns = sheet.columns || [];
  const rows = sheet.rows || [];
  const multiRound = Boolean(
    sheet.multiRound && columns.some((column) => column.rounds?.length)
  );
  const multiSection = Boolean(sheet.multiSection);
  const sectionHeader =
    (sheet.sections || []).map((s) => s.name).join(" + ") ||
    sheet.section?.name ||
    "—";

  const identityHeaders = (
    <>
      <th
        rowSpan={multiRound ? 2 : undefined}
        className="border border-rose/40 px-1.5 py-1.5"
      >
        Roll
      </th>
      <th
        rowSpan={multiRound ? 2 : undefined}
        className="border border-rose/40 px-1.5 py-1.5"
      >
        Student
      </th>
      <th
        rowSpan={multiRound ? 2 : undefined}
        className="border border-rose/40 px-1.5 py-1.5"
      >
        Father
      </th>
      <th
        rowSpan={multiRound ? 2 : undefined}
        className="border border-rose/40 px-1.5 py-1.5"
      >
        Group
      </th>
      {multiSection ? (
        <th
          rowSpan={multiRound ? 2 : undefined}
          className="border border-rose/40 px-1.5 py-1.5"
        >
          Sec
        </th>
      ) : null}
    </>
  );

  const summaryHeaders = (
    <>
      <th
        rowSpan={multiRound ? 2 : undefined}
        className="border border-rose/40 px-1.5 py-1.5"
      >
        T.Marks
      </th>
      <th
        rowSpan={multiRound ? 2 : undefined}
        className="border border-rose/40 px-1.5 py-1.5"
      >
        Obt
      </th>
      <th
        rowSpan={multiRound ? 2 : undefined}
        className="border border-rose/40 px-1.5 py-1.5"
      >
        %
      </th>
      <th
        rowSpan={multiRound ? 2 : undefined}
        className="border border-rose/40 px-1.5 py-1.5"
      >
        Pos
      </th>
      <th
        rowSpan={multiRound ? 2 : undefined}
        className="border border-rose/40 px-1.5 py-1.5"
      >
        Status
      </th>
    </>
  );

  return (
    <article className="student-list-sheet compile-sheet mx-auto max-w-6xl rounded-2xl border border-rose/40 bg-white p-4 shadow-sm sm:p-6">
      <header className="mb-4 border-b border-rose/40 pb-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {academy?.logo ? (
            <img src={academy.logo} alt="" className="size-14 object-contain" />
          ) : null}
          <div>
            <h1 className="font-display text-2xl font-semibold text-navy">
              {academy?.name || "Academy"}
            </h1>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate">
              {sheet.combined || multiSection
                ? "Combined Result Sheet"
                : "Result Sheet"}
            </p>
          </div>
        </div>
        <p className="mt-2 font-display text-lg text-navy">
          {sheet.examLabel || "Exam"}
        </p>
        <dl className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-slate">
          <div>
            <dt className="inline font-medium text-navy">Class: </dt>
            <dd className="inline">{sheet.section?.class?.name}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-navy">
              {multiSection ? "Sections: " : "Section: "}
            </dt>
            <dd className="inline">{sectionHeader}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-navy">Session: </dt>
            <dd className="inline">{session}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-navy">Pass %: </dt>
            <dd className="inline">{passPercent}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-navy">Passed: </dt>
            <dd className="inline">
              {passed}/{complete}
            </dd>
          </div>
        </dl>
      </header>

      {sheet.empty || columns.length === 0 ? (
        <p className="py-8 text-center text-slate">
          {sheet.message || "No subject marks entered yet."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="gazette-table w-full border-collapse text-left text-[11px] sm:text-xs">
            <thead>
              {multiRound ? (
                <>
                  <tr className="bg-blush/50 text-navy">
                    {identityHeaders}
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        colSpan={Math.max(column.rounds?.length || 1, 1)}
                        className="border border-rose/40 px-1.5 py-1.5 text-center"
                      >
                        {column.label}
                      </th>
                    ))}
                    {summaryHeaders}
                  </tr>
                  <tr className="bg-blush/30 text-navy">
                    {columns.flatMap((column) =>
                      (column.rounds || []).map((round) => (
                        <th
                          key={`${column.key}:${round.id}`}
                          className="border border-rose/40 px-1 py-1 text-center font-medium"
                          title={round.label}
                        >
                          {shortRoundLabel(round.label)}
                        </th>
                      ))
                    )}
                  </tr>
                </>
              ) : (
                <tr className="bg-blush/50 text-navy">
                  {identityHeaders}
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className="border border-rose/40 px-1.5 py-1.5 text-center"
                    >
                      {column.label}
                    </th>
                  ))}
                  {summaryHeaders}
                </tr>
              )}
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="odd:bg-white even:bg-blush/20">
                  <td className="border border-rose/30 px-1.5 py-1 font-medium">
                    {row.rollNumber}
                  </td>
                  <td className="border border-rose/30 px-1.5 py-1 whitespace-nowrap">
                    {cleanStudentName(row.name)}
                  </td>
                  <td className="border border-rose/30 px-1.5 py-1 whitespace-nowrap">
                    {cleanFatherName(row.fatherName)}
                  </td>
                  <td className="border border-rose/30 px-1.5 py-1 text-center">
                    {shortGroupLabel(row.group)}
                  </td>
                  {multiSection ? (
                    <td className="border border-rose/30 px-1.5 py-1 text-center">
                      {row.sectionName || "—"}
                    </td>
                  ) : null}
                  {multiRound
                    ? (row.breakdown || []).flatMap((cell) =>
                        (cell.roundValues || []).map((value) => (
                          <td
                            key={`${row.id}:${cell.key}:${value.roundId}`}
                            className="border border-rose/30 px-1 py-1 text-center"
                          >
                            {value.display}
                          </td>
                        ))
                      )
                    : row.cells.map((cell, i) => (
                        <td
                          key={`${row.id}-${columns[i]?.key || i}`}
                          className="border border-rose/30 px-1.5 py-1 text-center"
                        >
                          {cell.display}
                        </td>
                      ))}
                  <td className="border border-rose/30 px-1.5 py-1 text-center">
                    {row.maxTotal > 0 ? formatMarks(row.maxTotal) : "—"}
                  </td>
                  <td className="border border-rose/30 px-1.5 py-1 text-center font-medium">
                    {row.maxTotal > 0 ? formatMarks(row.obtainedTotal) : "—"}
                  </td>
                  <td className="border border-rose/30 px-1.5 py-1 text-center">
                    {row.percent == null ? "—" : formatMarks(row.percent)}
                  </td>
                  <td className="border border-rose/30 px-1.5 py-1 text-center font-medium">
                    {row.position ?? "—"}
                  </td>
                  <td className="border border-rose/30 px-1.5 py-1 text-center">
                    {!row.complete ? "—" : row.passed ? "Pass" : "Fail"}
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
  );
}

function AcademyResultCompilePrint() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);

  const sectionIds = useMemo(
    () =>
      (searchParams.get("sections") || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    [searchParams]
  );
  const examIds = useMemo(
    () =>
      (searchParams.get("exams") || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    [searchParams]
  );
  const combineSections = useMemo(() => {
    const raw = (searchParams.get("combine") || "").toLowerCase();
    return raw === "1" || raw === "true" || raw === "yes";
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sectionIds.length || !examIds.length) {
        toast.error("Select at least one section and one exam");
        navigate("/academy/results", { replace: true });
        return;
      }
      setLoading(true);
      try {
        const { data } = await api.post("/results/compile", {
          sectionIds,
          examIds,
          combineSections: combineSections && sectionIds.length > 1,
        });
        if (!cancelled) setPayload(data);
      } catch (err) {
        if (!cancelled) {
          toast.error(err.response?.data?.message || "Failed to compile results");
          navigate("/academy/results", { replace: true });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sectionIds, examIds, combineSections, navigate]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-slate">
        Compiling results…
      </div>
    );
  }

  if (!payload) return null;

  const { academy, sheets, session, passPercent, exams, skippedSections } =
    payload;
  const skipped = skippedSections || [];

  return (
    <div className="print-page student-list-print min-h-screen bg-bg-soft px-3 py-4 sm:px-6">
      <style>{`
        @media print {
          .compile-sheet { break-after: page; page-break-after: always; }
          .compile-sheet:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
      <div className="no-print mx-auto mb-4 flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <Link
          to="/academy/results"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate hover:text-navy"
        >
          <ArrowLeft className="size-4" />
          Back to results
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

      <div className="no-print mx-auto mb-4 max-w-6xl rounded-xl border border-rose/40 bg-white/80 px-4 py-3 text-sm text-slate">
        {(exams || []).map((e) => e.name).join(" + ") || "Exams"} ·{" "}
        {(sheets || []).length} section sheet
        {(sheets || []).length === 1 ? "" : "s"}
        {skipped.length
          ? ` · ${skipped.length} empty section${skipped.length === 1 ? "" : "s"} skipped`
          : ""}
      </div>

      {skipped.length ? (
        <div className="no-print mx-auto mb-4 max-w-6xl rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-navy">
          <p className="font-semibold">Skipped (no entered marks)</p>
          <p className="mt-1 text-slate">
            {skipped
              .map((s) =>
                [s.className, s.name].filter(Boolean).join(" "),
              )
              .join(" · ")}
          </p>
        </div>
      ) : null}

      <div className="space-y-6">
        {(sheets || []).map((sheet) => (
          <GazetteSheet
            key={sheet.section?._id || sheet.examLabel}
            academy={academy}
            sheet={sheet}
            session={session}
            passPercent={passPercent}
          />
        ))}
      </div>
    </div>
  );
}

export default AcademyResultCompilePrint;
