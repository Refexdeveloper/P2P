const IST = 'Asia/Kolkata';

/** Parse API dates. Server formatDateTime uses en-IN (DD/MM/YYYY), which `new Date()` reads as US MM/DD. */
export function parseAppDate(value: string | Date | number | null | undefined): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const raw = String(value).trim();
  if (!raw || raw === '—' || raw === '-') return null;

  const dmy = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i
  );
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let hour = dmy[4] != null ? Number(dmy[4]) : 0;
      const minute = dmy[5] != null ? Number(dmy[5]) : 0;
      const second = dmy[6] != null ? Number(dmy[6]) : 0;
      const ampm = dmy[7]?.toLowerCase();
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      const iso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+05:30`;
      const parsed = new Date(iso);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  const mysql = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (mysql) {
    const parsed = new Date(
      `${mysql[1]}-${mysql[2]}-${mysql[3]}T${mysql[4]}:${mysql[5]}:${mysql[6] || '00'}+05:30`
    );
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const parsed = new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00+05:30`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function formatDisplayDate(value: string | Date | number | null | undefined): string {
  const d = parseAppDate(value);
  if (!d) return value ? String(value) : '—';
  return d.toLocaleDateString('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDisplayDateTime(value: string | Date | number | null | undefined): string {
  const d = parseAppDate(value);
  if (!d) return value ? String(value) : '—';
  return d.toLocaleString('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}
