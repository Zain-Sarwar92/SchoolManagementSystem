import { useMemo, useState } from "react";
import {
  Eye,
  Image,
  LayoutTemplate,
  Palette,
  Printer,
  RotateCcw,
  Save,
  Type,
  UserRound,
} from "lucide-react";
import GeneratorLayout from "../components/GeneratorLayout.jsx";
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
  { value: "1", label: "Layout 1 — Classic" },
  { value: "2", label: "Layout 2 — Compact Pairs" },
  { value: "3", label: "Layout 3 — Centered Brand" },
  { value: "4", label: "Layout 4 — Chip Meta" },
  { value: "5", label: "Layout 5 — Split Header" },
];

const WATERMARK_OPTIONS = [
  { value: WATERMARK_MODES.MONO, label: "Monogram" },
  { value: WATERMARK_MODES.SCHOOL, label: "School name" },
  { value: WATERMARK_MODES.NONE, label: "None" },
  { value: WATERMARK_MODES.FULL, label: "Full logo" },
];

const PRINT_TOGGLES = [
  ["showPartHeading", "Show part heading", "Objective / subjective part labels"],
  ["separateSubjective", "Separate subjective part", "Start subjective on a new block"],
  ["objectiveBorder", "Objective border", "Box around MCQ section"],
  ["subjectiveBorder", "Subjective border", "Box around short / long"],
  ["showSyllabus", "Print exam syllabus", "Chapter list under the header"],
  ["showBubbleSheet", "Print bubble sheet", "OMR-style answer grid"],
  ["showAnswerKey", "Print answer keys", "Key page after the paper"],
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

function initialsFromName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "A";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

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

  const displayName = user?.name || "Administrator";

  return (
    <GeneratorLayout>
      <div className={`tg-settings${dirty ? " tg-settings--dirty" : ""}`}>
        <header className="tg-settings-head">
          <div className="tg-settings-head-copy">
            <p className="tg-settings-eyebrow">Account Settings</p>
            <h1 className="tg-settings-title">Print & paper defaults</h1>
            <p className="tg-settings-sub">
              Fonts, sizes, and layout apply to every paper you print or open
              for this academy.
            </p>
          </div>
          <div className="tg-settings-actions">
            {dirty ? (
              <span className="tg-settings-dirty-pill" role="status">
                Unsaved changes
              </span>
            ) : (
              <span className="tg-settings-saved-pill" role="status">
                All saved
              </span>
            )}
            <div className="tg-settings-action-btns">
              <button
                type="button"
                className="tg-settings-reset"
                onClick={resetDefaults}
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Reset defaults
              </button>
              <button
                type="button"
                className="tg-btn-primary tg-settings-save"
                onClick={save}
                disabled={!dirty}
              >
                <Save className="size-3.5" aria-hidden />
                {dirty ? "Save changes" : "Saved"}
              </button>
            </div>
          </div>
        </header>

        <div className="tg-settings-account">
          <span className="tg-settings-avatar" aria-hidden>
            {initialsFromName(displayName)}
          </span>
          <div className="tg-settings-account-copy">
            <p className="tg-settings-kicker">Signed in as</p>
            <p className="tg-settings-account-name">{displayName}</p>
            <p className="tg-settings-account-meta">
              {user?.email || "—"}
              {academy?.name ? ` · ${academy.name}` : ""}
            </p>
          </div>
          <span className="tg-settings-account-badge">
            <UserRound className="size-3.5" aria-hidden />
            Academy defaults
          </span>
        </div>

        <div className="tg-settings-grid">
          <section className="tg-settings-panel tg-settings-panel--type">
            <div className="tg-settings-panel-head">
              <span className="tg-settings-panel-icon" aria-hidden>
                <Type strokeWidth={1.75} className="size-4" />
              </span>
              <div>
                <h2 className="tg-settings-panel-title">Typography</h2>
                <p className="tg-settings-panel-desc">
                  English &amp; Urdu size, weight, and ink color
                </p>
              </div>
            </div>
            <div className="tg-settings-fields">
              <label className="tg-settings-field">
                <span>English font size (pt)</span>
                <input
                  type="number"
                  min={8}
                  max={22}
                  value={opts.englishSize}
                  onChange={(e) => set("englishSize", e.target.value)}
                  className="tg-field h-10 w-full px-2.5 text-sm"
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
                  className="tg-field h-10 w-full px-2.5 text-sm"
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
                  className="tg-field h-10 w-full px-2.5 text-sm"
                />
              </label>
              <label className="tg-settings-field">
                <span>Font weight</span>
                <select
                  className="tg-native-select"
                  value={opts.fontWeight || "normal"}
                  onChange={(e) => set("fontWeight", e.target.value)}
                >
                  {FONT_WEIGHT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tg-settings-field">
                <span>Font color</span>
                <div className="tg-settings-color-row">
                  <input
                    type="color"
                    value={opts.fontColor || "#000000"}
                    onChange={(e) => set("fontColor", e.target.value)}
                    className="tg-settings-color"
                    aria-label="Font color"
                  />
                  <span className="tg-settings-color-hex">
                    {(opts.fontColor || "#000000").toUpperCase()}
                  </span>
                </div>
              </label>
              <label className="tg-settings-field">
                <span>Equation size boost (px)</span>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={opts.equationSize ?? 0}
                  onChange={(e) => set("equationSize", e.target.value)}
                  className="tg-field h-10 w-full px-2.5 text-sm"
                />
              </label>
            </div>
          </section>

          <section className="tg-settings-panel tg-settings-panel--brand">
            <div className="tg-settings-panel-head">
              <span className="tg-settings-panel-icon" aria-hidden>
                <LayoutTemplate strokeWidth={1.75} className="size-4" />
              </span>
              <div>
                <h2 className="tg-settings-panel-title">Header &amp; branding</h2>
                <p className="tg-settings-panel-desc">
                  Header scale, logo, layout, and watermark
                </p>
              </div>
            </div>
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
                  className="tg-field h-10 w-full px-2.5 text-sm"
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
                  className="tg-field h-10 w-full px-2.5 text-sm"
                />
              </label>
              <label className="tg-settings-field tg-settings-field--wide">
                <span>
                  <Palette className="tg-settings-inline-ico" aria-hidden />
                  Paper layout
                </span>
                <select
                  className="tg-native-select"
                  value={opts.layout || "1"}
                  onChange={(e) => set("layout", e.target.value)}
                >
                  {LAYOUT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tg-settings-field tg-settings-field--wide">
                <span>
                  <Image className="tg-settings-inline-ico" aria-hidden />
                  Watermark
                </span>
                <select
                  className="tg-native-select"
                  value={opts.watermark || WATERMARK_MODES.MONO}
                  onChange={(e) => set("watermark", e.target.value)}
                >
                  {WATERMARK_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="tg-settings-panel tg-settings-panel--checks">
            <div className="tg-settings-panel-head">
              <span className="tg-settings-panel-icon" aria-hidden>
                <Printer strokeWidth={1.75} className="size-4" />
              </span>
              <div>
                <h2 className="tg-settings-panel-title">Print options</h2>
                <p className="tg-settings-panel-desc">
                  Toggle what appears on the printed sheet
                </p>
              </div>
            </div>
            <div className="tg-settings-checks">
              {PRINT_TOGGLES.map(([key, label, hint]) => {
                const on = Boolean(opts[key]);
                return (
                  <label
                    key={key}
                    className={`tg-settings-check${on ? " tg-settings-check--on" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => set(key, e.target.checked)}
                    />
                    <span className="tg-settings-check-copy">
                      <span className="tg-settings-check-label">{label}</span>
                      <span className="tg-settings-check-hint">{hint}</span>
                    </span>
                    <span className="tg-settings-switch" aria-hidden />
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        <section className="tg-settings-preview">
          <div className="tg-settings-preview-head">
            <div className="tg-settings-panel-head">
              <span className="tg-settings-panel-icon" aria-hidden>
                <Eye strokeWidth={1.75} className="size-4" />
              </span>
              <div>
                <h2 className="tg-settings-panel-title">Live preview</h2>
                <p className="tg-settings-preview-hint">
                  Sample paper updates as you change the fields above.
                </p>
              </div>
            </div>
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
