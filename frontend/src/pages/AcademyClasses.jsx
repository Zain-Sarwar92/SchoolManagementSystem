import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, GraduationCap, Layers, Pencil, Plus, Trash2, X } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { useAcademyNav } from "../hooks/useAcademyNav.js";
import { toast } from "../components/ui/toast.jsx";
import api from "../services/api.js";

const emptyForm = {
  name: "",
  description: "",
  isActive: true,
};

function AcademyClasses() {
  const navItems = useAcademyNav();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/classes?includeInactive=true");
      setClasses(data.classes);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load classes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (schoolClass) => {
    setEditing(schoolClass);
    setForm({
      name: schoolClass.name || "",
      description: schoolClass.description || "",
      isActive: schoolClass.isActive !== false,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Class name is required");
      return;
    }
    if (form.name.trim().length > 80) {
      toast.error("Class name must be 80 characters or fewer");
      return;
    }
    if (form.description.trim().length > 300) {
      toast.error("Description must be 300 characters or fewer");
      return;
    }

    setSubmitting(true);

    try {
      if (editing) {
        await api.put(`/classes/${editing._id}`, {
          name: form.name.trim(),
          description: form.description.trim(),
          isActive: form.isActive,
        });
        toast.success("Class updated successfully");
      } else {
        await api.post("/classes", {
          name: form.name.trim(),
          description: form.description.trim(),
        });
        toast.success("Class created successfully");
      }

      closeForm();
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save class");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (schoolClass) => {
    if (schoolClass.sectionCount > 0) {
      toast.error("Delete linked sections first, then delete this class");
      return;
    }

    const confirmed = window.confirm(`Delete class "${schoolClass.name}"?`);
    if (!confirmed) return;

    try {
      await api.delete(`/classes/${schoolClass._id}`);
      toast.success("Class deleted successfully");
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete class");
    }
  };

  return (
    <DashboardLayout title="Classes" navItems={navItems}>
      <section className="sms-surface rounded-2xl p-4 sm:rounded-3xl sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold text-navy">Classes</h2>
            <p className="mt-0.5 text-sm text-slate">
              {loading ? "Loading…" : `${classes.length} class${classes.length === 1 ? "" : "es"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-blush transition hover:bg-slate sm:w-auto"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add Class
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate">Loading classes...</p>
        ) : classes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-rose/50 bg-white/60 px-4 py-10 text-center">
            <GraduationCap className="mx-auto mb-2 size-8 text-lavender" aria-hidden="true" />
            <p className="font-medium text-navy">No classes yet</p>
          </div>
        ) : (
          <div className="sms-list">
            {classes.map((schoolClass) => (
              <div
                key={schoolClass._id}
                className="sms-row flex-col items-stretch gap-3 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-navy/90 text-blush">
                    <GraduationCap className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <h3 className="font-display text-lg font-semibold text-navy">
                        {schoolClass.name}
                      </h3>
                      <span
                        className={[
                          "rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          schoolClass.isActive
                            ? "bg-lavender/25 text-navy"
                            : "bg-rose/50 text-navy",
                        ].join(" ")}
                      >
                        {schoolClass.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-slate">
                      <span className="inline-flex items-center gap-1">
                        <Layers className="size-3.5" aria-hidden="true" />
                        {schoolClass.sectionCount} section
                        {schoolClass.sectionCount === 1 ? "" : "s"}
                      </span>
                      {schoolClass.description ? (
                        <span className="truncate">· {schoolClass.description}</span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <div className="sms-actions ml-0 sm:ml-auto">
                  <Link
                    to={`/academy/sections?classId=${schoolClass._id}`}
                    className="sms-action"
                  >
                    Sections
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </Link>
                  <button type="button" onClick={() => openEdit(schoolClass)} className="sms-action">
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(schoolClass)}
                    className="sms-action sms-action--danger"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-navy/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-form-title"
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-rose/40 bg-white p-4 shadow-[0_20px_50px_rgb(31_34_50_/0.25)] sm:rounded-3xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 id="class-form-title" className="font-display text-2xl font-semibold text-navy">
                  {editing ? "Edit Class" : "Add Class"}
                </h2>
                <p className="text-sm text-slate">
                  <span className="text-[#a33b4a]">*</span> = required
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="cursor-pointer rounded-xl p-2 text-slate transition hover:bg-blush hover:text-navy"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-navy">
                  Class Name <span className="text-[#a33b4a]">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Class 9"
                  className="w-full rounded-xl border border-rose/60 bg-bg-soft px-4 py-2.5 text-navy outline-none transition focus:border-lavender focus:ring-2 focus:ring-lavender/40"
                />
              </div>

              <div>
                <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-navy">
                  Description <span className="font-normal text-slate">(optional)</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  value={form.description}
                  onChange={handleChange}
                  className="w-full resize-y rounded-xl border border-rose/60 bg-bg-soft px-4 py-2.5 text-navy outline-none transition focus:border-lavender focus:ring-2 focus:ring-lavender/40"
                />
              </div>

              {editing && (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-navy">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={form.isActive}
                    onChange={handleChange}
                    className="size-4 rounded border-rose/60"
                  />
                  Active class
                </label>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  className="min-h-11 w-full cursor-pointer rounded-xl border border-rose/50 px-4 py-2.5 text-sm font-semibold text-navy transition hover:bg-blush sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-11 w-full cursor-pointer rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-blush transition hover:bg-slate disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {submitting ? "Saving..." : editing ? "Update Class" : "Create Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default AcademyClasses;
