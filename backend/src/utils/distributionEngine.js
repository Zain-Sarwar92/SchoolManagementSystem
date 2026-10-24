/** Port of _compare_Test_System/src/lib/distribution/engine.ts */

export function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildTopicUsage(questions) {
  const usage = {};
  for (const q of questions) {
    usage[q.topicId] = (usage[q.topicId] ?? 0) + 1;
  }
  return usage;
}

export function selectBalanced(pool, count, topicUsage = {}) {
  if (count <= 0 || pool.length === 0) return [];

  const byTopic = new Map();
  for (const q of shuffle(pool)) {
    const list = byTopic.get(q.topicId) ?? [];
    list.push(q);
    byTopic.set(q.topicId, list);
  }

  const topicIds = [...byTopic.keys()];
  const pointers = new Map(topicIds.map((id) => [id, 0]));
  const usage = new Map(topicIds.map((id) => [id, topicUsage[id] ?? 0]));
  const selected = [];

  while (selected.length < count) {
    const available = topicIds.filter(
      (id) => (pointers.get(id) ?? 0) < (byTopic.get(id)?.length ?? 0)
    );
    if (available.length === 0) break;

    const minUsage = Math.min(...available.map((id) => usage.get(id) ?? 0));
    const round = shuffle(
      available.filter((id) => (usage.get(id) ?? 0) === minUsage)
    );

    for (const topicId of round) {
      if (selected.length >= count) break;
      const list = byTopic.get(topicId);
      const idx = pointers.get(topicId) ?? 0;
      selected.push(list[idx]);
      pointers.set(topicId, idx + 1);
      usage.set(topicId, (usage.get(topicId) ?? 0) + 1);
    }
  }

  return selected;
}

export function selectRandom(pool, count) {
  return shuffle(pool).slice(0, Math.max(0, count));
}

export function selectQuestions(pool, count, mode, options = {}) {
  const uniquePool = [...new Map(pool.map((q) => [String(q.id), q])).values()];
  const topicUsage = options.topicUsage;
  const hasSessionUsage = Boolean(
    topicUsage && Object.keys(topicUsage).length > 0
  );
  if (mode === "RANDOM" && !hasSessionUsage) {
    return selectRandom(uniquePool, count);
  }
  return selectBalanced(uniquePool, count, topicUsage ?? {});
}

export function selectByChapterQuotas(pool, quotas, mode, options = {}) {
  const selected = [];
  const used = new Set();
  const topicUsage = { ...(options.topicUsage ?? {}) };

  for (const quota of quotas) {
    const chapterPool = pool.filter(
      (q) =>
        String(q.chapterId) === String(quota.chapterId) && !used.has(String(q.id))
    );
    const picks = selectQuestions(chapterPool, quota.count, mode, {
      topicUsage,
    });
    for (const p of picks) {
      selected.push(p);
      used.add(String(p.id));
      topicUsage[p.topicId] = (topicUsage[p.topicId] ?? 0) + 1;
    }
  }

  return selected;
}
