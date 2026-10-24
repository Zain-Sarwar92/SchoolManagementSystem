import CustomSelect from "../../../components/ui/CustomSelect.jsx";

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
  { value: "mono", label: "Monogram Watermark" },
  { value: "none", label: "No Watermark" },
  { value: "full", label: "Full Logo Watermark" },
];

export default function PrintFormatBar({
  opts,
  onChange,
  onShuffleMcqs,
  onToggleInlineEdit,
  onPrint,
  inlineEditing = false,
  disabled = false,
}) {
  const set = (key, value) => onChange?.({ ...opts, [key]: value });

  return (
    <div className="pts-print-bar no-print">
      <div className="pts-print-bar-row">
        <div className="pts-print-field">
          <label>Line Height</label>
          <input
            type="number"
            step="0.1"
            min="1"
            max="2.5"
            value={opts.lineHeight}
            onChange={(e) => set("lineHeight", e.target.value)}
          />
        </div>
        <div className="pts-print-field">
          <label>Urdu Font Size</label>
          <input
            type="number"
            min="8"
            max="22"
            value={opts.urduSize}
            onChange={(e) => set("urduSize", e.target.value)}
          />
        </div>
        <div className="pts-print-field">
          <label>English Font Size</label>
          <input
            type="number"
            min="8"
            max="22"
            value={opts.englishSize}
            onChange={(e) => set("englishSize", e.target.value)}
          />
        </div>
        <div className="pts-print-field">
          <label>Equation Size</label>
          <input
            type="number"
            min="0"
            max="40"
            value={opts.equationSize ?? 0}
            onChange={(e) => set("equationSize", e.target.value)}
          />
        </div>
        <div className="pts-print-field">
          <label>Header Size</label>
          <input
            type="number"
            min="0"
            max="5"
            step="0.1"
            value={opts.headerSize ?? 1}
            onChange={(e) => set("headerSize", e.target.value)}
          />
        </div>
        <div className="pts-print-field">
          <label>Logo Size</label>
          <input
            type="number"
            min="0.3"
            max="3"
            step="0.1"
            value={opts.logoSize ?? 1}
            onChange={(e) => set("logoSize", e.target.value)}
          />
        </div>
        <div className="pts-print-field pts-print-field--color">
          <label>Font Color</label>
          <input
            type="color"
            value={opts.fontColor || "#000000"}
            onChange={(e) => set("fontColor", e.target.value)}
          />
        </div>
        <div className="pts-print-field">
          <label>Font Weight</label>
          <CustomSelect
            className="tg-select"
            searchable={false}
            value={opts.fontWeight || "normal"}
            onChange={(val) => set("fontWeight", String(val))}
            options={FONT_WEIGHT_OPTIONS}
            placeholder="Font weight"
          />
        </div>
        <div className="pts-print-field pts-print-field--wide">
          <label>Select Layout</label>
          <CustomSelect
            className="tg-select"
            searchable={false}
            value={opts.layout || "1"}
            onChange={(val) => set("layout", String(val))}
            options={LAYOUT_OPTIONS}
            placeholder="Select layout"
          />
        </div>
        <div className="pts-print-field pts-print-field--wide">
          <label>Select Watermark</label>
          <CustomSelect
            className="tg-select"
            searchable={false}
            value={opts.watermark || "mono"}
            onChange={(val) => set("watermark", String(val))}
            options={WATERMARK_OPTIONS}
            placeholder="Select watermark"
          />
        </div>
      </div>

      <div className="pts-print-bar-row pts-print-bar-row--checks">
        <label className="pts-print-check">
          <input
            type="checkbox"
            checked={opts.showPartHeading}
            onChange={(e) => set("showPartHeading", e.target.checked)}
          />
          Show part Heading
        </label>
        <label className="pts-print-check">
          <input
            type="checkbox"
            checked={Boolean(opts.separateSubjective)}
            onChange={(e) => set("separateSubjective", e.target.checked)}
          />
          Separate subjective part
        </label>
        <label className="pts-print-check">
          <input
            type="checkbox"
            checked={Boolean(opts.objectiveBorder)}
            onChange={(e) => set("objectiveBorder", e.target.checked)}
          />
          Objective Border
        </label>
        <label className="pts-print-check">
          <input
            type="checkbox"
            checked={Boolean(opts.subjectiveBorder)}
            onChange={(e) => set("subjectiveBorder", e.target.checked)}
          />
          Subjective Border
        </label>
        <label className="pts-print-check">
          <input
            type="checkbox"
            checked={opts.showSyllabus}
            onChange={(e) => set("showSyllabus", e.target.checked)}
          />
          Print Exam Syllabus
        </label>
        <label className="pts-print-check">
          <input
            type="checkbox"
            checked={opts.showBubbleSheet}
            onChange={(e) => set("showBubbleSheet", e.target.checked)}
          />
          Print Bubble Sheet
        </label>
        <label className="pts-print-check">
          <input
            type="checkbox"
            checked={opts.showAnswerKey}
            onChange={(e) => set("showAnswerKey", e.target.checked)}
          />
          Print Answer Keys
        </label>

        <div className="pts-print-actions">
          <button
            type="button"
            className="pts-btn pts-btn--shuffle"
            disabled={disabled}
            onClick={onShuffleMcqs}
          >
            SHUFFLE MCQS
          </button>
          <button
            type="button"
            className="pts-btn pts-btn--edit"
            disabled
            title="Edit questions in the paper workspace — print edits are not saved yet"
            onClick={onToggleInlineEdit}
          >
            {inlineEditing ? "STOP EDITING" : "MANUAL EDITING"}
          </button>
          <button
            type="button"
            className="pts-btn pts-btn--print"
            disabled={disabled}
            onClick={onPrint}
          >
            PRINT PAPER
          </button>
        </div>
      </div>
    </div>
  );
}
