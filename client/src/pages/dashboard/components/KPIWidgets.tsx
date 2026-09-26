import { formatCompactInr, formatFullInr, monthOverMonth } from '../cfoFormat';

type Kpis = {
  totalPOAmount: number;
  approvedPOAmount: number;
  pendingPOAmount: number;
  totalVendorPayments: number;
  budgetUtilization: number;
};

/** Soft white + pastel wash — same style as requester dashboard cards */
const KPI_THEME = {
  total: {
    value: '#2563EB',
    iconBg: '#DBEAFE',
    wash: 'rgba(37, 99, 235, 0.14)',
  },
  active: {
    value: '#06B6D4',
    iconBg: '#CFFAFE',
    wash: 'rgba(6, 182, 212, 0.14)',
  },
  completed: {
    value: '#10B981',
    iconBg: '#D1FAE5',
    wash: 'rgba(16, 185, 129, 0.14)',
  },
  delayed: {
    value: '#F43F5E',
    iconBg: '#FFE4E6',
    wash: 'rgba(244, 63, 94, 0.12)',
  },
  open: {
    value: '#F97316',
    iconBg: '#FFEDD5',
    wash: 'rgba(249, 115, 22, 0.14)',
  },
  subtasks: {
    value: '#8B5CF6',
    iconBg: '#EDE9FE',
    wash: 'rgba(139, 92, 246, 0.14)',
  },
} as const;

type ThemeKey = keyof typeof KPI_THEME;

function PremiumKpiCard({
  title,
  value,
  titleAttr,
  subtitle,
  trend,
  trendPositive,
  icon,
  themeKey,
}: {
  title: string;
  value: string;
  titleAttr?: string;
  subtitle?: string;
  trend?: string;
  trendPositive?: boolean;
  icon: string;
  themeKey: ThemeKey;
}) {
  const theme = KPI_THEME[themeKey];

  return (
    <div
      title={titleAttr}
      className="
        group relative box-border flex h-full min-h-[148px] w-full cursor-default flex-col overflow-hidden
        rounded-2xl border border-transparent bg-white p-4 text-left sm:min-h-[160px] sm:rounded-[18px] sm:p-5
        shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]
        transition-[box-shadow,border-color,transform] duration-200 ease-out
        hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)]
      "
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
            {title}
          </p>
          <p
            className="mt-2 text-3xl font-bold tabular-nums leading-none tracking-tight sm:mt-3 sm:text-[2.15rem]"
            style={{ color: theme.value }}
          >
            {value}
          </p>
          {subtitle ? (
            <p className="mt-1.5 text-[11px] font-medium text-slate-400 sm:mt-2 sm:text-xs">{subtitle}</p>
          ) : null}
          {trend ? (
            <p
              className={`mt-2 flex items-center gap-1 text-[11px] font-semibold sm:mt-2.5 sm:text-xs ${
                trendPositive ? 'text-[#22C55E]' : 'text-[#EF4444]'
              }`}
            >
              <i className={`${trendPositive ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} text-xs sm:text-sm`} />
              {trend}
            </p>
          ) : null}
        </div>

        <div
          className="relative flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-xl sm:h-11 sm:w-11"
          style={{ backgroundColor: theme.iconBg, color: theme.value }}
        >
          <i className={`${icon} text-lg sm:text-xl`} aria-hidden />
        </div>
      </div>
    </div>
  );
}

export default function KPIWidgets({
  kpis,
  previousTotal,
  previousMonthLabel,
}: {
  kpis: Kpis;
  previousTotal: number;
  previousMonthLabel?: string;
}) {
  const vs = previousMonthLabel || 'prior month';
  const mom = monthOverMonth(kpis.totalPOAmount, previousTotal, vs);
  const approvedShare = kpis.totalPOAmount > 0 ? (kpis.approvedPOAmount / kpis.totalPOAmount) * 100 : 0;
  const pendingShare = kpis.totalPOAmount > 0 ? (kpis.pendingPOAmount / kpis.totalPOAmount) * 100 : 0;
  const payShare = kpis.totalPOAmount > 0 ? (kpis.totalVendorPayments / kpis.totalPOAmount) * 100 : 0;
  const budgetPct = Number(kpis.budgetUtilization || 0);

  const cards: Array<{
    title: string;
    value: string;
    titleAttr: string;
    subtitle: string;
    trend: string;
    trendPositive: boolean;
    icon: string;
    themeKey: ThemeKey;
  }> = [
    {
      title: 'Total PO Amount',
      value: formatCompactInr(kpis.totalPOAmount),
      titleAttr: formatFullInr(kpis.totalPOAmount),
      subtitle: `vs ${vs}`,
      trend: mom.label,
      trendPositive: mom.flat || mom.up,
      icon: 'ri-folder-3-line',
      themeKey: 'total',
    },
    {
      title: 'Approved PO Amount',
      value: formatCompactInr(kpis.approvedPOAmount),
      titleAttr: formatFullInr(kpis.approvedPOAmount),
      subtitle: 'Cleared POs',
      trend: `${approvedShare.toFixed(0)}% of total`,
      trendPositive: true,
      icon: 'ri-checkbox-circle-line',
      themeKey: 'completed',
    },
    {
      title: 'Pending PO Amount',
      value: formatCompactInr(kpis.pendingPOAmount),
      titleAttr: formatFullInr(kpis.pendingPOAmount),
      subtitle: 'Awaiting action',
      trend: `${pendingShare.toFixed(0)}% of total`,
      trendPositive: false,
      icon: 'ri-notification-3-line',
      themeKey: 'active',
    },
    {
      title: 'Vendor Payments',
      value: formatCompactInr(kpis.totalVendorPayments),
      titleAttr: formatFullInr(kpis.totalVendorPayments),
      subtitle: 'Paid to vendors',
      trend: `${payShare.toFixed(0)}% of total`,
      trendPositive: payShare >= 50,
      icon: 'ri-bank-line',
      themeKey: 'open',
    },
    {
      title: 'Budget Utilization',
      value: `${budgetPct.toFixed(1)}%`,
      titleAttr: `${budgetPct}% approved / total PO`,
      subtitle: 'Of allocated budget',
      trend: 'Approved / total PO',
      trendPositive: budgetPct <= 90,
      icon: 'ri-pie-chart-2-line',
      themeKey: budgetPct > 90 ? 'delayed' : 'subtasks',
    },
  ];

  return (
    <div className="mb-5 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:grid-cols-5">
      {cards.map((card) => (
        <PremiumKpiCard
          key={card.title}
          title={card.title}
          value={card.value}
          titleAttr={card.titleAttr}
          subtitle={card.subtitle}
          trend={card.trend}
          trendPositive={card.trendPositive}
          icon={card.icon}
          themeKey={card.themeKey}
        />
      ))}
    </div>
  );
}
