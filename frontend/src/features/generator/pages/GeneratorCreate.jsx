import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  Library,
  List,
  Menu,
  Pencil,
  Save,
  Printer,
  X,
  LogOut,
  Maximize2,
  RefreshCw,
} from "lucide-react";
import GeneratorLayout from "../components/GeneratorLayout.jsx";
import TgConfirmModal from "../components/TgConfirmModal.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { toast } from "../../../components/ui/toast.jsx";
import api from "../../../services/api.js";
import { openGeneratorPrintTab } from "../print/index.js";
import {
  SOURCE_OPTIONS,
  buildPickerOptions,
  fetchSubjectSyllabus,
  isClassicThreeTypeSubject,
  parsePickerValue,
  pickPool,
  searchPool,
  sourceKind,
  sourceLabel,
  sourceLabelShort,
  subtypeLabel,
  sumQuestionTypesForTopics,
} from "../bank/index.js";
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
  sectionScoredCount,
  sortPaperSections,
} from "../utils/paperBlueprint.js";
import { aggregateQuestionsMedium } from "../utils/questionMedium.js";
import StatusPanel from "../components/StatusPanel.jsx";
import {
  WIZARD_STEPS,
  PART_META,
  MEDIUM_OPTIONS,
  sectionQNumber,
  makeSectionKey,
  subjectIconFor,
  topicTitleWithoutCode,
  QuestionText,
  McqOptionsRow,
  PaperQuestionBlock,
  useGeneratorCatalog,
  ChapterQuotaModal,
  ALL_TYPES,
  initChapterPlan,
  buildChapterPlanRows,
  plannerTotalsFromRows,
  plannedCountForType,
  plannedQuotaForChapter,
  chapterQuotasForType,
  updateChapterPlanCount,
  clearChapterPlanCounts,
  autofillChapterPlan,
  validateChapterPlan,
  buildTopicUsage,
  buildTopicUsageForType,
} from "../create/index.js";

function GeneratorCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editPaperId = searchParams.get("edit");
  const openMenuOnLoad = searchParams.get("menu") === "add";
  const editSectionKeyOnLoad = searchParams.get("section");
  const { user, logout } = useAuth();
  const pendingEditSectionRef = useRef(null);
  /** Skip leave confirm when Back/Cancel already confirmed and consumes history guard */
  const paperLeaveViaUiRef = useRef(false);
  const pickerMenuRef = useRef(null);
  const academy = user?.academy;

  const showQuestionMenu = () => {
    requestAnimationFrame(() => {
      pickerMenuRef.current?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    });
  };

  const { boards, loading, catalogError, reloadCatalog } =
    useGeneratorCatalog();

  const [step, setStep] = useState("board");
  const [pending, setPending] = useState(false);
  const [editingPaperId, setEditingPaperId] = useState(null);

  const [board, setBoard] = useState(null);
  const [klass, setKlass] = useState(null);
  const [subject, setSubject] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [questionTypes, setQuestionTypes] = useState([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  /** Question Menu (filters) — collapses after Search so bank gets space */
  const [pickerMenuOpen, setPickerMenuOpen] = useState(true);
  /** Mobile paper actions — board-style hamburger drawer */
  const [paperRailOpen, setPaperRailOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  /** Custom confirm: { kind: 'leave-paper' } | { kind: 'cancel-section', section } */
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [inlineEditing, setInlineEditing] = useState(false);
  const [printMode, setPrintMode] = useState("single");
  const [refreshingId, setRefreshingId] = useState(null);
  const [refreshingSection, setRefreshingSection] = useState(null);

  const [activeType, setActiveType] = useState("MCQ");
  const [activeSubType, setActiveSubType] = useState(null);
  const [requiredCount, setRequiredCount] = useState("");
  const [attemptCount, setAttemptCount] = useState("");
  const [marksPerQuestion, setMarksPerQuestion] = useState("");
  const [medium, setMedium] = useState("BOTH");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [pool, setPool] = useState([]);
  const [draftSelected, setDraftSelected] = useState([]);
  const [paperSections, setPaperSections] = useState([]);
  const [editingSectionKey, setEditingSectionKey] = useState(null);
  const [pickerMessage, setPickerMessage] = useState(null);
  /** Total matching bank size from last search (PTS-style count). */
  const [poolTotal, setPoolTotal] = useState(0);

  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [examDate, setExamDate] = useState("");
  const [instructions, setInstructions] = useState("");
  const [syllabusNote, setSyllabusNote] = useState("");
  const [paperCategory, setPaperCategory] = useState("");

  /** Multi-chapter MCQ/Short/Long quotas (classic 3-type subjects only). */
  const [chapterPlan, setChapterPlan] = useState([]);
  const [plannerOpen, setPlannerOpen] = useState(false);

  /* Update Paper → open full paper workspace with picker / refresh / replace */
  useEffect(() => {
    if (!editPaperId || !boards.length) return;
    let cancelled = false;

    (async () => {
      setPending(true);
      try {
        const { data } = await api.get(`/generator/papers/${editPaperId}`);
        const paper = data.paper;
        if (!paper || cancelled) return;

        const subjectId = paper.subject ? String(paper.subject) : "";
        let foundBoard = null;
        let foundClass = null;
        let foundSubject = null;

        for (const b of boards) {
          for (const c of b.classes || []) {
            for (const s of c.subjects || []) {
              if (subjectId && s.id === subjectId) {
                foundBoard = b;
                foundClass = c;
                foundSubject = s;
                break;
              }
            }
            if (foundSubject) break;
          }
          if (foundSubject) break;
        }

        if (!foundSubject) {
          for (const b of boards) {
            for (const c of b.classes || []) {
              if (c.name !== paper.classLabel) continue;
              const s = (c.subjects || []).find(
                (sub) => sub.name === paper.subjectLabel
              );
              if (s) {
                foundBoard = b;
                foundClass = c;
                foundSubject = s;
                break;
              }
            }
            if (foundSubject) break;
          }
        }

        if (!foundSubject) {
          toast.error("Could not match this paper’s subject in the catalog");
          navigate("/academy/generator/papers");
          return;
        }

        const syl = await fetchSubjectSyllabus(foundSubject.id);
        if (cancelled) return;

        const chs = syl.chapters || [];
        const allChapterIds = chs.map((c) => c.id);
        const allTopicIds = chs.flatMap((c) =>
          (c.topics || []).map((t) => t.id).filter(Boolean)
        );

        setBoard(foundBoard);
        setKlass(foundClass);
        setSubject(foundSubject);
        setChapters(chs);
        setQuestionTypes(syl.questionTypes || []);
        setSelectedChapterIds(allChapterIds);
        setSelectedTopicIds(allTopicIds);
        const blueprint = blueprintFromApiPaper(paper);
        setPaperSections(blueprint.sections);
        setTitle(blueprint.meta.title || "");
        setPaperCategory(blueprint.meta.paperCategory || "");
        setExamDate(blueprint.meta.examDate || "");
        setDurationMinutes(Number(blueprint.meta.durationMinutes) || 60);
        setInstructions(blueprint.meta.instructions || "");
        setSyllabusNote(blueprint.meta.syllabusNote || "");
        setMedium(mediumFromApi(blueprint.meta.medium));
        setEditingPaperId(String(paper._id));
        setInlineEditing(false);
        setEditingSectionKey(null);
        setDraftSelected([]);
        setPool([]);
        setPoolTotal(0);
        setModalOpen(Boolean(openMenuOnLoad) && !editSectionKeyOnLoad);
        setStep("paper");
        if (editSectionKeyOnLoad) {
          pendingEditSectionRef.current = editSectionKeyOnLoad;
        }
        toast.success(
          openMenuOnLoad
            ? "Add a new question section from the menu"
            : "Paper loaded — Question Menu adds; section pencil edits"
        );
      } catch (err) {
        if (!cancelled) {
          toast.error(err.response?.data?.message || "Failed to load paper");
          navigate("/academy/generator/papers");
        }
      } finally {
        if (!cancelled) setPending(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editPaperId, boards, navigate, openMenuOnLoad, editSectionKeyOnLoad]);

  /* Browser Back + refresh/tab-close while building a paper */
  useEffect(() => {
    if (step !== "paper") return undefined;

    if (!window.history.state?.tgPaperGuard) {
      window.history.pushState({ tgPaperGuard: true }, "");
    }

    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const onPopState = () => {
      if (paperLeaveViaUiRef.current) {
        paperLeaveViaUiRef.current = false;
        setModalOpen(false);
        setSaveModalOpen(false);
        setPaperSections([]);
        setChapterPlan([]);
        setPlannerOpen(false);
        resetPicker();
        setStep("chapters");
        return;
      }
      /* Stay on paper; ask with custom modal (not native confirm) */
      window.history.pushState({ tgPaperGuard: true }, "");
      setConfirmDialog({ kind: "leave-paper" });
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
    };
  }, [step]);

  const selectedChapters = useMemo(
    () => chapters.filter((c) => selectedChapterIds.includes(c.id)),
    [chapters, selectedChapterIds]
  );

  const derivedSyllabus = useMemo(
    () => selectedChapters.map((c) => c.name).join("; "),
    [selectedChapters]
  );

  const usedQuestionIds = useMemo(
    () => paperSections.flatMap((s) => s.questions.map((q) => q.id)),
    [paperSections]
  );

  /** Topic usage for the active type only (MCQ ≠ Short ≠ Long). */
  const paperTopicUsage = useMemo(
    () => buildTopicUsageForType(paperSections, activeType),
    [paperSections, activeType]
  );

  const paperQuestionCount = useMemo(
    () => paperSections.reduce((sum, s) => sum + (s.questions?.length || 0), 0),
    [paperSections]
  );

  const paperMarks = useMemo(
    () => paperTotalMarks(paperSections),
    [paperSections]
  );

  const isClassicSubject = useMemo(
    () => isClassicThreeTypeSubject(subject?.name, questionTypes),
    [subject?.name, questionTypes]
  );

  const useChapterPlanner =
    isClassicSubject && selectedChapterIds.length >= 2;

  const chapterPlanRows = useMemo(
    () =>
      buildChapterPlanRows(chapterPlan, selectedChapters, selectedTopicIds),
    [chapterPlan, selectedChapters, selectedTopicIds]
  );

  const plannerTotals = useMemo(
    () => plannerTotalsFromRows(chapterPlanRows),
    [chapterPlanRows]
  );

  const plannerQuestionTotal =
    plannerTotals.MCQ + plannerTotals.SHORT + plannerTotals.LONG;

  const hasChapterPlan =
    useChapterPlanner &&
    chapterPlan.length > 0 &&
    plannerQuestionTotal > 0;

  /**
   * Question-type dropdown: type catalog filtered to selected topics only
   * (e.g. Summary Matric only on poem chapters — matches board Generate Paper).
   */
  const selectionQuestionTypes = useMemo(
    () =>
      sumQuestionTypesForTopics(chapters, selectedTopicIds, questionTypes),
    [chapters, selectedTopicIds, questionTypes]
  );

  const pickerOptions = useMemo(
    () =>
      buildPickerOptions({
        subjectName: subject?.name,
        className: klass?.name,
        questionTypes: selectedTopicIds.length
          ? selectionQuestionTypes
          : questionTypes,
      }),
    [
      subject?.name,
      klass?.name,
      selectedTopicIds.length,
      selectionQuestionTypes,
      questionTypes,
    ]
  );

  const pickerValue = `${activeType}:${activeSubType || ""}`;

  // Snap to a valid option when subject / catalog changes (not on chapter toggles).
  useEffect(() => {
    if (!pickerOptions.length) return;
    const stillValid = pickerOptions.some((o) => o.value === pickerValue);
    if (stillValid) return;
    const first = pickerOptions[0];
    setActiveType(first.type);
    setActiveSubType(first.subType);
    setPool([]);
    setPoolTotal(0);
    setDraftSelected([]);
    setPickerMessage(null);
  }, [pickerOptions, pickerValue]);

  const groupQuestionsByTopic = useMemo(() => {
    const topicMeta = new Map();
    for (const ch of chapters) {
      for (const t of ch.topics || []) {
        const name = t.name || "Topic";
        const code =
          t.code ||
          (String(name).match(/^(\d+(?:\.\d+)*)/) || [])[1] ||
          "";
        topicMeta.set(t.id, {
          name,
          code,
          order: t.order ?? topicMeta.size,
        });
      }
    }

    const codeSortKey = (code) =>
      String(code || "")
        .split(".")
        .map((n) => Number.parseInt(n, 10) || 0);

    return (questions) => {
    const groups = new Map();
      for (const q of questions) {
      const key = q.topicId || "unknown";
      if (!groups.has(key)) {
          const meta = topicMeta.get(key) || {
            name: "Topic",
            code: "",
            order: 9999,
          };
        groups.set(key, {
          topicId: key,
            topicName: meta.name,
            topicCode: meta.code,
            order: meta.order,
          questions: [],
        });
      }
      groups.get(key).questions.push(q);
    }

      return [...groups.values()].sort((a, b) => {
        const ak = codeSortKey(a.topicCode);
        const bk = codeSortKey(b.topicCode);
        const len = Math.max(ak.length, bk.length);
        for (let i = 0; i < len; i += 1) {
          const d = (ak[i] || 0) - (bk[i] || 0);
          if (d !== 0) return d;
        }
        if (a.order !== b.order) return a.order - b.order;
        return String(a.topicName).localeCompare(String(b.topicName));
      });
    };
  }, [chapters]);

  const selectedIdSet = useMemo(
    () => new Set(draftSelected.map((q) => q.id)),
    [draftSelected]
  );

  const bankByTopic = useMemo(
    () => groupQuestionsByTopic(pool),
    [groupQuestionsByTopic, pool]
  );

  const topicCodeById = useMemo(() => {
    const map = new Map();
    for (const ch of chapters) {
      for (const t of ch.topics || []) {
        const name = t.name || "Topic";
        const code =
          t.code ||
          (String(name).match(/^(\d+(?:\.\d+)*)/) || [])[1] ||
          "";
        map.set(t.id, code);
      }
    }
    return map;
  }, [chapters]);

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === step);

  const loadSyllabus = async (subjectId) => {
    const data = await fetchSubjectSyllabus(subjectId);
    setChapters(data.chapters || []);
    setQuestionTypes(data.questionTypes || []);
    setSelectedChapterIds([]);
    setSelectedTopicIds([]);
  };

  const resetPicker = () => {
    setRequiredCount("");
    setAttemptCount("");
    setMarksPerQuestion("");
    setMedium("BOTH");
    setSourceFilter("ALL");
    setPool([]);
    setPoolTotal(0);
    setDraftSelected([]);
    setPickerMessage(null);
    setEditingSectionKey(null);
  };

  const resetBuildState = () => {
    resetPicker();
    setActiveType("MCQ");
    setActiveSubType(null);
    setPaperSections([]);
    setModalOpen(false);
    setSaveModalOpen(false);
    setShowAnswerKey(false);
    setChapterPlan([]);
    setPlannerOpen(false);
  };

  const selectBoard = (b) => {
    setBoard(b);
    setKlass(null);
    setSubject(null);
    setChapters([]);
    setQuestionTypes([]);
    setSelectedChapterIds([]);
    setSelectedTopicIds([]);
    resetBuildState();
    setStep("class");
  };

  const selectClass = (c) => {
    setKlass(c);
    setSubject(null);
    setChapters([]);
    setQuestionTypes([]);
    setSelectedChapterIds([]);
    setSelectedTopicIds([]);
    resetBuildState();
    setStep("subject");
  };

  const selectSubject = async (s) => {
    setPending(true);
    try {
      setSubject(s);
      await loadSyllabus(s.id);
      resetBuildState();
      setStep("chapters");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load syllabus");
    } finally {
      setPending(false);
    }
  };

  const toggleChapter = (chapter) => {
    const on = selectedChapterIds.includes(chapter.id);
    if (on) {
      setSelectedChapterIds((ids) => ids.filter((id) => id !== chapter.id));
      const topicIds = new Set((chapter.topics || []).map((t) => t.id));
      setSelectedTopicIds((ids) => ids.filter((id) => !topicIds.has(id)));
    } else {
      setSelectedChapterIds((ids) => [...ids, chapter.id]);
      setSelectedTopicIds((ids) => [
        ...new Set([...ids, ...(chapter.topics || []).map((t) => t.id)]),
      ]);
    }
  };

  const toggleTopic = (topicId, chapterId) => {
    const on = selectedTopicIds.includes(topicId);
    if (on) {
      const nextTopics = selectedTopicIds.filter((id) => id !== topicId);
      setSelectedTopicIds(nextTopics);
      const chapter = chapters.find((c) => c.id === chapterId);
      const stillHas = (chapter?.topics || []).some((t) =>
        nextTopics.includes(t.id)
      );
      if (!stillHas) {
        setSelectedChapterIds((ids) => ids.filter((id) => id !== chapterId));
      }
    } else {
      setSelectedTopicIds((ids) => [...ids, topicId]);
      setSelectedChapterIds((ids) =>
        ids.includes(chapterId) ? ids : [...ids, chapterId]
      );
    }
  };

  const selectAllChapters = () => {
    setSelectedChapterIds(chapters.map((c) => c.id));
    setSelectedTopicIds(
      chapters.flatMap((c) => (c.topics || []).map((t) => t.id))
    );
  };

  const clearChapters = () => {
    setSelectedChapterIds([]);
    setSelectedTopicIds([]);
    setChapterPlan([]);
    setPlannerOpen(false);
  };

  const beginPaperWorkspace = (opts = {}) => {
    const { withPlan = false } = opts;
    resetPicker();
    setPaperSections([]);
    setTitle("");
    setDurationMinutes(60);
    setExamDate("");
    setInstructions("");
    setSyllabusNote(derivedSyllabus);
    setPaperCategory("");
    setShowAnswerKey(false);

    if (withPlan) {
      const firstType =
        ALL_TYPES.find((t) => plannedCountForType(chapterPlan, t) > 0) || "MCQ";
      const firstOpt =
        pickerOptions.find((o) => o.type === firstType) || pickerOptions[0];
      const type = firstOpt?.type || firstType;
      setActiveType(type);
      setActiveSubType(firstOpt?.subType || null);
      const planned = plannedCountForType(chapterPlan, type);
      setRequiredCount(planned > 0 ? planned : "");
      setMarksPerQuestion("");
      void syncMediumForType(type, firstOpt?.subType || null);
    } else {
      const first = pickerOptions[0];
      setActiveType(first?.type || "MCQ");
      setActiveSubType(first?.subType || null);
      setMarksPerQuestion("");
      void syncMediumForType(first?.type || "MCQ", first?.subType || null);
    }

    setModalOpen(true);
    setStep("paper");
  };

  /** Compare flow: skip Build → paper + picker modal (or chapter planner first). */
  const openSelectQuestions = () => {
    if (!selectedTopicIds.length) {
      toast.error("Select at least one chapter or topic");
      return;
    }
    if (useChapterPlanner) {
      setChapterPlan(initChapterPlan(selectedChapters));
      setPlannerOpen(true);
      return;
    }
    setChapterPlan([]);
    beginPaperWorkspace({ withPlan: false });
  };

  const continueFromPlanner = () => {
    const err = validateChapterPlan(chapterPlanRows, plannerQuestionTotal);
    if (err) {
      toast.error(err);
      return;
    }
    setPlannerOpen(false);
    beginPaperWorkspace({ withPlan: true });
    toast.success(
      `Planner ready · ${plannerTotals.MCQ} MCQ · ${plannerTotals.SHORT} Short · ${plannerTotals.LONG} Long`
    );
  };

  const clearPaperWorkspace = () => {
    setConfirmDialog(null);
    setModalOpen(false);
    setSaveModalOpen(false);
    setPaperSections([]);
    setChapterPlan([]);
    setPlannerOpen(false);
    resetPicker();
    setStep("chapters");
  };

  /** Leave paper step (UI Back / Cancel Paper) — opens custom confirm */
  const leavePaperWorkspace = () => {
    if (step !== "paper") return;
    setConfirmDialog({ kind: "leave-paper" });
  };

  const performLeavePaper = () => {
    setConfirmDialog(null);
    if (window.history.state?.tgPaperGuard) {
      paperLeaveViaUiRef.current = true;
      window.history.back();
      return;
    }
    clearPaperWorkspace();
  };

  const goBack = () => {
    if (step === "class") {
      setBoard(null);
      setStep("board");
    } else if (step === "subject") {
      setKlass(null);
      setStep("class");
    } else if (step === "chapters") {
      setSubject(null);
      setChapters([]);
      setQuestionTypes([]);
      setSelectedChapterIds([]);
      setSelectedTopicIds([]);
      setStep("subject");
    } else if (step === "paper") {
      leavePaperWorkspace();
    }
  };

  const clearBelow = (level) => {
    if (level <= 0) setBoard(null);
    if (level <= 1) setKlass(null);
    if (level <= 2) {
      setSubject(null);
      setChapters([]);
      setQuestionTypes([]);
      setSelectedChapterIds([]);
      setSelectedTopicIds([]);
    }
    resetBuildState();
  };

  const jumpTo = (target) => {
    if (target === "board") {
      clearBelow(0);
      setStep("board");
      return;
    }
    if (target === "class" && board) {
      clearBelow(1);
      setStep("class");
      return;
    }
    if (target === "subject" && klass) {
      clearBelow(2);
      setStep("subject");
      return;
    }
    if (target === "chapters" && subject) {
      setModalOpen(false);
      setSaveModalOpen(false);
      setPaperSections([]);
      setChapterPlan([]);
      setPlannerOpen(false);
      resetPicker();
      setStep("chapters");
    }
  };

  const selectedChapterNums = chapters
    .map((c, i) =>
      selectedChapterIds.includes(c.id) ? String(c.order || i + 1) : null
    )
    .filter(Boolean)
    .join(", ");

  const selectionPath = [
    board && {
      id: "board",
      label: "Board",
      value: String(board.name || "").replace(/ Board$/i, "") || board.name,
    },
    klass && { id: "class", label: "Class", value: klass.name },
    subject && { id: "subject", label: "Subject", value: subject.name },
    subject &&
      (step === "chapters" || step === "paper") && {
        id: "chapters",
        label: "Ch",
        value: selectedChapterNums || "—",
      },
  ].filter(Boolean);

  const syncMediumForType = async (type, field) => {
    if (!subject?.id || !type) return;
    const topicIds =
      selectedTopicIds.length > 0
        ? selectedTopicIds
        : chapters.flatMap((c) => (c.topics || []).map((t) => t.id));
    if (!topicIds.length) return;
    try {
      const data = await searchPool({
        subjectId: subject.id,
        topicIds,
        chapterIds: selectedChapterIds,
        type,
        field,
        source: "ALL",
        limit: 400,
      });
      const next = aggregateQuestionsMedium(data?.questions || []);
      setMedium(next);
    } catch {
      /* keep current medium */
    }
  };

  const activatePickerOption = (value) => {
    const parsed = parsePickerValue(value);
    if (!parsed) return;
    setActiveType(parsed.type);
    setActiveSubType(parsed.subType);
    setAttemptCount("");
    setMarksPerQuestion("");
    setPool([]);
    setPoolTotal(0);
    setDraftSelected([]);
    setPickerMessage(null);
    if (hasChapterPlan) {
      const planned = plannedCountForType(chapterPlan, parsed.type);
      setRequiredCount(planned > 0 ? planned : "");
    }
    void syncMediumForType(parsed.type, parsed.subType);
  };

  const parsedRequired = () => {
    const n = Number(requiredCount);
    return Number.isFinite(n) ? n : 0;
  };

  const parsedMarks = () => {
    const n = Number(marksPerQuestion);
    return Number.isFinite(n) ? n : 0;
  };

  const parsedAttempt = () => {
    const n = Number(attemptCount);
    return Number.isFinite(n) ? n : 0;
  };

  const runSearch = async () => {
    if (!subject) return;
    if (!selectedTopicIds.length) {
      toast.error("Select syllabus topics first");
      return;
    }
    if (!hasChapterPlan && parsedRequired() < 1) {
      toast.error("Enter how many questions are required.");
      return;
    }
    if (parsedMarks() < 1) {
      toast.error("Enter marks for each question first.");
      return;
    }
    setPickerMenuOpen(false);
    setPending(true);
    setPickerMessage(null);
    try {
      const keepSelected = editingSectionKey
        ? draftSelected
        : [];
      const keepIds = new Set(keepSelected.map((q) => q.id));
      const excludeIds = usedQuestionIds.filter((id) => !keepIds.has(id));
      const data = await searchPool({
        subjectId: subject.id,
        topicIds: selectedTopicIds,
        type: activeType,
        field: activeSubType,
        source: sourceFilter,
        excludeIds,
        limit: 3000,
      });
      const found = data.questions || [];
      const total = Number(data.total) || found.length;
      setPoolTotal(total);
      const truncNote =
        data.truncated || total > found.length
          ? ` (showing ${found.length} of ${total})`
          : "";
      if (editingSectionKey && keepSelected.length) {
        const byId = new Map();
        for (const q of keepSelected) byId.set(q.id, q);
        for (const q of found) {
          if (!byId.has(q.id)) byId.set(q.id, q);
        }
        setPool([...byId.values()]);
        setDraftSelected(keepSelected);
        setPickerMessage(
          `Found ${total} questions${truncNote} · ${keepSelected.length} selected`
        );
      } else {
        setPool(found);
        setDraftSelected([]);
        setPickerMessage(
          total
            ? `Found ${total} questions${truncNote}`
            : "No questions match this filter"
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Search failed");
    } finally {
      setPending(false);
    }
  };

  const runSelectRandom = async () => {
    if (!subject) return;
    const quotas = hasChapterPlan
      ? chapterQuotasForType(chapterPlan, activeType)
      : [];
    const plannedNeed = hasChapterPlan
      ? plannedCountForType(chapterPlan, activeType)
      : 0;
    if (hasChapterPlan) {
      if (plannedNeed < 1) {
        toast.error(
          `No chapter quota is set for ${TYPE_META[activeType].short} in the planner.`
        );
        return;
      }
      if (parsedRequired() !== plannedNeed) {
        setRequiredCount(plannedNeed);
      }
    }
    const need = hasChapterPlan ? plannedNeed : parsedRequired();
    if (need < 1) {
      toast.error("Enter the required number of questions first.");
      return;
    }
    if (parsedMarks() < 1) {
      toast.error("Enter marks for each question first.");
      return;
    }
    if (!selectedTopicIds.length) {
      toast.error("Select syllabus topics first");
      return;
    }
    setPending(true);
    setPickerMessage(null);
    try {
      const data = await pickPool({
        subjectId: subject.id,
        topicIds: selectedTopicIds,
        type: activeType,
        field: activeSubType,
        count: need,
        mode: "BALANCED",
        source: sourceFilter,
        excludeIds: usedQuestionIds,
        topicUsage: paperTopicUsage,
        chapterQuotas: quotas.length ? quotas : undefined,
      });
      const questions = data.questions || [];
      setDraftSelected(questions);

      if (questions.length === 0) {
        setPool([]);
        setPoolTotal(0);
        setPickerMessage("Not enough questions for random pick");
        return;
      }

      /* Keep random picks selected, but load full bank so user can swap manually. */
      const pickedIds = new Set(questions.map((q) => q.id));
      const excludeIds = usedQuestionIds.filter((id) => !pickedIds.has(id));
      let bank = [];
      let bankTotal = 0;
      let truncNote = "";
      try {
        const bankData = await searchPool({
          subjectId: subject.id,
          topicIds: selectedTopicIds,
          type: activeType,
          field: activeSubType,
          source: sourceFilter,
          excludeIds,
          limit: 3000,
        });
        bank = bankData.questions || [];
        bankTotal = Number(bankData.total) || bank.length;
        if (bankData.truncated || bankTotal > bank.length) {
          truncNote = ` (showing ${bank.length} of ${bankTotal})`;
        }
      } catch {
        /* Bank load failed — still show the random picks. */
        bank = [];
        bankTotal = questions.length;
      }

      const byId = new Map();
      for (const q of questions) byId.set(q.id, q);
      for (const q of bank) {
        if (!byId.has(q.id)) byId.set(q.id, q);
      }
      setPool([...byId.values()]);
      setPoolTotal(bankTotal || byId.size);
      setPickerMessage(
        hasChapterPlan
          ? `Random · planner quotas · ${questions.length} selected · bank open${truncNote}`
          : `Random selected · ${questions.length} selected · bank open${truncNote}`
      );
    } catch (err) {
      toast.error(err.response?.data?.message || "Random select failed");
    } finally {
      setPending(false);
    }
  };

  const toggleDraftQuestion = (question) => {
    const need = parsedRequired();
    if (need < 1) {
      toast.error("Enter the required number of questions first.");
      return;
    }
    const already = draftSelected.some((q) => q.id === question.id);
    if (already) {
      setDraftSelected((prev) => prev.filter((q) => q.id !== question.id));
      return;
    }
    if (draftSelected.length >= need) {
      toast.error(
        `You already selected ${need} ${TYPE_META[activeType].short} — uncheck one first to swap.`
      );
      return;
    }
    if (hasChapterPlan) {
      const quota =
        plannedQuotaForChapter(chapterPlan, question.chapterId, activeType) ??
        0;
      if (quota < 1) {
        const chapterName =
          chapters.find((c) => c.id === question.chapterId)?.name || "Chapter";
        toast.error(
          `${chapterName}: no ${TYPE_META[activeType].short} quota in the planner.`
        );
        return;
      }
      const fromChapter = draftSelected.filter(
        (q) => q.chapterId === question.chapterId
      ).length;
      if (fromChapter >= quota) {
        const chapterName =
          chapters.find((c) => c.id === question.chapterId)?.name || "Chapter";
        toast.error(
          `${chapterName}: you can select up to ${quota} ${TYPE_META[activeType].short} (planner limit).`
        );
        return;
      }
    }
    setDraftSelected((prev) => [...prev, question]);
  };

  /** Replace one question in the random/search draft — only that slot changes */
  const replaceDraftQuestion = async (questionId) => {
    if (!subject) return;
    if (!selectedTopicIds.length) {
      toast.error("Select syllabus topics first");
      return;
    }
    const current = draftSelected.find((q) => q.id === questionId);
    setRefreshingId(questionId);
    try {
      // Only exclude what's already chosen / on the paper — not the whole bank
      // (bank now includes selected rows, so excluding poolIds left zero candidates).
      const excludeIds = [
        ...new Set([...usedQuestionIds, ...draftSelected.map((q) => q.id)]),
      ];
      const draftOthers = draftSelected.filter((q) => q.id !== questionId);
      const topicUsage = buildTopicUsageForType(
        paperSections,
        activeType,
        draftOthers
      );
      const quotas =
        hasChapterPlan && current?.chapterId
          ? [{ chapterId: current.chapterId, count: 1 }]
          : undefined;
      const data = await pickPool({
        subjectId: subject.id,
        topicIds: selectedTopicIds,
        type: activeType,
        field: activeSubType,
        count: 1,
        mode: "BALANCED",
        source: sourceFilter,
        excludeIds,
        topicUsage,
        chapterQuotas: quotas,
      });
      const next = data.questions?.[0];
      if (!next) {
        toast.error("No replacement question available");
        return;
      }
      setDraftSelected((prev) =>
        prev.map((q) => (q.id === questionId ? next : q))
      );
      setPool((prev) => {
        const withoutOld = prev.filter((q) => q.id !== questionId);
        if (withoutOld.some((q) => q.id === next.id)) return withoutOld;
        const oldIndex = prev.findIndex((q) => q.id === questionId);
        if (oldIndex < 0) return [...withoutOld, next];
        const merged = [...withoutOld];
        merged.splice(Math.min(oldIndex, merged.length), 0, next);
        return merged;
      });
      toast.success("Question replaced");
    } catch (err) {
      toast.error(err.response?.data?.message || "Replace failed");
    } finally {
      setRefreshingId(null);
    }
  };

  const addSectionToPaper = () => {
    const need = parsedRequired();
    const marks = parsedMarks();
    const attempt = parsedAttempt();
    if (need < 1) {
      setPickerMenuOpen(true);
      showQuestionMenu();
      toast.error("Enter the required number of questions.");
      return;
    }
    if (!(marksPerQuestion !== "" && marks >= 1)) {
      setPickerMenuOpen(true);
      showQuestionMenu();
      toast.error("Marks each is required (enter at least 1).");
      return;
    }
    const typeLabel = TYPE_META[activeType].short;
    if (draftSelected.length === 0) {
      toast.error(`Pick ${need} ${typeLabel} before adding this section.`);
      return;
    }
    if (draftSelected.length < need) {
      toast.error(
        `${need} ${typeLabel} required, but only ${draftSelected.length} selected.`
      );
      return;
    }
    if (draftSelected.length > need) {
      toast.error(
        `${need} ${typeLabel} required, but ${draftSelected.length} selected.`
      );
      return;
    }

    if (hasChapterPlan) {
      for (const quota of chapterQuotasForType(chapterPlan, activeType)) {
        const picked = draftSelected.filter(
          (q) => q.chapterId === quota.chapterId
        ).length;
        if (picked !== quota.count) {
          const chapterName =
            chapters.find((c) => c.id === quota.chapterId)?.name || "Chapter";
          toast.error(
            `${chapterName}: ${quota.count} ${typeLabel} required; ${picked} currently selected.`
          );
          return;
        }
      }
    }

    const sectionPayload = {
      key: editingSectionKey || makeSectionKey(),
          type: activeType,
      subType: activeSubType || null,
      order: editingSectionKey
        ? paperSections.find((s) => s.key === editingSectionKey)?.order ??
          Date.now()
        : Date.now(),
          attemptCount:
            attempt > 0 && attempt < draftSelected.length ? attempt : 0,
          marksEach: marks,
          questions: draftSelected,
    };

    setPaperSections((prev) => {
      if (editingSectionKey) {
        return sortPaperSections(
          prev.map((s) =>
            s.key === editingSectionKey ? { ...sectionPayload, key: s.key } : s
          )
        );
      }
      return sortPaperSections([...prev, sectionPayload]);
    });

    const wasEditing = Boolean(editingSectionKey);
    const nextSections = sortPaperSections(
      wasEditing
        ? paperSections.map((s) =>
            s.key === editingSectionKey ? sectionPayload : s
          )
        : [...paperSections, sectionPayload]
    );
    const coveredKeys = new Set(
      nextSections.map((s) => `${s.type}:${s.subType || ""}`)
    );
    const nextOpt =
      pickerOptions.find((o) => !coveredKeys.has(o.value)) || null;
    const qNo = sectionQNumber(sectionPayload.key, nextSections);

    resetPicker();
    if (nextOpt) {
      setActiveType(nextOpt.type);
      setActiveSubType(nextOpt.subType);
      setMarksPerQuestion("");
      if (hasChapterPlan) {
        const planned = plannedCountForType(chapterPlan, nextOpt.type);
        setRequiredCount(planned > 0 ? planned : "");
      }
      void syncMediumForType(nextOpt.type, nextOpt.subType);
    } else {
      const allQs = nextSections.flatMap((s) => s.questions || []);
      setMedium(aggregateQuestionsMedium(allQs));
    }
    setPickerMenuOpen(true);
    showQuestionMenu();
    toast.success(
      wasEditing
        ? `${TYPE_META[activeType].short} section updated (Q${qNo})`
        : `${TYPE_META[activeType].short} section added (Q${qNo})`
    );
  };

  const removeSection = (sectionKey) => {
    setPaperSections((prev) => prev.filter((s) => s.key !== sectionKey));
  };

  const updatePaperQuestionText = (sectionKey, questionId, patch) => {
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

  const cancelSectionType = (section) => {
    setConfirmDialog({ kind: "cancel-section", section });
  };

  const performCancelSection = () => {
    const section = confirmDialog?.section;
    setConfirmDialog(null);
    if (!section) return;
    const qNo = sectionQNumber(section.key, paperSections);
    removeSection(section.key);
    toast.success(`Q${qNo} removed`);
  };

  /** Rail: Question Menu — add a NEW section (does not replace an existing one) */
  const openAddQuestionsMenu = () => {
    setEditingSectionKey(null);
    setDraftSelected([]);
    setPool([]);
    setPoolTotal(0);
    setPickerMessage(null);
    setAttemptCount("");
    const first = pickerOptions[0];
    const nextType = first?.type || "MCQ";
    if (first) {
      setActiveType(first.type);
      setActiveSubType(first.subType);
    }
    if (hasChapterPlan) {
      const planned = plannedCountForType(chapterPlan, nextType);
      setRequiredCount(planned > 0 ? planned : "");
    } else {
      setRequiredCount("");
    }
    setMarksPerQuestion("");
    setPickerMenuOpen(true);
    setModalOpen(true);
    showQuestionMenu();
    void syncMediumForType(nextType, first?.subType || null);
  };

  /** Section pencil — edit / replace questions inside THAT section only */
  const openPickerForSection = async (section) => {
    const type = section.type;
    const opt =
      pickerOptions.find(
        (o) =>
          o.type === type &&
          (o.subType || null) === (section.subType || null)
      ) ||
      pickerOptions.find((o) => o.type === type) ||
      pickerOptions[0] ||
      null;
    const nextType = opt?.type || type;
    const nextSubType = opt ? opt.subType : section.subType || null;
    setActiveType(nextType);
    setActiveSubType(nextSubType);
    void syncMediumForType(nextType, nextSubType);

    const selected = section.questions || [];
    const count = selected.length;
    /* Editing a section: require that section's size, not the full planner total */
    setRequiredCount(count > 0 ? String(count) : "");
    setMarksPerQuestion(
      Number(section.marksEach) > 0 ? String(section.marksEach) : ""
    );
    const attempt = Number(section.attemptCount);
    setAttemptCount(
      Number.isFinite(attempt) && attempt > 0 ? String(attempt) : ""
    );
    setDraftSelected(selected);
    setEditingSectionKey(section.key);
    setPickerMenuOpen(true);
    setModalOpen(true);
    showQuestionMenu();
    setPickerMessage(
      count
        ? `Editing Q${sectionQNumber(section.key, paperSections)} · ${count} selected`
        : null
    );

    /* Load full bank for this type; keep current section questions selected + visible */
    if (!subject || !selectedTopicIds.length) {
      setPool(selected);
      return;
    }

    setPending(true);
    try {
      const selectedIds = new Set(selected.map((q) => q.id));
      const excludeIds = usedQuestionIds.filter((id) => !selectedIds.has(id));
      const data = await searchPool({
        subjectId: subject.id,
        topicIds: selectedTopicIds,
        type: nextType,
        field: nextSubType,
        source: sourceFilter,
        excludeIds,
        limit: 3000,
      });
      const found = data.questions || [];
      const total = Number(data.total) || found.length;
      setPoolTotal(total);
      const byId = new Map();
      for (const q of selected) byId.set(q.id, q);
      for (const q of found) {
        if (!byId.has(q.id)) byId.set(q.id, q);
      }
      const merged = [...byId.values()];
      setPool(merged);
      setDraftSelected(selected);
      setPickerMessage(
        `Editing Q${sectionQNumber(section.key, paperSections)} · ${selected.length} selected · ${total} in bank` +
          (data.truncated || total > found.length
            ? ` (showing ${merged.length})`
            : "")
      );
    } catch (err) {
      setPool(selected);
      setPoolTotal(selected.length);
      toast.error(err.response?.data?.message || "Failed to load questions");
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    const key = pendingEditSectionRef.current;
    if (!key || step !== "paper" || !paperSections.length) return;
    const section = paperSections.find((s) => s.key === key);
    if (!section) {
      pendingEditSectionRef.current = null;
      return;
    }
    pendingEditSectionRef.current = null;
    openPickerForSection(section);
    // openPickerForSection is stable enough for one-shot deep link after load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, paperSections]);

  /** Re-search / re-pick same count for one section only */
  const refreshSectionQuestions = async (sectionKey) => {
    if (!subject) return;
    if (!selectedTopicIds.length) {
      toast.error("Syllabus topics missing");
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
      // Exclude every question already on the paper so refresh returns new ones
      const excludeIds = [
        ...new Set(
          paperSections.flatMap((s) =>
            (s.questions || []).map((q) => q.id).filter(Boolean)
          )
        ),
      ];
      /* Same-type sections only — don't let MCQ topics skew Short/Long refresh */
      const otherQuestions = paperSections
        .filter((s) => s.key !== sectionKey && s.type === section.type)
        .flatMap((s) => s.questions || []);
      const quotas = hasChapterPlan
        ? chapterQuotasForType(chapterPlan, section.type)
        : [];
      const data = await pickPool({
        subjectId: subject.id,
        topicIds: selectedTopicIds,
        type: section.type,
        field: section.subType,
        count,
        mode: "BALANCED",
        source: sourceFilter,
        excludeIds,
        topicUsage: buildTopicUsage(otherQuestions),
        chapterQuotas: quotas.length ? quotas : undefined,
      });
      const questions = data.questions || [];
      if (!questions.length) {
        toast.error("No replacement questions available for this section");
        return;
      }
      setPaperSections((prev) =>
        prev.map((s) =>
          s.key === sectionKey
            ? {
                ...s,
                questions,
              }
            : s
        )
      );
      toast.success(
        `Q${sectionQNumber(sectionKey, paperSections)} updated · ${questions.length} questions`
      );
    } catch (err) {
      toast.error(err.response?.data?.message || "Search update failed");
    } finally {
      setRefreshingSection(null);
    }
  };

  const cancelPaper = () => {
    leavePaperWorkspace();
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

  const printPaper = (mode) => {
    if (!paperSections.length) {
      toast.error("Add questions before printing");
      return;
    }
    if (!blueprintHasMarks(paperSections)) {
      toast.error("Enter marks for each section before printing.");
      return;
    }
    setPrintMode(mode);
    const printMedium = aggregateQuestionsMedium(
      paperSections.flatMap((s) => s.questions || [])
    );
    if (printMedium !== medium) setMedium(printMedium);
    const printBody = blueprintToPrintPayload(
      {
        title,
        boardLabel: board?.name,
        classLabel: klass?.name,
        subjectLabel: subject?.name,
        subjectId: subject?.id,
        medium: printMedium,
        paperCategory,
        examDate,
        durationMinutes,
        instructions,
        syllabusNote: syllabusNote || derivedSyllabus,
        sections: paperSections,
      },
      {
        meta: {
          orgTitle: academy?.name || board?.name || "Examination Test",
          address: academy?.address || "",
          phone: academy?.phone || "",
          logoUrl: academy?.logo || "",
          className: klass?.name || "",
          subjectName: subject?.name || "",
          examDate: examDate || null,
          durationMinutes,
          totalMarks: paperMarks,
          paperCode: editingPaperId
            ? String(editingPaperId).slice(-4).toUpperCase()
            : String(paperQuestionCount || 0).padStart(4, "0"),
          syllabusNote: (syllabusNote || derivedSyllabus || "").trim(),
          paperCategory: paperCategory || title || "",
          examLabel: paperCategory || "TEST",
        },
      }
    );
    const tab = openGeneratorPrintTab(
      printBody,
      mode,
      academy?._id || academy?.id
    );
    if (!tab) {
      toast.error("Allow pop-ups in this browser to open the print window.");
    }
  };
  const openSaveModal = () => {
    if (!paperSections.length) {
      toast.error(
        "Add at least one section first (MCQs / Short Questions / Long Questions)."
      );
      return;
    }
    if (!blueprintHasMarks(paperSections)) {
      toast.error("Enter marks for each question section before saving.");
      return;
    }
    if (!title.trim() && subject?.name) {
      setTitle(`${subject.name} Test`);
    }
    if (!syllabusNote.trim()) setSyllabusNote(derivedSyllabus);
    setModalOpen(false);
    setSaveModalOpen(true);
  };

  const savePaper = async () => {
    if (!subject || !klass || !board) {
      toast.error("Subject missing");
      return;
    }
    if (!title.trim()) {
      toast.error("Enter a test name.");
      return;
    }
    if (!paperCategory.trim()) {
      toast.error("Select a paper category.");
      return;
    }
    if (!examDate) {
      toast.error("Select an exam date.");
      return;
    }
    if (Number(durationMinutes) < 5) {
      toast.error("Duration must be at least 5 minutes.");
      return;
    }
    if (!paperSections.length) {
      toast.error("Test is empty");
      return;
    }
    if (!blueprintHasMarks(paperSections)) {
      toast.error("Enter marks for each question section.");
      return;
    }

    setPending(true);
    try {
      const payload = blueprintToApiBody({
        title: title.trim(),
        boardLabel: board.name,
        classLabel: klass.name,
        subjectLabel: subject.name,
        subjectId: subject.id,
        medium,
        distributionMode: "BALANCED",
        durationMinutes: Number(durationMinutes) || 60,
        examDate,
        instructions: instructions.trim(),
        syllabusNote: (syllabusNote || derivedSyllabus).trim(),
        paperCategory: paperCategory.trim(),
        sections: paperSections,
      });
      if (editingPaperId) {
        await api.put(`/generator/papers/${editingPaperId}`, payload);
        toast.success("Paper updated successfully.");
      } else {
        await api.post("/generator/papers", payload);
        toast.success("Test saved successfully.");
      }
      navigate("/academy/generator/papers");
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setPending(false);
    }
  };

  const headTitle =
    step === "board"
      ? "Select Syllabus"
      : step === "class"
        ? "Select Class"
        : step === "subject"
          ? "Select Subject"
          : step === "chapters"
            ? "Select Chapters"
            : "Test Preview";

  const renderQuestionRow = (q, { index, selectedZone = false, topicCode = "" }) => {
    const selected = selectedZone || selectedIdSet.has(q.id);
    const kind = sourceKind(q.source);
    const replacing = refreshingId === q.id;
    const code = topicCode || topicCodeById.get(q.topicId) || "";

  return (
      <div
        key={`${selectedZone ? "sel" : "bank"}-${q.id}`}
        className={[
          "tg-pool-row",
          selected ? "tg-pool-row--on" : "",
          selectedZone ? "tg-pool-row--selected-zone" : "",
        ].join(" ")}
      >
        <button
          type="button"
          className="tg-pool-row-main"
          onClick={() => toggleDraftQuestion(q)}
          aria-pressed={selected}
        >
          <span className="tg-pool-meta">
            {selectedZone ? (
              <span className="tg-pool-topic-num" title={code || "Topic"}>
                {code || "—"}
              </span>
            ) : null}
            <span
              className={[
                "tg-pool-source",
                kind === "exercise"
                  ? "tg-pool-source--ex"
                  : kind === "additional"
                    ? "tg-pool-source--add"
                    : "",
              ].join(" ")}
              title={sourceLabel(q.source)}
            >
              {sourceLabelShort(q.source)}
            </span>
          </span>
          <span className="tg-pool-body">
            <span className="tg-pool-stem">
              <span className="tg-pool-qno" aria-hidden>
                {index}.
              </span>
              <QuestionText
                text={q.text}
                textUrdu={q.textUrdu}
                medium={medium}
                dualLayout="columns"
              />
            </span>
            {activeType === "MCQ" ? (
              <McqOptionsRow question={q} medium={medium} />
            ) : null}
          </span>
        </button>
        {selectedZone ? (
          <button
            type="button"
            className="tg-pool-replace"
            disabled={replacing || pending}
            title="Replace this question only"
            onClick={(e) => {
              e.stopPropagation();
              replaceDraftQuestion(q.id);
            }}
          >
            <RefreshCw
              className={["size-3.5", replacing ? "animate-spin" : ""].join(" ")}
            />
            <span>{replacing ? "Replacing…" : "Replace"}</span>
          </button>
            ) : null}
      </div>
    );
  };

  const renderBankGroups = (groups) => {
    let qIndex = 0;
    if (!groups.length) {
      return (
        <p className="tg-pool-zone-empty">No questions in this list.</p>
      );
    }
    return groups.map((group) => (
      <section key={`bank-${group.topicId}`} className="tg-pool-topic">
        <header className="tg-pool-topic-head">
          {group.topicCode ? (
            <span className="tg-pool-topic-code">{group.topicCode}</span>
          ) : null}
          <span className="truncate tracking-wide">
            {topicTitleWithoutCode(group.topicName, group.topicCode)}
          </span>
        </header>
        <div className="tg-pool-rows">
          {group.questions.map((q) => {
            qIndex += 1;
            return renderQuestionRow(q, {
              index: qIndex,
              selectedZone: false,
              topicCode: group.topicCode,
            });
          })}
        </div>
      </section>
    ));
  };

  const renderSelectedList = () => {
    if (!draftSelected.length) {
      return (
        <p className="tg-pool-zone-empty">No questions selected yet.</p>
      );
    }
    return (
      <div className="tg-pool-rows tg-pool-rows--flat">
        {draftSelected.map((q, i) =>
          renderQuestionRow(q, {
            index: i + 1,
            selectedZone: true,
            topicCode: topicCodeById.get(q.topicId) || "",
          })
        )}
      </div>
    );
  };

  const renderExamSheet = (keySuffix = "main", interactive = true) => {
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
          const meta = TYPE_META[section.type];
          const heading = sectionInstruction(section.type, section.subType, {
            subjectName: subject?.name,
            className: klass?.name,
          });
          const part = meta.part;
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
                  isUrduLikeSubject(subject?.name)
                    ? "tg-exam-section-bar--urdu-only"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {isUrduLikeSubject(subject?.name) ? null : (
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
                  {isUrduLikeSubject(subject?.name) ? attemptNote : null}
                </p>
                {interactive && section.type === "LONG" ? (
                  <p className="tg-exam-marks-hint no-print">
                    Change any question’s marks below — total updates automatically
                  </p>
                ) : null}
              </div>

              {interactive ? (
                <div className="tg-exam-section-tools no-print">
                <button
                  type="button"
                    className="tg-exam-section-tool"
                    title="Edit this section’s questions"
                    onClick={() => openPickerForSection(section)}
                >
                    <Pencil className="size-4" />
                </button>
                  <button
                    type="button"
                    className="tg-exam-section-tool tg-exam-section-tool--danger"
                    title="Cancel this section"
                    onClick={() => cancelSectionType(section)}
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
                    medium={medium}
                    showAnswerKey={showAnswerKey}
                    inlineEdit={inlineEditing && interactive}
                    marksEdit={interactive}
                    onUpdateText={(patch) =>
                      updatePaperQuestionText(section.key, q.id, patch)
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

  const runRailAction = (fn) => {
    setPaperRailOpen(false);
    if (typeof fn === "function") fn();
  };

  const paperRailItems = [
    {
      id: "menu",
      group: "Build",
      label: "Question's Menu",
      icon: List,
      title: "Add a new question section to the paper",
      onClick: () => runRailAction(openAddQuestionsMenu),
    },
    {
      id: "edit",
      group: "Build",
      label: "Inline Editing",
      icon: Pencil,
      title: "Edit question text on the paper",
      active: inlineEditing,
      onClick: () => runRailAction(() => setInlineEditing((v) => !v)),
    },
    {
      id: "save",
      group: "Build",
      label: editingPaperId ? "Update Paper" : "Save Paper",
      icon: Save,
      accent: "save",
      onClick: () => runRailAction(openSaveModal),
      disabled: !paperSections.length || pending,
    },
    {
      id: "print-s",
      group: "Print",
      label: "Print Single",
      icon: Printer,
      onClick: () => runRailAction(() => printPaper("single")),
      disabled: !paperSections.length,
    },
    {
      id: "print-v",
      group: "Print",
      label: "Double Vertical",
      icon: Printer,
      onClick: () => runRailAction(() => printPaper("double-v")),
      disabled: !paperSections.length,
    },
    {
      id: "print-h",
      group: "Print",
      label: "Double Horizontal",
      icon: Printer,
      onClick: () => runRailAction(() => printPaper("double-h")),
      disabled: !paperSections.length,
    },
    {
      id: "cancel",
      group: "Session",
      label: "Cancel Paper",
      icon: X,
      accent: "danger",
      onClick: () => runRailAction(cancelPaper),
    },
  ];

  const paperRailGroups = ["Build", "Print", "Session"]
    .map((label) => ({
      label,
      items: paperRailItems.filter((item) => item.group === label),
    }))
    .filter((g) => g.items.length);

  return (
    <GeneratorLayout
      title="Generate Paper"
      mode={step === "paper" ? "paper" : "default"}
    >
      {step !== "paper" ? (
        <>
      <div className="tg-surface mb-3 px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-tg-ink sm:text-xl">
              {headTitle}
            </h2>
          </div>

          {step !== "board" ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={goBack}
                disabled={pending}
                className="rounded-lg border border-tg-blue/30 bg-tg-cream/70 px-2.5 py-1.5 text-xs font-semibold text-tg-ink transition hover:bg-tg-mist/50 disabled:opacity-50"
              >
                Back
              </button>
            </div>
          ) : null}
        </div>

        {selectionPath.length ? (
          <div className="tg-path" aria-label="Current selection">
            {selectionPath.map((item, i) => (
              <span key={item.id} className="tg-path-item">
                {i > 0 ? <span className="tg-path-sep">/</span> : null}
                {item.id === step ? (
                  <span className="tg-path-chip tg-path-chip--on">
                    <small>{item.label}</small>
                    <span dir="auto">{item.value}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="tg-path-chip"
                    onClick={() => jumpTo(item.id)}
                    title={`Change ${item.label}`}
                  >
                    <small>{item.label}</small>
                    <span dir="auto">{item.value}</span>
                  </button>
                )}
              </span>
            ))}
          </div>
        ) : null}

          <nav
          className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-tg-mist/60 pt-2"
            aria-label="Test generation steps"
          >
            {WIZARD_STEPS.map((item, index) => {
              const state =
                index < stepIndex
                  ? "done"
                  : index === stepIndex
                    ? "current"
                    : "todo";
              return (
              <div key={item.id} className="flex items-center gap-1.5">
                  {index > 0 ? (
                  <span className="hidden h-px w-4 bg-tg-blue/25 sm:block" />
                  ) : null}
                  <span
                    className={[
                      "grid size-5 place-items-center rounded-full text-[10px] font-bold",
                      state === "done" && "bg-tg-navy text-white",
                      state === "current" && "bg-tg-ink text-white",
                      state === "todo" && "bg-tg-mist text-tg-ink/40",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={[
                    "text-[10px] font-semibold uppercase tracking-wide",
                      state === "current"
                        ? "text-tg-ink"
                        : state === "todo"
                          ? "text-tg-deep/40"
                          : "text-tg-deep",
                    ].join(" ")}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </nav>
      </div>

      {step === "board" ? (
        <StatusPanel
          loading={loading}
          error={catalogError}
          loadingLabel="Loading curriculum…"
          onRetry={reloadCatalog}
          empty={!loading && !catalogError && !boards.length}
          emptyTitle="No curriculum loaded"
          emptyHint={
            <>
              Run{" "}
              <code className="rounded bg-white px-1">
                npm run seed:pts:boards
              </code>{" "}
              then{" "}
              <code className="rounded bg-white px-1">npm run import:ptb</code>{" "}
              in the backend.
            </>
          }
        >
          {!loading && !catalogError && boards.length ? (
            <div className="tg-syllabus-grid">
              {boards.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  className="tg-syllabus-card tg-anim-in"
                  style={{ "--tg-anim-i": i }}
                  onClick={() => selectBoard(b)}
                >
                  <span className="tg-syllabus-card-logo" aria-hidden>
                    {b.imageUrl ? (
                      <img src={b.imageUrl} alt="" loading="lazy" />
                    ) : (
                      <Library className="size-8 text-tg-navy" />
                    )}
                  </span>
                  <span className="tg-syllabus-card-title">
                    {b.name.replace(/ Board$/i, "")}
                  </span>
                  <span className="tg-syllabus-card-sub">
                    {b.subtitle || "Syllabus"}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </StatusPanel>
      ) : null}

      {step === "class" && board ? (
        <div className="tg-syllabus-grid">
          {(board.classes || []).map((c, i) => {
            const n = (c.subjects || []).length;
            return (
              <button
                key={c.id}
                type="button"
                className="tg-syllabus-card tg-syllabus-card--class tg-anim-in"
                style={{ "--tg-anim-i": i }}
                onClick={() => selectClass(c)}
              >
                <span className="tg-syllabus-card-title">{c.name}</span>
                <span className="tg-syllabus-card-sub">
                  {board.name}
                  {n > 0 ? ` · ${n} subject${n === 1 ? "" : "s"}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {step === "subject" && klass ? (
        (klass.subjects || []).length ? (
          <div className="tg-syllabus-grid">
            {(klass.subjects || []).map((s, i) => {
              const Icon = subjectIconFor(s.name);
              const hasLogo = Boolean(s.imageUrl);
              return (
                <button
                  key={s.id}
                  type="button"
                  className="tg-syllabus-card tg-syllabus-card--subject tg-anim-in"
                  style={{ "--tg-anim-i": i }}
                  disabled={pending}
                  onClick={() => selectSubject(s)}
                >
                  <span
                    className={[
                      "tg-syllabus-card-logo",
                      hasLogo ? "" : "tg-syllabus-card-logo--icon",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-hidden
                  >
                    {hasLogo ? (
                      <img src={s.imageUrl} alt="" loading="lazy" />
                    ) : (
                      <Icon
                        className="size-7 text-tg-navy"
                        strokeWidth={1.75}
                      />
                    )}
                  </span>
                  <span className="tg-syllabus-card-title">{s.name}</span>
                  <span className="tg-syllabus-card-sub">{klass.name}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="tg-surface p-6 text-center">
            <p className="font-display text-lg font-bold text-tg-ink">
              No subjects yet
            </p>
            <p className="mt-1 text-sm text-tg-deep/75">
              {board?.name} · {klass.name} — import bank data for this class.
            </p>
          </div>
        )
      ) : null}

      {step === "chapters" ? (
        <>
          <div className="tg-syllabus-toolbar tg-syllabus-toolbar--chapters">
            {(() => {
              const allOn =
                chapters.length > 0 &&
                selectedChapterIds.length === chapters.length;
              const someOn = selectedChapterIds.length > 0 && !allOn;
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (allOn) clearChapters();
                    else selectAllChapters();
                  }}
                  className={[
                    "tg-select-all",
                    allOn ? "tg-select-all--on" : "",
                    someOn ? "tg-select-all--partial" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={allOn}
                >
                  <span className="tg-select-all-box" aria-hidden>
                    {allOn ? "✓" : someOn ? "–" : ""}
                  </span>
                  <span>{allOn ? "All selected" : "Select all"}</span>
                </button>
              );
            })()}
          </div>

          <div className="tg-chapter-list" role="list">
            {chapters.map((chapter, chIdx) => {
              const topics = chapter.topics || [];
              const selectedTopicsInChapter = topics.filter((t) =>
                selectedTopicIds.includes(t.id)
              ).length;
              const allTopicsSelected =
                topics.length > 0 && selectedTopicsInChapter === topics.length;
              const someTopicsSelected =
                selectedTopicsInChapter > 0 && !allTopicsSelected;
              const chapterOn = selectedTopicsInChapter > 0;
              return (
                <article
                  key={chapter.id}
                  role="listitem"
                  style={{ "--tg-anim-i": chIdx % 12 }}
                  className={[
                    "tg-chapter-row tg-anim-in",
                    chapterOn ? "tg-chapter-row--selected" : "",
                    allTopicsSelected ? "tg-chapter-row--complete" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <label className="tg-chapter-row-head">
                    <input
                      type="checkbox"
                      className="tg-check-input"
                      checked={allTopicsSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someTopicsSelected;
                      }}
                      onChange={() => toggleChapter(chapter)}
                    />
                    <span
                      className={[
                        "tg-check",
                        allTopicsSelected ? "tg-check--on" : "",
                        someTopicsSelected ? "tg-check--partial" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-hidden
                    >
                      {allTopicsSelected ? "✓" : someTopicsSelected ? "–" : ""}
                    </span>
                    <span
                      className={[
                        "tg-chapter-row-title",
                        isUrduLikeSubject(subject?.name) ? "tg-font-urdu" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      dir="auto"
                    >
                      {chapter.name}
                    </span>
                    {topics.length ? (
                      <span
                        className={[
                          "tg-chapter-row-count",
                          chapterOn ? "tg-chapter-row-count--on" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {selectedTopicsInChapter}/{topics.length}
                      </span>
                    ) : null}
                  </label>

                  <div className="tg-chapter-row-topics">
                    {topics.length ? (
                      topics.map((topic) => {
                        const topicOn = selectedTopicIds.includes(topic.id);
                        return (
                          <label
                            key={topic.id}
                            className={[
                              "tg-topic-row",
                              topicOn ? "tg-topic-row--on" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <input
                              type="checkbox"
                              className="tg-check-input"
                              checked={topicOn}
                              onChange={() =>
                                toggleTopic(topic.id, chapter.id)
                              }
                            />
                            <span
                              className={[
                                "tg-check tg-check--sm",
                                topicOn ? "tg-check--on" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              aria-hidden
                            >
                              {topicOn ? "✓" : ""}
                            </span>
                            <span
                              className={[
                                "tg-topic-row-title",
                                isUrduLikeSubject(subject?.name)
                                  ? "tg-font-urdu"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              dir="auto"
                            >
                              {topic.name}
                            </span>
                          </label>
                        );
                      })
                    ) : (
                      <p className="tg-topic-row-empty">
                        No topics in this chapter.
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
            {!chapters.length ? (
              <p className="tg-surface p-6 text-sm text-tg-ink/70">
                No chapters for this subject.
              </p>
            ) : null}
          </div>

          <div className="tg-action-bar">
            <div className="tg-action-bar-inner tg-action-bar-inner--cta">
              <div className="tg-action-bar-summary">
                <p className="tg-action-bar-label">Syllabus ready</p>
                <p className="tg-action-bar-counts">
                  <span>
                    <strong>{selectedChapterIds.length}</strong> chapters
                  </span>
                  <span className="tg-action-bar-dot" aria-hidden />
                  <span>
                    <strong>{selectedTopicIds.length}</strong> topics
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={openSelectQuestions}
                disabled={!selectedTopicIds.length || pending}
                aria-label="Continue to select questions"
                title="Continue to select questions"
                className={[
                  "tg-continue-cta",
                  selectedTopicIds.length && !pending
                    ? "tg-continue-cta--ready"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="tg-continue-cta-shine" aria-hidden />
                <span className="tg-continue-cta-arrow" aria-hidden>
                  →
                </span>
              </button>
            </div>
          </div>
        </>
      ) : null}

        </>
      ) : (
        <div
          className={[
            "tg-paper-workspace",
            paperRailOpen ? "tg-paper-workspace--rail-open" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {paperRailOpen ? (
            <button
              type="button"
              className="tg-paper-rail-backdrop no-print"
              aria-label="Close menu"
              onClick={() => setPaperRailOpen(false)}
            />
          ) : null}

          <aside
            className={[
              "tg-paper-rail no-print",
              paperRailOpen ? "tg-paper-rail--open" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="tg-paper-rail-head">
              <div className="tg-paper-rail-profile">
                {academy?.logo ? (
                  <img
                    src={academy.logo}
                    alt=""
                    className="tg-paper-rail-logo"
                  />
                ) : (
                  <span className="tg-paper-rail-logo tg-paper-rail-logo--fallback">
                    TG
                  </span>
                )}
                <div className="min-w-0">
                  <p className="tg-paper-rail-name">
                    {user?.name ||
                      (user?.role === "sub_account"
                        ? "Sub account"
                        : user?.role === "teacher"
                          ? "Teacher"
                          : "Administrator")}
                  </p>
                  <p className="tg-paper-rail-role">
                    {user?.role === "sub_account"
                      ? "Sub account"
                      : user?.role === "teacher"
                        ? "Teacher"
                        : "Administrator"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="tg-paper-rail-close"
                aria-label="Close menu"
                onClick={() => setPaperRailOpen(false)}
              >
                <X className="size-4" strokeWidth={2.25} />
              </button>
            </div>

            <nav className="tg-paper-rail-nav" aria-label="Paper actions">
              {paperRailGroups.map((group) => (
                <div key={group.label} className="tg-paper-rail-group">
                  <p className="tg-paper-rail-label">{group.label}</p>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={item.onClick}
                        disabled={item.disabled}
                        title={item.title || item.label}
                        className={[
                          "tg-paper-rail-item",
                          item.active ? "tg-paper-rail-item--on" : "",
                          item.accent === "save"
                            ? "tg-paper-rail-item--save"
                            : "",
                          item.accent === "danger"
                            ? "tg-paper-rail-item--danger"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <span className="tg-paper-rail-ico" aria-hidden>
                          <Icon className="size-3.5" strokeWidth={2} />
                        </span>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="tg-paper-rail-foot">
              <button
                type="button"
                onClick={() => runRailAction(handleLogout)}
                className="tg-paper-rail-iconbtn tg-paper-rail-iconbtn--danger"
                title="Logout"
              >
                <LogOut className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => runRailAction(toggleFullscreen)}
                className="tg-paper-rail-iconbtn"
                title="Fullscreen"
              >
                <Maximize2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  runRailAction(() => setShowAnswerKey((v) => !v))
                }
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
            <div className="tg-paper-stage-bar no-print">
              <button
                type="button"
                className="tg-paper-menu-btn"
                aria-label="Open paper menu"
                aria-expanded={paperRailOpen}
                onClick={() => setPaperRailOpen(true)}
              >
                <Menu className="size-5" strokeWidth={2.25} />
              </button>
              <p className="tg-paper-stage-bar-hint">
                {subject?.name
                  ? `${klass?.name || ""} · ${subject.name}`
                  : "Paper workspace"}
              </p>
              <button
                type="button"
                onClick={cancelPaper}
                className="tg-paper-back"
              >
                <ArrowLeft className="size-4" strokeWidth={2.25} />
                Back
              </button>
            </div>
            {!paperSections.length ? (
              <div className="tg-paper-empty no-print">
                <p className="font-display text-lg font-bold text-tg-ink">
                  Select questions
                </p>
                <p className="mt-1 text-sm text-tg-deep/75">
                  Use Question&apos;s Menu to build this paper.
                </p>
                    <button
                      type="button"
                  onClick={openAddQuestionsMenu}
                  className="tg-btn-primary mt-4 px-4 py-2.5 text-sm"
                    >
                  Open Question&apos;s Menu
                    </button>
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
      )}

      <TgConfirmModal
        open={confirmDialog?.kind === "leave-paper"}
        title="Leave this page?"
        message="Cancel this paper and go back to syllabus? Unsaved questions will be lost."
        confirmLabel="Leave page"
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
            ? `Cancel Q${sectionQNumber(confirmDialog.section.key, paperSections)} (${TYPE_META[confirmDialog.section.type]?.label || confirmDialog.section.type}) from this paper?`
            : ""
        }
        confirmLabel="Remove"
        cancelLabel="Keep"
        danger
        onCancel={() => setConfirmDialog(null)}
        onConfirm={performCancelSection}
      />

      <ChapterQuotaModal
        open={plannerOpen}
        subjectName={subject?.name}
        className={klass?.name}
        rows={chapterPlanRows}
        totals={plannerTotals}
        questionTotal={plannerQuestionTotal}
        onUpdate={(chapterId, type, value) =>
          setChapterPlan((prev) =>
            updateChapterPlanCount(prev, chapterId, type, value)
          )
        }
        onAutofill={() =>
          setChapterPlan(autofillChapterPlan(selectedChapters, selectedTopicIds))
        }
        onClear={() => setChapterPlan((prev) => clearChapterPlanCounts(prev))}
        onCancel={() => {
          setPlannerOpen(false);
          setChapterPlan([]);
        }}
        onContinue={continueFromPlanner}
      />

      {/* SAVE MODAL */}
      {saveModalOpen ? (
        <div className="tg-modal-backdrop" role="dialog" aria-modal="true">
          <div className="tg-modal" style={{ maxWidth: "36rem" }}>
            <div className="tg-modal-header">
              <div>
                <p className="text-xs font-medium text-white/70">
                  {editingPaperId ? "Update Test" : "Save Test"}
                </p>
                <h3 className="text-base font-bold">Fill test details</h3>
              </div>
              <button
                type="button"
                className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25"
                onClick={() => setSaveModalOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto p-4">
              <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-tg-ink">
                  Paper name <span className="text-red-500">*</span>
                <input
                  className="tg-field mt-1.5 h-11 w-full px-3"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Biology Mid Term"
                />
              </label>
                <label className="block text-sm font-semibold text-tg-ink">
                  Paper category <span className="text-red-500">*</span>
                  <input
                    className="tg-field mt-1.5 h-11 w-full px-3"
                    value={paperCategory}
                    onChange={(e) => setPaperCategory(e.target.value)}
                    placeholder="e.g. Monthly Test"
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-tg-ink">
                  Exam date <span className="text-red-500">*</span>
                  <input
                    type="date"
                    className="tg-field mt-1.5 h-11 w-full px-3"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-semibold text-tg-ink">
                  Duration (min) <span className="text-red-500">*</span>
                  <input
                    type="number"
                    min={5}
                    className="tg-field mt-1.5 h-11 w-full px-3"
                    value={durationMinutes}
                    onChange={(e) =>
                      setDurationMinutes(
                        e.target.value === ""
                          ? ""
                          : Math.max(0, Number(e.target.value))
                      )
                    }
                  />
                </label>
              </div>
              <label className="block text-sm font-semibold text-tg-ink">
                Exam syllabus
                <input
                  className="tg-field mt-1.5 h-11 w-full px-3"
                  value={syllabusNote || derivedSyllabus}
                  onChange={(e) => setSyllabusNote(e.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-tg-ink">
                Instructions (optional)
                <textarea
                  className="tg-field mt-1.5 min-h-20 w-full px-3 py-2 text-sm"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </label>
            </div>
            <div className="tg-modal-footer">
              <p className="text-sm font-semibold text-tg-ink">
                Total marks: {paperMarks}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSaveModalOpen(false)}
                  className="rounded-xl border border-tg-blue/30 bg-white px-3 py-2 text-sm font-semibold text-tg-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={savePaper}
                  disabled={pending}
                  className="tg-btn-primary px-4 py-2 text-sm disabled:opacity-50"
                >
                  {pending
                    ? editingPaperId
                      ? "Updating…"
                      : "Saving…"
                    : editingPaperId
                      ? "Update Test"
                      : "Save Test"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* QUESTION PICKER — opens over paper preview */}
      {step === "paper" && modalOpen ? (
        <div className="tg-modal-backdrop" role="dialog" aria-modal="true">
          <div className="tg-modal">
            <div className="tg-modal-header">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/75">
                  {editingSectionKey
                    ? `Edit Q${sectionQNumber(editingSectionKey, paperSections)}`
                    : "Add new questions"}
                </p>
                <h3 className="truncate text-base font-bold sm:text-lg">
                  {klass?.name} — {subject?.name}
                </h3>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25"
                onClick={() => setModalOpen(false)}
              >
                Close
              </button>
            </div>

            <div
              className={[
                "tg-picker-body",
                pickerMenuOpen ? "tg-picker-body--menu-open" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="tg-picker-shell tg-scroll-quiet">
                <section
                  ref={pickerMenuRef}
                  className={[
                    "tg-picker-sec tg-picker-sec--menu",
                    pickerMenuOpen ? "" : "tg-picker-sec--menu-collapsed",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {pickerMenuOpen ? null : (
                    <button
                      type="button"
                      className="tg-picker-sec-toggle"
                      onClick={() => setPickerMenuOpen(true)}
                    >
                      <span>Question Menu</span>
                      <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
                    </button>
                  )}
                  {pickerMenuOpen ? (
                    <>
                  <div className="tg-picker-fields">
                      <label className="tg-picker-field--type block">
                        <span className="tg-picker-label">
                          Question type <span aria-hidden>*</span>
                        </span>
                        <select
                          required
                          aria-required="true"
                          className={[
                            "tg-native-select",
                            pickerOptions.some((o) =>
                              /[\u0600-\u06FF]/.test(o.label || "")
                            )
                              ? "tg-font-urdu"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          value={
                            pickerOptions.some((o) => o.value === pickerValue)
                              ? pickerValue
                              : pickerOptions[0]?.value || "MCQ:"
                          }
                          onChange={(e) =>
                            activatePickerOption(String(e.target.value))
                          }
                        >
                          {pickerOptions.map((opt) => (
                            <option
                              key={opt.value}
                              value={opt.value}
                              className={
                                /[\u0600-\u06FF]/.test(opt.label || "")
                                  ? "tg-font-urdu"
                                  : undefined
                              }
                            >
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="tg-picker-field--sm block">
                        <span className="tg-picker-label">Source</span>
                        <select
                          className="tg-native-select"
                          value={sourceFilter}
                          onChange={(e) => {
                            setSourceFilter(String(e.target.value));
                            setPool([]);
                            setPoolTotal(0);
                            setDraftSelected([]);
                          }}
                        >
                          {SOURCE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="tg-picker-field--sm block">
                        <span className="tg-picker-label">Medium</span>
                        <select
                          className="tg-native-select"
                          value={medium}
                          onChange={(e) => setMedium(String(e.target.value))}
                        >
                          {MEDIUM_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="tg-picker-field--sm block">
                        <span className="tg-picker-label">
                          Required <span aria-hidden>*</span>
                          {hasChapterPlan ? " (planner)" : ""}
                        </span>
                        <input
                          type="number"
                          min={1}
                          required={!hasChapterPlan}
                          aria-required={!hasChapterPlan}
                          placeholder="Req"
                          value={requiredCount}
                          readOnly={hasChapterPlan}
                          title={
                            hasChapterPlan
                              ? "Set from chapter planner"
                              : undefined
                          }
                          onChange={(e) => {
                            if (hasChapterPlan) return;
                            setRequiredCount(
                              e.target.value === ""
                                ? ""
                                : Math.max(1, Number(e.target.value))
                            );
                          }}
                          className="tg-field h-[2.35rem] w-full px-2 text-sm"
                        />
                      </label>
                      <label className="tg-picker-field--sm block">
                        <span className="tg-picker-label">
                          Marks <span aria-hidden>*</span>
                        </span>
                        <input
                          type="number"
                          min={1}
                          required
                          aria-required="true"
                          placeholder="Marks"
                          value={marksPerQuestion}
                          onChange={(e) =>
                            setMarksPerQuestion(
                              e.target.value === ""
                                ? ""
                                : Math.max(1, Number(e.target.value))
                            )
                          }
                          className="tg-field h-[2.35rem] w-full px-2 text-sm"
                        />
                      </label>
                      <label className="tg-picker-field--sm block">
                        <span className="tg-picker-label">Attempt any</span>
                        <input
                          type="number"
                          min={0}
                          placeholder="—"
                          value={attemptCount}
                          onChange={(e) =>
                            setAttemptCount(
                              e.target.value === ""
                                ? ""
                                : Math.max(0, Number(e.target.value))
                            )
                          }
                          className="tg-field h-[2.35rem] w-full px-2 text-sm"
                        />
                      </label>
                    </div>

                  <div className="tg-picker-actions">
                    <p className="tg-picker-selected-count" aria-live="polite">
                      {draftSelected.length}
                      {parsedRequired() > 0
                        ? ` of ${parsedRequired()} selected`
                        : " selected"}
                    </p>
                    <button
                      type="button"
                      onClick={runSearch}
                      disabled={pending}
                      className="tg-picker-search-btn disabled:opacity-50"
                    >
                      {pending ? "Searching…" : "Search"}
                    </button>
                  </div>
                    </>
                  ) : null}
                </section>

                <section className="tg-picker-sec tg-picker-sec--bank">
                  <div className="tg-pool-summary tg-pool-summary--bank">
                    <span>2. Questions Bank</span>
                    <span aria-live="polite">
                      {pending
                        ? "Searching…"
                        : poolTotal > 0 || pool.length > 0
                          ? `${poolTotal || pool.length} Record${
                              (poolTotal || pool.length) === 1 ? "" : "'s"
                            } Found`
                          : pickerMessage?.includes("No ")
                            ? "0 Record's Found"
                            : "Search to load"}
                    </span>
                  </div>
                  <div
                    className="tg-pool-zone tg-pool-zone--bank tg-scroll-quiet"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {pool.length > 0 ? (
                      renderBankGroups(bankByTopic)
                    ) : (
                      <p className="tg-pool-zone-empty">
                        {pending
                          ? "Loading questions…"
                          : pickerMessage?.includes("No ")
                            ? "No questions match this filter. Change type, source, or chapters and search again."
                            : "Tap Search or Random Select to load matching questions."}
                      </p>
                    )}
                  </div>
                </section>

                <div className="tg-pool-mid-actions">
                  <button
                    type="button"
                    onClick={runSelectRandom}
                    disabled={pending}
                    className="tg-pool-mid-btn tg-pool-mid-btn--random"
                  >
                    Random Select →
                  </button>
                  <button
                    type="button"
                    onClick={addSectionToPaper}
                    disabled={pending}
                    className="tg-pool-mid-btn tg-pool-mid-btn--add"
                  >
                    {editingSectionKey
                      ? "Update Section →"
                      : "Add Questions →"}
                  </button>
                </div>

                <section className="tg-picker-sec tg-picker-sec--selected">
                  <div className="tg-pool-summary tg-pool-summary--selected">
                    <span>3. Selected Questions</span>
                    <span>
                      {draftSelected.length}
                      {parsedRequired() > 0
                        ? ` of ${parsedRequired()} required`
                        : ""}
                    </span>
                  </div>
                  <div className="tg-pool-zone tg-pool-zone--selected">
                    {renderSelectedList()}
                  </div>
                </section>
              </div>
            </div>

            <div className="tg-modal-footer">
  
            </div>
          </div>
        </div>
      ) : null}
    </GeneratorLayout>
  );
}

export default GeneratorCreate;

