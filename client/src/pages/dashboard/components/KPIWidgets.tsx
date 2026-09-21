import PmKpiCard from '../../../components/base/PmKpiCard';
import { formatCompactInr, formatFullInr, monthOverMonth } from '../cfoFormat';

type Kpis = {
  totalPOAmount: number;
  approvedPOAmount: number;
  pendingPOAmount: number;
  totalVendorPayments: number;
  budgetUtilization: number;
};

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

  const cards = [
    {
      title: 'Total PO Amount',
      value: formatCompactInr(kpis.totalPOAmount),
      titleAttr: formatFullInr(kpis.totalPOAmount),
      delta: mom.label,
      deltaTone: (mom.flat ? 'flat' : mom.up ? 'up' : 'down') as 'up' | 'down' | 'flat',
      subtitle: `vs ${vs}`,
      icon: 'ri-folder-3-line',
      tone: 'total' as const,
      progress: undefined as number | undefined,
    },
    {
      title: 'Approved PO Amount',
      value: formatCompactInr(kpis.approvedPOAmount),
      titleAttr: formatFullInr(kpis.approvedPOAmount),
      delta: `${approvedShare.toFixed(0)}% of total`,
      deltaTone: 'up' as const,
      subtitle: 'Cleared POs',
      icon: 'ri-checkbox-circle-line',
      tone: 'completed' as const,
      progress: approvedShare,
    },
    {
      title: 'Pending PO Amount',
      value: formatCompactInr(kpis.pendingPOAmount),
      titleAttr: formatFullInr(kpis.pendingPOAmount),
      delta: `${pendingShare.toFixed(0)}% of total`,
      deltaTone: 'down' as const,
      subtitle: 'Awaiting action',
      icon: 'ri-notification-3-line',
      tone: 'active' as const,
      progress: pendingShare,
    },
    {
      title: 'Vendor Payments',
      value: formatCompactInr(kpis.totalVendorPayments),
      titleAttr: formatFullInr(kpis.totalVendorPayments),
      delta: `${payShare.toFixed(0)}% of total`,
      deltaTone: payShare >= 50 ? ('up' as const) : ('flat' as const),
      subtitle: 'Paid to vendors',
      icon: 'ri-bank-line',
      tone: 'open' as const,
      progress: payShare,
    },
    {
      title: 'Budget Utilization',
      value: `${budgetPct.toFixed(1)}%`,
      titleAttr: `${budgetPct}% approved / total PO`,
      delta: 'Approved / total PO',
      deltaTone: 'flat' as const,
      subtitle: 'Of allocated budget',
      icon: 'ri-pie-chart-2-line',
      tone: budgetPct > 90 ? ('delayed' as const) : ('subtasks' as const),
      progress: Math.min(100, budgetPct),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
      {cards.map((card) => (
        <PmKpiCard
          key={card.title}
          title={card.title}
          value={card.value}
          titleAttr={card.titleAttr}
          icon={card.icon}
          tone={card.tone}
          subtitle={card.subtitle}
          delta={card.delta}
          deltaTone={card.deltaTone}
          progress={card.progress}
        />
      ))}
    </div>
  );
}
