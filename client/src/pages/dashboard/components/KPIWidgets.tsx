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

  const cards = [
    {
      title: 'Total PO Amount',
      value: formatCompactInr(kpis.totalPOAmount),
      titleAttr: formatFullInr(kpis.totalPOAmount),
      delta: mom.label,
      up: mom.up,
      flat: mom.flat,
      icon: 'ri-shopping-cart-2-line',
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    {
      title: 'Approved PO Amount',
      value: formatCompactInr(kpis.approvedPOAmount),
      titleAttr: formatFullInr(kpis.approvedPOAmount),
      delta: `${approvedShare.toFixed(1)}% of total PO`,
      up: true,
      flat: false,
      icon: 'ri-shield-check-line',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      title: 'Pending PO Amount',
      value: formatCompactInr(kpis.pendingPOAmount),
      titleAttr: formatFullInr(kpis.pendingPOAmount),
      delta: `${pendingShare.toFixed(1)}% of total PO`,
      up: true,
      flat: false,
      icon: 'ri-time-line',
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-500',
    },
    {
      title: 'Vendor Payments',
      value: formatCompactInr(kpis.totalVendorPayments),
      titleAttr: formatFullInr(kpis.totalVendorPayments),
      delta: `${payShare.toFixed(1)}% of total PO`,
      up: payShare >= 0,
      flat: payShare === 0,
      icon: 'ri-bank-line',
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
    },
    {
      title: 'Budget Utilization',
      value: `${Number(kpis.budgetUtilization || 0).toFixed(1)}%`,
      titleAttr: `${kpis.budgetUtilization}% approved / total PO`,
      delta: 'Approved / total PO',
      up: true,
      flat: false,
      icon: 'ri-pie-chart-2-line',
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-white border border-[#EEF0F5] rounded-[16px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:shadow-[0_10px_28px_rgba(16,24,40,0.06)] hover:-translate-y-px transition-all duration-200 px-4 py-4 min-h-[120px] flex flex-col"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12px] font-medium text-slate-500 leading-tight pt-0.5">{card.title}</p>
            <div className={`w-8 h-8 ${card.iconBg} rounded-lg flex items-center justify-center shrink-0`}>
              <i className={`${card.icon} text-base ${card.iconColor}`}></i>
            </div>
          </div>
          <p className="text-[22px] font-bold text-slate-900 mt-2 leading-none tracking-tight" title={card.titleAttr}>
            {card.value}
          </p>
          <p
            className={`text-[11px] mt-2 font-medium inline-flex items-center gap-1 ${
              card.flat ? 'text-slate-400' : card.up ? 'text-emerald-600' : 'text-rose-500'
            }`}
          >
            {!card.flat ? <i className={`${card.up ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} text-[10px]`}></i> : null}
            {card.delta}
          </p>
        </div>
      ))}
    </div>
  );
}
