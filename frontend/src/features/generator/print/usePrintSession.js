import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../../services/api.js";
import { toast } from "../../../components/ui/toast.jsx";
import { normalizePrintMode } from "./printConstants.js";
import {
  normalizePrintOpts,
  readPrintPrefs,
  writePrintPrefs,
} from "./printOpts.js";
import {
  buildPrintPayloadFromApiPaper,
  readGeneratorPrintPayload,
  shuffleMcqSections,
  writeGeneratorPrintPayload,
} from "./printPayload.js";

/**
 * Shared print-tab session: load by paper id or localStorage payload,
 * persist prefs, shuffle MCQs, log PAPER_PRINT + browser print.
 */
export function usePrintSession({
  paperId = null,
  modeParam = "single",
  academy = null,
} = {}) {
  const academyId = academy?._id || academy?.id || null;
  const academyName = academy?.name || "";
  const academyAddress = academy?.address || "";
  const academyPhone = academy?.phone || "";
  const academyLogo = academy?.logo || "";

  const [payload, setPayload] = useState(null);
  const [sections, setSections] = useState([]);
  const [printMode, setPrintMode] = useState(() =>
    normalizePrintMode(modeParam)
  );
  const [loading, setLoading] = useState(Boolean(paperId));
  const [inlineEditing, setInlineEditing] = useState(false);
  const [printOpts, setPrintOpts] = useState(() => readPrintPrefs(academyId));

  useEffect(() => {
    setPrintOpts((o) =>
      normalizePrintOpts({ ...readPrintPrefs(academyId), ...o })
    );
  }, [academyId]);

  useEffect(() => {
    let cancelled = false;
    const academySnap = {
      _id: academyId,
      id: academyId,
      name: academyName,
      address: academyAddress,
      phone: academyPhone,
      logo: academyLogo,
    };

    (async () => {
      const savedPrefs = readPrintPrefs(academyId);
      const mode = normalizePrintMode(modeParam);

      if (paperId) {
        setLoading(true);
        try {
          const { data } = await api.get(`/generator/papers/${paperId}`);
          const paper = data.paper;
          if (!paper || cancelled) return;
          const next = buildPrintPayloadFromApiPaper(paper, academySnap, mode);
          next.printOpts = savedPrefs;
          writeGeneratorPrintPayload(next);
          if (cancelled) return;
          setPayload(next);
          setSections(next.sections);
          setPrintOpts(savedPrefs);
          setPrintMode(mode);
        } catch (err) {
          if (!cancelled) {
            toast.error(err.response?.data?.message || "Failed to load paper");
            setPayload(null);
            setSections([]);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      const data = readGeneratorPrintPayload();
      if (!data?.sections?.length) {
        setPayload(null);
        setSections([]);
        setLoading(false);
        return;
      }
      const mergedOpts = normalizePrintOpts({
        ...savedPrefs,
        ...(data.printOpts || {}),
      });
      setPayload(data);
      setSections(data.sections);
      setPrintMode(normalizePrintMode(data.printMode || mode));
      setPrintOpts(mergedOpts);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    modeParam,
    paperId,
    academyId,
    academyName,
    academyAddress,
    academyPhone,
    academyLogo,
  ]);

  const persist = useCallback(
    (nextSections, nextOpts = printOpts) => {
      if (!payload) return;
      const opts = normalizePrintOpts(nextOpts);
      const next = {
        ...payload,
        sections: nextSections,
        printOpts: opts,
        printMode,
        academyId,
      };
      writeGeneratorPrintPayload(next);
      writePrintPrefs(academyId, opts);
      setPayload(next);
    },
    [payload, printOpts, printMode, academyId]
  );

  const updatePrintOpts = useCallback(
    (next) => {
      const opts = normalizePrintOpts(next);
      setPrintOpts(opts);
      persist(sections, opts);
    },
    [persist, sections]
  );

  const shuffleMcqs = useCallback(() => {
    const next = shuffleMcqSections(sections);
    setSections(next);
    persist(next);
    toast.success("MCQs shuffled");
  }, [sections, persist]);

  const runPrint = useCallback(() => {
    writePrintPrefs(academyId, printOpts);
    const title =
      payload?.meta?.title ||
      payload?.meta?.paperCategory ||
      payload?.title ||
      "Paper";
    const classLabel =
      payload?.meta?.classLabel || payload?.meta?.className || "";
    const subjectLabel =
      payload?.meta?.subjectLabel || payload?.meta?.subjectName || "";
    void api
      .post("/activities", {
        action: "PAPER_PRINT",
        summary: `Printed paper “${title}”${
          classLabel || subjectLabel
            ? ` (${[classLabel, subjectLabel].filter(Boolean).join(" · ")})`
            : ""
        }`,
        meta: {
          paperId: paperId || payload?.paperId || null,
          title,
          classLabel,
          subjectLabel,
          printMode,
        },
      })
      .catch(() => {});
    window.setTimeout(() => window.print(), 80);
  }, [academyId, printOpts, payload, paperId, printMode]);

  const ready = Boolean(payload && sections.length);

  return useMemo(
    () => ({
      loading,
      ready,
      payload,
      sections,
      printMode,
      printOpts,
      inlineEditing,
      setInlineEditing,
      updatePrintOpts,
      shuffleMcqs,
      runPrint,
    }),
    [
      loading,
      ready,
      payload,
      sections,
      printMode,
      printOpts,
      inlineEditing,
      updatePrintOpts,
      shuffleMcqs,
      runPrint,
    ]
  );
}
