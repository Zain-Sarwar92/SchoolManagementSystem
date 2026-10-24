/** Practical gazette compiler ported from Test_System results.ts for SMS MERN. */

export function sortByRoll(a, b) {
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/** Extract "Round 2" / "R3" → 2 for chronological fallback sorting. */
export function examRoundNumber(name = "") {
  const text = String(name || "");
  const roundMatch = text.match(/round\s*(\d+)/i);
  if (roundMatch) return Number(roundMatch[1]);
  const shortMatch = text.match(/\br\s*(\d+)\b/i);
  if (shortMatch) return Number(shortMatch[1]);
  return null;
}

/**
 * Earliest exam first: examDate → createdAt → round number → name.
 * Missing dates sort after dated exams (not as epoch 0).
 */
export function compareExamsByDate(a, b) {
  const aDate = a?.examDate ? new Date(a.examDate).getTime() : NaN;
  const bDate = b?.examDate ? new Date(b.examDate).getTime() : NaN;
  const aHasDate = Number.isFinite(aDate);
  const bHasDate = Number.isFinite(bDate);
  if (aHasDate && bHasDate && aDate !== bDate) return aDate - bDate;
  if (aHasDate !== bHasDate) return aHasDate ? -1 : 1;

  const aCreated = a?.createdAt ? new Date(a.createdAt).getTime() : NaN;
  const bCreated = b?.createdAt ? new Date(b.createdAt).getTime() : NaN;
  const aHasCreated = Number.isFinite(aCreated);
  const bHasCreated = Number.isFinite(bCreated);
  if (aHasCreated && bHasCreated && aCreated !== bCreated) {
    return aCreated - bCreated;
  }
  if (aHasCreated !== bHasCreated) return aHasCreated ? -1 : 1;

  const aRound = examRoundNumber(a?.name);
  const bRound = examRoundNumber(b?.name);
  if (aRound != null && bRound != null && aRound !== bRound) {
    return aRound - bRound;
  }
  if (aRound != null && bRound == null) return -1;
  if (aRound == null && bRound != null) return 1;

  return String(a?.name || "").localeCompare(String(b?.name || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function gradeFromPercent(percent) {
  if (percent == null) return "—";
  if (percent >= 80) return "A+";
  if (percent >= 70) return "A";
  if (percent >= 60) return "B";
  if (percent >= 50) return "C";
  if (percent >= 40) return "D";
  return "F";
}

export function percentOf(obtained, total) {
  if (total <= 0) return null;
  return Math.round((obtained / total) * 1000) / 10;
}

export function roundResultMarks(n) {
  return Math.round(n * 10) / 10;
}

export function formatResultMarks(n) {
  return roundResultMarks(n).toFixed(1);
}

export function formatResultPercent(n) {
  return roundResultMarks(n).toFixed(1);
}

function shortSubjectLabel(name = "") {
  const n = String(name).trim();
  if (/computer/i.test(n)) return "Comp";
  if (/biology|حیاتیات/i.test(n)) return "Bio";
  if (/chemistry|کیمیا/i.test(n)) return "Chem";
  if (/mathematics|math/i.test(n)) return "Math";
  if (/pakistan\s*stud/i.test(n)) return "Pak St.";
  if (/islamiyat|islamic/i.test(n)) return "Isl.";
  if (/tarjuma/i.test(n)) return "TQ";
  if (n.length <= 12) return n;
  return `${n.slice(0, 10)}…`;
}

function shortElectiveLabel(name = "") {
  if (/biology|حیاتیات/i.test(name)) return "Bio";
  if (/chemistry|کیمیا/i.test(name)) return "Chem";
  if (/computer/i.test(name)) return "Comp";
  return shortSubjectLabel(name);
}

function isBiologyName(name) {
  const n = String(name).trim().toLowerCase();
  return n.includes("biology") || String(name).includes("حیاتیات");
}

function isChemistryName(name) {
  const n = String(name).trim().toLowerCase();
  return n.includes("chemistry") || String(name).includes("کیمیا");
}

function isComputerName(name) {
  const n = String(name).trim().toLowerCase();
  return n.includes("computer") || String(name).includes("کمپیوٹر");
}

/** Matric (9–10): Bio/Comp. Intermediate (11–12): Bio/Comp/Chem. */
export function resolveGazetteElectiveMerge(className, gradeLevel) {
  const grade =
    Number(gradeLevel) ||
    Number(String(className || "").match(/\b(1[0-2]|[1-9])\b/)?.[1]) ||
    0;
  if (grade >= 9 && grade <= 10) return "matric";
  if (grade >= 11 && grade <= 12) return "intermediate";
  return "default";
}

function isMergedElectiveSubject(name, merge) {
  if (merge === "matric") {
    return isBiologyName(name) || isComputerName(name);
  }
  if (merge === "intermediate") {
    return isBiologyName(name) || isComputerName(name) || isChemistryName(name);
  }
  return isBiologyName(name) || isChemistryName(name) || isComputerName(name);
}

function mergedElectiveLabel(subjects, merge) {
  if (merge === "matric") return "Bio/Comp";
  if (merge === "intermediate") return "Bio/Comp/Chem";
  return subjects.map((row) => shortElectiveLabel(row.name)).join(" / ");
}

/** Pick one elective (Bio/Comp/Chem) — never sum multiple enrollments. */
function pickElectiveSubject(chosenList, student, markMap) {
  if (!chosenList?.length) return null;
  if (chosenList.length === 1) return chosenList[0];

  const group = String(student?.group || "").toLowerCase();
  const byGroup = chosenList.find((subject) => {
    if (
      group === "biology" ||
      group === "pre_medical" ||
      group.includes("bio")
    ) {
      return isBiologyName(subject.name);
    }
    if (
      group === "computer" ||
      group === "ics" ||
      group === "pre_engineering" ||
      group.includes("comp")
    ) {
      return isComputerName(subject.name);
    }
    if (group === "chemistry" || group.includes("chem")) {
      return isChemistryName(subject.name);
    }
    return false;
  });
  if (byGroup) return byGroup;

  const withMarks = chosenList.find((subject) => {
    const mark = markMap?.get(`${student.id}:${subject.id}`);
    return mark && (mark.isAbsent || mark.obtainedMarks != null);
  });
  if (withMarks) return withMarks;

  return chosenList[0];
}

/** Dash (unentered) and Abs count the same for pass/fail: subject fails. */
function subjectPasses(cell, passPercent) {
  if (!cell?.applicable) return true;
  if (!cell.entered || cell.isAbsent) return false;
  const subjectPercent = percentOf(cell.obtained ?? 0, cell.totalMarks);
  return subjectPercent != null && subjectPercent >= passPercent;
}

/**
 * Build gazette columns. Elective alternatives (Bio/Comp/Chem) share one column.
 * @param {Array<{ id: string, name: string, totalMarks?: number }>} subjects
 */
export function buildGazetteColumns(subjects, merge = "default") {
  const columns = [];
  const altSubjects = subjects.filter((row) =>
    isMergedElectiveSubject(row.name, merge)
  );
  const shouldMerge =
    merge === "matric" || merge === "intermediate"
      ? altSubjects.length >= 1
      : altSubjects.length > 1;
  const altIds = new Set(shouldMerge ? altSubjects.map((row) => row.id) : []);
  let altColumnAdded = false;

  for (const subject of subjects) {
    if (shouldMerge && altIds.has(subject.id)) {
      if (altColumnAdded) continue;
      altColumnAdded = true;
      columns.push({
        kind: "elective",
        key:
          merge === "matric"
            ? "group:BIO_COMP"
            : merge === "intermediate"
              ? "group:BIO_COMP_CHEM"
              : "group:BIO_CHEM_COMP",
        label: mergedElectiveLabel(altSubjects, merge),
        group:
          merge === "matric"
            ? "BIO_COMP"
            : merge === "intermediate"
              ? "BIO_COMP_CHEM"
              : "BIO_CHEM_COMP",
        subjectIds: altSubjects.map((row) => row.id),
        totalMarks: Math.max(
          ...altSubjects.map((row) => row.totalMarks ?? 100)
        ),
      });
      continue;
    }

    columns.push({
      kind: "subject",
      key: `subject:${subject.id}`,
      label: shortSubjectLabel(subject.name),
      subjectId: subject.id,
      totalMarks: subject.totalMarks ?? 100,
    });
  }
  return columns;
}

/**
 * @param {object} input
 * @param {number} input.passPercent
 * @param {string} [input.className]
 * @param {number} [input.gradeLevel]
 * @param {Array} input.students - id, rollNumber, name, fatherName, major, group, enrolledSubjectIds
 * @param {Array} input.subjects - id, name, totalMarks
 * @param {Array} input.marks - studentId, subjectId, obtainedMarks, isAbsent
 */
export function compileSectionResult(input) {
  const markMap = new Map();
  for (const mark of input.marks) {
    markMap.set(`${mark.studentId}:${mark.subjectId}`, mark);
  }

  const merge = resolveGazetteElectiveMerge(input.className, input.gradeLevel);
  const columns = buildGazetteColumns(input.subjects, merge);
  const subjectById = new Map(input.subjects.map((s) => [s.id, s]));

  const rows = input.students.map((student) => {
    const enrolled = new Set(
      (student.enrolledSubjectIds || []).map((id) => String(id))
    );
    const isEnrolled = (subjectId) =>
      enrolled.size === 0 ? true : enrolled.has(String(subjectId));

    const cells = columns.map((column) => {
      if (column.kind === "subject") {
        const subject = subjectById.get(column.subjectId);
        const applicable = Boolean(subject && isEnrolled(subject.id));
        const mark = markMap.get(`${student.id}:${column.subjectId}`);
        const isAbsent = applicable && (mark?.isAbsent ?? false);
        const rawObtained = !applicable
          ? null
          : isAbsent
            ? 0
            : (mark?.obtainedMarks ?? null);
        const obtained =
          rawObtained == null ? null : roundResultMarks(rawObtained);
        const entered = !applicable
          ? true
          : Boolean(mark && (mark.isAbsent || mark.obtainedMarks != null));
        return {
          id: column.subjectId,
          name: subject?.name ?? column.label,
          totalMarks: subject?.totalMarks ?? column.totalMarks,
          obtained,
          isAbsent,
          entered,
          applicable,
          display: !applicable
            ? "—"
            : isAbsent
              ? "Abs"
              : obtained == null
                ? "—"
                : formatResultMarks(obtained),
        };
      }

      const chosenList = column.subjectIds
        .map((id) => subjectById.get(id))
        .filter((subject) => subject && isEnrolled(subject.id));

      if (chosenList.length === 0) {
        return {
          id: column.key,
          name: column.label,
          totalMarks: column.totalMarks,
          obtained: null,
          isAbsent: false,
          entered: true,
          applicable: false,
          display: "—",
        };
      }

      const primary = pickElectiveSubject(chosenList, student, markMap);
      const mark = markMap.get(`${student.id}:${primary.id}`);
      const isAbsent = mark?.isAbsent ?? false;
      const raw = isAbsent ? 0 : (mark?.obtainedMarks ?? null);
      const obtained = raw == null ? null : roundResultMarks(raw);
      const entered = Boolean(
        mark && (mark.isAbsent || mark.obtainedMarks != null)
      );
      const totalMarks = primary.totalMarks ?? column.totalMarks;
      return {
        id: primary.id,
        name: primary.name,
        totalMarks,
        obtained,
        isAbsent,
        entered,
        applicable: true,
        display: !entered
          ? "—"
          : isAbsent
            ? "Abs"
            : obtained == null
              ? "—"
              : formatResultMarks(obtained),
      };
    });

    const scored = cells.filter((cell) => cell.applicable);
    // Dash and Abs both count as 0 toward obtained; result is always finalized
    const complete = scored.length > 0;
    const obtainedTotal = roundResultMarks(
      scored.reduce((sum, cell) => {
        // Abs or dash (unentered) → 0
        if (!cell.entered || cell.isAbsent) return sum;
        return sum + (cell.obtained ?? 0);
      }, 0)
    );
    const maxTotal = scored.reduce((sum, cell) => sum + cell.totalMarks, 0);
    const percent =
      maxTotal > 0 ? percentOf(obtainedTotal, maxTotal) : null;
    const passed =
      complete &&
      scored.every((cell) => subjectPasses(cell, input.passPercent)) &&
      percent != null &&
      percent >= input.passPercent;

    return {
      id: student.id,
      rollNumber: student.rollNumber,
      name: student.name,
      fatherName: student.fatherName,
      major: student.major || null,
      group: student.group || null,
      cells,
      obtainedTotal,
      maxTotal,
      percent,
      grade: gradeFromPercent(percent),
      passed,
      complete,
      position: null,
    };
  });

  const ranked = [...rows]
    .filter((row) => row.maxTotal > 0)
    .sort(
      (a, b) =>
        b.obtainedTotal - a.obtainedTotal ||
        sortByRoll(a.rollNumber, b.rollNumber)
    );

  let lastTotal = null;
  let lastPosition = 0;
  for (const row of ranked) {
    if (lastTotal === row.obtainedTotal) {
      row.position = lastPosition;
      continue;
    }
    lastPosition += 1;
    lastTotal = row.obtainedTotal;
    row.position = lastPosition;
  }

  const positionById = new Map(ranked.map((row) => [row.id, row.position]));
  return {
    columns,
    rows: rows
      .map((row) => ({ ...row, position: positionById.get(row.id) ?? null }))
      .sort((a, b) => {
        if (a.position != null && b.position != null) {
          return (
            a.position - b.position || sortByRoll(a.rollNumber, b.rollNumber)
          );
        }
        if (a.position != null) return -1;
        if (b.position != null) return 1;
        return sortByRoll(a.rollNumber, b.rollNumber);
      }),
  };
}

/**
 * Combine multiple exam rounds for one section by summing subject totals
 * and obtained marks (same approach as Test_System).
 *
 * @param {object} input
 * @param {number} input.passPercent
 * @param {string} [input.className]
 * @param {number} [input.gradeLevel]
 * @param {Array} input.students - id, rollNumber, name, fatherName, major, group, enrolledSubjectIds
 * @param {Array} input.rounds - [{ assessments: [{ subjectId, subjectName, totalMarks, marks }] }]
 */
export function compileCombinedSectionResult(input) {
  const subjectAgg = new Map();
  const markAgg = new Map();

  const isEnrolled = (student, subjectId) => {
    const enrolled = student.enrolledSubjectIds || [];
    if (!enrolled.length) return true;
    return enrolled.map(String).includes(String(subjectId));
  };

  for (const round of input.rounds || []) {
    for (const assessment of round.assessments || []) {
      const subjectId = String(assessment.subjectId);
      const totalMarks = Number(assessment.totalMarks) || 0;
      const existing = subjectAgg.get(subjectId);
      if (existing) {
        existing.totalMarks += totalMarks;
        existing.assessmentRounds += 1;
      } else {
        subjectAgg.set(subjectId, {
          id: subjectId,
          name: assessment.subjectName || "Subject",
          totalMarks,
          assessmentRounds: 1,
        });
      }

      const marksByStudent = new Map(
        (assessment.marks || []).map((mark) => [
          String(mark.studentId),
          mark,
        ])
      );

      for (const student of input.students || []) {
        if (!isEnrolled(student, subjectId)) continue;
        const key = `${student.id}:${subjectId}`;
        const mark = marksByStudent.get(String(student.id));
        const entered = Boolean(
          mark && (mark.isAbsent || mark.obtainedMarks != null)
        );
        const current = markAgg.get(key) || {
          obtained: 0,
          zeroRounds: 0, // Abs or dash — both count as 0
          expectedRounds: 0,
        };
        current.expectedRounds += 1;
        // Dash (missing) and Abs both count as 0 toward combined totals
        if (!entered || mark.isAbsent) {
          current.zeroRounds += 1;
        } else {
          current.obtained += Number(mark.obtainedMarks) || 0;
        }
        markAgg.set(key, current);
      }
    }
  }

  const subjects = [...subjectAgg.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  const forcedMarks = [...markAgg.entries()].map(([key, agg]) => {
    const [studentId, subjectId] = key.split(":");
    const allZero =
      agg.expectedRounds > 0 && agg.zeroRounds === agg.expectedRounds;
    return {
      studentId,
      subjectId,
      // All Abs/dash → treat as absent (0); otherwise sum (zeros already excluded)
      obtainedMarks: allZero ? 0 : agg.obtained,
      isAbsent: allZero,
    };
  });

  return compileSectionResult({
    passPercent: input.passPercent,
    className: input.className,
    gradeLevel: input.gradeLevel,
    students: input.students,
    subjects,
    marks: forcedMarks,
  });
}

/**
 * Combined multi-round result with per-round mark breakdown under each subject.
 *
 * @param {object} input — same as compileCombinedSectionResult, but each round
 *   should include { id, label, assessments: [...] }
 */
export function compileMultiRoundSectionResult(input) {
  const rounds = input.rounds || [];
  const combined = compileCombinedSectionResult({
    passPercent: input.passPercent,
    className: input.className,
    gradeLevel: input.gradeLevel,
    students: input.students,
    rounds: rounds.map((round) => ({ assessments: round.assessments })),
  });

  const totalsByRound = new Map();
  const marksByRound = new Map();

  for (const round of rounds) {
    const totals = new Map();
    const marks = new Map();
    for (const assessment of round.assessments || []) {
      const subjectId = String(assessment.subjectId);
      totals.set(subjectId, Number(assessment.totalMarks) || 0);
      for (const mark of assessment.marks || []) {
        marks.set(`${mark.studentId}:${subjectId}`, {
          obtainedMarks: mark.obtainedMarks,
          isAbsent: mark.isAbsent,
        });
      }
    }
    totalsByRound.set(String(round.id), totals);
    marksByRound.set(String(round.id), marks);
  }

  const columnSubjectIds = combined.columns.map((column) =>
    column.kind === "subject" ? [column.subjectId] : column.subjectIds
  );

  const columns = combined.columns.map((column, index) => {
    const subjectIds = columnSubjectIds[index];
    const roundMeta = rounds
      .map((round) => {
        const totals = totalsByRound.get(String(round.id));
        const present = subjectIds
          .map((subjectId) => totals?.get(String(subjectId)))
          .filter((value) => value != null);
        if (!present.length) return null;
        return {
          id: String(round.id),
          label: round.label || "Round",
          totalMarks: Math.max(...present),
        };
      })
      .filter(Boolean);

    return {
      key: column.key,
      label: column.label,
      totalMarks: column.totalMarks,
      kind: column.kind,
      subjectId: column.subjectId,
      subjectIds: column.subjectIds,
      rounds: roundMeta,
    };
  });

  const rows = combined.rows.map((row) => {
    const enrolled = new Set(
      (input.students.find((s) => s.id === row.id)?.enrolledSubjectIds || []).map(
        String
      )
    );

    const breakdown = combined.columns.map((column, index) => {
      const subjectIds = columnSubjectIds[index].map(String);
      const cell = row.cells[index];
      const applicable = cell?.applicable ?? false;

      let chosenSubjectId = null;
      if (column.kind === "subject") {
        chosenSubjectId = subjectIds[0] || null;
      } else if (applicable) {
        // Match the elective chosen in the combined cell (group-aware pick)
        if (cell?.id && !String(cell.id).startsWith("group:")) {
          chosenSubjectId = String(cell.id).includes("+")
            ? String(cell.id).split("+")[0]
            : String(cell.id);
        } else if (enrolled.size > 0) {
          chosenSubjectId =
            subjectIds.find((id) => enrolled.has(id)) || subjectIds[0] || null;
        } else {
          chosenSubjectId = subjectIds[0] || null;
        }
      }

      const roundValues = columns[index].rounds.map((round) => {
        if (!applicable || !chosenSubjectId) {
          return { roundId: round.id, display: "—" };
        }
        const hasAssessment = totalsByRound
          .get(round.id)
          ?.has(chosenSubjectId);
        if (!hasAssessment) {
          return { roundId: round.id, display: "—" };
        }
        const mark = marksByRound
          .get(round.id)
          ?.get(`${row.id}:${chosenSubjectId}`);
        if (mark?.isAbsent) {
          return { roundId: round.id, display: "Abs" };
        }
        if (mark?.obtainedMarks == null) {
          return { roundId: round.id, display: "—" };
        }
        return {
          roundId: round.id,
          display: formatResultMarks(Number(mark.obtainedMarks)),
        };
      });

      return {
        key: column.key,
        roundValues,
        totalDisplay: cell?.display ?? "—",
      };
    });

    return { ...row, breakdown };
  });

  return { columns, rows, multiRound: true };
}

export function appendManualGazetteRows(input) {
  if (!input.manualMarks?.length) return input.rows;

  const subjectById = new Map(input.subjects.map((s) => [s.id, s]));
  const grouped = new Map();

  for (const mark of input.manualMarks) {
    const key = `${mark.rollNumber.trim().toLowerCase()}|${mark.name.trim().toLowerCase()}|${(mark.fatherName || "").trim().toLowerCase()}`;
    let bucket = grouped.get(key);
    if (!bucket) {
      bucket = {
        rollNumber: mark.rollNumber.trim(),
        name: mark.name.trim(),
        fatherName: (mark.fatherName || "").trim(),
        marks: new Map(),
      };
      grouped.set(key, bucket);
    }
    bucket.marks.set(String(mark.subjectId), {
      obtainedMarks: mark.obtainedMarks,
      isAbsent: mark.isAbsent,
    });
  }

  const manualRows = [...grouped.entries()].map(([key, person], index) => {
    const cells = input.columns.map((column) => {
      if (column.kind === "subject") {
        const subject = subjectById.get(column.subjectId);
        const mark = person.marks.get(String(column.subjectId));
        const applicable = Boolean(subject && mark);
        const isAbsent = applicable && (mark?.isAbsent ?? false);
        const raw = !applicable
          ? null
          : isAbsent
            ? 0
            : (mark?.obtainedMarks ?? null);
        const obtained = raw == null ? null : roundResultMarks(raw);
        return {
          id: subject?.id ?? column.subjectId,
          name: subject?.name ?? column.label,
          totalMarks: subject?.totalMarks ?? column.totalMarks,
          obtained,
          isAbsent,
          entered: applicable,
          applicable,
          display: !applicable
            ? "—"
            : isAbsent
              ? "Abs"
              : obtained == null
                ? "—"
                : formatResultMarks(obtained),
        };
      }

      const chosenSubjectId = column.subjectIds.find((id) =>
        person.marks.has(String(id))
      );
      const groupMark = chosenSubjectId
        ? person.marks.get(String(chosenSubjectId))
        : null;
      const subject = chosenSubjectId
        ? subjectById.get(chosenSubjectId)
        : undefined;
      const applicable = Boolean(groupMark && subject);
      const isAbsent = applicable && (groupMark?.isAbsent ?? false);
      const rawGroup = !applicable
        ? null
        : isAbsent
          ? 0
          : (groupMark?.obtainedMarks ?? null);
      const obtained = rawGroup == null ? null : roundResultMarks(rawGroup);
      return {
        id: subject?.id ?? column.key,
        name: subject?.name ?? column.label,
        totalMarks: subject?.totalMarks ?? column.totalMarks,
        obtained,
        isAbsent,
        entered: applicable,
        applicable,
        display: !applicable
          ? "—"
          : isAbsent
            ? "Abs"
            : obtained == null
              ? "—"
              : formatResultMarks(obtained),
      };
    });

    const scored = cells.filter((cell) => cell.applicable);
    const complete = scored.length > 0;
    const obtainedTotal = roundResultMarks(
      scored.reduce((sum, cell) => {
        // Abs or dash → 0
        if (!cell.entered || cell.isAbsent) return sum;
        return sum + (cell.obtained ?? 0);
      }, 0)
    );
    const maxTotal = scored.reduce((sum, cell) => sum + cell.totalMarks, 0);
    const passPercent = Number(input.passPercent) || 33;
    const percent =
      maxTotal > 0 ? percentOf(obtainedTotal, maxTotal) : null;
    const passed =
      complete &&
      scored.every((cell) => subjectPasses(cell, passPercent)) &&
      percent != null &&
      percent >= passPercent;

    return {
      id: `manual:${key}:${index}`,
      rollNumber: person.rollNumber,
      name: person.name,
      fatherName: person.fatherName,
      major: null,
      group: null,
      cells,
      obtainedTotal,
      maxTotal,
      percent,
      grade: gradeFromPercent(percent),
      passed,
      complete,
      position: null,
      isManual: true,
    };
  });

  return [
    ...input.rows,
    ...manualRows.sort((a, b) => sortByRoll(a.rollNumber, b.rollNumber)),
  ];
}

/**
 * Append off-roster students to a multi-round gazette.
 * manualMarks: { rollNumber, name, fatherName, subjectId, roundId, obtainedMarks, isAbsent }
 */
export function appendManualMultiRoundGazetteRows(input) {
  if (!input.manualMarks?.length) return input.rows;

  const rounds = input.rounds || [];
  const passPercent = Number(input.passPercent) || 33;
  const grouped = new Map();

  for (const mark of input.manualMarks) {
    const key = `${String(mark.rollNumber || "").trim().toLowerCase()}|${String(mark.name || "").trim().toLowerCase()}|${String(mark.fatherName || "").trim().toLowerCase()}`;
    let bucket = grouped.get(key);
    if (!bucket) {
      bucket = {
        rollNumber: String(mark.rollNumber || "").trim(),
        name: String(mark.name || "").trim(),
        fatherName: String(mark.fatherName || "").trim(),
        marks: new Map(), // `${roundId}:${subjectId}` -> mark
      };
      grouped.set(key, bucket);
    }
    if (!mark.subjectId || !mark.roundId) continue;
    bucket.marks.set(`${mark.roundId}:${mark.subjectId}`, {
      obtainedMarks: mark.obtainedMarks,
      isAbsent: mark.isAbsent,
    });
  }

  const manualRows = [...grouped.entries()].map(([key, person], index) => {
    const cells = [];
    const breakdown = [];

    for (const column of input.columns || []) {
      const subjectIds =
        column.kind === "subject"
          ? [column.subjectId]
          : column.subjectIds || [];

      const roundMeta = column.rounds || rounds.map((r) => ({
        id: String(r.id),
        label: r.label,
        totalMarks: column.totalMarks,
      }));

      const roundValues = roundMeta.map((round) => {
        const chosenSubjectId = subjectIds.find((subjectId) =>
          person.marks.has(`${round.id}:${subjectId}`)
        );
        if (!chosenSubjectId) {
          return { roundId: round.id, display: "—", entered: false };
        }
        const mark = person.marks.get(`${round.id}:${chosenSubjectId}`);
        if (mark?.isAbsent) {
          return { roundId: round.id, display: "Abs", entered: true, isAbsent: true, obtained: 0, total: round.totalMarks || column.totalMarks };
        }
        if (mark?.obtainedMarks == null) {
          return { roundId: round.id, display: "—", entered: false };
        }
        return {
          roundId: round.id,
          display: formatResultMarks(Number(mark.obtainedMarks)),
          entered: true,
          isAbsent: false,
          obtained: Number(mark.obtainedMarks) || 0,
          total: round.totalMarks || column.totalMarks,
        };
      });

      const expected = roundMeta.length;
      // Dash and Abs both count as 0 for every expected round
      const zeroRounds = roundValues.filter(
        (v) => !v.entered || v.isAbsent
      ).length;
      const allZero = expected > 0 && zeroRounds === expected;
      const allAbsent =
        expected > 0 && roundValues.every((v) => v.isAbsent);
      const obtained = roundValues.reduce(
        (sum, v) => sum + (!v.entered || v.isAbsent ? 0 : v.obtained || 0),
        0
      );
      const totalMarks = roundValues.reduce(
        (sum, v) => sum + (v.total || column.totalMarks || 0),
        0
      );
      const applicable = expected > 0;
      const cell = {
        id: subjectIds[0] || column.key,
        name: column.label,
        totalMarks: applicable ? totalMarks : column.totalMarks,
        obtained: allZero ? 0 : roundResultMarks(obtained),
        isAbsent: allAbsent,
        entered: true, // dash counted like abs — result finalized
        applicable,
        display: allAbsent
          ? "Abs"
          : allZero
            ? "—"
            : formatResultMarks(obtained),
      };
      cells.push(cell);
      breakdown.push({
        key: column.key,
        roundValues: roundValues.map(({ roundId, display }) => ({
          roundId,
          display,
        })),
        totalDisplay: cell.display,
      });
    }

    const scored = cells.filter((cell) => cell.applicable);
    const complete = scored.length > 0;
    const obtainedTotal = roundResultMarks(
      scored.reduce((sum, cell) => {
        if (!cell.entered || cell.isAbsent) return sum;
        return sum + (cell.obtained ?? 0);
      }, 0)
    );
    const maxTotal = scored.reduce((sum, cell) => sum + cell.totalMarks, 0);
    const percent =
      maxTotal > 0 ? percentOf(obtainedTotal, maxTotal) : null;
    const passed =
      complete &&
      scored.every((cell) => subjectPasses(cell, passPercent)) &&
      percent != null &&
      percent >= passPercent;

    return {
      id: `manual:${key}:${index}`,
      rollNumber: person.rollNumber,
      name: person.name,
      fatherName: person.fatherName,
      major: null,
      group: null,
      cells,
      breakdown,
      obtainedTotal,
      maxTotal,
      percent,
      grade: gradeFromPercent(percent),
      passed,
      complete,
      position: null,
      isManual: true,
    };
  });

  return [
    ...input.rows,
    ...manualRows.sort((a, b) => sortByRoll(a.rollNumber, b.rollNumber)),
  ];
}
