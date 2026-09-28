import type { PrStatusFilter } from './RequesterPrMobileFilters';

export type RequesterStatCard = {
  title: string;
  value: number;
  icon: string;
  filter: PrStatusFilter;
  wash?: string;
  accent?: string;
  iconBg?: string;
};

/**
 * Soft white cards + pastel top-right wash (leads-style dashboard).
 */
const KPI_THEME = {
  all: {
    value: '#2563EB',
    iconBg: '#DBEAFE',
    wash: 'rgba(37, 99, 235, 0.14)',
    selectedBorder: 'border-[#93C5FD]',
  },
  pending_approval: {
    value: '#06B6D4',
    iconBg: '#CFFAFE',
    wash: 'rgba(6, 182, 212, 0.14)',
    selectedBorder: 'border-[#67E8F9]',
  },
  approved: {
    value: '#10B981',
    iconBg: '#D1FAE5',
    wash: 'rgba(16, 185, 129, 0.14)',
    selectedBorder: 'border-[#6EE7B7]',
  },
  rejected: {
    value: '#F43F5E',
    iconBg: '#FFE4E6',
    wash: 'rgba(244, 63, 94, 0.12)',
    selectedBorder: 'border-[#FDA4AF]',
  },
  draft: {
    value: '#8B5CF6',
    iconBg: '#EDE9FE',
    wash: 'rgba(139, 92, 246, 0.14)',
    selectedBorder: 'border-[#C4B5FD]',
  },
  returned: {
    value: '#F97316',
    iconBg: '#FFEDD5',
    wash: 'rgba(249, 115, 22, 0.14)',
    selectedBorder: 'border-[#FDBA74]',
  },
} as const;

export default function RequesterStatCards({
  cards,
  selectedFilter,
  onSelect,
}: {
  cards: RequesterStatCard[];
  selectedFilter: PrStatusFilter;
  onSelect: (filter: PrStatusFilter) => void;
}) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const selected = selectedFilter === card.filter;
        const theme = KPI_THEME[card.filter] || KPI_THEME.all;

        return (
          <button
            key={card.title}
            type="button"
            onClick={() => onSelect(card.filter)}
            aria-pressed={selected}
            title={`View ${card.title} in table`}
            className={`
              group relative box-border flex h-full min-h-[128px] w-full cursor-pointer flex-col overflow-hidden
              rounded-2xl bg-white p-4 text-left sm:min-h-[140px] sm:rounded-[18px] sm:p-5
              shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]
              border transition-[box-shadow,border-color,transform] duration-200 ease-out
              hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)]
              ${selected ? theme.selectedBorder : 'border-transparent'}
            `}
          >
            {/* Soft pastel wash from top-right (matches reference cards) */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(120% 90% at 100% 0%, ${theme.wash} 0%, rgba(255,255,255,0) 55%)`,
              }}
            />

            <div className="relative z-[1] flex flex-1 items-start justify-between gap-3">
              <div className="min-w-0 flex-1 self-start">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px]">
                  {card.title}
                </p>
                <p
                  className="mt-2 text-3xl font-bold tabular-nums leading-none tracking-tight sm:mt-3 sm:text-[2.15rem]"
                  style={{ color: theme.value }}
                >
                  {Number(card.value) || 0}
                </p>
              </div>

              <div
                className="relative flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-xl sm:h-11 sm:w-11"
                style={{ backgroundColor: theme.iconBg, color: theme.value }}
              >
                <i className={`${card.icon} text-lg sm:text-xl`} aria-hidden />
              </div>
            </div>

            <span
              className="relative mt-auto inline-flex items-center gap-1 pt-3 text-[12px] font-semibold text-[#6366F1]
                opacity-0 translate-y-1 transition-all duration-200
                group-hover:translate-y-0 group-hover:opacity-100"
            >
              Click to view
              <i className="ri-arrow-right-line text-sm" aria-hidden />
            </span>
          </button>
        );
      })}
    </div>
  );
}
