import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { useAcademyNav } from "../hooks/useAcademyNav.js";
import { toast } from "../components/ui/toast.jsx";
import api from "../services/api.js";

function AcademyResultMarks() {
  const navItems = useAcademyNav();
  const { assessmentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [totalMarks, setTotalMarks] = useState("30");
  const [rows, setRows] = useState([]);
  const [manualRows, setManualRows] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/results/assessments/${assessmentId}/marks`);
      setAssessment(data.assessment);
      setTotalMarks(String(data.assessment.totalMarks ?? 30));
      setRows(
        (data.roster || []).map((row) => ({
          studentId: row.studentId,
          rollNumber: row.rollNumber,
          name: row.name,
          fatherName: row.fatherName || "",
          obtained:
            row.obtainedMarks == null || row.isAbsent
              ? ""
              : String(row.obtainedMarks),
          absent: Boolean(row.isAbsent),
        }))
      );
      setManualRows(
        (data.manualMarks || []).map((row) => ({
          _id: row._id,
          rollNumber: row.rollNumber,
          name: row.name,
          fatherName: row.fatherName || "",
          obtained:
            row.obtainedMarks == null || row.isAbsent
              ? ""
              : String(row.obtainedMarks),
          absent: Boolean(row.isAbsent),
        }))
      );
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load marks");
      navigate("/academy/results", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  const updateRow = (index, patch) => {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const updateManual = (index, patch) => {
    setManualRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const addManualRow = () => {
    setManualRows((current) => [
      ...current,
      {
        rollNumber: "",
        name: "",
        fatherName: "",
        obtained: "",
        absent: false,
      },
    ]);
  };

  const removeManualRow = (index) => {
    setManualRows((current) => current.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const total = Number(totalMarks);
    if (!(total >= 0.01) || total > 1000 || Number.isNaN(total)) {
      toast.error("Total marks must be between 0.01 and 1000");
      return;
    }

    const checkObtained = (label, obtained, absent) => {
      if (absent || obtained === "" || obtained == null) return true;
      const value = Number(obtained);
      if (Number.isNaN(value) || value < 0) {
        toast.error(`${label}: marks cannot be negative`);
        return false;
      }
      if (value > total) {
        toast.error(`${label}: obtained marks cannot exceed total (${total})`);
        return false;
      }
      return true;
    };

    for (const row of rows) {
      if (
        !checkObtained(
          row.name || row.rollNumber || "Student",
          row.obtained,
          row.absent
        )
      ) {
        return;
      }
    }
    for (const row of manualRows) {
      if (
        !checkObtained(
          row.name || row.rollNumber || "Manual entry",
          row.obtained,
          row.absent
        )
      ) {
        return;
      }
    }

    setSaving(true);
    try {
      await api.put(`/results/assessments/${assessmentId}/marks`, {
        totalMarks: total,
        studentMarks: rows.map((row) => ({
          studentId: row.studentId,
          obtained: row.absent ? "" : row.obtained,
          absent: row.absent,
        })),
        manualMarks: manualRows.map((row) => ({
          _id: row._id,
          rollNumber: row.rollNumber,
          name: row.name,
          fatherName: row.fatherName,
          obtained: row.absent ? "" : row.obtained,
          absent: row.absent,
        })),
      });
      const entered =
        rows.filter((r) => r.absent || r.obtained.trim()).length +
        manualRows.filter((r) => r.absent || r.obtained.trim()).length;
      toast.success(`Marks saved (${entered} rows with values).`);
      const examId = assessment?.exam?._id;
      const sectionId = assessment?.section?._id;
      if (examId && sectionId) {
        navigate(`/academy/results/sections/${sectionId}/exams/${examId}`);
      } else {
        await load();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save marks");
    } finally {
      setSaving(false);
    }
  };

  const backHref =
    assessment?.section?._id && assessment?.exam?._id
      ? `/academy/results/sections/${assessment.section._id}/exams/${assessment.exam._id}`
      : "/academy/results";

  return (
    <DashboardLayout title="Marks entry" navItems={navItems}>
      <section className="sms-surface rounded-2xl p-4 sm:rounded-3xl sm:p-6">
        <Link
          to={backHref}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate transition hover:text-navy"
        >
          <ArrowLeft className="size-4" />
          Back to subjects
        </Link>

        {loading ? (
          <p className="text-sm text-slate">Loading marks…</p>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate">
                  {assessment?.section?.class?.name} · {assessment?.section?.name} ·{" "}
                  {assessment?.exam?.name}
                </p>
                <h2 className="font-display text-2xl font-semibold text-navy">
                  {assessment?.subjectName}
                </h2>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-navy">Total marks</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  step="0.5"
                  value={totalMarks}
                  onChange={(e) => setTotalMarks(e.target.value)}
                  className="w-28 rounded-xl border border-rose/50 bg-white px-3 py-2 text-navy outline-none focus:border-navy"
                />
              </label>
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-semibold text-navy">
                Roster ({rows.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addManualRow}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-rose/50 px-3 text-sm font-medium text-navy hover:bg-blush"
                >
                  <Plus className="size-4" />
                  Add row
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-navy px-4 text-sm font-semibold text-blush disabled:opacity-60"
                >
                  <Save className="size-4" />
                  {saving ? "Saving…" : "Save marks"}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-rose/40">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-blush/60 text-navy">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Roll</th>
                    <th className="px-3 py-2.5 font-semibold">Student</th>
                    <th className="px-3 py-2.5 font-semibold">Father</th>
                    <th className="px-3 py-2.5 font-semibold">Marks</th>
                    <th className="px-3 py-2.5 font-semibold">Absent</th>
                  </tr>
                </thead>
                <tbody className="bg-white/70">
                  {rows.map((row, index) => (
                    <tr key={row.studentId} className="border-t border-rose/30">
                      <td className="px-3 py-2 font-medium text-navy">
                        {row.rollNumber}
                      </td>
                      <td className="px-3 py-2 text-navy">{row.name}</td>
                      <td className="px-3 py-2 text-slate">{row.fatherName}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          max={Number(totalMarks) || undefined}
                          step="0.5"
                          disabled={row.absent}
                          value={row.obtained}
                          onChange={(e) =>
                            updateRow(index, { obtained: e.target.value })
                          }
                          className="w-20 rounded-lg border border-rose/40 bg-white px-2 py-1.5 disabled:bg-blush/40"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={row.absent}
                          onChange={(e) =>
                            updateRow(index, {
                              absent: e.target.checked,
                              obtained: e.target.checked ? "" : row.obtained,
                            })
                          }
                          className="size-4 accent-navy"
                        />
                      </td>
                    </tr>
                  ))}
                  {manualRows.map((row, index) => (
                    <tr
                      key={row._id || `manual-${index}`}
                      className="border-t border-rose/30 bg-lavender/10"
                    >
                      <td className="px-3 py-2">
                        <input
                          value={row.rollNumber}
                          onChange={(e) =>
                            updateManual(index, { rollNumber: e.target.value })
                          }
                          placeholder="Roll"
                          className="w-24 rounded-lg border border-rose/40 px-2 py-1.5"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={row.name}
                          onChange={(e) =>
                            updateManual(index, { name: e.target.value })
                          }
                          placeholder="Name"
                          className="w-full min-w-[8rem] rounded-lg border border-rose/40 px-2 py-1.5"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={row.fatherName}
                          onChange={(e) =>
                            updateManual(index, { fatherName: e.target.value })
                          }
                          placeholder="Father"
                          className="w-full min-w-[7rem] rounded-lg border border-rose/40 px-2 py-1.5"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          max={Number(totalMarks) || undefined}
                          disabled={row.absent}
                          value={row.obtained}
                          onChange={(e) =>
                            updateManual(index, { obtained: e.target.value })
                          }
                          className="w-20 rounded-lg border border-rose/40 px-2 py-1.5 disabled:bg-blush/40"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={row.absent}
                            onChange={(e) =>
                              updateManual(index, {
                                absent: e.target.checked,
                                obtained: e.target.checked ? "" : row.obtained,
                              })
                            }
                            className="size-4 accent-navy"
                          />
                          <button
                            type="button"
                            onClick={() => removeManualRow(index)}
                            className="text-slate hover:text-navy"
                            title="Remove row"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && manualRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-8 text-center text-slate"
                      >
                        No students in this section for this subject.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </DashboardLayout>
  );
}

export default AcademyResultMarks;
