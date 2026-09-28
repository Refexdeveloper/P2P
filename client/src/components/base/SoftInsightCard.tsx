import type { ReactNode } from 'react';

/** Same pastel wash cards as the requester dashboard PR Insights. */
export const INSIGHT_THEMES = {
  blue: {
    value: '#2563EB',
    iconBg: '#DBEAFE',
    wash: 'rgba(37, 99, 235, 0.14)',
    selectedBorder: 'border-[#93C5FD]',
  },
  cyan: {
    value: '#06B6D4',
    iconBg: '#CFFAFE',
    wash: 'rgba(6, 182, 212, 0.14)',
    selectedBorder: 'border-[#67E8F9]',
  },
  green: {
    value: '#10B981',
    iconBg: '#D1FAE5',
    wash: 'rgba(16, 185, 129, 0.14)',
    selectedBorder: 'border-[#6EE7B7]',
  },
  rose: {
    value: '#F43F5E',
    iconBg: '#FFE4E6',
    wash: 'rgba(244, 63, 94, 0.12)',
    selectedBorder: 'border-[#FDA4AF]',
  },
  violet: {
    value: '#8B5CF6',
    iconBg: '#EDE9FE',
    wash: 'rgba(139, 92, 246, 0.14)',
    selectedBorder: 'border-[#C4B5FD]',
  },
  orange: {
    value: '#F97316',
    iconBg: '#FFEDD5',
    wash: 'rgba(249, 115, 22, 0.14)',
    selectedBorder: 'border-[#FDBA74]',
  },
} as const;

export type InsightThemeName = keyof typeof INSIGHT_THEMES;

export const INSIGHT_THEME_CYCLE: InsightThemeName[] = [
  'blue',
  'cyan',
  'green',
  'rose',
  'violet',
  'orange',
];

export default function SoftInsightCard({
  title,
  value,
  icon,
  theme = 'blue',
  subtitle,
  selected = false,
  onClick,
}: {
  title: string;
  value: ReactNode;
  icon: string;
  theme?: InsightThemeName;
  subtitle?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const palette = INSIGHT_THEMES[theme];
  const className = `
    group relative box-border flex h-full min-h-[128px] w-full flex-col overflow-hidden
    rounded-2xl bg-white p-4 text-left sm:min-h-[140px] sm:rounded-[18px] sm:p-5
    shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]
    border transition-[box-shadow,border-color] duration-200 ease-out
    hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)]
    ${selected ? palette.selectedBorder : 'border-transparent'}
    ${onClick ? 'cursor-pointer' : ''}
  `;

  const body = (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 100% 0%, ${palette.wash} 0%, rgba(255,255,255,0) 55%)`,
        }}
      />
      <div className="relative z-[1] flex flex-1 items-start justify-between gap-3">
        <div className="min-w-0 flex-1 self-start">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px]">
            {title}
          </p>
          <p
            className="mt-2 break-words text-3xl font-bold tabular-nums leading-none tracking-tight sm:mt-3 sm:text-[2.15rem]"
            style={{ color: palette.value }}
          >
            {value}
          </p>
          {subtitle ? <p className="mt-2 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <div
          className="relative flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-xl sm:h-11 sm:w-11"
          style={{ backgroundColor: palette.iconBg, color: palette.value }}
        >
          <i className={`${icon} text-lg sm:text-xl`} aria-hidden />
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}
