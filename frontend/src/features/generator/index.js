/** Test Generator feature public surface — App / shared pages import from here. */

export { default as GeneratorCreate } from "./pages/GeneratorCreate.jsx";
export { default as GeneratorPapers } from "./pages/GeneratorPapers.jsx";
export { default as GeneratorPaperView } from "./pages/GeneratorPaperView.jsx";
export { default as GeneratorPrintPaper } from "./pages/GeneratorPrintPaper.jsx";
export { default as GeneratorActivities } from "./pages/GeneratorActivities.jsx";
export { default as GeneratorSubAccounts } from "./pages/GeneratorSubAccounts.jsx";
export { default as GeneratorDashboard } from "./pages/GeneratorDashboard.jsx";
export { default as GeneratorSettings } from "./pages/GeneratorSettings.jsx";
export { default as GeneratorLayout } from "./components/GeneratorLayout.jsx";

/** Print engine (sheet, prefs, open tab) */
export {
  ExamPaperSheet,
  PrintFormatBar,
  openGeneratorPrintTab,
  usePrintSession,
} from "./print/index.js";

/** Bank (catalog / syllabus / search / pick) */
export {
  fetchCatalog,
  fetchSubjectSyllabus,
  searchPool,
  pickPool,
  buildPickerOptions,
  SOURCE_OPTIONS,
} from "./bank/index.js";

/** Create wizard helpers */
export {
  WIZARD_STEPS,
  useGeneratorCatalog,
  PaperQuestionBlock,
} from "./create/index.js";

export { default as StatusPanel } from "./components/StatusPanel.jsx";
