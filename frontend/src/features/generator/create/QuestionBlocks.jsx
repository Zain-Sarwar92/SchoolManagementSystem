import RichText from "../../../components/RichText.jsx";
import { isRedundantInstructionStem } from "../utils/paperBlueprint.js";

function QuestionText({ text, textUrdu, medium, dualLayout = "stack" }) {
  const en = String(text || "").trim();
  const ur = String(textUrdu || "").trim();
  const urduOk = Boolean(ur && ur !== "—" && ur !== en);

  if (medium === "URDU") {
    return (
      <RichText
        as="p"
        dir="rtl"
        className="tg-font-urdu whitespace-pre-wrap text-sm text-tg-ink"
        value={ur || en}
      />
    );
  }
  if (medium === "ENGLISH") {
    return (
      <RichText
        as="p"
        className="whitespace-pre-wrap text-sm text-tg-ink"
        value={en || ur}
      />
    );
  }

  /* Dual — side-by-side (board-style) or stacked */
  if (en && urduOk) {
    if (dualLayout === "columns") {
      return (
        <div className="tg-q-dual">
          <RichText as="p" className="tg-q-dual-en whitespace-pre-wrap" value={en} />
          <RichText
            as="p"
            dir="rtl"
            className="tg-q-dual-ur tg-font-urdu whitespace-pre-wrap"
            value={ur}
          />
        </div>
      );
    }
    return (
      <div className="space-y-1.5">
        <RichText
          as="p"
          className="whitespace-pre-wrap text-sm text-tg-ink"
          value={en}
        />
        <RichText
          as="p"
          dir="rtl"
          className="tg-font-urdu whitespace-pre-wrap border-t border-tg-mist/50 pt-1.5 text-right text-sm text-tg-ink"
          value={ur}
        />
      </div>
    );
  }

  const looksUrdu = /[\u0600-\u06FF]/.test(en || ur);
  return (
    <RichText
      as="p"
      dir={looksUrdu ? "rtl" : undefined}
      className={[
        "whitespace-pre-wrap text-sm text-tg-ink",
        looksUrdu ? "tg-font-urdu" : "",
      ].join(" ")}
      value={en || ur}
    />
  );
}

function McqOptionsRow({ question, medium, variant = "pool" }) {
  const pairs = [
    ["optionA", "optionAUrdu", "A"],
    ["optionB", "optionBUrdu", "B"],
    ["optionC", "optionCUrdu", "C"],
    ["optionD", "optionDUrdu", "D"],
  ];
  const both = medium === "BOTH" || medium === "ENGLISH_URDU";
  const present = pairs
    .map(([enKey, urKey, letter]) => {
      const en = String(question[enKey] || "").trim();
      const ur = String(question[urKey] || "").trim();
      return { en, ur, letter, enKey };
    })
    .filter((x) => x.en || x.ur);
  if (!present.length) return null;

  return (
    <div
      className={[
        "tg-mcq-row",
        variant === "paper" ? "tg-mcq-row--paper" : "",
        variant === "paper" && both ? "tg-mcq-row--paper-both" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {present.map(({ en, ur, letter, enKey }) => {
        const text =
          medium === "URDU" ? ur || en : medium === "ENGLISH" ? en || ur : en || ur;
        const looksUrdu = /[\u0600-\u06FF]/.test(text);
        const rtl = medium === "URDU" || (looksUrdu && !both);
        const showDual = both && ur && en && ur !== en;

        if (variant === "paper" && showDual) {
          return (
            <span key={enKey} className="tg-mcq-opt tg-mcq-opt--paper tg-mcq-opt--dual">
              <span className="tg-mcq-letter">({letter})</span>
              <span className="tg-mcq-opt-dual-en">
                <RichText as="span" value={en} />
              </span>
              <span className="tg-mcq-opt-sep">/</span>
              <span className="tg-mcq-opt-dual-ur tg-font-urdu" dir="rtl">
                <RichText as="span" dir="rtl" value={ur} />
              </span>
            </span>
          );
        }

        return (
          <span
            key={enKey}
            className={[
              "tg-mcq-opt",
              looksUrdu || medium === "URDU" ? "tg-font-urdu" : "",
              variant === "paper" ? "tg-mcq-opt--paper" : "",
            ].join(" ")}
            dir={rtl ? "rtl" : undefined}
          >
            <span className="tg-mcq-letter">({letter})</span>{" "}
            {showDual ? (
              <>
                <RichText as="span" value={en} />
                <span className="tg-mcq-opt-sep"> / </span>
                <RichText as="span" dir="rtl" className="tg-font-urdu" value={ur} />
              </>
            ) : (
              <RichText as="span" dir={rtl ? "rtl" : undefined} value={text} />
            )}
          </span>
        );
      })}
    </div>
  );
}

function PaperQuestionBlock({
  index,
  question,
  type,
  subType,
  medium,
  showAnswerKey,
  inlineEdit,
  marksEdit = false,
  onUpdateText,
}) {
  let en = String(question.text || "").trim();
  let ur = String(question.textUrdu || "").trim();
  /* Hide stem when it only repeats the section heading (SPELLING, etc.). */
  if (!inlineEdit) {
    if (isRedundantInstructionStem(en, type, subType)) en = "";
    if (isRedundantInstructionStem(ur, type, subType)) ur = "";
  }
  const urduOk = Boolean(ur && ur !== "—" && ur !== en);
  const showEn = medium !== "URDU";
  /* Dual (BOTH): always reserve Urdu column so paper matches board layout */
  const showUr =
    medium !== "ENGLISH" &&
    (urduOk || medium === "URDU" || medium === "BOTH" || inlineEdit);
  const qMarks = Number(question.marks);
  const marksVal = Number.isFinite(qMarks) && qMarks > 0 ? qMarks : "";

  return (
    <div className={["tg-paper-q", inlineEdit ? "tg-paper-q--inline" : ""].join(" ")}>
      <div
        className={[
          "tg-paper-q-stem",
          showEn && showUr ? "tg-paper-q-stem--dual" : "",
        ].join(" ")}
      >
        {showEn ? (
          <div className="tg-paper-q-en">
            <span className="tg-paper-q-num">{index}.</span>
            {inlineEdit ? (
              <p
                className="tg-paper-q-text tg-paper-q-text--edit"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) =>
                  onUpdateText?.({
                    text: e.currentTarget.textContent || "",
                  })
                }
              >
                {String(question.text || "").trim() ||
                  String(question.textUrdu || "").trim()}
              </p>
            ) : en || (!showUr && ur) ? (
              <RichText as="p" className="tg-paper-q-text" value={en || ur} />
            ) : null}
          </div>
        ) : null}
        {showUr ? (
          <div className="tg-paper-q-ur tg-font-urdu" dir="rtl">
            <span className="tg-paper-q-num">{index}.</span>
            {inlineEdit ? (
              <p
                className="tg-paper-q-text tg-paper-q-text--edit"
                contentEditable
                suppressContentEditableWarning
                dir="rtl"
                onBlur={(e) =>
                  onUpdateText?.({
                    textUrdu: e.currentTarget.textContent || "",
                  })
                }
              >
                {String(question.textUrdu || "").trim() ||
                  String(question.text || "").trim()}
              </p>
            ) : ur || en ? (
              <RichText
                as="p"
                dir="rtl"
                className="tg-paper-q-text tg-font-urdu"
                value={ur || en}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      {/* Per-question marks only for LONG (board-style 4 + 5 = 9) */}
      {marksEdit && type === "LONG" ? (
        <label className="tg-paper-q-marks-edit no-print" title="Marks for this question">
          <span>marks</span>
          <input
            type="number"
            min="1"
            step="1"
            value={marksVal}
            aria-label={`Marks for question ${index}`}
            onChange={(e) => {
              const n = Number(e.target.value);
              onUpdateText?.({
                marks: Number.isFinite(n) && n > 0 ? n : 0,
              });
            }}
          />
        </label>
      ) : null}
      {type === "MCQ" ? (
        <McqOptionsRow question={question} medium={medium} variant="paper" />
      ) : null}
      {showAnswerKey && question.correctAnswer ? (
        <p className="tg-paper-ans">Ans: {question.correctAnswer}</p>
      ) : null}
    </div>
  );
}

export { QuestionText, McqOptionsRow, PaperQuestionBlock };
