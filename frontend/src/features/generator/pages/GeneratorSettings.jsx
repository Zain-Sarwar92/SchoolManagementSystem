import { useMemo, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import GeneratorLayout from "../components/GeneratorLayout.jsx";
import CustomSelect from "../../../components/ui/CustomSelect.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { toast } from "../../../components/ui/toast.jsx";
import ExamPaperSheet from "../print/ExamPaperSheet.jsx";
import {
  defaultPrintOpts,
  normalizePrintOpts,
  readPrintPrefs,
  writePrintPrefs,
  sheetPropsFromPrintOpts,
} from "../print/printOpts.js";
import { WATERMARK_MODES } from "../print/printConstants.js";

const FONT_WEIGHT_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "bold", label: "Bold" },
];

const LAYOUT_OPTIONS = [
  { value: "1", label: "Layout 1 — Classic PTS" },
  { value: "2", label: "Layout 2 — Compact Pairs" },
  { value: "3", label: "Layout 3 — Centered Brand" },
  { value: "4", label: "Layout 4 — Chip Meta" },
  { value: "5", label: "Layout 5 — Split Header" },
];

const WATERMARK_OPTIONS = [
  { value: WATERMARK_MODES.MONO, label: "Monogram" },
  { value: WATERMARK_MODES.NONE, label: "None" },
  { value: WATERMARK_MODES.FULL, label: "Full logo" },
];

const PREVIEW_SECTIONS = [
  {
    key: "mcq",
    type: "MCQ",
    marksEach: 1,
    attemptCount: 0,
    questions: [
      {
        id: "p1",
        text: "Which quantity is a scalar?",
        textUrdu: "کون سی مقدار اسکیلر ہے؟",
        optionA: "Force",
        optionB: "Velocity",
        optionC: "Mass",
        optionD: "Acceleration",
        correctAnswer: "C",
        topicId: "t1",
        chapterId: "c1",
      },
      {
        id: "p2",
        text: "SI unit of force is:",
        textUrdu: "فورس کی ایس آئی اکائی ہے:",
        optionA: "Joule",
        optionB: "Newton",
        optionC: "Watt",
        optionD: "Pascal",
        correctAnswer: "B",
        topicId: "t2",
        chapterId: "c1",
      },
    ],
  },
  {
    key: "short",
    type: "SHORT",
    marksEach: 2,
    attemptCount: 0,
    questions: [
      {
        id: "p3",
        text: "Define speed and velocity.",
        textUrdu: "رفتار اور رفتار سمت کی تعریف کریں۔",
        topicId: "t3",
        chapterId: "c1",
      },
    ],
  },
];

function GeneratorSettings() {
  const { user } = useAuth();
  const academy = user?.academy;
  const academyId = academy?._id || academy?.id || null;

  const [opts, setOpts] = useState(() => readPrintPrefs(academyId));
  const [dirty, setDirty] = useState(false);

  const sheetProps = useMemo(() => sheetPropsFromPrintOpts(opts), [opts]);

  const set = (key, value) => {
    setOpts((prev) => normalizePrintOpts({ ...prev, [key]: value }));
    setDirty(true);
  };

  const save = () => {
    const next = normalizePrintOpts(opts);
    writePrintPrefs(academyId, next);
    setOpts(next);
    setDirty(false);
    toast.success("Print & font defaults saved");
  };

  const resetDefaults = () => {
    const next = defaultPrintOpts();
    setOpts(next);
    setDirty(true);
    toast.success("Defaults restored — click Save to keep them");
  };

  const previewMeta = {
    orgTitle: academy?.name || "Your Academy",
    address: academy?.address || "",
    logoUrl: academy?.logo || "",
    className: "Class 9",
    subjectName: "Physics",
    boardName: "Punjab Textbook",
    totalMarks: 5,
    durationMinutes: 40,
    examDate: new Date().toISOString().slice(0, 10),
    title: "Sample Paper Preview",
    paperCategory: "Sample Paper Preview",
    examLabel: "SAMPLE",
    syllabusNote: "Ch.1 Sample · Ch.2 Sample",
  };

  return (
    <GeneratorLayout>
      <div className="tg-settings">
        <header className="tg-settings-head">
          <div>
            <p className="tg-settings-eyebrow">Account Settings</p>
            <h1 className="tg-settings-title">Print & paper defaults</h1>
            <p className="tg-settings-sub">
              These fonts, sizes, and layout options apply whenever you print or
              open a paper. Changes save for this academy.
            </p>
          </div>
          <div className="tg-settings-actions">
            <button
              type="button"
              className="tg-btn-ghost"
              onClick={resetDefaults}
            >
              <RotateCcw className="size-3.5" />
              Reset defaults
            </button>
            <button
              type="button"
              className="tg-btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm"
              onClick={save}
              disabled={!dirty}
            >
              <Save className="size-3.5" />
              {dirty ? "Save changes" : "Saved"}
            </button>
          </div>
        </header>

        <div className="tg-settings-account tg-surface">
          <div>
            <p className="tg-settings-kicker">Signed in as</p>
            <p className="tg-settings-account-name">
              {user?.name || "Administrator"}
            </p>
            <p className="tg-settings-account-meta">
              {user?.email || "—"}
              {academy?.name ? ` · ${academy.name}` : ""}
            </p>
          </div>
        </div>

        <div className="tg-settings-grid">
          <section className="tg-settings-panel tg-surface">
            <h2 className="tg-settings-panel-title">Typography</h2>
            <div className="tg-settings-fields">
              <label className="tg-settings-field">
                <span>English font size (pt)</span>
                <input
                  type="number"
                  min={8}
                  max={22}
                  value={opts.englishSize}
                  onChange={(e) => set("englishSize", e.target.value)}
                  className="tg-field h-10 w-full px-2 text-sm"
                />
              </label>
              <label className="tg-settings-field">
                <span>Urdu font size (pt)</span>
                <input
                  type="number"
                  min={8}
                  max={22}
                  value={opts.urduSize}
                  onChange={(e) => set("urduSize", e.target.value)}
                  className="tg-field h-10 w-full px-2 text-sm"
                />
              </label>
              <label className="tg-settings-field">
                <span>Line height</span>
                <input
                  type="number"
                  min={1}
                  max={2.5}
                  step={0.1}
                  value={opts.lineHeight}
                  onChange={(e) => set("lineHeight", e.target.value)}
                  className="tg-field h-10 w-full px-2 text-sm"
                />
              </label>
              <div className="tg-settings-field">
                <span>Font weight</span>
                <CustomSelect
                  className="tg-select"
                  searchable={false}
                  value={opts.fontWeight || "normal"}
                  onChange={(val) => set("fontWeight", String(val))}
                  options={FONT_WEIGHT_OPTIONS}
                  placeholder="Font weight"
                />
              </div>
              <label className="tg-settings-field">
                <span>Font color</span>
                <input
                  type="color"
                  value={opts.fontColor || "#000000"}
                  onChange={(e) => set("fontColor", e.target.value)}
                  className="tg-settings-color"
                />
              </label>
              <label className="tg-settings-field">
                <span>Equation size boost (px)</span>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={opts.equationSize ?? 0}
                  onChange={(e) => set("equationSize", e.target.value)}
                  className="tg-field h-10 w-full px-2 text-sm"
                />
              </label>
            </div>
          </section>

          <section className="tg-settings-panel tg-surface">
            <h2 className="tg-settings-panel-title">Header & branding</h2>
            <div className="tg-settings-fields">
              <label className="tg-settings-field">
                <span>Header size scale</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={opts.headerSize ?? 1}
                  onChange={(e) => set("headerSize", e.target.value)}
                  className="tg-field h-10 w-full px-2 text-sm"
                />
              </label>
              <label className="tg-settings-field">
                <span>Logo size scale</span>
                <input
                  type="number"
                  min={0.3}
                  max={3}
                  step={0.1}
                  value={opts.logoSize ?? 1}
                  onChange={(e) => set("logoSize", e.target.value)}
                  className="tg-field h-10 w-full px-2 text-sm"
                />
              </label>
              <div className="tg-settings-field tg-settings-field--wide">
                <span>Paper layout</span>
                <CustomSelect
                  className="tg-select"
                  searchable={false}
                  value={opts.layout || "1"}
                  onChange={(val) => set("layout", String(val))}
                  options={LAYOUT_OPTIONS}
                  placeholder="Select layout"
                />
              </div>
              <div className="tg-settings-field tg-settings-field--wide">
                <span>Watermark</span>
                <CustomSelect
                  className="tg-select"
                  searchable={false}
                  value={opts.watermark || WATERMARK_MODES.MONO}
                  onChange={(val) => set("watermark", String(val))}
                  options={WATERMARK_OPTIONS}
                  placeholder="Select watermark"
                />
              </div>
            </div>
          </section>

          <section className="tg-settings-panel tg-surface tg-settings-panel--checks">
            <h2 className="tg-settings-panel-title">Print options</h2>
            <div className="tg-settings-checks">
              {[
                ["showPartHeading", "Show part heading"],
                ["separateSubjective", "Separate subjective part"],
                ["objectiveBorder", "Objective border"],
                ["subjectiveBorder", "Subjective border"],
                ["showSyllabus", "Print exam syllabus"],
                ["showBubbleSheet", "Print bubble sheet"],
                ["showAnswerKey", "Print answer keys"],
              ].map(([key, label]) => (
                <label key={key} className="tg-settings-check">
                  <input
                    type="checkbox"
                    checked={Boolean(opts[key])}
                    onChange={(e) => set(key, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>
        </div>

        <section className="tg-settings-preview tg-surface">
          <div className="tg-settings-preview-head">
            <h2 className="tg-settings-panel-title">Live preview</h2>
            <p className="tg-settings-preview-hint">
              Sample paper — update fields above to see fonts and layout change.
            </p>
          </div>
          <div className="tg-settings-preview-sheet">
            <ExamPaperSheet
              meta={previewMeta}
              sections={PREVIEW_SECTIONS}
              medium="BOTH"
              {...sheetProps}
            />
          </div>
        </section>
      </div>
    </GeneratorLayout>
  );
}

export default GeneratorSettings;
