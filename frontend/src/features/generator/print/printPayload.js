import { normalizePrintMode } from "./printConstants.js";
import { normalizePrintOpts, readPrintPrefs } from "./printOpts.js";
import { blueprintFromApiPaper, mediumFromApi } from "../utils/paperBlueprint.js";

const STORAGE_KEY = "tg_print_paper_payload";

/** Persist paper snapshot and open print UI in a new tab. */
export function openGeneratorPrintTab(payload, mode = "single", academyId) {
  const academy = academyId || payload?.academyId || null;
  const printOpts = normalizePrintOpts({
    ...readPrintPrefs(academy),
    ...(payload?.printOpts || {}),
  });
  const printMode = normalizePrintMode(mode);
  const body = {
    ...payload,
    printOpts,
    printMode,
    academyId: academy,
    savedAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(body));
  const url = `/academy/generator/print?mode=${encodeURIComponent(printMode)}`;
  return window.open(url, "_blank", "noopener,noreferrer");
}

export function readGeneratorPrintPayload() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeGeneratorPrintPayload(payload) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...payload, savedAt: Date.now() })
  );
}

/**
 * Build a print-tab payload from a saved API paper + academy branding.
 * Reused by print page (?id=) and any future “print saved paper” entry.
 */
export function buildPrintPayloadFromApiPaper(paper, academy, mode = "single") {
  if (!paper) return null;
  const academyId = academy?._id || academy?.id || null;
  const blueprint = blueprintFromApiPaper(paper);
  return {
    medium: mediumFromApi(paper.medium),
    printMode: normalizePrintMode(mode),
    academyId,
    printOpts: readPrintPrefs(academyId),
    paperId: String(paper._id),
    meta: {
      orgTitle: academy?.name || paper.boardLabel || "Examination Test",
      address: academy?.address || "",
      phone: academy?.phone || "",
      logoUrl: academy?.logo || "",
      className: paper.classLabel || "",
      subjectName: paper.subjectLabel || "",
      examDate: paper.examDate || null,
      durationMinutes: paper.durationMinutes,
      totalMarks: paper.totalMarks ?? blueprint.totalMarks,
      paperCode: String(paper._id).slice(-4).toUpperCase(),
      syllabusNote: paper.syllabusNote || "",
      paperCategory: paper.paperCategory || "",
      examLabel: paper.paperCategory || "TEST",
      title: paper.title || "",
    },
    sections: blueprint.sections,
  };
}

export function shuffleMcqSections(sections = []) {
  return sections.map((s) => {
    if (s.type !== "MCQ" || !s.questions?.length) return s;
    const next = [...s.questions];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return { ...s, questions: next };
  });
}
