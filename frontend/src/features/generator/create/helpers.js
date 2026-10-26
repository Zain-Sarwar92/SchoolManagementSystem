import {
  Atom,
  BookMarked,
  BookOpen,
  Brain,
  Briefcase,
  Calculator,
  FlaskConical,
  Globe2,
  Landmark,
  Languages,
  Library,
} from "lucide-react";

export function sectionQNumber(sectionKey, sections) {
  const idx = sections.findIndex((s) => s.key === sectionKey);
  return idx >= 0 ? idx + 1 : sections.length + 1;
}

export function makeSectionKey() {
  return `sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function subjectIconFor(name) {
  const n = String(name || "").toLowerCase();
  if (/math|حساب|الجبرا|geometry/.test(n)) return Calculator;
  if (/chem|کیمیا/.test(n)) return FlaskConical;
  if (/phys|طبیعیات|physics/.test(n)) return Atom;
  if (/bio|حیاتیات/.test(n)) return Brain;
  if (/comp|کمپیوٹر|ict|cs\b/.test(n)) return Briefcase;
  if (/eng|انگریزی/.test(n)) return BookOpen;
  if (/urd|اردو/.test(n)) return Languages;
  if (/isl|اسلام/.test(n)) return Landmark;
  if (/pak|پاکستان|study/.test(n)) return Globe2;
  if (/punj|پنجاب/.test(n)) return BookMarked;
  return Library;
}

export function shortClassBadge(className) {
  const raw = String(className || "").trim();
  if (!raw) return "?";
  /* class labels: 9TH, INTER-I, ONE, 3RD YEAR, OLD BOOKS */
  if (/^(ONE|TWO|THREE|FOUR)$/i.test(raw)) return raw.slice(0, 3).toUpperCase();
  if (/INTER/i.test(raw)) return raw.replace(/INTER-?/i, "I").slice(0, 4);
  if (/OLD/i.test(raw)) return "OLD";
  if (/YEAR/i.test(raw)) {
    const y = raw.match(/(\d+)/);
    return y ? `${y[1]}Y` : "YR";
  }
  const nth = raw.match(/^(\d+)(?:ST|ND|RD|TH)?$/i);
  if (nth) return nth[1];
  const match = raw.match(/(\d+[A-Za-z]*)\s*$/);
  if (match) return match[1].slice(0, 4);
  return raw.slice(0, 4).toUpperCase();
}

/** Avoid "2.3 2.3 Title" — strip leading topic code from name */
export function topicTitleWithoutCode(name, code) {
  let title = String(name || "").trim();
  const c = String(code || "").trim();
  if (c) {
    const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    title = title.replace(new RegExp(`^${escaped}\\s*[:.\\-)]?\\s*`, "i"), "");
  }
  title = title.replace(/^\d+(?:\.\d+)+\s*[:.\-)]?\s*/, "");
  return title.trim() || String(name || "").trim();
}
