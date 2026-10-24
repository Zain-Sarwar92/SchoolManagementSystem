import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  List,
  LogOut,
  Maximize2,
  Pencil,
  Printer,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import GeneratorLayout from "../components/GeneratorLayout.jsx";
import TgConfirmModal from "../components/TgConfirmModal.jsx";
import StatusPanel from "../components/StatusPanel.jsx";
import { PaperQuestionBlock } from "../create/QuestionBlocks.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { toast } from "../../../components/ui/toast.jsx";
import api from "../../../services/api.js";
import { openGeneratorPrintTab } from "../print/index.js";
import { fetchSubjectSyllabus, pickPool } from "../bank/index.js";
import {
  TYPE_META,
  blueprintFromApiPaper,
  blueprintHasMarks,
  blueprintToApiBody,
  blueprintToPrintPayload,
  isUrduLikeSubject,
  marksLine,
  mediumFromApi,
  paperTotalMarks,
  sectionInstruction,
} from "../utils/paperBlueprint.js";

const PART_META = {
  objective: { en: "Objective Part", ur: "حصہ معروضی" },
  subjective: { en: "Subjective Part", ur: "حصہ انشائیہ" },
};

function sectionQNumber(sectionKey, sections) {
  const idx = sections.findIndex((s) => s.key === sectionKey);
  return idx >= 0 ? idx + 1 : sections.length + 1;
}

function mediumFlag(medium) {
  return mediumFromApi(medium);
}

function normalizeSections(sections = []) {
  return blueprintFromApiPaper({ sections }).sections;
}

function GeneratorPaperView() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const academy = user?.academy;

  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [meta, setMeta] = useState(null);
  const [paperSections, setPaperSections] = useState([]);
  const [mediumUi, setMediumUi] = useState("BOTH");
  const [inlineEditing, setInlineEditing] = useState(false);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [printMode, setPrintMode] = useState("single");
  const [refreshingSection, setRefreshingSection] = useState(null);
  const [topicIds, setTopicIds] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const autoPrint = searchParams.get("print");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/generator/papers/${id}`);
        const paper = data.paper;
        if (!paper) throw new Error("Paper not found");
        setMeta(paper);
        setPaperSections(normalizeSections(paper.sections));
        setMediumUi(mediumFlag(paper.medium));

        if (paper.subject) {
          try {
            const syl = await fetchSubjectSyllabus(paper.subject);
            const ids = (syl.chapters || []).flatMap((c) =>
              (c.topics || []).map((t) => String(t.id || t._id || ""))
            );
            setTopicIds(ids.filter(Boolean));
          } catch {
            setTopicIds([]);
          }
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load paper");
        navigate("/academy/generator/papers");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  useEffect(() => {
    if (!autoPrint || loading || !paperSections.length) return;
    setPrintMode(
      autoPrint === "double-v" || autoPrint === "double-h"
        ? autoPrint
        : "single"
    );
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [autoPrint, loading, paperSections.length]);

  const paperMarks = useMemo(
    () => paperTotalMarks(paperSections),
    [paperSections]
  );

  const updateQuestionText = (sectionKey, questionId, patch) => {
    setPaperSections((prev) =>
      prev.map((s) => {
        if (s.key !== sectionKey) return s;
        return {
          ...s,
          questions: s.questions.map((q) =>
            q.id === questionId ? { ...q, ...patch } : q
          ),
        };
      })
    );
  };

  const removeSection = (sectionKey) => {
    const section = paperSections.find((s) => s.key === sectionKey);
    if (!section) return;
    setConfirmDialog({ kind: "cancel-section", section });
  };

  const performCancelSection = () => {
    const section = confirmDialog?.section;
    setConfirmDialog(null);
    if (!section) return;
    const qNo = sectionQNumber(section.key, paperSections);
    setPaperSections((prev) => prev.filter((s) => s.key !== section.key));
    toast.success(`Q${qNo} removed`);
  };

  const refreshSectionQuestions = async (sectionKey) => {
    const subjectId = meta?.subject ? String(meta.subject) : "";
    if (!subjectId) {
      toast.error("Subject missing — cannot refresh this section");
      return;
    }
    if (!topicIds.length) {
      toast.error("Syllabus topics missing for refresh");
      return;
    }
    const section = paperSections.find((s) => s.key === sectionKey);
    if (!section?.questions?.length) {
      toast.error("No questions in this section");
      return;
    }
    const count = section.questions.length;
    setRefreshingSection(sectionKey);
    try {
      const excludeIds = [
        ...new Set(
          paperSections.flatMap((s) =>
            (s.questions || []).map((q) => q.id).filter(Boolean)
          )
        ),
      ];
      const data = await pickPool({
        subjectId,
        topicIds: topicIds.map(String),
        type: section.type,
        count,
        mode: "RANDOM",
        source: "ALL",
        excludeIds,
      });
      const questions = (data.questions || []).map((q, i) => ({
        ...q,
        id: String(q.id || q._id || `${section.type}-${i}`),
      }));
      if (!questions.length) {
        toast.error("No replacement questions available for this section");
        return;
      }
      setPaperSections((prev) =>
        prev.map((s) => (s.key === sectionKey ? { ...s, questions } : s))
      );
      toast.success(
        `Q${sectionQNumber(sectionKey, paperSections)} updated · ${questions.length} questions`
      );
    } catch (err) {
      toast.error(err.response?.data?.message || "Refresh failed");
    } finally {
      setRefreshingSection(null);
    }
  };

  const goFullEditor = (mode = "edit", sectionKey = null) => {
    const params = new URLSearchParams({ edit: id });
    if (mode === "add") params.set("menu", "add");
    if (sectionKey) params.set("section", sectionKey);
    navigate(`/academy/generator?${params.toString()}`);
  };

  const savePaper = async () => {
    if (!paperSections.length) {
      toast.error("Paper is empty");
      return;
    }
    if (!blueprintHasMarks(paperSections)) {
      toast.error("Enter marks for each question section.");
      return;
    }
    setPending(true);
    try {
      const payload = blueprintToApiBody({
        ...meta,
        medium: mediumUi,
        sections: paperSections,
      });
      await api.put(`/generator/papers/${id}`, payload);
      toast.success("Paper updated");
      navigate("/academy/generator/papers");
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally {
      setPending(false);
    }
  };
  const printPaper = (mode) => {
    if (!paperSections.length) {
      toast.error("Add questions before printing");
      return;
    }
    if (!blueprintHasMarks(paperSections)) {
      toast.error("Enter marks for each section before printing.");
      return;
    }
    const tab = openGeneratorPrintTab(
      blueprintToPrintPayload(
        {
          ...meta,
          medium: mediumUi,
          sections: paperSections,
        },
        {
          meta: {
            orgTitle: academy?.name || meta?.boardLabel || "Examination Test",
            address: academy?.address || "",
            phone: academy?.phone || "",
            logoUrl: academy?.logo || "",
            className: meta?.classLabel || "",
            subjectName: meta?.subjectLabel || "",
            examDate: meta?.examDate || null,
            durationMinutes: meta?.durationMinutes,
            totalMarks: paperMarks,
            paperCode: id ? String(id).slice(-4).toUpperCase() : "____",
            syllabusNote: meta?.syllabusNote || "",
            paperCategory: meta?.paperCategory || "",
            examLabel: meta?.paperCategory || "TEST",
          },
        }
      ),
      mode,
      academy?._id || academy?.id
    );
    if (!tab) {
      toast.error("Allow pop-ups in this browser to open the print window.");
    }
  };
  const cancelPaper = () => {
    setConfirmDialog({ kind: "leave-paper" });
  };

  const performLeavePaper = () => {
    setConfirmDialog(null);
    navigate("/academy/generator/papers");
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      toast.error("Fullscreen not available");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const railItems = [
    {
      id: "menu",
      label: "Question's Menu",
      icon: List,
      onClick: () => goFullEditor("add"),
    },
    {
      id: "edit",
      label: "Inline Editing",
      icon: Pencil,
      active: inlineEditing,
      onClick: () => setInlineEditing((v) => !v),
    },
    {
      id: "save",
      label: "Save Paper",
      icon: Save,
      accent: "save",
      onClick: savePaper,
      disabled: !paperSections.length || pending,
    },
    {
      id: "print-s",
      label: "Print Paper Single",
      icon: Printer,
      onClick: () => printPaper("single"),
      disabled: !paperSections.length,
    },
    {
      id: "print-v",
      label: "Print Paper Double (Vertical)",
      icon: Printer,
      onClick: () => printPaper("double-v"),
      disabled: !paperSections.length,
    },
    {
      id: "print-h",
      label: "Print Paper Double (Horizontal)",
      icon: Printer,
      onClick: () => printPaper("double-h"),
      disabled: !paperSections.length,
    },
    {
      id: "cancel",
      label: "Cancel Paper",
      icon: X,
      accent: "danger",
      onClick: cancelPaper,
    },
  ];

  const renderExamSheet = (keySuffix = "a", interactive = true) => {
    let lastPart = null;
    return (
      <div key={`sheet-${keySuffix}`} className="tg-exam-sheet">
        {academy?.logo ? (
          <img
            src={academy.logo}
            alt=""
            className="tg-exam-watermark"
            aria-hidden
          />
        ) : null}

        {paperSections.map((section) => {
          const typeMeta = TYPE_META[section.type] || TYPE_META.MCQ;
          const heading = sectionInstruction(section.type, section.subType, {
            subjectName: meta?.subjectLabel || "",
            className: meta?.classLabel || "",
          });
          const part = typeMeta.part;
          const showPartHead = part !== lastPart;
          lastPart = part;
          const qNo = sectionQNumber(section.key, paperSections);
          const attempt = Number(section.attemptCount);
          const attemptNote =
            Number.isFinite(attempt) && attempt > 0
              ? ` (Attempt any ${attempt})`
              : "";

          return (
            <section
              key={`${section.key}-${keySuffix}`}
              className="tg-exam-block"
            >
              {showPartHead ? (
                <div className="tg-exam-part">
                  <span>{PART_META[part].en}</span>
                  <span className="tg-font-urdu" dir="rtl">
                    {PART_META[part].ur}
                  </span>
                </div>
              ) : null}

              <div
                className={[
                  "tg-exam-section-bar",
                  isUrduLikeSubject(meta?.subjectLabel)
                    ? "tg-exam-section-bar--urdu-only"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {isUrduLikeSubject(meta?.subjectLabel) ? null : (
                  <p className="tg-exam-section-en">
                    <strong>
                      Q{qNo}. {heading.en}
                    </strong>
                    {attemptNote}
                  </p>
                )}
                <p className="tg-exam-marks">({marksLine(section)})</p>
                <p
                  className="tg-exam-section-ur tg-exam-section-ur--bold tg-font-urdu"
                  dir="rtl"
                >
                  <strong>
                    سوال نمبر {qNo}. {heading.ur}
                  </strong>
                  {isUrduLikeSubject(meta?.subjectLabel) ? attemptNote : null}
                </p>
              </div>

              {interactive ? (
                <div className="tg-exam-section-tools no-print">
                  <button
                    type="button"
                    className="tg-exam-section-tool"
                    title="Edit this section’s questions"
                    onClick={() => goFullEditor("edit", section.key)}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="tg-exam-section-tool tg-exam-section-tool--danger"
                    title="Cancel this question type"
                    onClick={() => removeSection(section.key)}
                  >
                    <X className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="tg-exam-section-tool"
                    title="Refresh these questions"
                    disabled={pending || refreshingSection === section.key}
                    onClick={() => refreshSectionQuestions(section.key)}
                  >
                    <RefreshCw
                      className={[
                        "size-4",
                        refreshingSection === section.key
                          ? "animate-spin"
                          : "",
                      ].join(" ")}
                    />
                  </button>
                </div>
              ) : null}

              <div className="tg-exam-questions">
                {section.questions.map((q, i) => (
                  <PaperQuestionBlock
                    key={`${q.id}-${keySuffix}`}
                    index={i + 1}
                    question={q}
                    type={section.type}
                    subType={section.subType}
                    medium={mediumUi}
                    showAnswerKey={showAnswerKey}
                    inlineEdit={inlineEditing && interactive}
                    onUpdateText={(patch) =>
                      updateQuestionText(section.key, q.id, patch)
                    }
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <GeneratorLayout mode="paper">
        <div className="tg-paper-workspace p-4">
          <StatusPanel loading loadingLabel="Loading paper…" />
        </div>
      </GeneratorLayout>
    );
  }

  return (
    <GeneratorLayout mode="paper">
      <div className="tg-paper-workspace">
        <aside className="tg-paper-rail no-print">
          <div className="tg-paper-rail-profile">
            {academy?.logo ? (
              <img src={academy.logo} alt="" className="tg-paper-rail-logo" />
            ) : (
              <span className="tg-paper-rail-logo tg-paper-rail-logo--fallback">
                TG
              </span>
            )}
            <div className="min-w-0">
              <p className="tg-paper-rail-name">
                {user?.name || "Administrator"}
              </p>
              <p className="tg-paper-rail-role">Administrator</p>
            </div>
          </div>

          <nav className="tg-paper-rail-nav" aria-label="Paper actions">
            {railItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={[
                    "tg-paper-rail-item",
                    item.active ? "tg-paper-rail-item--on" : "",
                    item.accent === "save" ? "tg-paper-rail-item--save" : "",
                    item.accent === "danger" ? "tg-paper-rail-item--danger" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="tg-paper-rail-foot">
            <button
              type="button"
              onClick={handleLogout}
              className="tg-paper-rail-iconbtn tg-paper-rail-iconbtn--danger"
              title="Logout"
            >
              <LogOut className="size-4" />
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="tg-paper-rail-iconbtn"
              title="Fullscreen"
            >
              <Maximize2 className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowAnswerKey((v) => !v)}
              className={[
                "tg-paper-rail-key",
                showAnswerKey ? "tg-paper-rail-key--on" : "",
              ].join(" ")}
            >
              {showAnswerKey ? "Hide Key" : "Answer Key"}
            </button>
          </div>
        </aside>

        <div className="tg-paper-stage">
          {!paperSections.length ? (
            <div className="tg-paper-empty no-print">
              <p className="font-display text-lg font-bold text-tg-ink">
                No sections left
              </p>
              <p className="mt-1 text-sm text-tg-deep/75">
                Cancel and return to Saved Papers, or refresh from list.
              </p>
            </div>
          ) : (
            <div
              className={[
                "tg-exam-print-root",
                printMode === "double-v" ? "tg-exam-print-root--dv" : "",
                printMode === "double-h" ? "tg-exam-print-root--dh" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {renderExamSheet("a", true)}
              {printMode !== "single" ? renderExamSheet("b", false) : null}
            </div>
          )}
        </div>
      </div>

      <TgConfirmModal
        open={confirmDialog?.kind === "leave-paper"}
        title="Leave this page?"
        message="Leave without saving changes?"
        confirmLabel="Leave"
        cancelLabel="Stay"
        danger
        onCancel={() => setConfirmDialog(null)}
        onConfirm={performLeavePaper}
      />
      <TgConfirmModal
        open={confirmDialog?.kind === "cancel-section"}
        title="Remove section?"
        message={
          confirmDialog?.kind === "cancel-section" && confirmDialog.section
            ? `Cancel Q${sectionQNumber(confirmDialog.section.key, paperSections)} (${TYPE_META[confirmDialog.section.type]?.part || confirmDialog.section.type}) from this paper?`
            : ""
        }
        confirmLabel="Remove"
        cancelLabel="Keep"
        danger
        onCancel={() => setConfirmDialog(null)}
        onConfirm={performCancelSection}
      />
    </GeneratorLayout>
  );
}

export default GeneratorPaperView;
