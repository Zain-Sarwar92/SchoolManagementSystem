import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import StudentListSheet from "../components/StudentListSheet.jsx";
import StudentListPrintHeader from "../components/StudentListPrintHeader.jsx";
import { toast } from "../components/ui/toast.jsx";
import api from "../services/api.js";
import { printHeaderDefaults, sortByRoll } from "../utils/studentListPrint.js";

/**
 * /academy/students/print/:sectionId → preview + fill header → window.print()
 */
function AcademyStudentListPrint() {
  const navigate = useNavigate();
  const { sectionId } = useParams();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [academy, setAcademy] = useState(null);
  const [section, setSection] = useState(null);
  const [schoolClass, setSchoolClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [header, setHeader] = useState(() => printHeaderDefaults(searchParams));

  const setHeaderField = (key, value) => {
    setHeader((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [academyRes, studentsRes] = await Promise.all([
          api.get("/academies/me"),
          api.get(
            `/students?sectionId=${sectionId}&status=active&fields=print${
              searchParams.get("session")
                ? `&session=${encodeURIComponent(searchParams.get("session"))}`
                : ""
            }`
          ),
        ]);

        if (cancelled) return;

        const rows = (studentsRes.data.students || [])
          .slice()
          .sort((a, b) => sortByRoll(a.rollNumber, b.rollNumber));

        const sample = rows[0];
        const foundSection = sample?.section
          ? { _id: sectionId, name: sample.section.name || sample.section }
          : null;
        const foundClass = sample?.class || null;

        // If section empty, still need section meta — one sections lookup
        if (!foundSection) {
          const sectionsRes = await api.get("/sections");
          if (cancelled) return;
          const found = (sectionsRes.data.sections || []).find((s) => s._id === sectionId);
          if (!found) {
            toast.error("Section not found");
            navigate("/academy/students", { replace: true });
            return;
          }
          setSection(found);
          setSchoolClass(found.class || null);
        } else {
          setSection(foundSection);
          setSchoolClass(foundClass);
        }

        setAcademy(academyRes.data.academy || null);
        setStudents(rows);
      } catch (err) {
        if (!cancelled) {
          toast.error(err.response?.data?.message || "Failed to load print list");
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
  }, [sectionId, navigate]);

  const backHref = useMemo(() => {
    const from = searchParams.get("back");
    if (from && from.startsWith("/academy")) return from;
    if (schoolClass?._id) {
      return `/academy/students?classId=${schoolClass._id}&sectionId=${sectionId}`;
    }
    return "/academy/students";
  }, [searchParams, schoolClass, sectionId]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg-soft text-slate">
        Preparing student list…
      </div>
    );
  }

  return (
    <div className="print-page student-list-print min-h-screen bg-bg-soft px-3 py-4 sm:px-6">
      <div className="print-toolbar no-print">
        <Link
          to={backHref}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose/50 bg-white px-3 text-sm font-semibold text-navy transition hover:bg-blush"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-blush transition hover:bg-slate"
        >
          <Printer className="size-4" aria-hidden="true" />
          Print / Save PDF
        </button>
      </div>

      <StudentListPrintHeader {...header} onChange={setHeaderField} />

      <StudentListSheet
        organization={academy}
        className={schoolClass?.name || "Class"}
        sectionName={section?.name || "Section"}
        students={students}
        {...header}
      />

      <p className="print-screen-hint no-print">
        Review the preview, then Print / Save PDF.
      </p>
    </div>
  );
}

export default AcademyStudentListPrint;
