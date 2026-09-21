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

/** Soft blue wash behind white cards */
export const PM_PAGE_BG =
  'linear-gradient(165deg, #EEF4FF 0%, #F3F6FB 42%, #F3F6FB 100%)';

export const PM_HERO_GRADIENT =
  'linear-gradient(135deg, #1E88E5 0%, #1565C0 55%, #2B5AED 100%)';

export const PM_PRIMARY_GRADIENT =
  'linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)';

/** White card shell — dashboard style */
export const PM_CARD =
  'bg-white border border-slate-200/80 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-shadow overflow-hidden';

export const PM_CARD_HEADER =
  'flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 bg-[#EEF4FF]/50';

export const PM_ICON_CHIP =
  'w-8 h-8 flex items-center justify-center rounded-lg bg-[#E3F2FD] text-[#1E88E5] shrink-0';

export const PM_ICON_CHIP_SOLID =
  'w-8 h-8 flex items-center justify-center rounded-lg bg-[#1E88E5] text-white shrink-0';

export const PM_LABEL =
  'block text-xs font-semibold text-[#7F8C8D] uppercase tracking-wider mb-2';

export const PM_INPUT =
  'w-full min-w-0 max-w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/30 focus:border-[#1E88E5] bg-white box-border';

export const PM_BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#1E88E5] hover:bg-[#1565C0] shadow-sm transition-colors cursor-pointer disabled:opacity-60';

export const PM_BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-60';

export const PM_TABLE_WRAP =
  'border border-slate-200 rounded-xl overflow-hidden bg-white';

export const PM_TABLE_HEAD =
  'bg-[#F8FAFC] border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-[#7F8C8D]';

export const PM_BADGE_OPEN =
  'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#E3F2FD] text-[#1E88E5]';

export const PM_BADGE_DONE =
  'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-[#43A047]';
