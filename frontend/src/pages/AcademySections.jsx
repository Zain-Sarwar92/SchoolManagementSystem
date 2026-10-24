import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronRight,
  GraduationCap,
  Layers,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import CustomSelect from "../components/ui/CustomSelect.jsx";
import { useAcademyNav } from "../hooks/useAcademyNav.js";
import { toast } from "../components/ui/toast.jsx";
import { sectionSwatch } from "../utils/sectionColors.js";
import api from "../services/api.js";

const emptyForm = {
  name: "",
  classId: "",
  capacity: "",
  description: "",
  isActive: true,
};

function splitPreviewNames(raw) {
  return [
    ...new Set(
      raw
        .split(/[,/|]+/)
        .map((part) => part.trim())
        .filter(Boolean)
    ),
  ];
}

function AcademySections() {
  const navItems = useAcademyNav();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedClassId = searchParams.get("classId") || "";

  const [sections, setSections] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const activeClasses = useMemo(
    () => classes.filter((item) => item.isActive !== false),
    [classes]
  );

  const selectedClass = useMemo(
    () => classes.find((item) => item._id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  const visibleSections = useMemo(() => {
    if (!selectedClassId) return [];
    return sections.filter((section) => section.class?._id === selectedClassId);
  }, [sections, selectedClassId]);

  const previewNames = useMemo(
    () => (editing ? [] : splitPreviewNames(form.name)),
    [editing, form.name]
  );

  const classOptions = useMemo(
    () =>
      (editing ? classes : activeClasses).map((item) => ({
        value: item._id,
        label: item.name,
        hint:
          item.isActive === false
            ? "Inactive"
            : `${sections.filter((section) => section.class?._id === item._id).length} sections`,
      })),
    [editing, classes, activeClasses, sections]
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [sectionsRes, classesRes] = await Promise.all([
        api.get("/sections"),
        api.get("/classes?includeInactive=true"),
      ]);
      setSections(sectionsRes.data.sections);
      setClasses(classesRes.data.classes);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load sections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    if (activeClasses.length === 0) {
      toast.error("Create a class first");
      navigate("/academy/classes");
      return;
    }

    setEditing(null);
    setForm({
      ...emptyForm,
      classId: selectedClassId || "",
    });
    setShowForm(true);
  };

  const openEdit = (section) => {
    setEditing(section);
    setForm({
      name: section.name || "",
      classId: section.class?._id || "",
      capacity: section.capacity ?? "",
      description: section.description || "",
      isActive: section.isActive !== false,
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

    if (!form.classId) {
      toast.error("Please select a class");
      return;
    }

    if (!form.name.trim()) {
      toast.error("Section name is required");
      return;
    }

    if (!editing && previewNames.length === 0) {
      toast.error("Enter at least one section name");
      return;
    }

    const namesToCheck = editing
      ? [form.name.trim()]
      : previewNames.length
        ? previewNames
        : [form.name.trim()];
    for (const sectionName of namesToCheck) {
      if (sectionName.length > 40) {
        toast.error(`Section name is too long (max 40): ${sectionName}`);
        return;
      }
    }

    if (form.capacity !== "" && form.capacity != null) {
      const capacity = Number(form.capacity);
      if (!Number.isInteger(capacity) || capacity < 1) {
        toast.error("Capacity must be a whole number of at least 1");
        return;
      }
    }

    setSubmitting(true);

    try {
      if (editing) {
        await api.put(`/sections/${editing._id}`, {
          name: form.name.trim(),
          classId: form.classId,
          capacity: form.capacity === "" ? null : Number(form.capacity),
          description: form.description.trim(),
          isActive: form.isActive,
        });
        toast.success("Section updated successfully");
      } else {
        const { data } = await api.post("/sections", {
          name: form.name.trim(),
          classId: form.classId,
          capacity: form.capacity === "" ? null : Number(form.capacity),
          description: form.description.trim(),
        });
        toast.success(data.message || "Section created successfully");
      }

      closeForm();
      await loadData();

      if (!selectedClassId && form.classId) {
        navigate(`/academy/sections?classId=${form.classId}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save section");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (section) => {
    const label = `${section.class?.name || "Class"} - ${section.name}`;
    const confirmed = window.confirm(`Delete section "${label}"?`);
    if (!confirmed) return;

    try {
      await api.delete(`/sections/${section._id}`);
      toast.success("Section deleted successfully");
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete section");
    }
  };

  return (
    <DashboardLayout title="Sections" navItems={navItems}>
      <section className="sms-surface rounded-2xl p-4 sm:rounded-3xl sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold text-navy">
              {selectedClass ? selectedClass.name : "Sections"}
            </h2>
            <p className="mt-0.5 text-sm text-slate">
              {selectedClass
                ? `${visibleSections.length} section${visibleSections.length === 1 ? "" : "s"}`
                : "Pick a class to manage its sections"}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-blush transition hover:bg-slate sm:w-auto"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add Section
          </button>
        </div>

        {selectedClass ? (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <Link
              to="/academy/sections"
              className="font-medium text-lavender transition hover:text-navy"
            >
              All classes
            </Link>
            <ChevronRight className="size-3.5 text-slate" aria-hidden="true" />
            <span className="font-semibold text-navy">{selectedClass.name}</span>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate">Loading...</p>
        ) : !selectedClass ? (
          classes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-rose/50 bg-white/60 px-4 py-10 text-center">
              <GraduationCap className="mx-auto mb-2 size-8 text-lavender" aria-hidden="true" />
              <p className="font-medium text-navy">No classes found</p>
              <Link
                to="/academy/classes"
                className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-blush"
              >
                Classes
              </Link>
            </div>
          ) : (
            <div className="sms-list">
              {classes.map((schoolClass) => {
                const count = sections.filter(
                  (section) => section.class?._id === schoolClass._id
                ).length;

                return (
                  <Link
                    key={schoolClass._id}
                    to={`/academy/sections?classId=${schoolClass._id}`}
                    className="sms-row sms-row--link"
                  >
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-navy/90 text-blush">
                      <GraduationCap className="size-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg font-semibold text-navy">
                        {schoolClass.name}
                      </h3>
                      <p className="text-sm text-slate">
                        {count} section{count === 1 ? "" : "s"}
                        {!schoolClass.isActive ? " · Inactive" : ""}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-navy">
                      Open
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </span>
                  </Link>
                );
              })}
            </div>
          )
        ) : visibleSections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-rose/50 bg-white/60 px-4 py-10 text-center">
            <Layers className="mx-auto mb-2 size-8 text-lavender" aria-hidden="true" />
            <p className="font-medium text-navy">No sections in this class</p>
          </div>
        ) : (
          <div className="sms-list">
            {visibleSections.map((section) => (
              <div
                key={section._id}
                className="sms-row flex-col items-stretch gap-3 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className="sms-swatch"
                    style={{ backgroundColor: sectionSwatch(section.name) }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <h3 className="font-display text-lg font-semibold text-navy">
                        {section.name}
                      </h3>
                      <span className="sms-meta">
                        {section.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-sm text-slate">
                      Capacity: {section.capacity || "—"}
                      {section.description ? ` · ${section.description}` : ""}
                    </p>
                  </div>
                </div>
                <div className="sms-actions ml-0 sm:ml-auto">
                  <button type="button" onClick={() => openEdit(section)} className="sms-action">
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(section)}
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
            aria-labelledby="section-form-title"
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-rose/40 bg-white p-4 shadow-[0_20px_50px_rgb(31_34_50_/0.25)] sm:rounded-3xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 id="section-form-title" className="font-display text-2xl font-semibold text-navy">
                  {editing ? "Edit Section" : "Add Section"}
                </h2>
                <p className="text-sm text-slate">
                  <span className="text-[#a33b4a]">*</span> required
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
              <CustomSelect
                label="Class"
                required
                value={form.classId}
                onChange={(next) => setForm((prev) => ({ ...prev, classId: next }))}
                options={classOptions}
                placeholder="Select class"
                searchPlaceholder="Search class..."
                emptyText="No classes found"
              />

              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-navy">
                  Section Name <span className="text-[#a33b4a]">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  value={form.name}
                  onChange={handleChange}
                  placeholder={editing ? "e.g. Red" : "e.g. Red, Blue, Green"}
                  className="w-full rounded-xl border border-rose/60 bg-bg-soft px-4 py-2.5 text-navy outline-none transition focus:border-lavender focus:ring-2 focus:ring-lavender/40"
                />
                {!editing ? (
                  <p className="mt-1 text-xs text-slate">
                    Comma-separated names create multiple sections
                  </p>
                ) : null}
                {!editing && previewNames.length > 1 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {previewNames.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1.5 rounded-full bg-lavender/25 px-2.5 py-1 text-xs font-semibold text-navy"
                      >
                        <span
                          className="sms-swatch"
                          style={{ backgroundColor: sectionSwatch(item) }}
                          aria-hidden="true"
                        />
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <label htmlFor="capacity" className="mb-1.5 block text-sm font-medium text-navy">
                  Capacity <span className="font-normal text-slate">(optional)</span>
                </label>
                <input
                  id="capacity"
                  name="capacity"
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={handleChange}
                  placeholder="e.g. 40"
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
                  Active section
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
                  {submitting
                    ? "Saving..."
                    : editing
                      ? "Update Section"
                      : previewNames.length > 1
                        ? `Create ${previewNames.length} Sections`
                        : "Create Section"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default AcademySections;
