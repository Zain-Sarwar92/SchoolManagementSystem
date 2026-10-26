/**
 * Test Generator print engine — single module for sheet, format bar,
 * prefs, payload, and print-tab session. Features unchanged.
 */

export { default as ExamPaperSheet } from "./ExamPaperSheet.jsx";
export { default as PrintFormatBar } from "./PrintFormatBar.jsx";

export {
  PRINT_MODES,
  PRINT_MODE_LIST,
  PRINT_LAYOUTS,
  WATERMARK_MODES,
  WATERMARK_MODE_LIST,
  normalizePrintMode,
  printRootClassName,
} from "./printConstants.js";

export {
  defaultPrintOpts,
  normalizePrintOpts,
  readPrintPrefs,
  writePrintPrefs,
  printStyleVars,
  sheetPropsFromPrintOpts,
} from "./printOpts.js";

export {
  openGeneratorPrintTab,
  readGeneratorPrintPayload,
  writeGeneratorPrintPayload,
  buildPrintPayloadFromApiPaper,
  shuffleMcqSections,
} from "./printPayload.js";

export { usePrintSession } from "./usePrintSession.js";
