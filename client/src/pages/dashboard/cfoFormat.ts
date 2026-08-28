export const CARD =
  'bg-white border border-[#EEF0F5] rounded-[16px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:shadow-[0_10px_28px_rgba(16,24,40,0.06)] hover:-translate-y-px transition-all duration-200';

export function formatCompactInr(value: number) {
  const n = Number(value || 0);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(n >= 100000000 ? 1 : 2)}Cr`;
  if (n >= 100000) {
    const lakhs = n / 100000;
    return `₹${lakhs >= 10 ? lakhs.toFixed(1) : lakhs.toFixed(1)}L`;
  }
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatFullInr(value: number) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function monthOverMonth(current: number, previous: number, vsLabel = 'prior month') {
  if (!Number.isFinite(previous) || previous === 0) {
    if (!current) return { label: `-- 0% vs ${vsLabel}`, up: true, flat: true };
    return { label: `New vs ${vsLabel}`, up: true, flat: false };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.abs(pct) < 0.05 ? 0 : pct;
  return {
    label: `${rounded >= 0 ? '+' : ''}${rounded.toFixed(1)}% vs ${vsLabel}`,
    up: rounded >= 0,
    flat: rounded === 0,
  };
}

export function lastDayOfYm(ym: string) {
  const [y, m] = String(ym || '').split('-').map(Number);
  if (!y || !m) return '';
  const d = new Date(y, m, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseLooseDate(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const iso = Date.parse(raw);
  if (!Number.isNaN(iso)) return new Date(iso);
  const m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

export function formatRangeLabel(from: string, to: string) {
  const fmt = (d: string) => {
    if (!d) return '';
    const dt = new Date(`${d}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  if (!from && !to) return 'All dates';
  return `${fmt(from) || 'Start'} - ${fmt(to) || 'End'}`;
}

export function daysUntil(dateStr: string) {
  const d = parseLooseDate(dateStr);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}
