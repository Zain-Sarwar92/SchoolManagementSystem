const fs = require("fs");
const data = require("./_canvas-data.json");

const slim = data.map((s) => ({
  slug: s.slug,
  name: s.name,
  total: s.total,
  mcq: s.mcq,
  short: s.short,
  long: s.long,
  fields: s.fields,
  chapters: s.chapters.map((c) => ({
    n: c.n,
    t: c.t,
    topics: c.topics,
    total: c.total,
    mcq: c.mcq,
    short: c.short,
    long: c.long,
    fields: c.fields,
    topicNames: c.topicNames,
  })),
}));

const FIELD_LABELS = {
  MCQ: "Multiple Choice",
  QA: "Q/A (Short)",
  LONG: "Long",
  SPELLING: "Spelling",
  MEANING: "Meaning",
  VERB: "Verb",
  GRAMMAR: "Grammar",
  TRANSLATE_EN: "Translate EN",
  TRANSLATE_UR: "Translate UR",
  VOICE: "Voice",
  IDIOM: "Idioms",
  SUMMARY: "Summary",
  POEM_STANZA: "Poem Stanzas",
  POEM: "Poem",
  PASSAGE: "Passage",
  CORRECT: "Correct sentences",
  APPLICATION: "Application",
  CENTRAL: "Central idea",
  HADITH: "Hadith",
  PERSONALITY: "Personality",
  AYAT: "Ayat",
  WORD: "Word meaning",
  LETTER: "Letter",
  STORY: "Story",
  DIALOGUE: "Dialogue",
};

const totalQ = slim.reduce((a, s) => a + s.total, 0);
const totalCh = slim.reduce((a, s) => a + s.chapters.length, 0);
const totalTp = slim.reduce(
  (a, s) => a + s.chapters.reduce((b, c) => b + c.topics, 0),
  0
);

const canvas = `import {
  Button,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Select,
  Stack,
  Stat,
  Table,
  Text,
  useHostTheme,
  useMemo,
  useState,
} from "cursor/canvas";

const SEED = ${JSON.stringify(slim)} as const;

const FIELD_LABELS: Record<string, string> = ${JSON.stringify(FIELD_LABELS)};

function fieldLabel(key: string) {
  return FIELD_LABELS[key] || key;
}

export default function PtsClass9SeedDetail() {
  const theme = useHostTheme();
  const [slug, setSlug] = useState(SEED[0]?.slug ?? "biology");
  const [showTopics, setShowTopics] = useState(true);

  const subject = useMemo(
    () => SEED.find((s) => s.slug === slug) ?? SEED[0],
    [slug],
  );

  const overviewRows = useMemo(
    () =>
      SEED.map((s) => [
        s.name,
        s.chapters.length,
        s.chapters.reduce((n, c) => n + c.topics, 0),
        s.total,
        s.mcq,
        s.short,
        s.long,
        Object.keys(s.fields).length,
      ]),
    [],
  );

  const fieldRows = useMemo(() => {
    if (!subject) return [] as Array<Array<string | number>>;
    return Object.entries(subject.fields)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .map(([k, n]) => [
        fieldLabel(k),
        k,
        n as number,
        subject.total
          ? Math.round(((n as number) / subject.total) * 100) + "%"
          : "0%",
      ]);
  }, [subject]);

  const chapterRows = useMemo(() => {
    if (!subject) return [] as Array<Array<string | number>>;
    return subject.chapters.map((c) => [
      c.n,
      c.t,
      c.topics,
      c.total,
      c.mcq,
      c.short,
      c.long,
    ]);
  }, [subject]);

  const topicRows = useMemo(() => {
    if (!subject || !showTopics) return [] as Array<Array<string | number>>;
    const rows: Array<Array<string | number>> = [];
    for (const c of subject.chapters) {
      for (const name of c.topicNames) {
        rows.push([c.n, name]);
      }
    }
    return rows;
  }, [subject, showTopics]);

  if (!subject) return null;

  return (
    <Stack gap={20} style={{ padding: 20 }}>
      <Stack gap={6}>
        <H1>PTB Class 9 — Live PTS Seed Detail</H1>
        <Text tone="secondary" size="small">
          Source: backend/data/lahore-board/9th (_live-seed-summary + syllabus +
          all-questions) · seeded 2026-10-17 · board Punjab Textbook
        </Text>
      </Stack>

      <Row gap={16} wrap>
        <Stat value={String(SEED.length)} label="Subjects" />
        <Stat value={"${totalCh}"} label="Chapters" />
        <Stat value={"${totalTp}"} label="Topics" />
        <Stat
          value={"${totalQ.toLocaleString()}"}
          label="Questions"
          tone="accent"
        />
      </Row>

      <Stack gap={8}>
        <H2>All subjects overview</H2>
        <Text tone="secondary" size="small">
          Pick a subject below to drill into chapters, topics, and question
          types.
        </Text>
        <Table
          headers={[
            "Subject",
            "Ch",
            "Topics",
            "Total Q",
            "MCQ",
            "Short",
            "Long",
            "Q Types",
          ]}
          rows={overviewRows}
          columnAlign={[
            "left",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
          ]}
          striped
          stickyHeader
        />
      </Stack>

      <Divider />

      <Stack gap={10}>
        <Row gap={12} align="center" wrap>
          <H2>Subject drill-down</H2>
          <Select
            value={slug}
            onChange={setSlug}
            options={SEED.map((s) => ({
              value: s.slug,
              label: s.name + " (" + s.total + ")",
            }))}
          />
          <Pill active>{subject.total.toLocaleString()} questions</Pill>
          <Pill>{subject.chapters.length} chapters</Pill>
          <Pill>
            {subject.chapters.reduce((n, c) => n + c.topics, 0)} topics
          </Pill>
        </Row>
        <Text tone="secondary" size="small">
          UI paper generator now lists these question types with counts and
          filters related questions by subtype.
        </Text>
      </Stack>

      <Grid columns={2} gap={16}>
        <Stack gap={8}>
          <H3>Question types (field / subtype)</H3>
          <Table
            headers={["Type", "Code", "Count", "%"]}
            rows={fieldRows}
            columnAlign={["left", "left", "right", "right"]}
            striped
          />
        </Stack>

        <Stack gap={12}>
          <H3>Bank split</H3>
          <Row gap={12} wrap>
            <Stat value={String(subject.mcq)} label="MCQ" />
            <Stat value={String(subject.short)} label="Short" />
            <Stat value={String(subject.long)} label="Long" />
          </Row>
          <H3>Type chips</H3>
          <Row gap={8} wrap>
            {Object.entries(subject.fields)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .map(([k, n]) => (
                <Pill key={k}>
                  {fieldLabel(k)} · {n as number}
                </Pill>
              ))}
          </Row>
        </Stack>
      </Grid>

      <Stack gap={8}>
        <H2>Chapters — {subject.name}</H2>
        <Table
          headers={["#", "Chapter", "Topics", "Total", "MCQ", "Short", "Long"]}
          rows={chapterRows}
          columnAlign={[
            "right",
            "left",
            "right",
            "right",
            "right",
            "right",
            "right",
          ]}
          striped
          stickyHeader
        />
      </Stack>

      <Stack gap={8}>
        <Row gap={12} align="center" wrap>
          <H2>Topics — {subject.name}</H2>
          <Button
            variant="secondary"
            onClick={() => setShowTopics((v) => !v)}
          >
            {showTopics ? "Hide topics" : "Show topics"}
          </Button>
        </Row>
        {showTopics ? (
          <Table
            headers={["Ch", "Topic"]}
            rows={topicRows}
            columnAlign={["right", "left"]}
            striped
            stickyHeader
          />
        ) : null}
      </Stack>

      <Text tone="secondary" size="small" style={{ color: theme.text.secondary }}>
        Grand total ${totalQ}. English / Urdu / Islamiyat / Punjabi / Tarjuma
        have extra subtypes beyond MCQ·Short·Long — those now appear in the
        paper generator question menu with counts.
      </Text>
    </Stack>
  );
}
`;

const outPath =
  "c:/Users/zain4/.cursor/projects/c-Users-zain4-Desktop-School-Management-system/canvases/pts-class9-seed-detail.canvas.tsx";
fs.writeFileSync(outPath, canvas);
console.log("wrote", outPath, "bytes", canvas.length);
