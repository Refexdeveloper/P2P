export type TaskStatFilter =
  | 'all'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'overdue';

export type TaskStatCard = {
  title: string;
  value: number;
  icon: string;
  filter: TaskStatFilter;
};

/**
 * Soft white cards + pastel top-right wash (matches requester dashboard).
 */
const KPI_THEME: Record<
  TaskStatFilter,
  { value: string; iconBg: string; wash: string; selectedBorder: string }
> = {
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
  returned: {
    value: '#F97316',
    iconBg: '#FFEDD5',
    wash: 'rgba(249, 115, 22, 0.14)',
    selectedBorder: 'border-[#FDBA74]',
  },
  overdue: {
    value: '#F97316',
    iconBg: '#FFEDD5',
    wash: 'rgba(249, 115, 22, 0.14)',
    selectedBorder: 'border-[#FDBA74]',
  },
};

export default function TaskStats({
  cards,
  selectedFilter,
  onSelect,
}: {
  cards: TaskStatCard[];
  selectedFilter: string;
  onSelect: (filter: TaskStatFilter) => void;
}) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
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
              group relative box-border flex h-full min-h-[92px] w-full cursor-pointer flex-col overflow-hidden
              rounded-2xl bg-white p-3.5 text-left sm:min-h-[100px] sm:rounded-[18px] sm:p-4
              shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]
              border transition-[box-shadow,border-color,transform] duration-200 ease-out
              hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)]
              ${selected ? theme.selectedBorder : 'border-transparent'}
            `}
          >
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
                  className="mt-1.5 text-2xl font-bold tabular-nums leading-none tracking-tight sm:text-3xl"
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

            <span className="sr-only">Click to view {card.title}</span>
          </button>
        );
      })}
    </div>
  );
}
