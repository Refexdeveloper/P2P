/**
 * Project Management design language — shared by Create PR and PM screens.
 * Primary font: Inter → Plus Jakarta Sans → system-ui
 */

export const PM = {
  bg: '#F3F6FB',
  bgAccent: '#EEF4FF',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  primary: '#1E88E5',
  secondary: '#1565C0',
  accent: '#2B5AED',
  link: '#1E62F0',
  tableText: '#2C3E50',
  mutedLabel: '#7F8C8D',
  total: '#2B5AED',
  active: '#0084AD',
  completed: '#22C55E',
  delayed: '#EF4444',
  onTrack: '#43A047',
  atRisk: '#FB8C00',
  amber: '#F59E0B',
} as const;

/** Soft pastel wash — matches requester dashboard */
export const PM_PAGE_BG =
  'linear-gradient(180deg, #edf1ff 0%, #f6f8ff 45%, #f2ecff 100%)';

export const PM_HERO_GRADIENT =
  'linear-gradient(135deg, #1E88E5 0%, #1565C0 55%, #2B5AED 100%)';

export const PM_PRIMARY_GRADIENT =
  'linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)';

/** Soft white card — dashboard KPI / table shell */
export const PM_CARD =
  'relative overflow-hidden rounded-2xl border border-transparent bg-white/95 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]';

export const PM_CARD_HEADER =
  'relative z-[1] flex items-center gap-3 border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/40 px-4 py-3.5 sm:px-6 sm:py-4';

export const PM_ICON_CHIP =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E3F2FD] text-[#1E88E5]';

export const PM_ICON_CHIP_SOLID =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E3F2FD] text-[#1E88E5]';

export const PM_LABEL =
  'mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400';

export const PM_INPUT =
  'box-border h-11 w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#0F172A] placeholder:text-slate-400 outline-none focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/30';


export const PM_BTN_PRIMARY =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#1E88E5] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1565C0] disabled:opacity-60';

export const PM_BTN_SECONDARY =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] transition-colors hover:border-[#90CAF9] disabled:opacity-60';

export const PM_TABLE_WRAP =
  'border border-slate-200 rounded-xl overflow-hidden bg-white';

export const PM_TABLE_HEAD =
  'bg-[#F8FAFC] border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-[#7F8C8D]';

export const PM_BADGE_OPEN =
  'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#E3F2FD] text-[#1E88E5]';

export const PM_BADGE_DONE =
  'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-[#43A047]';
