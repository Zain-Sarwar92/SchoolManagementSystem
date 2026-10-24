import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, UsersRound, X } from "lucide-react";
import GeneratorLayout from "../components/GeneratorLayout.jsx";
import TgConfirmModal from "../components/TgConfirmModal.jsx";
import { toast } from "../../../components/ui/toast.jsx";
import api from "../../../services/api.js";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  isActive: true,
};

function formatWhen(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Test Generator sub accounts only.
 * Separate from Academy Management → Teachers.
 */
function GeneratorSubAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(
        "/generator/sub-accounts?includeInactive=1"
      );
      setAccounts(data.subAccounts || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load sub accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name || "",
      email: row.email || "",
      password: "",
      isActive: row.isActive !== false,
    });
    setShowForm(true);
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

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        email,
        isActive: form.isActive,
      };
      if (form.password) payload.password = form.password;

      if (editing) {
        await api.put(`/generator/sub-accounts/${editing._id}`, payload);
        toast.success("Sub account updated");
      } else {
        await api.post("/generator/sub-accounts", payload);
        toast.success("Sub account created");
      }
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      await api.put(`/generator/sub-accounts/${row._id}`, {
        isActive: !row.isActive,
      });
      toast.success(
        row.isActive ? "Sub account deactivated" : "Sub account activated"
      );
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    }
  };

  const removeAccount = (row) => {
    setDeleteTarget(row);
  };

  const performDeleteAccount = async () => {
    const row = deleteTarget;
    setDeleteTarget(null);
    if (!row) return;
    try {
      await api.delete(`/generator/sub-accounts/${row._id}`);
      toast.success("Sub account deleted");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  };

  return (
    <GeneratorLayout title="Sub Accounts" wide>
      <div className="tg-papers-page space-y-4">
        <section className="tg-papers-toolbar">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-tg-ink/8 text-tg-ink">
              <UsersRound className="size-4" aria-hidden />
            </span>
            <div>
              <p className="tg-papers-count">
                {loading
                  ? "Loading…"
                  : `${accounts.length} sub account${
                      accounts.length === 1 ? "" : "s"
                    }`}
              </p>
              <p className="text-xs text-tg-ink/55">
                Separate Test Generator logins — not Academy Management
                teachers.
              </p>
            </div>
          </div>
          <div className="tg-papers-toolbar-right">
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-tg-ink px-3 py-2 text-sm font-semibold text-tg-cream transition hover:bg-tg-blue"
            >
              <Plus className="size-4" />
              Add sub account
            </button>
          </div>
        </section>

        <div className="tg-papers-table-wrap overflow-x-auto">
          <table className="tg-papers-table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="tg-papers-empty">
                    Loading sub accounts…
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="tg-papers-empty">
                    No sub accounts yet. Add a login for someone who should
                    generate papers (separate from school Teachers).
                  </td>
                </tr>
              ) : (
                accounts.map((row, index) => (
                  <tr key={row._id}>
                    <td className="tabular-nums text-tg-ink/60">{index + 1}</td>
                    <td className="tg-papers-name font-medium">{row.name}</td>
                    <td className="text-sm text-tg-ink/80">{row.email}</td>
                    <td>
                      <span
                        className={[
                          "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold",
                          row.isActive !== false
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800",
                        ].join(" ")}
                      >
                        {row.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-sm">
                      {formatWhen(row.createdAt)}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-tg-mist/70 px-2 py-1 text-xs font-semibold text-tg-ink hover:bg-tg-cream/80"
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(row)}
                          className="inline-flex items-center rounded-lg border border-tg-mist/70 px-2 py-1 text-xs font-semibold text-tg-ink hover:bg-tg-cream/80"
                        >
                          {row.isActive !== false ? "Deactivate" : "Activate"}
                        </button>
                        {row.isActive === false ? (
                          <button
                            type="button"
                            onClick={() => removeAccount(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800"
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-tg-ink/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
          <form
            onSubmit={handleSubmit}
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-tg-mist/40 bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-tg-ink">
                {editing ? "Edit sub account" : "Add sub account"}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="grid size-9 place-items-center rounded-lg hover:bg-tg-cream"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-tg-ink">Name *</span>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full rounded-xl border border-tg-mist/60 bg-tg-cream/40 px-3 py-2.5"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-tg-ink">
                  Email *
                </span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, email: e.target.value }))
                  }
                  className="w-full rounded-xl border border-tg-mist/60 bg-tg-cream/40 px-3 py-2.5"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-tg-ink">
                  Password {editing ? "(leave blank to keep)" : "*"}
                </span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, password: e.target.value }))
                  }
                  className="w-full rounded-xl border border-tg-mist/60 bg-tg-cream/40 px-3 py-2.5"
                  minLength={editing ? undefined : 6}
                  required={!editing}
                  autoComplete="new-password"
                />
              </label>
              {editing ? (
                <label className="flex items-center gap-2 text-sm font-medium text-tg-ink">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, isActive: e.target.checked }))
                    }
                    className="size-4 rounded border-tg-mist"
                  />
                  Active (can log in)
                </label>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-tg-mist/70 px-3 py-2 text-sm font-semibold text-tg-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-tg-ink px-3 py-2 text-sm font-semibold text-tg-cream disabled:opacity-60"
              >
                {submitting ? "Saving…" : editing ? "Update" : "Create"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      <TgConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete sub account?"
        message={
          deleteTarget
            ? `Delete “${deleteTarget.name}”? Deactivate first if still active.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={performDeleteAccount}
      />
    </GeneratorLayout>
  );
}

export default GeneratorSubAccounts;
