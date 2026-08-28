function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function toIso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Indian FY starts 1 April. Returns the April calendar year of the current FY. */
export function fyStartYear(d = new Date()) {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

export function fyLabel(startYear: number) {
  return `FY ${startYear}–${String(startYear + 1).slice(-2)}`;
}

export function fyBounds(startYear: number) {
  return {
    from: new Date(startYear, 3, 1),
    to: new Date(startYear + 1, 2, 31),
  };
}

export function formatShort(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export type PeriodKind = 'today' | 'mtd' | 'qtd' | 'this_fy';
export type Granularity = 'weekly' | 'monthly' | 'year' | 'custom';

export function indianQuarterStart(d = new Date()) {
  const m = d.getMonth();
  if (m >= 3 && m <= 5) return new Date(d.getFullYear(), 3, 1);
  if (m >= 6 && m <= 8) return new Date(d.getFullYear(), 6, 1);
  if (m >= 9 && m <= 11) return new Date(d.getFullYear(), 9, 1);
  return new Date(d.getFullYear(), 0, 1);
}

export function weekStartMonday(d = new Date()) {
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
}

export function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function monthEnd(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function rangeForKind(kind: PeriodKind, today = startOfDay()) {
  const fy = fyStartYear(today);
  if (kind === 'today') return { from: toIso(today), to: toIso(today) };
  if (kind === 'mtd') return { from: toIso(monthStart(today)), to: toIso(today) };
  if (kind === 'qtd') return { from: toIso(indianQuarterStart(today)), to: toIso(today) };
  return { from: toIso(fyBounds(fy).from), to: toIso(today) };
}

export function rangeForFy(startYear: number, today = startOfDay()) {
  const { from, to } = fyBounds(startYear);
  const end = today < to ? today : to;
  const current = fyStartYear(today) === startYear;
  return {
    from: toIso(from),
    to: toIso(current ? today : to),
    current,
    label: fyLabel(startYear),
    sub: current ? `${formatShort(toIso(from))} → Today` : `${formatShort(toIso(from))} → ${formatShort(toIso(to))}`,
  };
}

export function fyOptions(today = startOfDay(), count = 8) {
  const current = fyStartYear(today);
  return Array.from({ length: count }, (_, i) => rangeForFy(current - i, today));
}

export function monthOptions(today = startOfDay(), count = 12) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const from = monthStart(d);
    const end = monthEnd(d);
    const isCurrent = from.getFullYear() === today.getFullYear() && from.getMonth() === today.getMonth();
    const to = isCurrent ? today : end;
    return {
      key: toIso(from),
      label: from.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      sub: isCurrent ? `${formatShort(toIso(from))} → Today` : `${formatShort(toIso(from))} → ${formatShort(toIso(end))}`,
      from: toIso(from),
      to: toIso(to),
      current: isCurrent,
    };
  });
}

export function weekOptions(today = startOfDay(), count = 12) {
  const start = weekStartMonday(today);
  return Array.from({ length: count }, (_, i) => {
    const from = new Date(start.getFullYear(), start.getMonth(), start.getDate() - i * 7);
    const end = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6);
    const isCurrent = i === 0;
    const to = isCurrent ? today : end;
    return {
      key: toIso(from),
      label: `Week of ${formatShort(toIso(from))}`,
      sub: isCurrent ? `${formatShort(toIso(from))} → Today` : `${formatShort(toIso(from))} → ${formatShort(toIso(end))}`,
      from: toIso(from),
      to: toIso(to),
      current: isCurrent,
    };
  });
}

export function defaultFyFilter() {
  const r = rangeForKind('this_fy');
  return { dateFrom: r.from, dateTo: r.to };
}

export function periodButtonLabel(from: string, to: string, today = startOfDay()) {
  const current = fyStartYear(today);
  const fy = rangeForFy(current, today);
  if (from === fy.from && (to === fy.to || to === toIso(today))) return fy.label;
  const todayIso = toIso(today);
  if (from === todayIso && to === todayIso) return 'Today';
  const mtd = rangeForKind('mtd', today);
  if (from === mtd.from && to === mtd.to) return 'MTD';
  const qtd = rangeForKind('qtd', today);
  if (from === qtd.from && to === qtd.to) return 'QTD';
  if (from && to) {
    const match = fyOptions(today).find((y) => y.from === from && (y.to === to || (y.current && to === todayIso)));
    if (match) return match.label;
  }
  if (from && to) return `${formatShort(from)} – ${formatShort(to)}`;
  return 'All dates';
}
