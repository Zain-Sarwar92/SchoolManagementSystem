export function parseYmd(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isSunday(date) {
  return date.getDay() === 0;
}

export function addWorkingDays(start, count) {
  const date = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  if (count === 0) return date;
  if (count > 0) {
    let added = 0;
    while (added < count) {
      date.setDate(date.getDate() + 1);
      if (!isSunday(date)) added += 1;
    }
    return date;
  }
  let remaining = -count;
  while (remaining > 0) {
    date.setDate(date.getDate() - 1);
    if (!isSunday(date)) remaining -= 1;
  }
  return date;
}

export function addWorkingDaysYmd(ymd, count) {
  return formatYmd(addWorkingDays(parseYmd(ymd), count));
}
