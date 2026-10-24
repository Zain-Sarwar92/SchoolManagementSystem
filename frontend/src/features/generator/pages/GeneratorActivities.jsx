import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  FileX2,
  LogIn,
  Printer,
  RefreshCw,
  Search,
  UsersRound,
} from "lucide-react";
import GeneratorLayout from "../components/GeneratorLayout.jsx";
import { toast } from "../../../components/ui/toast.jsx";
import api from "../../../services/api.js";
import {
  ACTION_LABELS,
  ACTION_TONES,
  ACTIVITY_CATEGORIES,
  categoryById,
  categoryCount,
  formatActivityWhen,
  roleLabel,
} from "../utils/activityCategories.js";

const CATEGORY_ICONS = {
  all: Activity,
  login: LogIn,
  paper_generation: FilePlus2,
  paper_updates: RefreshCw,
  paper_deletion: FileX2,
  paper_print: Printer,
  sub_accounts: UsersRound,
};

function GeneratorActivities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [countsByAction, setCountsByAction] = useState({});
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 40,
    total: 0,
    pages: 1,
  });

  const category = useMemo(() => categoryById(categoryId), [categoryId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "40");
      params.set("counts", "1");
      if (category.actions?.length) {
        params.set("actions", category.actions.join(","));
      }
      if (appliedQuery.trim()) params.set("q", appliedQuery.trim());

      const { data } = await api.get(`/activities?${params.toString()}`);
      setActivities(data.activities || []);
      setPagination(
        data.pagination || { page: 1, limit: 40, total: 0, pages: 1 }
      );
      if (data.countsByAction && typeof data.countsByAction === "object") {
        setCountsByAction(data.countsByAction);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load activities");
    } finally {
      setLoading(false);
    }
  }, [page, category, appliedQuery]);

  useEffect(() => {
    load();
  }, [load]);

  const onSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedQuery(query.trim());
  };

  const selectCategory = (id) => {
    if (id === categoryId) return;
    setCategoryId(id);
    setPage(1);
  };

  const activeLabel = category.label;

  return (
    <GeneratorLayout title="Account Activities" wide>
      <div className="tg-papers-page space-y-4">
        <section className="tg-papers-toolbar">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-tg-ink/8 text-tg-ink">
              <Activity className="size-4" aria-hidden />
            </span>
            <div>
              <p className="tg-papers-count">
                {loading
                  ? "Loading…"
                  : `${pagination.total} ${activeLabel.toLowerCase()} log${
                      pagination.total === 1 ? "" : "s"
                    }`}
              </p>
              <p className="text-xs text-tg-ink/55">
                Tap a heading to filter — Login, paper generation, deletion, and
                more.
              </p>
            </div>
          </div>
          <div className="tg-papers-toolbar-right flex flex-wrap items-center gap-2">
            <form onSubmit={onSearch} className="tg-papers-search">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, summary…"
                aria-label="Search activities"
              />
              <button
                type="submit"
                className="tg-papers-search-btn"
                title="Search"
              >
                <Search className="size-4" />
              </button>
            </form>
          </div>
        </section>

        {/* Category headings — same idea as Login / Paper generation / Paper deletion */}
        <nav
          className="flex flex-wrap gap-2"
          aria-label="Activity categories"
        >
          {ACTIVITY_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.id] || Activity;
            const active = cat.id === categoryId;
            const count = categoryCount(cat, countsByAction);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => selectCategory(cat.id)}
                aria-pressed={active}
                className={[
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                  active
                    ? "border-tg-ink bg-tg-ink text-tg-cream shadow-sm"
                    : "border-tg-mist/70 bg-white text-tg-ink hover:border-tg-ink/40 hover:bg-tg-cream/50",
                ].join(" ")}
              >
                <Icon className="size-3.5 shrink-0 opacity-90" aria-hidden />
                <span>{cat.label}</span>
                <span
                  className={[
                    "rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                    active
                      ? "bg-white/15 text-tg-cream"
                      : "bg-tg-ink/8 text-tg-ink/70",
                  ].join(" ")}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="tg-papers-table-wrap overflow-x-auto">
          <table className="tg-papers-table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>When</th>
                <th>Action</th>
                <th>User</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="tg-papers-empty">
                    Loading {activeLabel.toLowerCase()} logs…
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="tg-papers-empty">
                    No {activeLabel.toLowerCase()} activity yet.
                  </td>
                </tr>
              ) : (
                activities.map((row, index) => (
                  <tr key={row._id}>
                    <td className="tabular-nums text-tg-ink/60">
                      {(pagination.page - 1) * pagination.limit + index + 1}
                    </td>
                    <td className="whitespace-nowrap text-sm">
                      {formatActivityWhen(row.createdAt)}
                    </td>
                    <td>
                      <span
                        className={[
                          "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold",
                          ACTION_TONES[row.action] ||
                            "bg-slate-100 text-slate-700",
                        ].join(" ")}
                      >
                        {ACTION_LABELS[row.action] || row.action}
                      </span>
                    </td>
                    <td>
                      <div className="tg-papers-user">
                        <span className="font-medium text-tg-ink">
                          {row.actorName || "—"}
                        </span>
                        <span className="block text-xs text-tg-ink/55">
                          {row.actorEmail || ""}
                          {row.actorRole
                            ? ` · ${roleLabel(row.actorRole)}`
                            : ""}
                        </span>
                      </div>
                    </td>
                    <td className="max-w-md text-sm text-tg-ink/85">
                      {row.summary}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 ? (
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-tg-ink/60">
              Page {pagination.page} of {pagination.pages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-tg-mist/60 bg-white px-2.5 py-1.5 text-xs font-semibold text-tg-ink disabled:opacity-40"
              >
                <ChevronLeft className="size-3.5" />
                Prev
              </button>
              <button
                type="button"
                disabled={page >= pagination.pages || loading}
                onClick={() =>
                  setPage((p) => Math.min(pagination.pages, p + 1))
                }
                className="inline-flex items-center gap-1 rounded-lg border border-tg-mist/60 bg-white px-2.5 py-1.5 text-xs font-semibold text-tg-ink disabled:opacity-40"
              >
                Next
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </GeneratorLayout>
  );
}

export default GeneratorActivities;
