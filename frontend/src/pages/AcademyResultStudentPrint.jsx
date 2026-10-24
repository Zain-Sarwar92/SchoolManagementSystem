import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { toast } from "../components/ui/toast.jsx";
import api from "../services/api.js";
import {
  cleanFatherName,
  cleanStudentName,
  formatMarks,
  shortRoundLabel,
} from "../utils/resultPrint.js";

function gradeFromPercent(percent) {
  if (percent == null) return "—";
  if (percent >= 80) return "A+";
  if (percent >= 70) return "A";
  if (percent >= 60) return "B";
  if (percent >= 50) return "C";
  if (percent >= 40) return "D";
  return "F";
}

function percentOf(obtained, total) {
  if (!total || total <= 0) return null;
  return Math.round((obtained / total) * 1000) / 10;
}

/** Build one subject row with R1 / R2 / R3 marks in the same line. */
function buildMultiRoundSubjects(exams, passPercent = 33) {
  const subjectNames = [
    ...new Set(
      exams.flatMap((exam) => (exam.subjects || []).map((s) => s.name)),
    ),
  ].sort((a, b) => a.localeCompare(b));

  return subjectNames.map((name) => {
    const roundCells = exams.map((exam) => {
      const subject = (exam.subjects || []).find((s) => s.name === name);
      const entered = Boolean(
        subject &&
          (subject.entered ||
            subject.isAbsent ||
            subject.obtained != null),
      );
      return {
        examId: String(exam._id),
        display: subject?.displayObtained ?? "—",
        obtained:
          !subject || subject.isAbsent || subject.obtained == null
            ? null
            : Number(subject.obtained),
        total: subject ? Number(subject.total) || 0 : 0,
        isAbsent: Boolean(subject?.isAbsent),
        entered,
        // Round with no assessment for this subject does not block completeness
        expected: Boolean(subject),
      };
    });

    const expected = roundCells.filter((cell) => cell.expected);
    // Dash and Abs both count as 0
    const obtainedTotal = expected.reduce((sum, cell) => {
      if (!cell.entered || cell.isAbsent || cell.obtained == null) return sum;
      return sum + (cell.obtained ?? 0);
    }, 0);
    const maxTotal = expected.reduce((sum, cell) => sum + cell.total, 0);
    const allAbsent =
      expected.length > 0 && expected.every((c) => c.isAbsent);
    const allZero =
      expected.length > 0 &&
      expected.every(
        (c) => !c.entered || c.isAbsent || c.obtained == null,
      );
    const percent =
      maxTotal > 0 ? percentOf(obtainedTotal, maxTotal) : null;
    // Abs or any dash → subject FAIL (same calculation)
    const status = allAbsent
      ? "ABSENT"
      : allZero || (percent != null && percent < passPercent)
        ? "FAIL"
        : percent == null
          ? "—"
          : "PASS";

    return {
      name,
      roundDisplays: roundCells.map((c) => c.display),
      maxTotal,
      obtainedTotal,
      percent,
      grade: gradeFromPercent(percent),
      status,
      complete: expected.length > 0,
      displayTotal: maxTotal > 0 ? formatMarks(maxTotal) : "—",
      displayObtained: allAbsent
        ? "Abs"
        : allZero
          ? "—"
          : formatMarks(obtainedTotal),
      displayPercent: percent == null ? "—" : formatMarks(percent),
    };
  });
}

function StudentReportSheet({ academy, student, session, exams, accumulative }) {
  const multiRound = exams.length > 1;
  const examTitle = multiRound
    ? exams.map((e) => shortRoundLabel(e.name)).join(" + ")
    : exams[0]?.name || "Overall";
  const passPercent = exams.length
    ? Math.min(...exams.map((e) => Number(e.passPercent) || 33))
    : 33;

  const subjects = useMemo(() => {
    if (!exams.length) return [];
    if (!multiRound) {
      return (exams[0].subjects || []).map((subject) => ({
        name: subject.name,
        roundDisplays: [],
        maxTotal: subject.total,
        obtainedTotal: subject.obtained,
        percent: subject.percent,
        grade: subject.grade,
        status: subject.status,
        displayTotal: subject.displayTotal,
        displayObtained: subject.displayObtained,
        displayPercent: subject.displayPercent,
      }));
    }
    return buildMultiRoundSubjects(exams, passPercent);
  }, [exams, multiRound, passPercent]);

  const totals = useMemo(() => {
    if (!multiRound && exams[0]) {
      return {
        maxTotal: exams[0].maxTotal,
        obtainedTotal: exams[0].obtainedTotal,
        percent: exams[0].percent,
        grade: exams[0].grade,
        passed: exams[0].passed,
        displayTotal: exams[0].displayTotal,
        displayObtained: exams[0].displayObtained,
        displayPercent: exams[0].displayPercent,
      };
    }
    const obtainedTotal = subjects.reduce((sum, s) => {
      if (s.status === "ABSENT" || s.status === "FAIL") {
        // FAIL may include dash/abs zeros already in obtainedTotal
      }
      return sum + (Number(s.obtainedTotal) || 0);
    }, 0);
    const maxTotal = subjects.reduce(
      (sum, s) => sum + (Number(s.maxTotal) || 0),
      0,
    );
    // Dash and Abs both fail the subject — overall PASS only if every subject PASS
    const allSubjectsPass = subjects.every((s) => s.status === "PASS");
    const percent =
      maxTotal > 0 ? percentOf(obtainedTotal, maxTotal) : null;
    const passed =
      subjects.length > 0 &&
      allSubjectsPass &&
      percent != null &&
      percent >= passPercent;
    return {
      maxTotal,
      obtainedTotal,
      percent,
      grade: gradeFromPercent(percent),
      passed,
      displayTotal: maxTotal > 0 ? formatMarks(maxTotal) : "—",
      displayObtained: formatMarks(obtainedTotal),
      displayPercent: percent == null ? "—" : formatMarks(percent),
    };
  }, [subjects, passPercent, multiRound, exams]);

  const roundHeaders = exams.map((exam) => shortRoundLabel(exam.name));
  const accumulativeRows =
    accumulative?.length > 0 ? accumulative : exams;

  return (
    <article className="school-rc-sheet">
      <header className="school-rc-header">
        {academy?.logo ? (
          <img src={academy.logo} alt="" className="school-rc-logo" />
        ) : (
          <div className="school-rc-logo-fallback" aria-hidden>
            {(academy?.name || "AC").slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="school-rc-header-text">
          <h1>{academy?.name || "Academy"}</h1>
          {academy?.address ? (
            <p className="school-rc-address">{academy.address}</p>
          ) : null}
          {academy?.phone ? <p>Phone: {academy.phone}</p> : null}
        </div>
      </header>

      <h2 className="school-rc-title">Exams Result Report ({examTitle})</h2>

      <table className="school-rc-student">
        <tbody>
          <tr>
            <th>Student Name</th>
            <td>{cleanStudentName(student?.name)}</td>
            <th>Class</th>
            <td>{student?.class?.name || "—"}</td>
          </tr>
          <tr>
            <th>Father Name</th>
            <td>{cleanFatherName(student?.fatherName) || "—"}</td>
            <th>Section</th>
            <td>{student?.section?.name || "—"}</td>
          </tr>
          <tr>
            <th>Registration</th>
            <td>{student?.rollNumber || "—"}</td>
            <th>Session</th>
            <td>{session || "—"}</td>
          </tr>
        </tbody>
      </table>

      <h3 className="school-rc-section-title">Subjects Evaluation Sheet</h3>
      {subjects.length === 0 ? (
        <p className="school-rc-empty">
          No subject marks for the selected rounds.
        </p>
      ) : (
        <>
          <div className="school-rc-table-scroll">
            <table className="school-rc-table">
              <thead>
                <tr>
                  <th className="col-num">#</th>
                  <th>Exam Subjects</th>
                  {multiRound
                    ? roundHeaders.map((label, i) => (
                        <th key={`${exams[i]._id}:h`}>{label}</th>
                      ))
                    : null}
                  <th>T-Marks</th>
                  <th>O-Marks</th>
                  <th>%</th>
                  <th>Grade</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject, index) => (
                  <tr key={subject.name}>
                    <td className="col-num">{index + 1}</td>
                    <td className="col-subject">{subject.name}</td>
                    {multiRound
                      ? subject.roundDisplays.map((display, i) => (
                          <td key={`${subject.name}:${exams[i]._id}`}>
                            {display}
                          </td>
                        ))
                      : null}
                    <td>{subject.displayTotal}</td>
                    <td>{subject.displayObtained}</td>
                    <td>{subject.displayPercent}</td>
                    <td>{subject.grade}</td>
                    <td
                      className={
                        subject.status === "PASS"
                          ? "status-pass"
                          : subject.status === "FAIL"
                            ? "status-fail"
                            : undefined
                      }
                    >
                      {subject.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="school-rc-totals">
            <div>
              <span>Total Marks</span>
              <strong>{totals.displayTotal}</strong>
            </div>
            <div>
              <span>Obtained Marks</span>
              <strong>{totals.displayObtained}</strong>
            </div>
            <div>
              <span>Percentage</span>
              <strong>
                {totals.percent == null ? "—" : `${totals.displayPercent}%`}
              </strong>
            </div>
            <div>
              <span>Grade</span>
              <strong>{totals.grade}</strong>
            </div>
            <div>
              <span>Result</span>
              <strong
                className={
                  totals.passed === true
                    ? "status-pass"
                    : totals.passed === false
                      ? "status-fail"
                      : undefined
                }
              >
                {totals.passed == null
                  ? "—"
                  : totals.passed
                    ? "PASS"
                    : "FAIL"}
              </strong>
            </div>
          </div>
        </>
      )}

      <div className="school-rc-remarks-row">
        <div className="school-rc-remarks">
          <span>Teacher&apos;s Remarks:</span>
          <div className="school-rc-remarks-line" />
          <div className="school-rc-remarks-line" />
        </div>
        <table className="school-rc-behavior">
          <tbody>
            <tr>
              <th>Hand Writing:</th>
              <td />
            </tr>
            <tr>
              <th>Uniform:</th>
              <td />
            </tr>
            <tr>
              <th>Homework:</th>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="school-rc-section-title">
        Accumulative Result&apos;s Summary
      </h3>
      {accumulativeRows.length === 0 ? (
        <p className="school-rc-empty">No exam results yet.</p>
      ) : (
        <table className="school-rc-table school-rc-accumulative">
          <thead>
            <tr>
              <th>Exam Name</th>
              <th>Total Marks</th>
              <th>Obtained Marks</th>
              <th>Percentage</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            {accumulativeRows.map((exam) => (
              <tr key={exam._id}>
                <td className="col-subject">{exam.name}</td>
                <td>{exam.displayTotal}</td>
                <td>{exam.displayObtained}</td>
                <td>
                  {exam.percent == null ? "—" : `${exam.displayPercent}%`}
                </td>
                <td>{exam.grade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <footer className="school-rc-sign">
        <div>
          <span />
          <p>Class Teacher</p>
        </div>
        <div>
          <span />
          <p>Controller Exams</p>
        </div>
        <div>
          <span />
          <p>Principal</p>
        </div>
      </footer>
    </article>
  );
}

function AcademyResultStudentPrint() {
  const { studentId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);

  const examsQuery = useMemo(
    () =>
      (searchParams.get("exams") || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .join(","),
    [searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!studentId) {
        navigate("/academy/results", { replace: true });
        return;
      }
      setLoading(true);
      try {
        const params = {};
        if (examsQuery) params.exams = examsQuery;
        const { data } = await api.get(
          `/results/students/${studentId}/report`,
          { params },
        );
        if (!cancelled) setPayload(data);
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err.response?.data?.message || "Failed to load student report",
          );
          navigate("/academy/results", { replace: true });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, examsQuery, navigate]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-slate">
        Loading student report…
      </div>
    );
  }

  if (!payload) return null;

  const { academy, student, session, exams, accumulative } = payload;

  return (
    <div className="print-page student-list-print min-h-screen bg-bg-soft px-3 py-4 sm:px-6">
      <div className="no-print mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-between gap-3">
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

      <StudentReportSheet
        academy={academy}
        student={student}
        session={session}
        exams={exams || []}
        accumulative={accumulative || []}
      />
    </div>
  );
}

export default AcademyResultStudentPrint;
