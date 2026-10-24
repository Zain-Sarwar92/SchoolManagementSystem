import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import CustomSelect from "../components/ui/CustomSelect.jsx";
import { useAcademyNav } from "../hooks/useAcademyNav.js";
import { toast } from "../components/ui/toast.jsx";
import api from "../services/api.js";
import { academicSession, todayInputValue } from "../utils/studentListPrint.js";

const METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

function currentPeriodKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function periodOptions(count = 24) {
  const options = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    options.push({ value, label });
  }
  return options;
}

function periodLabel(periodKey) {
  if (!periodKey) return "—";
  if (periodKey === "ONCE") return "One-time";
  const [year, month] = String(periodKey).split("-").map(Number);
  if (!year || !month) return periodKey;
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
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

function amountForHead(head, student) {
  if (!head) return "";
  if (head.name === "Monthly Fee" || head.category === "tuition") {
    return String(Number(student?.monthlyFee) || 0);
  }
  if (head.defaultAmount != null) return String(Number(head.defaultAmount) || 0);
  return "";
}

function AcademyFeeCollectStudent() {
  const navItems = useAcademyNav();
  const navigate = useNavigate();
  const { studentId } = useParams();
  const [searchParams] = useSearchParams();
  const session = searchParams.get("session") || academicSession();
  const urlPeriod = searchParams.get("period") || currentPeriodKey();

  const [heads, setHeads] = useState([]);
  const [student, setStudent] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payHeadId, setPayHeadId] = useState("");
  const [payPeriodKey, setPayPeriodKey] = useState(urlPeriod);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payDate, setPayDate] = useState(todayInputValue());
  const [payNote, setPayNote] = useState("");
  const [collecting, setCollecting] = useState(false);

  const monthOptions = useMemo(
    () => [
      { value: "ONCE", label: "One-time (Admission)" },
      ...periodOptions(24),
    ],
    []
  );

  const backHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("tab", "collect");
    params.set("session", session);
    params.set("period", urlPeriod);
    return `/academy/fees?${params.toString()}`;
  }, [session, urlPeriod]);

  const selectedHead = useMemo(
    () => heads.find((h) => h._id === payHeadId) || null,
    [heads, payHeadId]
  );

  const resolveAmount = useCallback(
    (headId, period, stud, chargeList, headList) => {
      const head = (headList || []).find((h) => h._id === headId);
      if (!head) return "";
      const match = (chargeList || []).find(
        (c) =>
          String(c.feeHead?._id || c.feeHead) === String(headId) &&
          c.periodKey === period &&
          c.status !== "waived" &&
          c.balance > 0
      );
      if (match) return String(match.balance);
      return amountForHead(head, stud);
    },
    []
  );

  const loadLedger = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const [headRes, ledgerRes] = await Promise.all([
        api.get("/fees/heads"),
        api.get(`/fees/student/${studentId}`, { params: { session } }),
      ]);
      const nextHeads = headRes.data.heads || [];
      const nextStudent = ledgerRes.data.student;
      const nextCharges = ledgerRes.data.charges || [];
      setHeads(nextHeads);
      setLedger(ledgerRes.data);
      setStudent(nextStudent);

      setPayHeadId((prev) => {
        if (prev && nextHeads.some((h) => h._id === prev)) return prev;
        const monthlyHead = nextHeads.find((h) => h.name === "Monthly Fee");
        return monthlyHead?._id || nextHeads[0]?._id || "";
      });
      setPayPeriodKey((prev) => prev || urlPeriod);
      setPayAmount((prev) => {
        if (prev) return prev;
        const monthlyHead = nextHeads.find((h) => h.name === "Monthly Fee");
        const headId = monthlyHead?._id || nextHeads[0]?._id || "";
        return resolveAmount(headId, urlPeriod, nextStudent, nextCharges, nextHeads);
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load student fees");
      navigate(backHref, { replace: true });
    } finally {
      setLoading(false);
    }
  }, [studentId, session, navigate, backHref, urlPeriod, resolveAmount]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const allCharges = ledger?.charges || [];

  const handleFeeTypeChange = (headId) => {
    setPayHeadId(headId);
    const head = heads.find((h) => h._id === headId);
    let nextPeriod = payPeriodKey;
    if (head?.frequency === "one_time") {
      nextPeriod = "ONCE";
      setPayPeriodKey("ONCE");
    } else if (payPeriodKey === "ONCE") {
      nextPeriod = urlPeriod || currentPeriodKey();
      setPayPeriodKey(nextPeriod);
    }
    setPayAmount(
      resolveAmount(headId, nextPeriod, student, allCharges, heads)
    );
  };

  const handleMonthChange = (nextPeriod) => {
    setPayPeriodKey(nextPeriod);
    if (payHeadId) {
      setPayAmount(
        resolveAmount(payHeadId, nextPeriod, student, allCharges, heads)
      );
    }
  };

  const handleCollect = async (event) => {
    event.preventDefault();
    if (!student) return;

    const amount = Number(payAmount);
    if (!(amount > 0) || !payHeadId) {
      toast.error("Pick a fee type and amount");
      return;
    }
    if (!payPeriodKey) {
      toast.error("Select the month for this payment");
      return;
    }
    if (payDate && payDate > todayInputValue()) {
      toast.error("Payment date cannot be in the future");
      return;
    }
    const suggested = Number(
      resolveAmount(payHeadId, payPeriodKey, student, ledger?.charges || [], heads)
    );
    if (Number.isFinite(suggested) && suggested > 0 && amount > suggested + 0.001) {
      toast.error(
        `Amount cannot exceed remaining balance (${formatMoney(suggested)})`
      );
      return;
    }

    setCollecting(true);
    try {
      const res = await api.post("/fees/collect", {
        session,
        studentId: student._id,
        method: payMethod,
        paidAt: payDate,
        note: payNote,
        items: [{ feeHeadId: payHeadId, periodKey: payPeriodKey, amount }],
      });
      toast.success(res.data.message || "Payment recorded");
      setPayNote("");
      await loadLedger();
    } catch (err) {
      toast.error(err.response?.data?.message || "Collection failed");
    } finally {
      setCollecting(false);
    }
  };

  return (
    <DashboardLayout title="Collect fee" navItems={navItems}>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={backHref}
            className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-slate transition hover:text-navy"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Collect
          </Link>
        </div>

        {loading ? (
          <div className="sms-surface rounded-2xl p-8 text-center text-sm text-slate sm:rounded-3xl">
            Loading student fees…
          </div>
        ) : !student ? (
          <div className="sms-surface rounded-2xl p-8 text-center text-sm text-slate sm:rounded-3xl">
            Student not found.
          </div>
        ) : (
          <>
            <div className="sms-surface rounded-2xl px-4 py-4 sm:rounded-3xl sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-navy">
                    {student.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate">
                    {student.rollNumber}
                    {" · "}
                    {student.class?.name || "Class"}
                    {" · "}
                    {student.section?.name || "Section"}
                    {" · "}
                    Monthly {formatMoney(student.monthlyFee)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm font-semibold">
                  <span className="rounded-xl bg-rose/40 px-3 py-2 text-navy">
                    Outstanding {formatMoney(ledger?.outstanding)}
                  </span>
                  <span className="rounded-xl bg-lavender/30 px-3 py-2 text-navy">
                    Paid {formatMoney(ledger?.totalPaid)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <div className="sms-surface space-y-4 rounded-2xl p-4 sm:rounded-3xl sm:p-5">
                <div>
                  <h3 className="font-display text-lg font-semibold text-navy">
                    Fee history
                  </h3>
                  <p className="mt-1 text-sm text-slate">
                    All charges for this student.
                  </p>
                </div>

                {allCharges.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-rose/40 bg-blush/20 px-3 py-4 text-sm text-slate">
                    No fee charges yet.
                  </p>
                ) : (
                  <ul className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">
                    {allCharges.map((charge) => (
                      <li
                        key={charge._id}
                        className="rounded-xl border border-rose/30 bg-white px-3 py-2.5 text-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-navy">
                              {charge.feeHead?.name || charge.description}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-navy">
                              Month: {periodLabel(charge.periodKey)}
                            </p>
                            <p className="mt-0.5 text-xs text-slate">
                              Session {charge.session}
                              {" · billed "}
                              {formatMoney(charge.amount)}
                              {" · paid "}
                              {formatMoney(charge.paid)}
                              {charge.balance > 0
                                ? ` · due ${formatMoney(charge.balance)}`
                                : ""}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusTone(charge.status)}`}
                          >
                            {charge.status}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="sms-surface h-fit space-y-4 rounded-2xl p-4 sm:rounded-3xl sm:p-5 xl:sticky xl:top-4">
                <div>
                  <h3 className="font-display text-lg font-semibold text-navy">
                    Submit payment
                  </h3>
                  <p className="mt-1 text-sm text-slate">
                    Choose fee type, month, and amount, then record the payment.
                  </p>
                </div>

                <form onSubmit={handleCollect} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CustomSelect
                      label="Fee type"
                      value={payHeadId}
                      options={heads.map((h) => ({ value: h._id, label: h.name }))}
                      onChange={handleFeeTypeChange}
                    />
                    <CustomSelect
                      label="For month"
                      value={payPeriodKey}
                      options={
                        selectedHead?.frequency === "one_time"
                          ? [{ value: "ONCE", label: "One-time (Admission)" }]
                          : monthOptions
                      }
                      onChange={handleMonthChange}
                      searchable={false}
                    />
                    <label className="block text-sm sm:col-span-2">
                      <span className="mb-1 block font-medium text-navy">Amount</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="w-full rounded-xl border border-rose/60 bg-white px-3 py-2.5 text-navy outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/40"
                        required
                      />
                    </label>
                    <CustomSelect
                      label="Method"
                      value={payMethod}
                      options={METHOD_OPTIONS}
                      onChange={setPayMethod}
                      searchable={false}
                    />
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-navy">Paid on</span>
                      <input
                        type="date"
                        max={todayInputValue()}
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        className="w-full rounded-xl border border-rose/60 bg-white px-3 py-2.5 text-navy outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/40"
                        required
                      />
                    </label>
                    <label className="block text-sm sm:col-span-2">
                      <span className="mb-1 block font-medium text-navy">Note</span>
                      <input
                        type="text"
                        value={payNote}
                        onChange={(e) => setPayNote(e.target.value)}
                        placeholder="Optional"
                        className="w-full rounded-xl border border-rose/60 bg-white px-3 py-2.5 text-navy outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/40"
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={collecting}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-blush transition hover:bg-slate disabled:opacity-60"
                  >
                    {collecting ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                    )}
                    Record payment
                  </button>
                </form>
              </div>
            </div>
          </>
        )}
      </section>
    </DashboardLayout>
  );
}

export default AcademyFeeCollectStudent;
