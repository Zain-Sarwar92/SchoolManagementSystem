import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  LayoutDashboard,
  PauseCircle,
  Plus,
  X,
} from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import LogoUploadField from "../components/LogoUploadField.jsx";
import CustomSelect from "../components/ui/CustomSelect.jsx";
import { toast } from "../components/ui/toast.jsx";
import { superAdminNavItems } from "../constants/superAdminNav.js";
import api from "../services/api.js";
import { ACADEMY_PRODUCTS } from "../utils/academyModules.js";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  address: "",
  plan: "free",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
  moduleAcademyManagement: true,
  moduleTestGenerator: false,
};

const fields = [
  { name: "name", label: "Academy Name", type: "text", required: true, group: "academy" },
  {
    name: "email",
    label: "Academy Email",
    type: "email",
    required: true,
    hint: "School contact email",
    group: "academy",
  },
  { name: "phone", label: "Phone", type: "text", required: false, group: "academy" },
  {
    name: "address",
    label: "Address",
    type: "text",
    required: false,
    wide: true,
    group: "academy",
  },
  { name: "adminName", label: "Admin Name", type: "text", required: true, group: "admin" },
  {
    name: "adminEmail",
    label: "Admin Email (Login)",
    type: "email",
    required: true,
    group: "admin",
  },
  {
    name: "adminPassword",
    label: "Admin Password",
    type: "password",
    required: true,
    hint: "Min 6 characters",
    group: "admin",
  },
];

function SuperAdminDashboard() {
  const [stats, setStats] = useState({ total: 0, active: 0, suspended: 0 });
  const [academies, setAcademies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [logoFile, setLogoFile] = useState(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, academiesRes] = await Promise.all([
        api.get("/academies/stats"),
        api.get("/academies"),
      ]);
      setStats(statsRes.data.stats);
      setAcademies(academiesRes.data.academies);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load academies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(emptyForm);
    setLogoFile(null);
    setLogoUrl("");
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    if (!logoFile && !logoUrl.trim()) {
      toast.error("Academy logo is required");
      return;
    }

    if (!form.moduleAcademyManagement && !form.moduleTestGenerator) {
      toast.error("Select at least one product access");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, typeof value === "boolean" ? String(value) : value);
      });
      if (logoFile) {
        formData.append("logo", logoFile);
      } else {
        formData.append("logoUrl", logoUrl.trim());
      }

      await api.post("/academies", formData);
      toast.success("Academy registered successfully");
      closeForm();
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to register academy");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (academy) => {
    const nextStatus = academy.status === "active" ? "suspended" : "active";
    setStatusUpdating(academy._id);

    try {
      await api.patch(`/academies/${academy._id}/status`, { status: nextStatus });
      toast.success(`Academy ${nextStatus}`);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    } finally {
      setStatusUpdating(null);
    }
  };

  return (
    <DashboardLayout title="Super Admin" navItems={superAdminNavItems}>
      <div className="space-y-4 sm:space-y-6">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {[
            { label: "Total Academies", value: stats.total, icon: Building2 },
            { label: "Active", value: stats.active, icon: CheckCircle2 },
            { label: "Suspended", value: stats.suspended, icon: PauseCircle },
          ].map((card) => (
            <article
              key={card.label}
              className="sms-item-card rounded-2xl p-4 sm:rounded-3xl sm:p-5"
            >
              <div className="mb-3 inline-flex rounded-2xl bg-blush p-2 text-navy">
                <card.icon className="size-5" aria-hidden="true" />
              </div>
              <p className="text-sm text-slate">{card.label}</p>
              <p className="font-display text-3xl text-navy">{card.value}</p>
            </article>
          ))}
        </section>

        <section className="sms-surface rounded-2xl p-4 sm:rounded-3xl sm:p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl text-navy">Academies</h2>
              <p className="text-sm text-slate">Register and manage tenant schools</p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-navy px-4 py-2.5 text-sm font-semibold text-blush transition hover:bg-slate focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender sm:w-auto"
            >
              <Plus className="size-4" aria-hidden="true" />
              Register Academy
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-slate">Loading academies...</p>
          ) : academies.length === 0 ? (
            <p className="rounded-2xl bg-blush/70 px-4 py-6 text-sm text-slate">
              No academies yet. Register the first academy to get started.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="min-w-[640px] w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-rose/40 text-slate">
                    <th className="px-2 py-3 font-medium">Academy</th>
                    <th className="px-2 py-3 font-medium">Admin Login</th>
                    <th className="px-2 py-3 font-medium">Products</th>
                    <th className="px-2 py-3 font-medium">Plan</th>
                    <th className="px-2 py-3 font-medium">Status</th>
                    <th className="px-2 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {academies.map((academy) => (
                    <tr key={academy._id} className="border-b border-rose/20 align-top">
                      <td className="px-2 py-3">
                        <div className="flex items-start gap-3">
                          {academy.logo ? (
                            <img
                              src={academy.logo}
                              alt=""
                              className="size-10 rounded-xl border border-rose/40 object-contain bg-bg-soft p-1"
                            />
                          ) : (
                            <div className="grid size-10 place-items-center rounded-xl bg-blush text-navy">
                              <Building2 className="size-4" aria-hidden="true" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-navy">{academy.name}</p>
                            <p className="break-all text-xs text-slate">{academy.email}</p>
                            <p className="text-xs text-slate">/{academy.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <p className="text-navy">{academy.admin?.name || "—"}</p>
                        <p className="break-all text-xs text-slate">
                          {academy.admin?.email || "—"}
                        </p>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(academy.moduleAcademyManagement !== false) && (
                            <span className="rounded-full bg-lavender/25 px-2 py-0.5 text-[11px] font-semibold text-navy">
                              Academy Mgmt
                            </span>
                          )}
                          {academy.moduleTestGenerator && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-navy">
                              Test Generator
                            </span>
                          )}
                          {academy.moduleAcademyManagement === false &&
                            !academy.moduleTestGenerator && (
                              <span className="text-xs text-slate">None</span>
                            )}
                        </div>
                      </td>
                      <td className="px-2 py-3 capitalize text-navy">{academy.plan}</td>
                      <td className="px-2 py-3">
                        <span
                          className={[
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                            academy.status === "active"
                              ? "bg-lavender/30 text-navy"
                              : "bg-rose/60 text-navy",
                          ].join(" ")}
                        >
                          {academy.status}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          disabled={statusUpdating === academy._id}
                          onClick={() => toggleStatus(academy)}
                          className="cursor-pointer rounded-xl border border-rose/50 px-3 py-1.5 text-xs font-semibold text-navy transition hover:bg-blush disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lavender"
                        >
                          {statusUpdating === academy._id
                            ? "Updating..."
                            : academy.status === "active"
                              ? "Suspend"
                              : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-navy/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="register-academy-title"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-rose/40 bg-white p-4 shadow-[0_20px_50px_rgb(31_34_50_/0.25)] sm:rounded-3xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 id="register-academy-title" className="font-display text-2xl text-navy">
                  Register Academy
                </h2>
                <p className="text-sm text-slate">
                  <span className="text-[#a33b4a]">*</span> required
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="cursor-pointer rounded-xl p-2 text-slate transition hover:bg-blush hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-lavender"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
              {fields
                .filter((field) => field.group === "academy")
                .map((field) => (
                  <div key={field.name} className={field.wide ? "sm:col-span-2" : ""}>
                    <label htmlFor={field.name} className="mb-1.5 block text-sm font-medium text-navy">
                      {field.label}{" "}
                      {field.required ? (
                        <span className="text-[#a33b4a]">*</span>
                      ) : (
                        <span className="font-normal text-slate">(optional)</span>
                      )}
                    </label>
                    <input
                      id={field.name}
                      name={field.name}
                      type={field.type}
                      required={field.required}
                      value={form[field.name]}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-rose/60 bg-bg-soft px-4 py-2.5 text-navy outline-none transition focus:border-lavender focus:ring-2 focus:ring-lavender/40"
                    />
                    {field.hint && <p className="mt-1 text-xs text-slate">{field.hint}</p>}
                  </div>
                ))}

              <CustomSelect
                label="Plan"
                required
                name="plan"
                value={form.plan}
                onChange={(next) => setForm((prev) => ({ ...prev, plan: next }))}
                options={[
                  { value: "free", label: "Free", hint: "Starter plan" },
                  { value: "basic", label: "Basic", hint: "Growing academies" },
                  { value: "pro", label: "Pro", hint: "Full features" },
                ]}
                placeholder="Select plan"
                searchable={false}
              />

              <LogoUploadField
                file={logoFile}
                logoUrl={logoUrl}
                onFileChange={setLogoFile}
                onUrlChange={setLogoUrl}
                required
              />

              <fieldset className="sm:col-span-2 rounded-2xl border border-rose/50 bg-bg-soft/80 p-4">
                <legend className="px-1 text-sm font-semibold text-navy">
                  Product access <span className="text-[#a33b4a]">*</span>
                </legend>
                <p className="mb-3 text-xs text-slate">
                  Choose which separately deployable apps this academy can use.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ACADEMY_PRODUCTS.map((product) => (
                    <label
                      key={product.key}
                      className={[
                        "flex cursor-pointer gap-3 rounded-2xl border px-3 py-3 transition",
                        form[product.key]
                          ? "border-lavender bg-white shadow-sm"
                          : "border-rose/40 bg-white/60 hover:border-lavender/50",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(form[product.key])}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            [product.key]: e.target.checked,
                          }))
                        }
                        className="mt-1 size-4 accent-navy"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-navy">
                          {product.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate">
                          {product.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {fields
                .filter((field) => field.group === "admin")
                .map((field) => (
                  <div key={field.name} className={field.wide ? "sm:col-span-2" : ""}>
                    <label htmlFor={field.name} className="mb-1.5 block text-sm font-medium text-navy">
                      {field.label}{" "}
                      {field.required ? (
                        <span className="text-[#a33b4a]">*</span>
                      ) : (
                        <span className="font-normal text-slate">(optional)</span>
                      )}
                    </label>
                    <input
                      id={field.name}
                      name={field.name}
                      type={field.type}
                      required={field.required}
                      minLength={field.type === "password" ? 6 : undefined}
                      value={form[field.name]}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-rose/60 bg-bg-soft px-4 py-2.5 text-navy outline-none transition focus:border-lavender focus:ring-2 focus:ring-lavender/40"
                    />
                    {field.hint && <p className="mt-1 text-xs text-slate">{field.hint}</p>}
                  </div>
                ))}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:col-span-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  className="min-h-11 w-full cursor-pointer rounded-2xl border border-rose/50 px-4 py-2.5 text-sm font-semibold text-navy transition hover:bg-blush focus-visible:outline focus-visible:outline-2 focus-visible:outline-lavender sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-11 w-full cursor-pointer rounded-2xl bg-navy px-4 py-2.5 text-sm font-semibold text-blush transition hover:bg-slate disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender sm:w-auto"
                >
                  {submitting ? "Creating..." : "Create Academy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default SuperAdminDashboard;
