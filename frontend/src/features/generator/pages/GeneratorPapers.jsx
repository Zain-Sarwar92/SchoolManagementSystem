import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownUp,
  FilePlus2,
  MoreVertical,
  Pencil,
  Printer,
  Search,
  Trash2,
  X,
} from "lucide-react";
import GeneratorLayout from "../components/GeneratorLayout.jsx";
import TgConfirmModal from "../components/TgConfirmModal.jsx";
import StatusPanel from "../components/StatusPanel.jsx";
import { toast } from "../../../components/ui/toast.jsx";
import api from "../../../services/api.js";

function formatPaperDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCreated(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const COLUMNS = [
  { key: "sr", label: "Sr", sortable: false },
  { key: "title", label: "Paper Name", sortable: true },
  { key: "paperCategory", label: "Exam Name", sortable: true },
  { key: "classLabel", label: "Class", sortable: true },
  { key: "subjectLabel", label: "Subject", sortable: true },
  { key: "examDate", label: "Paper Date", sortable: true },
  { key: "createdAt", label: "Created DateTime", sortable: true },
  { key: "user", label: "User", sortable: true },
  { key: "actions", label: "Actions", sortable: false },
];

function sortValue(paper, key) {
  if (key === "user") {
    return String(paper.createdBy?.name || "").toLowerCase();
  }
  if (key === "examDate" || key === "createdAt") {
    const t = new Date(paper[key] || 0).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  return String(paper[key] || "").toLowerCase();
}

function GeneratorPapers() {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [menuId, setMenuId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const menuRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await api.get("/generator/papers");
      setPapers(data.papers || []);
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to load papers";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = papers;
    if (q) {
      rows = papers.filter((p) => {
        const hay = [
          p.title,
          p.paperCategory,
          p.classLabel,
          p.subjectLabel,
          p.boardLabel,
          p.createdBy?.name,
          formatPaperDate(p.examDate),
          formatCreated(p.createdAt),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [papers, query, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (!COLUMNS.find((c) => c.key === key)?.sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "createdAt" || key === "examDate" ? "desc" : "asc");
    }
  };

  const remove = (paper) => {
    setMenuId(null);
    setDeleteTarget(paper);
  };

  const performDelete = async () => {
    const paper = deleteTarget;
    setDeleteTarget(null);
    if (!paper) return;
    try {
      await api.delete(`/generator/papers/${paper._id}`);
      toast.success("Paper deleted");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  };

  const goPrint = (paper, mode) => {
    setMenuId(null);
    const url = `/academy/generator/print?id=${encodeURIComponent(paper._id)}&mode=${encodeURIComponent(mode)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const goUpdate = (paper) => {
    setMenuId(null);
    navigate(`/academy/generator?edit=${paper._id}`);
  };

  return (
    <GeneratorLayout title="Saved Papers" wide>
      <div className="tg-papers-page space-y-4">
        <section className="tg-papers-toolbar">
          <div>
            <p className="tg-papers-count">
              {loading
                ? "Loading…"
                : `${filtered.length} Record${filtered.length === 1 ? "" : "'s"} Found`}
            </p>
          </div>
          <div className="tg-papers-toolbar-right">
            <label className="tg-papers-search">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search papers…"
                aria-label="Search saved papers"
              />
              <span className="tg-papers-search-btn" aria-hidden>
                <Search className="size-4" />
              </span>
            </label>
            <Link
              to="/academy/generator"
              className="tg-btn-primary inline-flex min-h-10 items-center gap-2 px-3 text-sm"
            >
              <FilePlus2 className="size-4" />
              Generate paper
            </Link>
          </div>
        </section>

        {loading || loadError || papers.length === 0 ? (
          <StatusPanel
            loading={loading}
            error={loadError}
            loadingLabel="Loading papers…"
            onRetry={loadError ? load : null}
            empty={!loading && !loadError && papers.length === 0}
            emptyTitle="No papers yet"
            emptyHint="Generate your first paper from the syllabus catalog."
          >
            {!loading && !loadError && papers.length === 0 ? (
              <Link
                to="/academy/generator"
                className="tg-btn-primary mt-4 inline-flex px-3 py-2 text-sm"
              >
                Generate paper
              </Link>
            ) : null}
          </StatusPanel>
        ) : null}
        {!loading && !loadError && papers.length > 0 ? (
          <div className="tg-papers-table-wrap" ref={menuRef}>
            <table className="tg-papers-table">
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th key={col.key}>
                      {col.sortable ? (
                        <button
                          type="button"
                          className="tg-papers-sort"
                          onClick={() => toggleSort(col.key)}
                        >
                          <span>{col.label}</span>
                          <ArrowDownUp
                            className={[
                              "size-3.5 shrink-0 opacity-70",
                              sortKey === col.key ? "text-white opacity-100" : "",
                            ].join(" ")}
                          />
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="tg-papers-empty">
                      No papers match “{query}”.
                    </td>
                  </tr>
                ) : (
                  filtered.map((paper, index) => (
                    <tr key={paper._id}>
                      <td>{index + 1}</td>
                      <td className="tg-papers-name">{paper.title || "—"}</td>
                      <td>{paper.paperCategory || "—"}</td>
                      <td>{paper.classLabel || "—"}</td>
                      <td
                        className={
                          /[\u0600-\u06FF]/.test(paper.subjectLabel || "")
                            ? "tg-font-urdu"
                            : ""
                        }
                        dir={
                          /[\u0600-\u06FF]/.test(paper.subjectLabel || "")
                            ? "rtl"
                            : undefined
                        }
                      >
                        {paper.subjectLabel || "—"}
                      </td>
                      <td>{formatPaperDate(paper.examDate)}</td>
                      <td>{formatCreated(paper.createdAt)}</td>
                      <td className="tg-papers-user">
                        {paper.createdBy?.name || "—"}
                      </td>
                      <td className="tg-papers-actions-cell">
                        <button
                          type="button"
                          className="tg-papers-kebab"
                          aria-label="Paper actions"
                          aria-expanded={menuId === paper._id}
                          onClick={() =>
                            setMenuId((id) =>
                              id === paper._id ? null : paper._id
                            )
                          }
                        >
                          <MoreVertical className="size-4" />
                        </button>
                        {menuId === paper._id ? (
                          <div className="tg-papers-menu" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => goUpdate(paper)}
                            >
                              <Pencil className="size-3.5" />
                              Update Paper
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => goPrint(paper, "single")}
                            >
                              <Printer className="size-3.5" />
                              Print Single Copy
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => goPrint(paper, "double-v")}
                            >
                              <Printer className="size-3.5" />
                              Print 2 Copies (Vertical)
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => goPrint(paper, "double-h")}
                            >
                              <Printer className="size-3.5" />
                              Print 2 Copies (Horizontal)
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="tg-papers-menu-danger"
                              onClick={() => remove(paper)}
                            >
                              <X className="size-3.5" />
                              Delete Paper
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <TgConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete paper?"
        message={
          deleteTarget
            ? `Delete “${deleteTarget.title}”?`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={performDelete}
      />
    </GeneratorLayout>
  );
}

export default GeneratorPapers;
