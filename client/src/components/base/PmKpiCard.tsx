import { ReactNode } from 'react';
import { PM } from '../../constants/pmTheme';

export type PmKpiTone =
  | 'total'
  | 'active'
  | 'completed'
  | 'delayed'
  | 'open'
  | 'atRisk'
  | 'amber'
  | 'subtasks'
  | 'neutral';

const TONE: Record<
  PmKpiTone,
  { fg: string; soft: string; bar: string }
> = {
  total: { fg: PM.total, soft: '#EEF2FF', bar: PM.total },
  active: { fg: PM.active, soft: '#E0F7FA', bar: PM.active },
  completed: { fg: PM.completed, soft: '#ECFDF5', bar: PM.completed },
  delayed: { fg: PM.delayed, soft: '#FEF2F2', bar: PM.delayed },
  open: { fg: PM.primary, soft: '#E3F2FD', bar: PM.primary },
  atRisk: { fg: PM.atRisk, soft: '#FFF7ED', bar: PM.atRisk },
  amber: { fg: PM.amber, soft: '#FFFBEB', bar: PM.amber },
  subtasks: { fg: '#8B5CF6', soft: '#F5F3FF', bar: '#8B5CF6' },
  neutral: { fg: PM.muted, soft: '#F1F5F9', bar: PM.muted },
};

export type PmKpiCardProps = {
  title: string;
  value: ReactNode;
  icon: string;
  tone?: PmKpiTone;
  /** Secondary line under the value */
  subtitle?: ReactNode;
  /** Trend / delta line (e.g. "+100% from last quarter") */
  delta?: ReactNode;
  deltaTone?: 'up' | 'down' | 'flat';
  /** 0–100 progress fill */
  progress?: number;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
  titleAttr?: string;
};

/**
 * Project-dashboard style KPI card:
 * uppercase muted label, tinted icon chip, large tabular value, optional progress.
 */
export default function PmKpiCard({
  title,
  value,
  icon,
  tone = 'neutral',
  subtitle,
  delta,
  deltaTone = 'flat',
  progress,
  onClick,
  selected = false,
  className = '',
  titleAttr,
}: PmKpiCardProps) {
  const t = TONE[tone] || TONE.neutral;
  const Tag = onClick ? 'button' : 'div';
  const progressPct =
    typeof progress === 'number' && Number.isFinite(progress)
      ? Math.max(0, Math.min(100, progress))
      : null;

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={titleAttr}
      className={[
        'group relative text-left w-full bg-white border rounded-2xl',
        'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        'hover:shadow-[0_10px_28px_rgba(15,23,42,0.07)] hover:-translate-y-px',
        'transition-all duration-200 px-4 sm:px-5 py-4 sm:py-5 min-h-[118px] flex flex-col',
        selected
          ? 'border-[#1E88E5] ring-2 ring-[#1E88E5]/25'
          : 'border-slate-200/80 hover:border-slate-300',
        onClick ? 'cursor-pointer' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] leading-tight pt-0.5">
          {title}
        </p>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: t.soft, color: t.fg }}
        >
          <i className={`${icon} text-lg`} aria-hidden />
        </div>
      </div>

      <p className="mt-3 text-[1.65rem] sm:text-[1.85rem] font-bold text-[#0F172A] leading-none tracking-tight tabular-nums">
        {value}
      </p>

      {(subtitle || delta) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 min-h-[1.1rem]">
          {subtitle ? (
            <span className="text-xs font-medium text-[#64748B]">{subtitle}</span>
          ) : null}
          {delta ? (
            <span
              className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${
                deltaTone === 'up'
                  ? 'text-[#43A047]'
                  : deltaTone === 'down'
                    ? 'text-[#E53935]'
                    : 'text-[#64748B]'
              }`}
            >
              {deltaTone === 'up' ? (
                <i className="ri-arrow-up-line text-[10px]" />
              ) : deltaTone === 'down' ? (
                <i className="ri-arrow-down-line text-[10px]" />
              ) : null}
              {delta}
            </span>
          ) : null}
        </div>
      )}

      {progressPct != null ? (
        <div className="mt-auto pt-3">
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%`, backgroundColor: t.bar }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-auto" />
      )}
    </Tag>
  );
}
