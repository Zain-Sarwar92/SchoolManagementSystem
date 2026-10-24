import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import {
  ExamPaperSheet,
  PrintFormatBar,
  printRootClassName,
  sheetPropsFromPrintOpts,
  usePrintSession,
} from "../print/index.js";

function GeneratorPrintPaper() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const modeParam = searchParams.get("mode") || "single";
  const paperId = searchParams.get("id");

  const {
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
  } = usePrintSession({
    paperId,
    modeParam,
    academy: user?.academy,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f0f0] p-6">
        <p className="text-center text-sm text-tg-ink/70">Loading print view…</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#f0f0f0] p-6">
        <div className="mx-auto max-w-xl rounded-xl border border-tg-mist/50 bg-white p-6 text-center">
          <p className="font-display text-lg font-bold text-tg-ink">
            No paper loaded for print
          </p>
          <p className="mt-2 text-sm text-tg-deep/75">
            Go back to the paper workspace and click Print Paper again.
          </p>
        </div>
      </div>
    );
  }

  const sheetProps = sheetPropsFromPrintOpts(printOpts);
  const sheet = (key) => (
    <ExamPaperSheet
      key={key}
      meta={payload.meta || {}}
      sections={sections}
      medium={payload.medium || "BOTH"}
      {...sheetProps}
    />
  );

  return (
    <div className="pts-print-page">
      <div className="pts-print-page-inner">
        <PrintFormatBar
          opts={printOpts}
          onChange={updatePrintOpts}
          onShuffleMcqs={shuffleMcqs}
          onToggleInlineEdit={() => setInlineEditing((v) => !v)}
          onPrint={runPrint}
          inlineEditing={inlineEditing}
        />
        <div className={printRootClassName(printMode)}>
          {sheet("a")}
          {printMode !== "single" ? sheet("b") : null}
        </div>
      </div>
    </div>
  );
}

export default GeneratorPrintPaper;
