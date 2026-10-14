/**
 * Shared P2P design language — aligned with the New UI (tfx / teal) shell.
 * Primary font: Inter → Plus Jakarta Sans → system-ui
 */

export const PM = {
  bg: '#F3F8FB',
  bgAccent: '#E6F6F8',
  card: '#FFFFFF',
  text: '#0F1B2D',
  muted: '#6B7684',
  primary: '#0F6B7A',
  secondary: '#0B5561',
  accent: '#138899',
  link: '#0F6B7A',
  tableText: '#1B2533',
  mutedLabel: '#6B7684',
  total: '#0F6B7A',
  active: '#0F6B7A',
  completed: '#14B87A',
  delayed: '#EF3B4B',
  onTrack: '#14B87A',
  atRisk: '#F58A2A',
  amber: '#F58A2A',
} as const;

/** Soft page wash — matches tasks-fx / dashboard New UI */
export const PM_PAGE_BG =
  'linear-gradient(180deg, #e5f8fd 0%, #f3f8fb 45%, #eef6f8 100%)';

export const PM_HERO_GRADIENT =
  'linear-gradient(135deg, #0F6B7A 0%, #0B5561 55%, #138899 100%)';

export const PM_PRIMARY_GRADIENT =
  'linear-gradient(135deg, #138899 0%, #0B5561 100%)';

/** Soft white card — dashboard KPI / table shell */
export const PM_CARD =
  'relative overflow-hidden rounded-2xl border border-transparent bg-white/95 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]';

export const PM_CARD_HEADER =
  'relative z-[1] flex items-center gap-3 border-b border-slate-100/80 bg-gradient-to-r from-white to-[#e6f6f8]/40 px-4 py-3.5 sm:px-6 sm:py-4';

export const PM_ICON_CHIP =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e6f6f8] text-[#0f6b7a]';

export const PM_ICON_CHIP_SOLID =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e6f6f8] text-[#0f6b7a]';

export const PM_LABEL =
  'mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400';

export const PM_INPUT =
  'box-border h-11 w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#0F172A] placeholder:text-slate-400 outline-none focus:border-[#0f6b7a] focus:ring-2 focus:ring-[#0f6b7a]/30';

export const PM_BTN_PRIMARY =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0f6b7a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0b5561] disabled:opacity-60';

export const PM_BTN_SECONDARY =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] transition-colors hover:border-[#a9dbe2] disabled:opacity-60';

export const PM_TABLE_WRAP =
  'border border-slate-200 rounded-xl overflow-hidden bg-white';

export const PM_TABLE_HEAD =
  'bg-[#edf3f6] border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-[#6B7684]';

export const PM_BADGE_OPEN =
  'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#e6f6f8] text-[#0f6b7a]';

export const PM_BADGE_DONE =
  'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-[#14B87A]';
