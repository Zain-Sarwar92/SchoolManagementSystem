import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Banknote,
  CircleDollarSign,
  Loader2,
  Plus,
  Printer,
  Receipt,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import CustomSelect from "../components/ui/CustomSelect.jsx";
import { useAcademyNav } from "../hooks/useAcademyNav.js";
import { toast } from "../components/ui/toast.jsx";
import api from "../services/api.js";
import { academicSession, sessionChoices } from "../utils/studentListPrint.js";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "collect", label: "Collect" },
  { id: "generate", label: "Generate" },
  { id: "dues", label: "Dues" },
  { id: "types", label: "Fee types" },
];

const FREQUENCY_LABELS = {
  monthly: "Monthly",
  one_time: "One-time",
};

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "one_time", label: "One-time" },
];

const CATEGORY_OPTIONS = [
  { value: "other", label: "Other" },
  { value: "lab", label: "Lab" },
  { value: "transport", label: "Transport" },
  { value: "test", label: "Test / exam" },
  { value: "admission", label: "Admission" },
  { value: "tuition", label: "Tuition" },
  { value: "generator", label: "Generator" },
];

const EMPTY_NEW_HEAD = {
  name: "",
  category: "other",
  frequency: "monthly",
  defaultAmount: "",
  description: "",
};

const CALENDAR_MONTHS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Open (unpaid / partial)" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "waived", label: "Waived" },
];

function currentPeriodKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function periodOptions(count = 18) {
  const options = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    options.push({ value, label });
  }
  return options;
}

function formatMoney(value) {
  const n = Number(value) || 0;
  return `Rs ${n.toLocaleString("en-PK")}`;
}

function statusTone(status) {
  switch (status) {
    case "paid":
      return "bg-lavender/30 text-navy";
    case "partial":
      return "bg-blush text-navy";
    case "waived":
      return "bg-bg-soft text-slate";
    default:
      return "bg-rose/45 text-navy";
  }
}

function AcademyFees() {
  const navItems = useAcademyNav();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "overview";

  const [session, setSession] = useState(
    () => searchParams.get("session") || academicSession()
  );
  const [periodKey, setPeriodKey] = useState(
    () => searchParams.get("period") || currentPeriodKey()
  );

  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [heads, setHeads] = useState([]);
  const [summary, setSummary] = useState(null);
  const [dues, setDues] = useState([]);
  const [duesStatuses, setDuesStatuses] = useState(["open"]);
  const [duesQuery, setDuesQuery] = useState("");
  const [duesFeeHeadIds, setDuesFeeHeadIds] = useState([]);
  const [filterClassIds, setFilterClassIds] = useState([]);
  const [filterSectionIds, setFilterSectionIds] = useState([]);
  const [generateHeadIds, setGenerateHeadIds] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingDues, setLoadingDues] = useState(false);

  const [studentQuery, setStudentQuery] = useState("");
  const [studentHits, setStudentHits] = useState([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [headDrafts, setHeadDrafts] = useState({});
  const [headMonthDrafts, setHeadMonthDrafts] = useState({});
  const [savingHeadId, setSavingHeadId] = useState("");
  const [newHead, setNewHead] = useState(EMPTY_NEW_HEAD);
  const [creatingHead, setCreatingHead] = useState(false);
  const [deletingHeadId, setDeletingHeadId] = useState("");

  const sessionOptions = useMemo(
    () => sessionChoices().map((value) => ({ value, label: value })),
    []
  );
  const monthOptions = useMemo(
    () => [
      { value: "ONCE", label: "One-time (Admission)" },
      ...periodOptions(24),
    ],
    []
  );

  const duesHeadOptions = useMemo(
    () => heads.map((h) => ({ value: h._id, label: h.name })),
    [heads]
  );

  const classOptions = useMemo(
    () => classes.map((c) => ({ value: c._id, label: c.name })),
    [classes]
  );

  const sectionOptions = useMemo(() => {
    const scoped = filterClassIds.length
      ? sections.filter((s) =>
          filterClassIds.includes(String(s.class?._id || s.class))
        )
      : sections;
    return scoped.map((s) => ({
      value: s._id,
      label: `${s.name}${s.class?.name ? ` · ${s.class.name}` : ""}`,
    }));
  }, [sections, filterClassIds]);

  const headOptions = useMemo(
    () => heads.map((h) => ({ value: h._id, label: h.name })),
    [heads]
  );

  useEffect(() => {
    if (!generateHeadIds.length && heads.length) {
      const monthly = heads.find((h) => h.name === "Monthly Fee");
      if (monthly) setGenerateHeadIds([monthly._id]);
    }
  }, [heads, generateHeadIds.length]);

  useEffect(() => {
    if (!filterClassIds.length) return;
    setFilterSectionIds((prev) =>
      prev.filter((id) => {
        const section = sections.find((s) => String(s._id) === String(id));
        if (!section) return false;
        return filterClassIds.includes(String(section.class?._id || section.class));
      })
    );
  }, [filterClassIds, sections]);

  const setTab = (next) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    params.set("session", session);
    params.set("period", periodKey);
    setSearchParams(params, { replace: true });
  };

  const loadHeads = useCallback(async () => {
    const headRes = await api.get("/fees/heads");
    const next = headRes.data.heads || [];
    setHeads(next);
    const drafts = {};
    const monthDrafts = {};
    for (const head of next) {
      drafts[head._id] =
        head.defaultAmount == null || head.defaultAmount === ""
          ? ""
          : String(head.defaultAmount);
      monthDrafts[head._id] = Array.isArray(head.applicableMonths)
        ? [...head.applicableMonths].sort((a, b) => a - b)
        : [];
    }
    setHeadDrafts(drafts);
    setHeadMonthDrafts(monthDrafts);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingMeta(true);
    Promise.all([api.get("/classes"), api.get("/sections"), loadHeads()])
      .then(([classRes, sectionRes]) => {
        if (cancelled) return;
        setClasses(classRes.data.classes || []);
        setSections(sectionRes.data.sections || []);
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to load fee setup");
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadHeads]);

  const toggleHeadMonth = (headId, month) => {
    setHeadMonthDrafts((prev) => {
      const current = new Set(prev[headId] || []);
      if (current.has(month)) current.delete(month);
      else current.add(month);
      return {
        ...prev,
        [headId]: [...current].sort((a, b) => a - b),
      };
    });
  };

  const saveFeeHeadAmount = async (head) => {
    const raw = headDrafts[head._id];
    const amount =
      raw === "" || raw == null ? null : Number(raw);
    if (amount != null && (!(amount >= 0) || Number.isNaN(amount))) {
      toast.error("Enter a valid amount (0 or more)");
      return;
    }
    const isGenerator =
      head.name === "Generator Dues" || head.category === "generator";
    // Month limits are only for Generator Dues; clear for every other head.
    const applicableMonths = isGenerator ? headMonthDrafts[head._id] || [] : [];
    setSavingHeadId(head._id);
    try {
      const res = await api.patch(`/fees/heads/${head._id}`, {
        defaultAmount: amount,
        applicableMonths,
      });
      toast.success(res.data.message || "Fee type updated");
      await loadHeads();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update fee type");
    } finally {
      setSavingHeadId("");
    }
  };

  const createCustomFeeHead = async (e) => {
    e.preventDefault();
    const name = newHead.name.trim();
    if (!name) {
      toast.error("Enter a fee type name");
      return;
    }
    const amount =
      newHead.defaultAmount === "" || newHead.defaultAmount == null
        ? null
        : Number(newHead.defaultAmount);
    if (amount != null && (!(amount >= 0) || Number.isNaN(amount))) {
      toast.error("Enter a valid amount (0 or more)");
      return;
    }
    setCreatingHead(true);
    try {
      const res = await api.post("/fees/heads", {
        name,
        category: newHead.category || "other",
        frequency: newHead.frequency || "monthly",
        defaultAmount: amount,
        description: newHead.description.trim(),
      });
      toast.success(res.data.message || "Fee type created");
      setNewHead(EMPTY_NEW_HEAD);
      await loadHeads();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create fee type");
    } finally {
      setCreatingHead(false);
    }
  };

  const deleteFeeHead = async (head) => {
    if (head.name === "Monthly Fee" || head.category === "tuition") {
      toast.error("Monthly Fee cannot be deleted");
      return;
    }
    const ok = window.confirm(`Delete fee type “${head.name}”?`);
    if (!ok) return;
    setDeletingHeadId(head._id);
    try {
      const res = await api.delete(`/fees/heads/${head._id}`);
      toast.success(res.data.message || "Fee type deleted");
      await loadHeads();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete fee type");
    } finally {
      setDeletingHeadId("");
    }
  };

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await api.get("/fees/summary", {
        params: { session, periodKey },
      });
      setSummary(res.data.summary);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load summary");
    } finally {
      setLoadingSummary(false);
    }
  }, [session, periodKey]);

  const loadDues = useCallback(async () => {
    setLoadingDues(true);
    try {
      const res = await api.get("/fees/dues", {
        params: {
          session,
          periodKey,
          statuses: duesStatuses.length ? duesStatuses.join(",") : undefined,
          feeHeadIds: duesFeeHeadIds.length ? duesFeeHeadIds.join(",") : undefined,
          classIds: filterClassIds.length ? filterClassIds.join(",") : undefined,
          sectionIds: filterSectionIds.length ? filterSectionIds.join(",") : undefined,
          q: duesQuery.trim() || undefined,
        },
      });
      setDues(res.data.dues || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load dues");
    } finally {
      setLoadingDues(false);
    }
  }, [
    session,
    periodKey,
    duesStatuses,
    duesFeeHeadIds,
    filterClassIds,
    filterSectionIds,
    duesQuery,
  ]);

  const openStudentCollect = useCallback(
    (studentId) => {
      if (!studentId) return;
      const params = new URLSearchParams();
      params.set("session", session);
      params.set("period", periodKey);
      navigate(`/academy/fees/collect/${studentId}?${params.toString()}`);
    },
    [navigate, session, periodKey]
  );

  useEffect(() => {
    if (tab === "overview" || tab === "generate") loadSummary();
  }, [tab, loadSummary]);

  useEffect(() => {
    if (tab === "dues") loadDues();
  }, [tab, loadDues]);

  useEffect(() => {
    if (tab !== "collect") return undefined;
    const q = studentQuery.trim();
    if (q.length < 1) {
      setStudentHits([]);
      return undefined;
    }
    const handle = setTimeout(() => {
      setSearchingStudents(true);
      api
        .get("/fees/students/search", {
          params: {
            session,
            q,
            classIds: filterClassIds.length ? filterClassIds.join(",") : undefined,
            sectionIds: filterSectionIds.length
              ? filterSectionIds.join(",")
              : undefined,
          },
        })
        .then((res) => setStudentHits(res.data.students || []))
        .catch(() => setStudentHits([]))
        .finally(() => setSearchingStudents(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [studentQuery, session, filterClassIds, filterSectionIds, tab]);

  // Legacy deep-link: /academy/fees?tab=collect&studentId=…
  useEffect(() => {
    const studentId = searchParams.get("studentId");
    if (!studentId) return;
    openStudentCollect(studentId);
  }, [searchParams, openStudentCollect]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post("/fees/generate", {
        session,
        periodKey,
        classIds: filterClassIds,
        sectionIds: filterSectionIds,
        feeHeadIds: generateHeadIds,
      });
      toast.success(res.data.message || "Dues generated");
      loadSummary();
    } catch (err) {
      toast.error(err.response?.data?.message || "Generate failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleWaive = async (chargeId) => {
    if (!window.confirm("Waive this unpaid charge?")) return;
    try {
      await api.post(`/fees/charges/${chargeId}/waive`);
      toast.success("Charge waived");
      if (tab === "dues") loadDues();
      loadSummary();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not waive charge");
    }
  };

  return (
    <DashboardLayout title="Fees" navItems={navItems}>
      <section className="sms-surface rounded-2xl p-4 sm:rounded-3xl sm:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold text-navy">Fee desk</h2>
            <p className="mt-1 text-sm text-slate">
              Generate monthly dues, collect payments, and track outstanding balances.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[22rem]">
            <CustomSelect
              label="Session"
              value={session}
              options={sessionOptions}
              onChange={setSession}
              searchable={false}
            />
            <CustomSelect
              label="Period"
              value={periodKey}
              options={monthOptions}
              onChange={setPeriodKey}
              searchable={false}
            />
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={[
                "min-h-10 rounded-xl px-3.5 text-sm font-semibold transition",
                tab === item.id
                  ? "bg-navy text-blush"
                  : "border border-rose/40 bg-white text-navy hover:bg-blush",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loadingMeta ? (
          <p className="text-sm text-slate">Loading fee module…</p>
        ) : null}

        {tab === "overview" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-rose/35 bg-white px-4 py-4">
                <p className="text-xs font-semibold tracking-wide text-slate uppercase">
                  Billed · {periodKey}
                </p>
                <p className="mt-2 font-display text-2xl font-semibold text-navy">
                  {loadingSummary ? "…" : formatMoney(summary?.billed)}
                </p>
              </div>
              <div className="rounded-2xl border border-rose/35 bg-white px-4 py-4">
                <p className="text-xs font-semibold tracking-wide text-slate uppercase">
                  Collected
                </p>
                <p className="mt-2 font-display text-2xl font-semibold text-navy">
                  {loadingSummary ? "…" : formatMoney(summary?.collected)}
                </p>
              </div>
              <div className="rounded-2xl border border-rose/35 bg-white px-4 py-4">
                <p className="text-xs font-semibold tracking-wide text-slate uppercase">
                  Outstanding
                </p>
                <p className="mt-2 font-display text-2xl font-semibold text-navy">
                  {loadingSummary ? "…" : formatMoney(summary?.outstanding)}
                </p>
                <p className="mt-1 text-xs text-slate">
                  {`${summary?.unpaidCount || 0} open charge${
                    (summary?.unpaidCount || 0) === 1 ? "" : "s"
                  }`}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setTab("collect")}
                className="flex items-start gap-3 rounded-2xl border border-rose/35 bg-blush/40 px-4 py-4 text-left transition hover:bg-blush"
              >
                <Banknote className="mt-0.5 size-5 text-navy" aria-hidden="true" />
                <span>
                  <span className="block font-semibold text-navy">Collect fee</span>
                  <span className="mt-0.5 block text-sm text-slate">
                    Search student and record payment
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTab("generate")}
                className="flex items-start gap-3 rounded-2xl border border-rose/35 bg-white px-4 py-4 text-left transition hover:bg-blush/50"
              >
                <Sparkles className="mt-0.5 size-5 text-navy" aria-hidden="true" />
                <span>
                  <span className="block font-semibold text-navy">Generate month</span>
                  <span className="mt-0.5 block text-sm text-slate">
                    Create dues from monthlyFee
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTab("dues")}
                className="flex items-start gap-3 rounded-2xl border border-rose/35 bg-white px-4 py-4 text-left transition hover:bg-blush/50"
              >
                <Receipt className="mt-0.5 size-5 text-navy" aria-hidden="true" />
                <span>
                  <span className="block font-semibold text-navy">Open dues</span>
                  <span className="mt-0.5 block text-sm text-slate">
                    View unpaid / partial charges
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTab("types")}
                className="flex items-start gap-3 rounded-2xl border border-rose/35 bg-white px-4 py-4 text-left transition hover:bg-blush/50 sm:col-span-3"
              >
                <Settings2 className="mt-0.5 size-5 text-navy" aria-hidden="true" />
                <span>
                  <span className="block font-semibold text-navy">Fee types</span>
                  <span className="mt-0.5 block text-sm text-slate">
                    Amounts per academy · Generator Dues month limits
                  </span>
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {tab === "types" ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-rose/35 bg-white p-4 sm:p-5">
              <h3 className="font-display text-lg font-semibold text-navy">
                Fee types for this academy
              </h3>
              <p className="mt-1 text-sm text-slate">
                Add your own fee types, set amounts, then use them in Generate and Collect.
                Month limits apply only to <strong>Generator Dues</strong>.
              </p>
            </div>

            <form
              onSubmit={createCustomFeeHead}
              className="rounded-2xl border border-dashed border-rose/50 bg-bg-soft/60 p-4 sm:p-5"
            >
              <h3 className="font-display text-base font-semibold text-navy">
                Add fee type
              </h3>
              <p className="mt-1 text-sm text-slate">
                e.g. Lab fee, Transport, Sports — monthly or one-time.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block text-sm sm:col-span-2 lg:col-span-2">
                  <span className="mb-1 block font-medium text-navy">Name *</span>
                  <input
                    value={newHead.name}
                    onChange={(e) =>
                      setNewHead((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g. Transport fee"
                    className="w-full rounded-xl border border-rose/60 bg-white px-3 py-2.5 text-navy outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/40"
                  />
                </label>
                <CustomSelect
                  label="Frequency"
                  searchable={false}
                  value={newHead.frequency}
                  options={FREQUENCY_OPTIONS}
                  onChange={(value) =>
                    setNewHead((prev) => ({ ...prev, frequency: value }))
                  }
                />
                <CustomSelect
                  label="Category"
                  searchable={false}
                  value={newHead.category}
                  options={CATEGORY_OPTIONS}
                  onChange={(value) =>
                    setNewHead((prev) => ({ ...prev, category: value }))
                  }
                />
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-navy">
                    Default amount (Rs)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={newHead.defaultAmount}
                    onChange={(e) =>
                      setNewHead((prev) => ({
                        ...prev,
                        defaultAmount: e.target.value,
                      }))
                    }
                    placeholder="e.g. 1500"
                    className="w-full rounded-xl border border-rose/60 bg-white px-3 py-2.5 text-navy outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/40"
                  />
                </label>
                <label className="block text-sm sm:col-span-2 lg:col-span-3">
                  <span className="mb-1 block font-medium text-navy">
                    Note (optional)
                  </span>
                  <input
                    value={newHead.description}
                    onChange={(e) =>
                      setNewHead((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Short note for staff"
                    className="w-full rounded-xl border border-rose/60 bg-white px-3 py-2.5 text-navy outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/40"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={creatingHead}
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-blush transition hover:bg-slate disabled:opacity-60"
              >
                {creatingHead ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                {creatingHead ? "Adding…" : "Add fee type"}
              </button>
            </form>

            {heads.length === 0 ? (
              <p className="text-sm text-slate">No fee types yet.</p>
            ) : (
              <div className="space-y-3">
                {heads.map((head) => {
                  const isTuitionMonthly =
                    head.name === "Monthly Fee" || head.category === "tuition";
                  const isGenerator =
                    head.name === "Generator Dues" || head.category === "generator";
                  const showMonths = isGenerator;
                  const selectedMonths = headMonthDrafts[head._id] || [];
                  const canDelete = !isTuitionMonthly;
                  return (
                    <div
                      key={head._id}
                      className="rounded-2xl border border-rose/35 bg-white px-4 py-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-base font-semibold text-navy">
                              {head.name}
                            </h3>
                            <span className="rounded-md bg-blush px-1.5 py-0.5 text-[10px] font-bold uppercase text-navy">
                              {FREQUENCY_LABELS[head.frequency] || head.frequency}
                            </span>
                            <span className="rounded-md bg-lavender/25 px-1.5 py-0.5 text-[10px] font-bold uppercase text-navy">
                              {head.category}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate">
                            {head.frequency === "one_time"
                              ? "Charged once per student."
                              : isTuitionMonthly
                                ? "Amount comes from each student’s monthlyFee. Charged every month when generated."
                                : isGenerator
                                  ? "Fixed academy amount. Use months below to skip seasons (e.g. winter)."
                                  : head.category === "test" || head.name === "Test Dues"
                                    ? "Fixed academy test/exam dues. Generate for the month, then collect."
                                    : "Uses this academy’s default amount."}
                          </p>
                        </div>
                        <div className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-row sm:items-end lg:w-auto">
                          <label className="block min-w-0 flex-1 text-sm">
                            <span className="mb-1 block font-medium text-navy">
                              Default amount (Rs)
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={headDrafts[head._id] ?? ""}
                              onChange={(e) =>
                                setHeadDrafts((prev) => ({
                                  ...prev,
                                  [head._id]: e.target.value,
                                }))
                              }
                              placeholder={isTuitionMonthly ? "Uses student fee" : "e.g. 500"}
                              className="w-full rounded-xl border border-rose/60 bg-white px-3 py-2.5 text-navy outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/40"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => saveFeeHeadAmount(head)}
                            disabled={savingHeadId === head._id}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-blush transition hover:bg-slate disabled:opacity-60"
                          >
                            {savingHeadId === head._id ? (
                              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                            ) : null}
                            Save
                          </button>
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => deleteFeeHead(head)}
                              disabled={deletingHeadId === head._id}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose/50 px-3 text-sm font-semibold text-[#a33b4a] transition hover:bg-rose/40 disabled:opacity-60"
                              title="Delete fee type"
                            >
                              {deletingHeadId === head._id ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                              ) : (
                                <Trash2 className="size-4" aria-hidden="true" />
                              )}
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {showMonths ? (
                        <div className="mt-4 border-t border-rose/25 pt-3">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-navy">
                              Applicable months
                              <span className="ml-2 font-normal text-slate">
                                {selectedMonths.length === 0
                                  ? "(every month — Generate/Collect all year)"
                                  : `(only ${selectedMonths.length} month${
                                      selectedMonths.length === 1 ? "" : "s"
                                    } — others skipped)`}
                              </span>
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="text-xs font-semibold text-navy underline-offset-2 hover:underline"
                                onClick={() =>
                                  setHeadMonthDrafts((prev) => ({
                                    ...prev,
                                    [head._id]: CALENDAR_MONTHS.map((m) => m.value),
                                  }))
                                }
                              >
                                All
                              </button>
                              <button
                                type="button"
                                className="text-xs font-semibold text-navy underline-offset-2 hover:underline"
                                onClick={() =>
                                  setHeadMonthDrafts((prev) => ({
                                    ...prev,
                                    [head._id]: [],
                                  }))
                                }
                              >
                                Clear (= every month)
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {CALENDAR_MONTHS.map((month) => {
                              const active = selectedMonths.includes(month.value);
                              return (
                                <button
                                  key={month.value}
                                  type="button"
                                  onClick={() => toggleHeadMonth(head._id, month.value)}
                                  className={[
                                    "min-h-9 rounded-lg px-2.5 text-xs font-semibold transition",
                                    active
                                      ? "bg-navy text-blush"
                                      : "border border-rose/40 bg-white text-navy hover:bg-blush",
                                  ].join(" ")}
                                >
                                  {month.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {tab === "generate" ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-rose/35 bg-white p-4 sm:p-5">
              <h3 className="font-display text-lg font-semibold text-navy">
                Generate dues for {periodKey}
              </h3>
              <p className="mt-1 text-sm text-slate">
                Creates charges for active students. Monthly Fee uses each student&apos;s
                monthlyFee; Generator / Admission use Fee types amounts. Generator skips
                months you turned off in Fee types. Existing charges are skipped.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <CustomSelect
                  type="checkbox"
                  label="Class"
                  placeholder="All classes"
                  value={filterClassIds}
                  options={classOptions}
                  onChange={setFilterClassIds}
                />
                <CustomSelect
                  type="checkbox"
                  label="Section"
                  placeholder="All sections"
                  value={filterSectionIds}
                  options={sectionOptions}
                  onChange={setFilterSectionIds}
                />
                <CustomSelect
                  type="checkbox"
                  label="Fee type"
                  placeholder="Select fee types"
                  value={generateHeadIds}
                  options={headOptions}
                  onChange={setGenerateHeadIds}
                />
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-blush transition hover:bg-slate disabled:opacity-60"
              >
                {generating ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
                Generate dues
              </button>
            </div>
          </div>
        ) : null}

        {tab === "collect" ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-rose/30 bg-blush/25 px-4 py-3 sm:px-5">
              <div className="flex items-start gap-3">
                <CircleDollarSign
                  className="mt-0.5 size-5 shrink-0 text-navy"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium text-navy">Collect by student</p>
                  <p className="mt-0.5 text-sm text-slate">
                    Search and open a student to see fee history on one side and submit
                    payment on the other.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CustomSelect
                type="checkbox"
                label="Class filter"
                placeholder="All classes"
                value={filterClassIds}
                options={classOptions}
                onChange={setFilterClassIds}
              />
              <CustomSelect
                type="checkbox"
                label="Section filter"
                placeholder="All sections"
                value={filterSectionIds}
                options={sectionOptions}
                onChange={setFilterSectionIds}
              />
              <div className="relative sm:col-span-2 lg:col-span-1">
                <label className="mb-1 block text-sm font-medium text-navy">Search</label>
                <Search
                  className="pointer-events-none absolute bottom-3 left-3 size-4 text-slate"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder="Name, roll, phone…"
                  className="w-full rounded-xl border border-rose/60 bg-white py-2.5 pr-4 pl-10 text-navy outline-none transition focus:border-lavender focus:ring-2 focus:ring-lavender/40"
                />
              </div>
            </div>
            <div className="sms-list max-h-[32rem] overflow-y-auto">
              {searchingStudents ? (
                <p className="px-4 py-3 text-sm text-slate">Searching…</p>
              ) : studentHits.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate">
                  {studentQuery.trim()
                    ? "No students found"
                    : "Type a name or roll number to find a student"}
                </p>
              ) : (
                studentHits.map((student) => (
                  <button
                    key={student._id}
                    type="button"
                    onClick={() => openStudentCollect(student._id)}
                    className="sms-row sms-row--link w-full text-left"
                  >
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-navy text-blush">
                      <UserRound className="size-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-navy">{student.name}</p>
                      <p className="text-xs text-slate">
                        {student.rollNumber}
                        {" · "}
                        {student.class?.name || "Class"}
                        {" · "}
                        {student.section?.name || "Section"}
                      </p>
                    </div>
                    {student.outstanding > 0 ? (
                      <span className="rounded-md bg-rose/45 px-2 py-1 text-[11px] font-semibold text-navy">
                        {formatMoney(student.outstanding)}
                      </span>
                    ) : (
                      <span className="rounded-md bg-lavender/30 px-2 py-1 text-[11px] font-semibold text-navy">
                        Clear
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}

        {tab === "dues" ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <p className="text-sm text-slate">
                Filter by status / class / section, then print the paid or unpaid list.
                Admission uses period <strong className="text-navy">One-time</strong>.
              </p>
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set("session", session);
                  if (periodKey) params.set("period", periodKey);
                  if (duesStatuses.length) params.set("statuses", duesStatuses.join(","));
                  if (duesFeeHeadIds.length) {
                    params.set("feeHeadIds", duesFeeHeadIds.join(","));
                  }
                  if (filterClassIds.length) {
                    params.set("classIds", filterClassIds.join(","));
                  }
                  if (filterSectionIds.length) {
                    params.set("sectionIds", filterSectionIds.join(","));
                  }
                  if (duesQuery.trim()) params.set("q", duesQuery.trim());
                  navigate(`/academy/fees/print?${params.toString()}`);
                }}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-blush transition hover:bg-slate"
              >
                <Printer className="size-4" aria-hidden="true" />
                Print list
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CustomSelect
                type="checkbox"
                label="Fee type"
                placeholder="All fee types"
                value={duesFeeHeadIds}
                options={duesHeadOptions}
                onChange={setDuesFeeHeadIds}
              />
              <CustomSelect
                type="checkbox"
                label="Status"
                placeholder="All statuses"
                value={duesStatuses}
                options={STATUS_OPTIONS}
                onChange={setDuesStatuses}
                searchable={false}
              />
              <CustomSelect
                type="checkbox"
                label="Class"
                placeholder="All classes"
                value={filterClassIds}
                options={classOptions}
                onChange={setFilterClassIds}
              />
              <CustomSelect
                type="checkbox"
                label="Section"
                placeholder="All sections"
                value={filterSectionIds}
                options={sectionOptions}
                onChange={setFilterSectionIds}
              />
              <label className="block text-sm sm:col-span-2 lg:col-span-2">
                <span className="mb-1 block font-medium text-navy">Search</span>
                <input
                  type="search"
                  value={duesQuery}
                  onChange={(e) => setDuesQuery(e.target.value)}
                  placeholder="Name / roll…"
                  className="w-full rounded-xl border border-rose/60 bg-white px-3 py-2.5 text-navy outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/40"
                />
              </label>
            </div>

            {loadingDues ? (
              <p className="text-sm text-slate">Loading dues…</p>
            ) : dues.length === 0 ? (
              <div className="rounded-xl border border-dashed border-rose/50 bg-white/60 px-4 py-10 text-center">
                <Receipt className="mx-auto mb-2 size-8 text-lavender" aria-hidden="true" />
                <p className="font-medium text-navy">No dues match these filters</p>
                <p className="mt-1 text-sm text-slate">
                  Generate the month first, or widen filters.
                </p>
              </div>
            ) : (
              <div className="sms-list">
                {dues.map((due) => (
                  <div
                    key={due._id}
                    className="sms-row flex-col items-stretch gap-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-semibold text-navy">
                          {due.student?.name || "Student"}
                        </h3>
                        <span className="font-mono text-xs text-slate">
                          {due.student?.rollNumber}
                        </span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusTone(due.status)}`}
                        >
                          {due.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-slate">
                        {due.feeHead?.name || due.description}
                        {" · "}
                        {due.periodKey === "ONCE" ? "One-time" : due.periodKey}
                        {" · "}
                        {due.student?.class?.name}
                        {" / "}
                        {due.student?.section?.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate">
                        Billed {formatMoney(due.amount)} · Paid {formatMoney(due.paid)} ·
                        Balance {formatMoney(due.balance)}
                      </p>
                    </div>
                    <div className="sms-actions ml-0 sm:ml-auto">
                      <button
                        type="button"
                        className="sms-action"
                        onClick={() => openStudentCollect(due.student?._id)}
                      >
                        Collect
                      </button>
                      {due.balance > 0 && due.paid === 0 && due.status !== "waived" ? (
                        <button
                          type="button"
                          className="sms-action sms-action--danger"
                          onClick={() => handleWaive(due._id)}
                        >
                          Waive
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </section>
    </DashboardLayout>
  );
}

export default AcademyFees;
