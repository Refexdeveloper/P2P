import AnimatedKpiCard, { type KpiVariant } from '../../../components/feature/AnimatedKpiCard';
import '../../../styles/dashboard-fx.css';
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
  activeStatus = '',
  onStatus,
}: {
  kpis: Kpis;
  previousTotal: number;
  previousMonthLabel?: string;
  activeStatus?: string;
  onStatus?: (status: '' | 'Approved' | 'Pending Approval') => void;
}) {
  const vs = previousMonthLabel || 'prior month';
  const mom = monthOverMonth(kpis.totalPOAmount, previousTotal, vs);
  const approvedShare = kpis.totalPOAmount > 0 ? (kpis.approvedPOAmount / kpis.totalPOAmount) * 100 : 0;
  const pendingShare = kpis.totalPOAmount > 0 ? (kpis.pendingPOAmount / kpis.totalPOAmount) * 100 : 0;
  const payShare = kpis.totalPOAmount > 0 ? (kpis.totalVendorPayments / kpis.totalPOAmount) * 100 : 0;

  const cards: Array<{
    title: string;
    value: string;
    amount: number;
    titleAttr: string;
    subtitle: string;
    trend: string;
    trendPositive: boolean;
    variant: KpiVariant;
    percent: number;
    status: '' | 'Approved' | 'Pending Approval' | null;
  }> = [
    {
      title: 'Total PO Amount',
      value: formatCompactInr(kpis.totalPOAmount),
      amount: kpis.totalPOAmount,
      titleAttr: formatFullInr(kpis.totalPOAmount),
      subtitle: `vs ${vs}`,
      trend: mom.label,
      trendPositive: mom.flat || mom.up,
      variant: 'all',
      percent: 100,
      status: '',
    },
    {
      title: 'Approved PO Amount',
      value: formatCompactInr(kpis.approvedPOAmount),
      amount: kpis.approvedPOAmount,
      titleAttr: formatFullInr(kpis.approvedPOAmount),
      subtitle: 'Cleared POs',
      trend: `${approvedShare.toFixed(0)}% of total`,
      trendPositive: true,
      variant: 'approved',
      percent: approvedShare,
      status: 'Approved',
    },
    {
      title: 'Pending PO Amount',
      value: formatCompactInr(kpis.pendingPOAmount),
      amount: kpis.pendingPOAmount,
      titleAttr: formatFullInr(kpis.pendingPOAmount),
      subtitle: 'Awaiting action',
      trend: `${pendingShare.toFixed(0)}% of total`,
      trendPositive: false,
      variant: 'pending_approval',
      percent: pendingShare,
      status: 'Pending Approval',
    },
    {
      title: 'Vendor Payments',
      value: formatCompactInr(kpis.totalVendorPayments),
      amount: kpis.totalVendorPayments,
      titleAttr: formatFullInr(kpis.totalVendorPayments),
      subtitle: 'Paid to vendors',
      trend: `${payShare.toFixed(0)}% of total`,
      trendPositive: payShare >= 50,
      variant: 'payments',
      percent: payShare,
      status: null,
    },
  ];

  return (
    <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
      {cards.map((card, i) => {
        const clickable = card.status !== null && Boolean(onStatus);
        return (
          <div key={card.title} title={card.titleAttr} className="min-w-0">
            <AnimatedKpiCard
              title={card.title}
              value={card.amount}
              displayValue={card.value}
              variant={card.variant}
              index={i}
              total={kpis.totalPOAmount}
              percent={card.percent}
              subtitle={card.subtitle}
              live={card.variant === 'pending_approval' && card.amount > 0}
              selected={card.status !== null && card.status !== '' && activeStatus === card.status}
              chart="spark"
              footText={
                <span className={card.trendPositive ? 'tfx-trend up' : 'tfx-trend down'}>
                  <i className={card.trendPositive ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} aria-hidden />
                  {card.trend}
                </span>
              }
              toastText={clickable ? `Showing ${card.status ? card.status.toLowerCase() : 'all'} purchase orders` : null}
              interactive={clickable}
              onClick={
                clickable
                  ? () => onStatus!(activeStatus === card.status ? '' : (card.status as '' | 'Approved' | 'Pending Approval'))
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}
