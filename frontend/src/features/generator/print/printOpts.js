import {
  PRINT_LAYOUTS,
  WATERMARK_MODES,
  WATERMARK_MODE_LIST,
} from "./printConstants.js";

const PREFS_KEY = "tg_print_prefs_v2";

/** Default print/format settings for an organization (per-academy prefs). */
export function defaultPrintOpts() {
  return {
    lineHeight: "1.2",
    urduSize: "12",
    englishSize: "11",
    equationSize: "0",
    headerSize: "1",
    logoSize: "1",
    fontColor: "#000000",
    fontWeight: "normal",
    layout: "1",
    watermark: WATERMARK_MODES.MONO,
    showPartHeading: true,
    separateSubjective: false,
    objectiveBorder: false,
    subjectiveBorder: false,
    showSyllabus: true,
    showBubbleSheet: true,
    showAnswerKey: false,
  };
}

function prefsBucketKey(academyId) {
  return academyId ? String(academyId) : "_default";
}

/** Merge unknown/partial opts with defaults; clamp layout id. */
export function normalizePrintOpts(partial = {}) {
  const base = defaultPrintOpts();
  const next = { ...base, ...(partial && typeof partial === "object" ? partial : {}) };
  const layout = String(next.layout || "1");
  next.layout = PRINT_LAYOUTS.includes(layout) ? layout : "1";
  const wm = String(next.watermark || WATERMARK_MODES.MONO);
  next.watermark = WATERMARK_MODE_LIST.includes(wm)
    ? wm
    : WATERMARK_MODES.MONO;
  return next;
}

/** Load last-used print adjustments for this academy. */
export function readPrintPrefs(academyId) {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return normalizePrintOpts(all[prefsBucketKey(academyId)] || {});
  } catch {
    return defaultPrintOpts();
  }
}

/** Persist print adjustments across sessions. */
export function writePrintPrefs(academyId, opts) {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[prefsBucketKey(academyId)] = normalizePrintOpts(opts);
    localStorage.setItem(PREFS_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota / private mode */
  }
}

/** CSS variables applied to ExamPaperSheet root. */
export function printStyleVars(opts = {}) {
  const o = normalizePrintOpts(opts);
  return {
    "--exam-line-height": String(o.lineHeight || 1.2),
    "--exam-en-size": `${o.englishSize || 11}pt`,
    "--exam-ur-size": `${o.urduSize || 12}pt`,
    "--exam-header-scale": String(o.headerSize || 1),
    "--exam-logo-scale": String(o.logoSize || 1),
    "--exam-eq-boost": `${Number(o.equationSize) || 0}px`,
    "--exam-ink": o.fontColor || "#000000",
    color: o.fontColor || "#000000",
    fontWeight: o.fontWeight || "normal",
  };
}

/** Props shared by ExamPaperSheet from print opts (DRY). */
export function sheetPropsFromPrintOpts(opts = {}) {
  const o = normalizePrintOpts(opts);
  return {
    showAnswerKey: Boolean(o.showAnswerKey),
    showPartHeading: o.showPartHeading !== false,
    showBubbleSheet: Boolean(o.showBubbleSheet),
    showSyllabus: o.showSyllabus !== false,
    watermark: o.watermark || WATERMARK_MODES.MONO,
    objectiveBorder: Boolean(o.objectiveBorder),
    subjectiveBorder: Boolean(o.subjectiveBorder),
    layout: o.layout || "1",
    styleVars: printStyleVars(o),
  };
}
