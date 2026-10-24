import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CircleDollarSign,
  FilePlus2,
  ClipboardList,
  GraduationCap,
  RefreshCw,
  Users,
  Wallet,
} from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { useAcademyNav } from "../hooks/useAcademyNav.js";
import { toast } from "../components/ui/toast.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api.js";
import {
  academyHasModule,
  isTestGeneratorOnly,
} from "../utils/academyModules.js";
import { GeneratorDashboard } from "../features/generator/index.js";

function formatMoney(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-PK")}`;
}

function KpiCard({ label, value, hint, icon: Icon, tone = "navy" }) {
  const tones = {
    navy: "bg-navy text-blush",
    soft: "bg-blush/70 text-navy",
    warn: "bg-amber-50 text-navy border border-amber-200/80",
    ok: "bg-emerald-50 text-navy border border-emerald-200/80",
  };
  return (
    <div
      className={[
        "rounded-2xl px-4 py-3.5 shadow-sm",
        tones[tone] || tones.soft,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
            {label}
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
            {value}
          </p>
          {hint ? (
            <p className="mt-0.5 text-xs opacity-75">{hint}</p>
          ) : null}
        </div>
        {Icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/20">
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Panel({ title, action, children, className = "" }) {
  return (
    <section
      className={[
        "rounded-2xl border border-rose/35 bg-white/90 p-4 shadow-sm",
        className,
      ].join(" ")}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-navy">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function AcademyAdminDashboard() {
  const navItems = useAcademyNav();
  const { user } = useAuth();
  const tgOnly = isTestGeneratorOnly(user?.academy);
  const [academy, setAcademy] = useState(null);
  const [ops, setOps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = async ({ soft = false } = {}) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const academyRes = await api.get("/academies/me");
      const nextAcademy = academyRes.data.academy;
      setAcademy(nextAcademy);

      if (academyHasModule(nextAcademy, "ACADEMY_MANAGEMENT")) {
        const opsRes = await api.get("/academies/me/ops-dashboard");
        setOps(opsRes.data);
      } else {
        setOps(null);
      }
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to load dashboard";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (tgOnly) return;
    load();
  }, [tgOnly]);

  // PTS-style Test Generator dashboard — completely separate from AM UI
  if (tgOnly) {
    return <GeneratorDashboard />;
  }

  const hasManagement = academyHasModule(
    academy || user?.academy,
    "ACADEMY_MANAGEMENT"
  );
  const hasTestGenerator = academyHasModule(
    academy || user?.academy,
    "TEST_GENERATOR"
  );
  const kpis = ops?.kpis;
  const classes = ops?.classes || [];
  const defaulters = ops?.fees?.defaulters || [];
  const todayPayments = ops?.fees?.todayPayments || [];
  const incomplete = ops?.results?.incomplete || [];

  return (
    <DashboardLayout title="Dashboard" navItems={navItems}>
      <div className="space-y-4 sm:space-y-5">
        {/* Header */}
        <section className="sms-surface rounded-2xl p-4 sm:rounded-3xl sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              {academy?.logo ? (
                <img
                  src={academy.logo}
                  alt=""
                  className="size-12 rounded-2xl border border-rose/40 bg-bg-soft object-contain p-1"
                />
              ) : (
                <div className="grid size-12 place-items-center rounded-2xl bg-blush text-navy">
                  <Building2 className="size-6" aria-hidden />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-semibold text-navy">
                  {loading ? "Loading…" : academy?.name || "Academy"}
                </h2>
                <p className="text-sm text-slate">
                  {hasManagement && hasTestGenerator
                    ? "Operations desk"
                    : hasTestGenerator
                      ? "Test Generator"
                      : "Operations desk"}
                  {ops?.session ? ` · ${ops.session}` : ""}
                  {user?.name ? ` · Hi ${user.name}` : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => load({ soft: true })}
                disabled={loading || refreshing}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-rose/50 bg-white px-3 text-sm font-semibold text-navy transition hover:bg-blush disabled:opacity-60"
              >
                <RefreshCw
                  className={[
                    "size-3.5",
                    refreshing ? "animate-spin" : "",
                  ].join(" ")}
                />
                Refresh
              </button>
              {hasTestGenerator ? (
                <Link
                  to="/academy/generator"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-navy px-3 text-sm font-semibold text-blush"
                >
                  Generate paper
                  <ArrowRight className="size-3.5" />
                </Link>
              ) : null}
              {hasManagement ? (
                <Link
                  to="/academy/fees"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-navy px-3 text-sm font-semibold text-blush"
                >
                  Fee desk
                  <ArrowRight className="size-3.5" />
                </Link>
              ) : null}
            </div>
          </div>

          {error ? (
            <p
              className="mt-3 rounded-xl bg-rose/50 px-3 py-2 text-sm text-navy"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {hasManagement ? (
            <>
              {/* KPIs */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  label="Students"
                  value={loading ? "…" : kpis?.students ?? 0}
                  hint={`${kpis?.classes ?? 0} classes · ${kpis?.sections ?? 0} sections`}
                  icon={Users}
                  tone="navy"
                />
                <KpiCard
                  label="Open dues"
                  value={loading ? "…" : formatMoney(kpis?.openDuesAmount)}
                  hint={`${kpis?.openDuesCount ?? 0} unpaid charge(s)`}
                  icon={AlertTriangle}
                  tone="warn"
                />
                <KpiCard
                  label="Today collected"
                  value={loading ? "…" : formatMoney(kpis?.todayCollectionAmount)}
                  hint={`${kpis?.todayPaymentCount ?? 0} payment(s)`}
                  icon={Wallet}
                  tone="ok"
                />
                <KpiCard
                  label="Results incomplete"
                  value={loading ? "…" : kpis?.incompleteResultSheets ?? 0}
                  hint={`${kpis?.exams ?? 0} exam(s) this session`}
                  icon={ClipboardList}
                  tone="soft"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/academy/students"
                  className="inline-flex min-h-9 items-center rounded-lg border border-rose/45 bg-white px-3 text-xs font-semibold text-navy hover:bg-blush"
                >
                  Students
                </Link>
                <Link
                  to="/academy/fees"
                  className="inline-flex min-h-9 items-center rounded-lg border border-rose/45 bg-white px-3 text-xs font-semibold text-navy hover:bg-blush"
                >
                  Fees
                </Link>
                <Link
                  to="/academy/results"
                  className="inline-flex min-h-9 items-center rounded-lg border border-rose/45 bg-white px-3 text-xs font-semibold text-navy hover:bg-blush"
                >
                  Results
                </Link>
                <Link
                  to="/academy/classes"
                  className="inline-flex min-h-9 items-center rounded-lg border border-rose/45 bg-white px-3 text-xs font-semibold text-navy hover:bg-blush"
                >
                  Classes
                </Link>
              </div>
            </>
          ) : hasTestGenerator ? (
            <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-navy text-blush">
                  <FilePlus2 className="size-4" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-navy">Test Generator</p>
                  <p className="mt-1 text-sm text-slate">
                    Standalone paper app — zero link to Academy Management modules.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to="/academy/generator"
                      className="inline-flex min-h-9 items-center rounded-lg bg-navy px-3 text-xs font-semibold text-blush"
                    >
                      Generate paper
                    </Link>
                    <Link
                      to="/academy/generator/papers"
                      className="inline-flex min-h-9 items-center rounded-lg border border-rose/45 bg-white px-3 text-xs font-semibold text-navy"
                    >
                      Saved papers
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {hasManagement ? (
        <>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Enrollment */}
          <Panel
            title="Students by class"
            action={
              <Link
                to="/academy/students"
                className="text-xs font-semibold text-navy underline"
              >
                View all
              </Link>
            }
          >
            {loading ? (
              <p className="text-sm text-slate">Loading enrollment…</p>
            ) : classes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-rose/40 px-3 py-6 text-center text-sm text-slate">
                No active classes yet.{" "}
                <Link to="/academy/classes" className="font-medium text-navy underline">
                  Add a class
                </Link>
              </p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-auto pr-1">
                {classes.map((klass) => (
                  <li
                    key={klass._id}
                    className="rounded-xl border border-rose/30 bg-bg-soft/80 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-navy">
                        <GraduationCap className="size-3.5 text-slate" />
                        {klass.name}
                      </p>
                      <span className="text-xs font-semibold tabular-nums text-slate">
                        {klass.studentCount} student
                        {klass.studentCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(klass.sections || []).map((section) => (
                        <span
                          key={section._id}
                          className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-0.5 text-xs text-navy ring-1 ring-rose/30"
                        >
                          {section.name}
                          <span className="font-semibold tabular-nums text-slate">
                            {section.studentCount}
                          </span>
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Defaulters */}
          <Panel
            title="Fee defaulters"
            action={
              <Link
                to="/academy/fees"
                className="text-xs font-semibold text-navy underline"
              >
                Fee desk
              </Link>
            }
          >
            {loading ? (
              <p className="text-sm text-slate">Loading dues…</p>
            ) : defaulters.length === 0 ? (
              <p className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-3 py-6 text-center text-sm text-navy">
                No open balances for this session.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-rose/30 text-xs uppercase tracking-wide text-slate">
                      <th className="py-2 pr-2 font-semibold">Student</th>
                      <th className="py-2 pr-2 font-semibold">Roll</th>
                      <th className="py-2 text-right font-semibold">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {defaulters.map((row) => (
                      <tr
                        key={row.student._id}
                        className="border-b border-rose/20 last:border-0"
                      >
                        <td className="py-2 pr-2 font-medium text-navy">
                          {row.student.name}
                          <span className="mt-0.5 block text-xs font-normal text-slate">
                            {row.dues} due{row.dues === 1 ? "" : "s"}
                          </span>
                        </td>
                        <td className="py-2 pr-2 tabular-nums text-slate">
                          {row.student.rollNumber}
                        </td>
                        <td className="py-2 text-right font-semibold tabular-nums text-navy">
                          {formatMoney(row.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* Today collection */}
          <Panel
            title="Today’s collection"
            action={
              <span className="text-xs font-semibold tabular-nums text-slate">
                {formatMoney(ops?.fees?.todayCollectionAmount)}
              </span>
            }
          >
            {loading ? (
              <p className="text-sm text-slate">Loading payments…</p>
            ) : todayPayments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-rose/40 px-3 py-6 text-center text-sm text-slate">
                No payments recorded today yet.
              </p>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-auto">
                {todayPayments.map((payment) => (
                  <li
                    key={payment._id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-rose/30 bg-bg-soft/70 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy">
                        {payment.student?.name || "Student"}
                      </p>
                      <p className="text-xs text-slate">
                        Roll {payment.student?.rollNumber || "—"}
                        {payment.receiptNumber
                          ? ` · ${payment.receiptNumber}`
                          : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-navy">
                      {formatMoney(payment.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Incomplete results */}
          <Panel
            title="Results — incomplete marks"
            action={
              <Link
                to="/academy/results"
                className="text-xs font-semibold text-navy underline"
              >
                Open results
              </Link>
            }
          >
            {loading ? (
              <p className="text-sm text-slate">Checking exams…</p>
            ) : incomplete.length === 0 ? (
              <p className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-3 py-6 text-center text-sm text-navy">
                {ops?.kpis?.exams
                  ? "All linked exam sheets look complete for this session."
                  : "No exams in this session yet."}
              </p>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-auto">
                {incomplete.map((row) => (
                  <li key={`${row.examId}:${row.sectionId}`}>
                    <Link
                      to={`/academy/results/sections/${row.sectionId}/exams/${row.examId}`}
                      className="flex items-start justify-between gap-3 rounded-xl border border-rose/30 bg-bg-soft/70 px-3 py-2.5 transition hover:border-navy/30 hover:bg-blush/40"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-navy">
                          {row.examName}
                          <span className="font-normal text-slate">
                            {" "}
                            · {row.className} {row.sectionName}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-slate">
                          {row.enteredMarks}/{row.expectedMarks} marks entered
                          {" · "}
                          {row.missingMarks} missing
                          {" · "}
                          {row.subjects} subject
                          {row.subjects === 1 ? "" : "s"}
                        </p>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-rose/40">
                          <div
                            className="h-full rounded-full bg-navy transition-all"
                            style={{
                              width: `${Math.min(100, row.progressPercent)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-navy">
                        {row.progressPercent}%
                      </span>
                    </Link>
                  </li>
                ))}
                {(ops?.results?.incompleteTotal || 0) > incomplete.length ? (
                  <li className="pt-1 text-center text-xs text-slate">
                    +{ops.results.incompleteTotal - incomplete.length} more —
                    open Results for the full list
                  </li>
                ) : null}
              </ul>
            )}
          </Panel>
        </div>

        {/* Quick actions strip */}
        <section className="grid gap-2 sm:grid-cols-3">
          <Link
            to="/academy/fees"
            className="flex items-center gap-3 rounded-2xl border border-rose/35 bg-white/90 px-4 py-3 transition hover:bg-blush/50"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-navy text-blush">
              <CircleDollarSign className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-navy">
                Collect fees
              </span>
              <span className="block text-xs text-slate">
                Open fee desk & dues
              </span>
            </span>
          </Link>
          <Link
            to="/academy/results"
            className="flex items-center gap-3 rounded-2xl border border-rose/35 bg-white/90 px-4 py-3 transition hover:bg-blush/50"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-navy text-blush">
              <ClipboardList className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-navy">
                Enter marks
              </span>
              <span className="block text-xs text-slate">
                Finish incomplete sheets
              </span>
            </span>
          </Link>
          <Link
            to="/academy/students"
            className="flex items-center gap-3 rounded-2xl border border-rose/35 bg-white/90 px-4 py-3 transition hover:bg-blush/50"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-navy text-blush">
              <Users className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-navy">
                Manage students
              </span>
              <span className="block text-xs text-slate">
                Roster, rolls, promote
              </span>
            </span>
          </Link>
        </section>
        </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

export default AcademyAdminDashboard;
