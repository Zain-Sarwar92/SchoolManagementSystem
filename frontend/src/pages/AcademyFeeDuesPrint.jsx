import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { toast } from "../components/ui/toast.jsx";
import api from "../services/api.js";
import { academicSession, sortByRoll, todayInputValue } from "../utils/studentListPrint.js";

const STATUS_LABELS = {
  open: "Open (unpaid / partial)",
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  waived: "Waived",
  all: "All statuses",
};

function formatMoney(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-PK")}`;
}

function periodLabel(periodKey) {
  if (!periodKey) return "All periods";
  if (periodKey === "ONCE") return "One-time (Admission)";
  const [year, month] = periodKey.split("-").map(Number);
  if (!year || !month) return periodKey;
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

function sheetTotals(rows) {
  let billed = 0;
  let paid = 0;
  let balance = 0;
  for (const row of rows) {
    if (row.status === "waived") continue;
    billed += Number(row.amount) || 0;
    paid += Number(row.paid) || 0;
    balance += Number(row.balance) || 0;
  }
  return {
    billed: Math.round(billed),
    paid: Math.round(paid),
    balance: Math.round(balance),
    count: rows.length,
  };
}

function AcademyFeeDuesPrint() {
  const [searchParams] = useSearchParams();
  const session = searchParams.get("session") || academicSession();
  const periodKey = searchParams.get("period") || "";
  const statuses =
    searchParams.get("statuses") || searchParams.get("status") || "open";
  const classIds =
    searchParams.get("classIds") || searchParams.get("classId") || "";
  const sectionIds =
    searchParams.get("sectionIds") || searchParams.get("sectionId") || "";
  const feeHeadIds =
    searchParams.get("feeHeadIds") || searchParams.get("feeHeadId") || "";
  const q = searchParams.get("q") || "";
  const statusList = statuses
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const classIdList = classIds
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const sectionIdList = sectionIds
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const feeHeadIdList = feeHeadIds
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const [loading, setLoading] = useState(true);
  const [academy, setAcademy] = useState(null);
  const [dues, setDues] = useState([]);
  const [className, setClassName] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [feeTypeName, setFeeTypeName] = useState("");
  const [listDate, setListDate] = useState(todayInputValue());
  const [title, setTitle] = useState("");

  const backHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("tab", "dues");
    params.set("session", session);
    if (periodKey) params.set("period", periodKey);
    return `/academy/fees?${params.toString()}`;
  }, [session, periodKey]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [academyRes, duesRes, classesRes, sectionsRes, headsRes] = await Promise.all([
          api.get("/academies/me"),
          api.get("/fees/dues", {
            params: {
              session,
              periodKey: periodKey || undefined,
              statuses: statuses || undefined,
              classIds: classIds || undefined,
              sectionIds: sectionIds || undefined,
              feeHeadIds: feeHeadIds || undefined,
              q: q || undefined,
            },
          }),
          api.get("/classes"),
          api.get("/sections"),
          api.get("/fees/heads"),
        ]);
        if (cancelled) return;

        const classNames = (classesRes.data.classes || [])
          .filter((c) => classIdList.includes(c._id))
          .map((c) => c.name);
        const sectionNames = (sectionsRes.data.sections || [])
          .filter((s) => sectionIdList.includes(s._id))
          .map((s) => s.name);
        const headNames = (headsRes.data.heads || [])
          .filter((h) => feeHeadIdList.includes(h._id))
          .map((h) => h.name);

        setAcademy(academyRes.data.academy || null);
        setDues(duesRes.data.dues || []);
        setClassName(classNames.join(", "));
        setSectionName(sectionNames.join(", "));
        setFeeTypeName(headNames.join(", "));

        const statusBit =
          statusList.map((s) => STATUS_LABELS[s] || s).join(", ") || "All statuses";
        const scope =
          [classNames.join(", "), sectionNames.join(", ")].filter(Boolean).join(" · ") ||
          "All classes · All sections";
        setTitle(`${statusBit} fee list · ${scope}`);
      } catch (err) {
        if (!cancelled) {
          toast.error(err.response?.data?.message || "Failed to load fee list");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session, periodKey, statuses, classIds, sectionIds, feeHeadIds, q]);

  /**
   * Class-wise → section-wise blocks that flow continuously
   * (next section starts right after the previous — no forced page break).
   */
  const sectionGroups = useMemo(() => {
    const map = new Map();
    for (const row of dues) {
      const cId = String(row.student?.class?._id || row.student?.class || "unknown");
      const sId = String(row.student?.section?._id || row.student?.section || "unknown");
      const cName = row.student?.class?.name || "Unknown class";
      const sName = row.student?.section?.name || "Unknown section";
      const key = `${cId}::${sId}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          classId: cId,
          sectionId: sId,
          className: cName,
          sectionName: sName,
          rows: [],
        });
      }
      map.get(key).rows.push(row);
    }

    const groups = [...map.values()].sort((a, b) => {
      const byClass = a.className.localeCompare(b.className, undefined, { numeric: true });
      if (byClass !== 0) return byClass;
      return a.sectionName.localeCompare(b.sectionName, undefined, { numeric: true });
    });

    for (const group of groups) {
      group.rows.sort((a, b) =>
        sortByRoll(a.student?.rollNumber, b.student?.rollNumber)
      );
      group.totals = sheetTotals(group.rows);
    }
    return groups;
  }, [dues]);

  const grandTotals = useMemo(() => sheetTotals(dues), [dues]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg-soft text-slate">
        Preparing fee list…
      </div>
    );
  }

  return (
    <div className="print-page fee-dues-print min-h-screen bg-bg-soft px-3 py-4 sm:px-6">
      <div className="print-toolbar no-print">
        <Link
          to={backHref}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose/50 bg-white px-3 text-sm font-semibold text-navy transition hover:bg-blush"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Dues
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-blush transition hover:bg-slate"
        >
          <Printer className="size-4" aria-hidden="true" />
          Print
        </button>
      </div>

      <div className="no-print mb-4 rounded-2xl border border-rose/40 bg-white p-4 sm:p-5">
        <p className="text-sm font-semibold text-navy">Print details</p>
        <p className="mt-1 text-xs text-slate">
          Lists print <strong>class-wise → section-wise</strong> in one continuous flow.
          When a section ends, the next section continues on the same page if space
          remains — no forced page break.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-navy">List title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-rose/60 bg-white px-3 py-2.5 text-navy outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/40"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-navy">Date</span>
            <input
              type="date"
              value={listDate}
              onChange={(e) => setListDate(e.target.value)}
              className="w-full rounded-xl border border-rose/60 bg-white px-3 py-2.5 text-navy outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/40"
            />
          </label>
        </div>
        {sectionGroups.length > 0 ? (
          <p className="mt-3 text-sm font-medium text-navy">
            {sectionGroups.length} section
            {sectionGroups.length === 1 ? "" : "s"}
            {className ? ` · ${className}` : " · all classes"}
            {sectionName ? ` · ${sectionName}` : " · all sections"}
            {" · "}
            balance {formatMoney(grandTotals.balance)}
          </p>
        ) : null}
      </div>

      {sectionGroups.length === 0 ? (
        <div className="fee-dues-sheet">
          <p className="fee-dues-sheet__empty">No records match these filters.</p>
        </div>
      ) : (
        <div className="fee-dues-sheet fee-dues-sheet--continuous">
          <div className="fee-dues-sheet__watermark" aria-hidden="true">
            {academy?.logo ? (
              <img src={academy.logo} alt="" />
            ) : (
              <span>{(academy?.name || "A").slice(0, 2).toUpperCase()}</span>
            )}
          </div>

          <header className="fee-dues-sheet__header">
            {academy?.logo ? (
              <img src={academy.logo} alt="" className="fee-dues-sheet__logo" />
            ) : (
              <div className="fee-dues-sheet__logo-fallback">
                {(academy?.name || "A").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1>{academy?.name || "Academy"}</h1>
              {academy?.address ? <p>{academy.address}</p> : null}
              {academy?.phone ? <p>Phone: {academy.phone}</p> : null}
            </div>
          </header>

          <div className="fee-dues-sheet__title">
            <h2>{title || "Fee list"}</h2>
            <p>
              Session {session}
              {" · "}
              Period {periodLabel(periodKey)}
              {" · "}
              {statusList.map((s) => STATUS_LABELS[s] || s).join(", ") || "All statuses"}
              {feeTypeName ? ` · ${feeTypeName}` : ""}
              {" · "}
              Date {listDate}
            </p>
          </div>

          <div className="fee-dues-flow">
            {sectionGroups.map((group) => (
              <section key={group.key} className="fee-dues-block">
                <h3 className="fee-dues-block__heading">
                  {group.className}
                  {" · Section "}
                  {group.sectionName}
                </h3>
                <table className="fee-dues-sheet__table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Roll</th>
                      <th>Student</th>
                      <th>Fee</th>
                      <th>Period</th>
                      <th>Status</th>
                      <th>Billed</th>
                      <th>Paid</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row, index) => (
                      <tr key={row._id}>
                        <td>{index + 1}</td>
                        <td>{row.student?.rollNumber || "—"}</td>
                        <td>
                          <strong>{row.student?.name || "—"}</strong>
                          {row.student?.fatherName ? (
                            <span className="fee-dues-sheet__muted">
                              {" "}
                              S/O {row.student.fatherName}
                            </span>
                          ) : null}
                        </td>
                        <td>{row.feeHead?.name || row.description || "—"}</td>
                        <td>{row.periodKey === "ONCE" ? "One-time" : row.periodKey}</td>
                        <td className="fee-dues-sheet__status">{row.status}</td>
                        <td>{formatMoney(row.amount)}</td>
                        <td>{formatMoney(row.paid)}</td>
                        <td>{formatMoney(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="fee-dues-sheet__totals">
                      <td colSpan={6}>
                        Total · {group.totals.count} charge
                        {group.totals.count === 1 ? "" : "s"}
                      </td>
                      <td>{formatMoney(group.totals.billed)}</td>
                      <td>{formatMoney(group.totals.paid)}</td>
                      <td>{formatMoney(group.totals.balance)}</td>
                    </tr>
                  </tfoot>
                </table>
              </section>
            ))}
          </div>

          <p className="fee-dues-sheet__grand">
            Grand total · {grandTotals.count} charge
            {grandTotals.count === 1 ? "" : "s"}
            {" · Billed "}
            {formatMoney(grandTotals.billed)}
            {" · Paid "}
            {formatMoney(grandTotals.paid)}
            {" · Balance "}
            {formatMoney(grandTotals.balance)}
          </p>
        </div>
      )}

      <p className="print-screen-hint no-print">
        Continuous print: next class/section starts right after the previous list on the same
        page when space remains.
      </p>
    </div>
  );
}

export default AcademyFeeDuesPrint;
