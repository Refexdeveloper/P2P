import { cfoDashboardKPIs } from '../../../mocks/cfo-dashboard-data';

const formatCurrency = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${value.toLocaleString()}`;
};

const widgets = [
  {
    title: 'Total PO Amount',
    value: formatCurrency(cfoDashboardKPIs.totalPOAmount),
    subtext: 'All Entities Combined',
    icon: 'ri-file-list-3-line',
    textColor: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-100'
  },
  {
    title: 'Entity-wise Spend',
    value: formatCurrency(cfoDashboardKPIs.entityWiseSpend),
    subtext: 'Across 4 Entities',
    icon: 'ri-building-2-line',
    textColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-100'
  },
  {
    title: 'Approved PO Amount',
    value: formatCurrency(cfoDashboardKPIs.approvedPOAmount),
    subtext: 'Fully Authorized',
    icon: 'ri-checkbox-circle-line',
    textColor: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-100'
  },
  {
    title: 'Pending PO Amount',
    value: formatCurrency(cfoDashboardKPIs.pendingPOAmount),
    subtext: 'Awaiting Approval',
    icon: 'ri-time-line',
    textColor: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-100'
  },
  {
    title: 'Vendor Payments',
    value: formatCurrency(cfoDashboardKPIs.totalVendorPayments),
    subtext: 'Total Released',
    icon: 'ri-bank-line',
    textColor: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-100'
  },
  {
    title: 'Budget Utilization',
    value: `${cfoDashboardKPIs.budgetUtilization}%`,
    subtext: 'Of Annual Budget',
    icon: 'ri-pie-chart-2-line',
    textColor: 'text-rose-600',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-100'
  }
];

export default function KPIWidgets() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {widgets.map((card, index) => (
        <div
          key={index}
          className={`bg-white rounded-xl border ${card.borderColor} p-4 hover:shadow-md transition-shadow`}
        >
          <div className={`w-9 h-9 ${card.bgColor} rounded-lg flex items-center justify-center mb-3`}>
            <i className={`${card.icon} text-lg ${card.textColor}`}></i>
          </div>
          <p className="text-xs text-gray-500 mb-1 whitespace-nowrap">{card.title}</p>
          <p className="text-xl font-bold text-gray-900 leading-tight">{card.value}</p>
          <p className="text-xs text-gray-400 mt-1">{card.subtext}</p>
        </div>
      ))}
    </div>
  );
}
