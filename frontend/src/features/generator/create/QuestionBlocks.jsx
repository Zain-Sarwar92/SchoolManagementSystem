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

  /* Dual — side-by-side (PTS-style) or stacked */
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
  const opts = [
    question.optionA,
    question.optionB,
    question.optionC,
    question.optionD,
  ];
  const present = opts
    .map((opt, i) => ({ opt: String(opt || "").trim(), i }))
    .filter((x) => x.opt);
  if (!present.length) return null;

  return (
    <div
      className={["tg-mcq-row", variant === "paper" ? "tg-mcq-row--paper" : ""].join(
        " "
      )}
    >
      {present.map(({ opt, i }) => {
        const letter = String.fromCharCode(65 + i);
        const looksUrdu = /[\u0600-\u06FF]/.test(opt);
        const rtl = medium === "URDU" || looksUrdu;
        return (
          <span
            key={letter}
            className={[
              "tg-mcq-opt",
              looksUrdu ? "tg-font-urdu" : "",
              variant === "paper" ? "tg-mcq-opt--paper" : "",
            ].join(" ")}
            dir={rtl ? "rtl" : undefined}
          >
            <strong>({letter})</strong>{" "}
            <RichText as="span" dir={rtl ? "rtl" : undefined} value={opt} />
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
  const showUr =
    medium !== "ENGLISH" && (urduOk || medium === "URDU" || inlineEdit);

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
