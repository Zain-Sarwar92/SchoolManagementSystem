import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Trash2, UserCog, X } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { useAcademyNav } from "../hooks/useAcademyNav.js";
import { toast } from "../components/ui/toast.jsx";
import api from "../services/api.js";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  teacherLevel: "MATRIC",
  isActive: true,
  assignments: [],
};

function AcademyTeachers() {
  const navItems = useAcademyNav();
  const [teachers, setTeachers] = useState([]);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [options, setOptions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [draftAssignment, setDraftAssignment] = useState({
    classId: "",
    sectionId: "",
    subjectId: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [teachersRes, levelsRes] = await Promise.all([
        api.get("/teachers?includeInactive=1"),
        api.get("/teachers/levels"),
      ]);
      setTeachers(teachersRes.data.teachers || []);
      setLevels(levelsRes.data.levels || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load teachers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadOptions = async (level) => {
    try {
      const { data } = await api.get(
        `/teachers/assignment-options?level=${level}`
      );
      setOptions(data.classes || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load subjects");
      setOptions([]);
    }
  };

  const openCreate = async () => {
    setEditing(null);
    setForm(emptyForm);
    setDraftAssignment({ classId: "", sectionId: "", subjectId: "" });
    setShowForm(true);
    await loadOptions(emptyForm.teacherLevel);
  };

  const openEdit = async (teacher) => {
    setEditing(teacher);
    setForm({
      name: teacher.name || "",
      email: teacher.email || "",
      password: "",
      teacherLevel: teacher.teacherLevel || "MATRIC",
      isActive: teacher.isActive !== false,
      assignments: (teacher.assignments || []).map((row) => ({
        classId: row.class?._id,
        sectionId: row.section?._id,
        subjectId: row.subject?._id,
        className: row.class?.name,
        sectionName: row.section?.name,
        subjectName: row.subject?.name,
      })),
    });
    setDraftAssignment({ classId: "", sectionId: "", subjectId: "" });
    setShowForm(true);
    await loadOptions(teacher.teacherLevel || "MATRIC");
  };

  const selectedClass = useMemo(
    () => options.find((c) => c.classId === draftAssignment.classId) || null,
    [options, draftAssignment.classId]
  );

  const addAssignment = () => {
    const { classId, sectionId, subjectId } = draftAssignment;
    if (!classId || !sectionId || !subjectId) {
      toast.error("Pick class, section, and subject");
      return;
    }
    const klass = options.find((c) => c.classId === classId);
    const section = klass?.sections?.find((s) => s.id === sectionId);
    const subject = klass?.subjects?.find((s) => s.subjectId === subjectId);
    const key = `${classId}:${sectionId}:${subjectId}`;
    if (
      form.assignments.some(
        (a) => `${a.classId}:${a.sectionId}:${a.subjectId}` === key
      )
    ) {
      toast.error("Assignment already added");
      return;
    }
    setForm((prev) => ({
      ...prev,
      assignments: [
        ...prev.assignments,
        {
          classId,
          sectionId,
          subjectId,
          className: klass?.className,
          sectionName: section?.name,
          subjectName: subject?.subjectName,
        },
      ],
    }));
    setDraftAssignment({ classId, sectionId: "", subjectId: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    const email = form.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (!editing && !form.password) {
      toast.error("Password is required");
      return;
    }
    if (form.password && form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (!form.teacherLevel) {
      toast.error("Select a teacher type");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        teacherLevel: form.teacherLevel,
        isActive: form.isActive,
        assignments: form.assignments.map((a) => ({
          classId: a.classId,
          sectionId: a.sectionId,
          subjectId: a.subjectId,
        })),
      };
      if (form.password) payload.password = form.password;

      if (editing) {
        await api.put(`/teachers/${editing._id}`, payload);
        toast.success("Teacher updated");
      } else {
        await api.post("/teachers", payload);
        toast.success("Teacher created");
      }
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (teacher) => {
    try {
      await api.put(`/teachers/${teacher._id}`, {
        isActive: !teacher.isActive,
      });
      toast.success(teacher.isActive ? "Teacher deactivated" : "Teacher activated");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    }
  };

  const removeTeacher = async (teacher) => {
    if (!window.confirm(`Delete ${teacher.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/teachers/${teacher._id}`);
      toast.success("Teacher deleted");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  };

  return (
    <DashboardLayout title="Teachers" navItems={navItems}>
      <div className="space-y-4">
        <section className="sms-surface flex flex-wrap items-start justify-between gap-3 rounded-2xl p-4 sm:rounded-3xl sm:p-5">
          <div>
            <h2 className="font-display text-2xl font-semibold text-navy">
              Teachers
            </h2>
            <p className="text-sm text-slate">
              Primary / Matric / Intermediate + class · section · subject maps
              (needed for schedules).
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-navy px-3 text-sm font-semibold text-blush sm:w-auto"
          >
            <Plus className="size-4" />
            Add teacher
          </button>
        </section>

        {loading ? (
          <p className="text-sm text-slate">Loading…</p>
        ) : teachers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-rose/40 bg-white/80 px-4 py-10 text-center">
            <UserCog className="mx-auto size-8 text-slate" />
            <p className="mt-2 font-semibold text-navy">No teachers yet</p>
            <p className="text-sm text-slate">
              Add teachers before creating test schedules.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {teachers.map((teacher) => (
              <li
                key={teacher._id}
                className="rounded-2xl border border-rose/35 bg-white/90 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-navy">{teacher.name}</p>
                      <span className="rounded-lg bg-blush px-2 py-0.5 text-xs font-semibold text-navy">
                        {teacher.teacherLevelLabel || teacher.teacherLevel}
                      </span>
                      {!teacher.isActive ? (
                        <span className="rounded-lg bg-rose/40 px-2 py-0.5 text-xs font-semibold text-navy">
                          Inactive
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate">{teacher.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(teacher.assignments || []).slice(0, 8).map((a) => (
                        <span
                          key={a._id}
                          className="rounded-lg bg-bg-soft px-2 py-0.5 text-xs text-navy ring-1 ring-rose/30"
                        >
                          {a.subject?.name} · {a.class?.name} {a.section?.name}
                        </span>
                      ))}
                      {(teacher.assignments || []).length > 8 ? (
                        <span className="text-xs text-slate">
                          +{teacher.assignments.length - 8} more
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(teacher)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-rose/45 px-2.5 text-xs font-semibold text-navy"
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(teacher)}
                      className="inline-flex min-h-9 items-center rounded-lg border border-rose/45 px-2.5 text-xs font-semibold text-navy"
                    >
                      {teacher.isActive ? "Deactivate" : "Activate"}
                    </button>
                    {!teacher.isActive ? (
                      <button
                        type="button"
                        onClick={() => removeTeacher(teacher)}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-rose/60 bg-rose/30 px-2.5 text-xs font-semibold text-navy"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {showForm ? (
          <div className="fixed inset-0 z-50 grid place-items-end bg-navy/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
            <form
              onSubmit={handleSubmit}
              className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-rose/40 bg-white p-4 shadow-[0_20px_50px_rgb(31_34_50_/0.25)] sm:rounded-3xl sm:p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-navy">
                  {editing ? "Edit teacher" : "Add teacher"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="grid size-9 place-items-center rounded-lg hover:bg-blush"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-navy">Name *</span>
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    className="w-full rounded-xl border border-rose/50 bg-bg-soft px-3 py-2.5"
                    required
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-navy">Email *</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, email: e.target.value }))
                    }
                    className="w-full rounded-xl border border-rose/50 bg-bg-soft px-3 py-2.5"
                    required
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-navy">
                    Password {editing ? "(optional)" : "*"}
                  </span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, password: e.target.value }))
                    }
                    className="w-full rounded-xl border border-rose/50 bg-bg-soft px-3 py-2.5"
                    minLength={6}
                    required={!editing}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-navy">
                    Teacher type *
                  </span>
                  <select
                    value={form.teacherLevel}
                    onChange={async (e) => {
                      const teacherLevel = e.target.value;
                      setForm((p) => ({
                        ...p,
                        teacherLevel,
                        assignments: [],
                      }));
                      await loadOptions(teacherLevel);
                    }}
                    className="w-full rounded-xl border border-rose/50 bg-bg-soft px-3 py-2.5"
                  >
                    {levels.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label} — {level.description}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-xl border border-rose/30 bg-bg-soft/70 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">
                    Subject assignments
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <select
                      value={draftAssignment.classId}
                      onChange={(e) =>
                        setDraftAssignment({
                          classId: e.target.value,
                          sectionId: "",
                          subjectId: "",
                        })
                      }
                      className="rounded-lg border border-rose/40 bg-white px-2 py-2 text-sm"
                    >
                      <option value="">Class</option>
                      {options.map((c) => (
                        <option key={c.classId} value={c.classId}>
                          {c.className}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draftAssignment.sectionId}
                      onChange={(e) =>
                        setDraftAssignment((p) => ({
                          ...p,
                          sectionId: e.target.value,
                        }))
                      }
                      className="rounded-lg border border-rose/40 bg-white px-2 py-2 text-sm"
                      disabled={!selectedClass}
                    >
                      <option value="">Section</option>
                      {(selectedClass?.sections || []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draftAssignment.subjectId}
                      onChange={(e) =>
                        setDraftAssignment((p) => ({
                          ...p,
                          subjectId: e.target.value,
                        }))
                      }
                      className="rounded-lg border border-rose/40 bg-white px-2 py-2 text-sm"
                      disabled={!selectedClass}
                    >
                      <option value="">Subject</option>
                      {(selectedClass?.subjects || []).map((s) => (
                        <option key={s.subjectId} value={s.subjectId}>
                          {s.subjectName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={addAssignment}
                    className="mt-2 rounded-lg border border-rose/45 bg-white px-3 py-1.5 text-xs font-semibold text-navy"
                  >
                    Add assignment
                  </button>
                  <ul className="mt-2 space-y-1">
                    {form.assignments.map((a) => (
                      <li
                        key={`${a.classId}:${a.sectionId}:${a.subjectId}`}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-xs text-navy ring-1 ring-rose/30"
                      >
                        <span>
                          {a.subjectName} · {a.className} {a.sectionName}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((p) => ({
                              ...p,
                              assignments: p.assignments.filter(
                                (row) =>
                                  !(
                                    row.classId === a.classId &&
                                    row.sectionId === a.sectionId &&
                                    row.subjectId === a.subjectId
                                  )
                              ),
                            }))
                          }
                          className="text-slate hover:text-navy"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {editing ? (
                  <label className="flex items-center gap-2 text-sm text-navy">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, isActive: e.target.checked }))
                      }
                    />
                    Active
                  </label>
                ) : null}

                <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="min-h-11 w-full rounded-xl border border-rose/45 px-3 py-2 text-sm font-semibold sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="min-h-11 w-full rounded-xl bg-navy px-3 py-2 text-sm font-semibold text-blush disabled:opacity-60 sm:w-auto"
                  >
                    {submitting ? "Saving…" : "Save"}
                  </button>
                </div>
                <p className="text-xs text-slate">
                  Tip: after teachers, open{" "}
                  <Link to="/academy/schedules" className="underline">
                    Schedules
                  </Link>
                  .
                </p>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

export default AcademyTeachers;
