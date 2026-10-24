import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import StudentListSheet from "../components/StudentListSheet.jsx";
import StudentListPrintHeader from "../components/StudentListPrintHeader.jsx";
import { toast } from "../components/ui/toast.jsx";
import api from "../services/api.js";
import { printHeaderDefaults, sortByRoll } from "../utils/studentListPrint.js";

/**
 * Print many section lists in one request (page-break between sheets).
 * /academy/students/print-batch?sections=id1,id2,id3
 */
function AcademyStudentListPrintBatch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const sectionIds = useMemo(
    () =>
      (searchParams.get("sections") || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    [searchParams]
  );

  const [loading, setLoading] = useState(true);
  const [academy, setAcademy] = useState(null);
  const [batches, setBatches] = useState([]);
  const [header, setHeader] = useState(() => printHeaderDefaults(searchParams));

  const setHeaderField = (key, value) => {
    setHeader((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (sectionIds.length === 0) {
        toast.error("No sections selected for print");
        navigate("/academy/students", { replace: true });
        return;
      }

      setLoading(true);
      try {
        const [academyRes, studentsRes, sectionsRes] = await Promise.all([
          api.get("/academies/me"),
          api.get(
            `/students?sectionIds=${sectionIds.join(",")}&status=active&fields=print${
              searchParams.get("session")
                ? `&session=${encodeURIComponent(searchParams.get("session"))}`
                : ""
            }`
          ),
          api.get("/sections"),
        ]);

        if (cancelled) return;

        const allSections = sectionsRes.data.sections || [];
        const selected = sectionIds
          .map((id) => allSections.find((s) => s._id === id))
          .filter(Boolean);

        if (selected.length === 0) {
          toast.error("Selected sections not found");
          navigate("/academy/students", { replace: true });
          return;
        }

        const students = studentsRes.data.students || [];
        const bySection = new Map();
        for (const student of students) {
          const sid = String(student.section?._id || student.section);
          if (!bySection.has(sid)) bySection.set(sid, []);
          bySection.get(sid).push(student);
        }

        const studentLists = selected
          .map((section) => ({
            section,
            students: (bySection.get(String(section._id)) || [])
              .slice()
              .sort((a, b) => sortByRoll(a.rollNumber, b.rollNumber)),
          }))
          .sort((a, b) => {
            const ca = a.section.class?.name || "";
            const cb = b.section.class?.name || "";
            const c = ca.localeCompare(cb, undefined, { numeric: true });
            if (c !== 0) return c;
            return String(a.section.name).localeCompare(String(b.section.name), undefined, {
              numeric: true,
            });
          });

        setAcademy(academyRes.data.academy || null);
        setBatches(studentLists);
      } catch (err) {
        if (!cancelled) {
          toast.error(err.response?.data?.message || "Failed to load lists");
          navigate("/academy/students", { replace: true });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [sectionIds, navigate]);

  const backHref = searchParams.get("back")?.startsWith("/academy")
    ? searchParams.get("back")
    : "/academy/students";

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg-soft text-slate">
        Preparing {sectionIds.length} student list{sectionIds.length === 1 ? "" : "s"}…
      </div>
    );
  }

  return (
    <div className="print-page student-list-print min-h-screen bg-bg-soft px-3 py-4 sm:px-6">
      <div className="print-toolbar no-print">
        <div>
          <Link
            to={backHref}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose/50 bg-white px-3 text-sm font-semibold text-navy transition hover:bg-blush"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Link>
          <p className="mt-2 text-sm font-semibold text-navy">
            Print all · {batches.length} list{batches.length === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-slate">
            One sheet per section · each starts on a new page when printing
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-blush transition hover:bg-slate"
        >
          <Printer className="size-4" aria-hidden="true" />
          Print all lists
        </button>
      </div>

      <StudentListPrintHeader
        {...header}
        onChange={setHeaderField}
        hint="e.g. Subject = English, Exam = Class Test — applies to all selected sections."
      />

      <div className="student-list-batch">
        {batches.map((batch, index) => (
          <StudentListSheet
            key={batch.section._id}
            organization={academy}
            className={batch.section.class?.name || "Class"}
            sectionName={batch.section.name}
            students={batch.students}
            {...header}
            pageBreakAfter={index < batches.length - 1}
          />
        ))}
      </div>

      <p className="print-screen-hint no-print">
        Review all section sheets below, then Print all lists.
      </p>
    </div>
  );
}

export default AcademyStudentListPrintBatch;
