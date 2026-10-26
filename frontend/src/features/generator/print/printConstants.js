/** Print engine constants — layouts, modes, watermarks (features stay). */

export const PRINT_MODES = Object.freeze({
  SINGLE: "single",
  DOUBLE_V: "double-v",
  DOUBLE_H: "double-h",
});

export const PRINT_MODE_LIST = Object.freeze([
  PRINT_MODES.SINGLE,
  PRINT_MODES.DOUBLE_V,
  PRINT_MODES.DOUBLE_H,
]);

/** Header layouts on ExamPaperSheet (1–5). */
export const PRINT_LAYOUTS = Object.freeze(["1", "2", "3", "4", "5"]);

export const WATERMARK_MODES = Object.freeze({
  MONO: "mono",
  SCHOOL: "school",
  NONE: "none",
  FULL: "full",
});

export const WATERMARK_MODE_LIST = Object.freeze(
  Object.values(WATERMARK_MODES)
);

export function normalizePrintMode(mode) {
  const m = String(mode || PRINT_MODES.SINGLE);
  return PRINT_MODE_LIST.includes(m) ? m : PRINT_MODES.SINGLE;
}

export function printRootClassName(printMode) {
  const mode = normalizePrintMode(printMode);
  return [
    "tg-exam-print-root",
    mode === PRINT_MODES.DOUBLE_V ? "tg-exam-print-root--dv" : "",
    mode === PRINT_MODES.DOUBLE_H ? "tg-exam-print-root--dh" : "",
  ]
    .filter(Boolean)
    .join(" ");
}
