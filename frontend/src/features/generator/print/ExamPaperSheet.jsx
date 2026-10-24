import RichText from "../../../components/RichText.jsx";
import {
  isRedundantInstructionStem,
  isUrduLikeSubject,
  sectionInstruction,
} from "../utils/paperBlueprint.js";

const ROMANS = [
  "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
  "XXI", "XXII", "XXIII", "XXIV", "XXV", "XXVI", "XXVII", "XXVIII", "XXIX", "XXX",
];

function questionLabel(type, index) {
  if (type === "SHORT") return ROMANS[index] ?? String(index + 1);
  return String(index + 1);
}

function formatExamDate(value) {
  if (!value) return "____________";
  const d = new Date(String(value).includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTimeAllowed(minutes) {
  if (minutes == null || minutes === "") return "____";
  const n = Number(minutes);
  if (!Number.isFinite(n) || n <= 0) return "____";
  if (n >= 60 && n % 60 === 0) return `${n / 60} HOU`;
  return `${n} MINS`;
}

function scoredCount(section) {
  const n = section.questions?.length || 0;
  const attempt = Number(section.attemptCount);
  if (!Number.isFinite(attempt) || attempt <= 0) return n;
  return Math.min(n, attempt);
}

function sectionMarksTotal(section) {
  return scoredCount(section) * (Number(section.marksEach) || 0);
}

function normalizeMcqKey(value) {
  if (!value) return null;
  const trimmed = String(value).trim().toUpperCase();
  if (/^[A-D]$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^[(\[]?([A-D])[)\].:]?$/);
  return match?.[1] ?? null;
}

/** PTS-style meta cell — blank = empty write-in area (no underscore line) */
function MetaCell({
  label,
  value = "",
  blank = false,
  wide = false,
  span2 = false,
}) {
  return (
    <div
      className={[
        "exam-info-cell",
        wide ? "exam-info-cell-wide" : "",
        span2 ? "exam-info-cell-span2" : "",
        blank ? "exam-info-cell--blank" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="exam-info-label">{label}</span>
      <span className="exam-info-value">{blank ? "\u00a0" : value || "\u00a0"}</span>
    </div>
  );
}

/** Equal row — Student Name + Roll Number (empty cells, no lines) */
function BlankIdentityRow() {
  return (
    <div className="exam-identity-row" aria-label="Student identity">
      <div className="exam-identity-field">
        <span className="exam-identity-label">Student Name</span>
        <span className="exam-identity-value">{"\u00a0"}</span>
      </div>
      <div className="exam-identity-field">
        <span className="exam-identity-label">Roll Number</span>
        <span className="exam-identity-value">{"\u00a0"}</span>
      </div>
    </div>
  );
}

function BubbleSheet({ count, layout }) {
  if (count <= 0) return null;
  return (
    <div
      className={[
        "exam-bubble-sheet",
        layout === "2" ? "exam-bubble-sheet--dense" : "",
        layout === "4" ? "exam-bubble-sheet--row" : "",
        layout === "5" ? "exam-bubble-sheet--boxed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="exam-bubble-row">
          <span className="exam-bubble-no">{i + 1}</span>
          {["A", "B", "C", "D"].map((letter) => (
            <span key={letter} className="exam-bubble">
              <span className="exam-bubble-circle" />
              <span className="exam-bubble-letter">({letter})</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function McqOptions({ question, medium, showAnswerKey }) {
  const opts = [
    ["optionA", "optionAUrdu", "A"],
    ["optionB", "optionBUrdu", "B"],
    ["optionC", "optionCUrdu", "C"],
    ["optionD", "optionDUrdu", "D"],
  ];
  const correct = showAnswerKey ? normalizeMcqKey(question.correctAnswer) : null;
  const both = medium === "BOTH" || medium === "ENGLISH_URDU";

  return (
    <div className={both ? "exam-mcq-options exam-mcq-options--both" : "exam-mcq-options"}>
      {opts.map(([enKey, urKey, letter]) => {
        const en = question[enKey];
        const ur = question[urKey];
        if (!en && !ur) return null;
        const text =
          medium === "URDU" ? ur || en : medium === "ENGLISH" ? en || ur : en || ur;
        return (
          <span
            key={enKey}
            className={[
              "exam-mcq-opt",
              correct === letter ? "exam-mcq-opt--correct" : "",
            ].join(" ")}
          >
            <span className="exam-mcq-letter">({letter})</span>{" "}
            {medium === "URDU" ? (
              <RichText value={text} dir="rtl" />
            ) : both && ur && en && ur !== en ? (
              <>
                <RichText value={en} />
                <span className="exam-mcq-opt-sep"> / </span>
                <RichText value={ur} dir="rtl" />
              </>
            ) : (
              <RichText value={text} />
            )}
          </span>
        );
      })}
    </div>
  );
}

function QuestionStem({
  question,
  medium,
  index,
  sectionType,
  sectionSubType,
  stacked,
}) {
  const label = questionLabel(sectionType, index);
  let en = question.text || "";
  let ur = question.textUrdu || "";
  if (isRedundantInstructionStem(en, sectionType, sectionSubType)) en = "";
  if (isRedundantInstructionStem(ur, sectionType, sectionSubType)) ur = "";

  if (medium === "ENGLISH") {
    return (
      <p className="exam-q-stem exam-q-en">
        <span className="exam-q-num">{label}.</span>
        {en ? (
          <>
            {" "}
            <RichText value={en} />
          </>
        ) : null}
      </p>
    );
  }
  if (medium === "URDU") {
    return (
      <p className="exam-q-stem exam-q-ur" dir="rtl">
        <span className="exam-q-num">{label}.</span>
        {ur || en ? (
          <>
            {" "}
            <RichText value={ur || en} />
          </>
        ) : null}
      </p>
    );
  }
  return (
    <div
      className={[
        "exam-q-bilingual",
        stacked ? "exam-q-bilingual--stack" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="exam-q-stem exam-q-en">
        <span className="exam-q-num">{label}.</span>
        {en ? (
          <>
            {" "}
            <RichText value={en} />
          </>
        ) : null}
      </p>
      {ur ? (
        <p className="exam-q-stem exam-q-ur" dir="rtl">
          <span className="exam-q-num">{label}.</span>{" "}
          <RichText value={ur} />
        </p>
      ) : null}
    </div>
  );
}

function PartBanner({ en, ur, marksLine }) {
  return (
    <div className="exam-part-banner">
      <h2>
        {en}
        <span dir="rtl" className="exam-section-ur">
          {" "}
          {ur}
        </span>
      </h2>
      {marksLine ? <p className="exam-part-marks">{marksLine}</p> : null}
    </div>
  );
}

function SectionPromptRow({ en, ur, medium, attemptNote, qNo, urduOnly }) {
  const enLine = /^(Q\d+\.|Question \d+\.)/i.test(en)
    ? en
        .replace(/^Q\d+\./i, `Q${qNo}.`)
        .replace(/^Question \d+\./i, `Q${qNo}.`)
    : `Q${qNo}. ${en}`;
  const urLine = /سوال نمبر \d+/.test(ur)
    ? ur.replace(/سوال نمبر \d+[.:]?/, `سوال نمبر ${qNo}.`)
    : `سوال نمبر ${qNo}. ${ur}`;

  if (urduOnly || medium === "URDU") {
    return (
      <div className="exam-q-prompt exam-q-prompt-single">
        <div className="exam-q-prompt-line exam-q-ur exam-q-heading exam-q-heading--bold" dir="rtl">
          <strong>{urLine}</strong>
        </div>
        {attemptNote ? <p className="exam-attempt-note">{attemptNote}</p> : null}
      </div>
    );
  }
  if (medium === "ENGLISH") {
    return (
      <div className="exam-q-prompt exam-q-prompt-single">
        <div className="exam-q-prompt-line exam-q-en exam-q-heading">
          <strong>{enLine}</strong>
        </div>
        {attemptNote ? <p className="exam-attempt-note">{attemptNote}</p> : null}
      </div>
    );
  }
  return (
    <div className="exam-q-prompt">
      <div className="exam-q-prompt-en">
        <div className="exam-q-prompt-line exam-q-en exam-q-heading">
          <strong>{enLine}</strong>
        </div>
        {attemptNote ? <p className="exam-attempt-note">{attemptNote}</p> : null}
      </div>
      <div className="exam-q-prompt-ur exam-q-ur exam-q-heading exam-q-heading--bold" dir="rtl">
        <strong>{urLine}</strong>
      </div>
    </div>
  );
}

function BrandHeader({ layout, orgName, address, logoUrl }) {
  /* Layout 3 — centered logo above name */
  if (layout === "3") {
    return (
      <header className="exam-brand-header exam-brand-header--centered">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="exam-logo-img exam-logo-img--center" />
        ) : (
          <div className="exam-logo-fallback exam-logo-fallback--center" aria-hidden>
            {(orgName.slice(0, 2) || "EX").toUpperCase()}
          </div>
        )}
        <h1 className="exam-org-name">{orgName}</h1>
        {address ? (
          <p className="exam-org-address">HEAD OFFICE: {address.toUpperCase()}</p>
        ) : null}
      </header>
    );
  }

  /* Layout 5 — slim top bar */
  if (layout === "5") {
    return (
      <header className="exam-brand-header exam-brand-header--bar">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="exam-logo-img exam-logo-img--sm" />
        ) : null}
        <div className="exam-brand-bar-text">
          <h1 className="exam-org-name">{orgName}</h1>
          {address ? (
            <p className="exam-org-address">{address.toUpperCase()}</p>
          ) : null}
        </div>
      </header>
    );
  }

  /* Layout 1 / 2 / 4 — classic logo left + name center */
  return (
    <header className="exam-brand-header">
      <div className="exam-brand-row">
        <div className="exam-brand-logo">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="exam-logo-img" />
          ) : (
            <div className="exam-logo-fallback" aria-hidden>
              {(orgName.slice(0, 2) || "EX").toUpperCase()}
            </div>
          )}
        </div>
        <div className="exam-brand-center">
          <h1 className="exam-org-name">{orgName}</h1>
          {address ? (
            <p className="exam-org-address">
              HEAD OFFICE: {address.toUpperCase()}
            </p>
          ) : null}
        </div>
        <div className="exam-brand-spacer" aria-hidden />
      </div>
    </header>
  );
}

function InfoGrid({
  layout,
  classDisplay,
  meta,
  totalMarks,
  showSyllabus,
}) {
  const examValue = String(
    meta.examLabel || meta.paperCategory || "____"
  ).toUpperCase();
  const syllabusValue = showSyllabus
    ? String(meta.syllabusNote || "____").toUpperCase()
    : "____";
  const code = String(meta.paperCode || "____").toUpperCase();
  const subject = String(meta.subjectName || "____").toUpperCase();
  const time = formatTimeAllowed(meta.durationMinutes);
  const date = formatExamDate(meta.examDate);

  /* Layout 2 — equal name/roll + 2-col pairs */
  if (layout === "2") {
    return (
      <div className="exam-info-block exam-info-block--l2">
        <BlankIdentityRow />
        <div className="exam-info-grid exam-info-grid--pairs">
          <MetaCell label="Class Name" value={classDisplay || "____"} />
          <MetaCell label="Paper Code" value={code} />
          <MetaCell label="Subject Name" value={subject} />
          <MetaCell label="Time Allowed" value={time} />
          <MetaCell label="Total Marks" value={String(totalMarks)} />
          <MetaCell label="Exam Date" value={date} />
          <MetaCell label="Exam" value={examValue} />
          <MetaCell label="Exam Syllabus" value={syllabusValue} />
        </div>
      </div>
    );
  }

  /* Layout 4 — equal name/roll + chips */
  if (layout === "4") {
    const chips = [
      { label: "Class", value: classDisplay || "____" },
      { label: "Code", value: code },
      { label: "Subject", value: subject },
      { label: "Time", value: time },
      { label: "Marks", value: String(totalMarks) },
      { label: "Date", value: date },
      { label: "Exam", value: examValue },
    ];
    if (showSyllabus) {
      chips.push({ label: "Syllabus", value: syllabusValue, wide: true });
    }
    return (
      <div className="exam-info-block exam-info-block--l4">
        <BlankIdentityRow />
        <div className="exam-info-chips">
          {chips.map((c) => (
            <div
              key={c.label}
              className={[
                "exam-info-chip",
                c.wide ? "exam-info-chip--wide" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="exam-info-chip-label">{c.label}</span>
              <span className="exam-info-chip-value">{c.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* Layout 5 — equal name/roll + tidy 2×2 detail (never uneven blanks) */
  if (layout === "5") {
    return (
      <div className="exam-info-block exam-info-block--l5">
        <BlankIdentityRow />
        <div className="exam-info-grid exam-info-grid--pairs">
          <MetaCell label="Class Name" value={classDisplay || "____"} />
          <MetaCell label="Paper Code" value={code} />
          <MetaCell label="Subject Name" value={subject} />
          <MetaCell label="Time Allowed" value={time} />
          <MetaCell label="Total Marks" value={String(totalMarks)} />
          <MetaCell label="Exam Date" value={date} />
          <MetaCell label="Exam" value={examValue} />
          <MetaCell label="Exam Syllabus" value={syllabusValue} />
        </div>
      </div>
    );
  }

  /*
   * Layout 1 & 3 — real <table> so every border prints
   * (CSS-grid label backgrounds were hiding horizontal lines on Code/Marks/Syllabus)
   * 3 fields per row × 4 rows
   */
  const rows = [
    [
      { k: "Student Name", blank: true },
      { k: "Roll Number", blank: true },
      { k: "Class", v: classDisplay || "—" },
    ],
    [
      { k: "Code", v: code },
      { k: "Subject", v: subject },
      { k: "Time", v: time },
    ],
    [
      { k: "Marks", v: String(totalMarks) },
      { k: "Date", v: date },
      { k: "Exam", v: examValue },
    ],
    [
      { k: "Syllabus", v: syllabusValue },
      { k: "Invigilator", blank: true },
      { k: "Signature", blank: true },
    ],
  ];

  return (
    <div
      className={[
        "exam-info-block",
        "exam-info-block--pts",
        layout === "3" ? "exam-info-block--l3" : "exam-info-block--l1",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <table className="exam-pts-table">
        <colgroup>
          <col className="exam-pts-col-k" />
          <col className="exam-pts-col-v" />
          <col className="exam-pts-col-k" />
          <col className="exam-pts-col-v" />
          <col className="exam-pts-col-k" />
          <col className="exam-pts-col-v" />
        </colgroup>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.flatMap((c) => [
                <th key={`${c.k}-k`} scope="row" className="exam-pts-th">
                  {c.k}
                </th>,
                <td
                  key={`${c.k}-v`}
                  className={[
                    "exam-pts-td",
                    c.blank ? "exam-pts-td--blank" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {c.blank ? "\u00a0" : c.v}
                </td>,
              ])}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * PTS-style printable exam sheet with 5 selectable layouts.
 */
export default function ExamPaperSheet({
  meta = {},
  sections = [],
  medium = "BOTH",
  className = "",
  layout = "1",
  showAnswerKey = false,
  showPartHeading = true,
  showBubbleSheet = true,
  showSyllabus = true,
  watermark = "mono",
  objectiveBorder = false,
  subjectiveBorder = false,
  styleVars = null,
  renderSectionTools = null,
}) {
  const layoutId = String(layout || "1");
  const totalMarks =
    meta.totalMarks ??
    sections.reduce((sum, s) => sum + sectionMarksTotal(s), 0);

  const orgName = (
    meta.orgName ||
    meta.orgTitle ||
    meta.boardName ||
    "Examination Test"
  ).trim();
  const address = (meta.address || "").trim();
  const logoUrl = (meta.logoUrl || "").trim();
  const classDisplay = String(meta.className || "")
    .replace(/class\s*/i, "")
    .trim()
    .toUpperCase();
  const mcqSection = sections.find((s) => s.type === "MCQ");
  const mcqCount = mcqSection?.questions?.length || 0;
  const hasSubjective = sections.some(
    (s) => s.type === "SHORT" || s.type === "LONG"
  );
  let subjectiveShown = false;
  const stackQuestions = layoutId === "4" || layoutId === "2";

  const mcqKeyLine =
    showAnswerKey && mcqSection
      ? mcqSection.questions
          .map((q, idx) => {
            const key = normalizeMcqKey(q.correctAnswer);
            return key ? `${idx + 1}-${key}` : null;
          })
          .filter(Boolean)
          .join(" · ")
      : "";

  const showWatermark = watermark !== "none" && Boolean(logoUrl);

  return (
    <article
      className={[
        "exam-sheet",
        `exam-sheet--layout-${layoutId}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={styleVars || undefined}
    >
      {showWatermark ? (
        <img
          src={logoUrl}
          alt=""
          className={[
            "exam-watermark",
            watermark === "full" ? "exam-watermark--full" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
        />
      ) : null}

      <BrandHeader
        layout={layoutId}
        orgName={orgName}
        address={address}
        logoUrl={logoUrl}
      />

      <InfoGrid
        layout={layoutId}
        classDisplay={classDisplay}
        meta={meta}
        totalMarks={totalMarks}
        showSyllabus={showSyllabus}
      />

      {showBubbleSheet && mcqCount > 0 ? (
        <BubbleSheet count={mcqCount} layout={layoutId} />
      ) : null}

      {sections.length === 0 ? (
        <p className="exam-empty">No questions added yet.</p>
      ) : (
        sections.map((section, sIdx) => {
          const scored = scoredCount(section);
          const marks = sectionMarksTotal(section);
          const marksLine = `(${Number(section.marksEach) || 0} x ${scored} = ${marks})`;
          const subjectName = meta.subjectName || meta.subjectLabel || "";
          const urduOnlyHeadings = isUrduLikeSubject(subjectName);
          const prompt = sectionInstruction(section.type, section.subType, {
            subjectName,
            className: meta.className || meta.classLabel || "",
          });
          const showSubjectiveBanner =
            showPartHeading &&
            hasSubjective &&
            (section.type === "SHORT" || section.type === "LONG") &&
            !subjectiveShown;
          if (showSubjectiveBanner) subjectiveShown = true;

          const attempt = Number(section.attemptCount);
          const attemptNote =
            Number.isFinite(attempt) &&
            attempt > 0 &&
            attempt < (section.questions?.length || 0)
              ? `Attempt any ${attempt} out of ${section.questions.length}`
              : null;

          const qNo = sIdx + 1;
          const bordered =
            (section.type === "MCQ" && objectiveBorder) ||
            ((section.type === "SHORT" || section.type === "LONG") &&
              subjectiveBorder);

          return (
            <div key={section.key || `${section.type}-${sIdx}`}>
              {showPartHeading && section.type === "MCQ" ? (
                <PartBanner
                  en="Objective Part"
                  ur="حصہ معروضی"
                  marksLine={marksLine}
                />
              ) : null}
              {showSubjectiveBanner ? (
                <PartBanner
                  en="Subjective Part"
                  ur="حصہ انشائیہ"
                  marksLine={null}
                />
              ) : null}

              <section
                className={[
                  "exam-section",
                  section.type === "MCQ" ? "exam-section-objective" : "",
                  bordered ? "exam-section--bordered" : "",
                ].join(" ")}
              >
                {!(showPartHeading && section.type === "MCQ") ? (
                  <p className="exam-inline-marks">{marksLine}</p>
                ) : null}

                <SectionPromptRow
                  en={prompt.en}
                  ur={prompt.ur}
                  medium={medium}
                  attemptNote={attemptNote}
                  qNo={qNo}
                  urduOnly={urduOnlyHeadings}
                />

                {typeof renderSectionTools === "function"
                  ? renderSectionTools(section, sIdx)
                  : null}

                <ol className="exam-q-list">
                  {(section.questions || []).map((q, idx) => (
                    <li
                      key={q.id || `${section.type}-${idx}`}
                      className="exam-q-item"
                    >
                      <QuestionStem
                        question={q}
                        medium={medium}
                        index={idx}
                        sectionType={section.type}
                        sectionSubType={section.subType}
                        stacked={stackQuestions}
                      />
                      {section.type === "MCQ" ? (
                        <McqOptions
                          question={q}
                          medium={medium}
                          showAnswerKey={showAnswerKey}
                        />
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          );
        })
      )}

      {mcqKeyLine ? (
        <div className="exam-answer-key">
          <h4>MCQ Answer Key</h4>
          <p>{mcqKeyLine}</p>
        </div>
      ) : null}
    </article>
  );
}
