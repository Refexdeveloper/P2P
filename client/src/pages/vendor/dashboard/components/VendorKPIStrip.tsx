import { VendorKPIData } from '../../../../mocks/vendor-dashboard-data';

interface Props {
  data: VendorKPIData;
}

const fmt = (n: number) =>
  n >= 10000000
    ? `₹${(n / 10000000).toFixed(2)} Cr`
    : n >= 100000
    ? `₹${(n / 100000).toFixed(2)} L`
    : `₹${n.toLocaleString('en-IN')}`;

export default function VendorKPIStrip({ data }: Props) {
  const kpis = [
    {
      label: 'Open RFQs',
      value: data.openRFQs,
      sub: `${data.pendingQuotes} need quote`,
      icon: 'ri-file-list-3-line',
      color: 'bg-amber-50 text-amber-600 border-amber-200',
      dot: 'bg-amber-500',
    },
    {
      label: 'Re-quote Alerts',
      value: data.reQuoteRequested,
      sub: 'Action required',
      icon: 'ri-refresh-line',
      color: 'bg-red-50 text-red-600 border-red-200',
      dot: 'bg-red-500',
    },
    {
      label: 'Pending PO Acceptance',
      value: data.pendingPOAcceptance,
      sub: `${data.acceptedPOs} accepted`,
      icon: 'ri-shake-hands-line',
      color: 'bg-orange-50 text-orange-600 border-orange-200',
      dot: 'bg-orange-500',
    },
    {
      label: 'Invoices Pending',
      value: data.pendingInvoices + data.draftInvoices,
      sub: `${data.discrepancyInvoices} discrepancy`,
      icon: 'ri-file-invoice-line',
      color: 'bg-violet-50 text-violet-600 border-violet-200',
      dot: 'bg-violet-500',
    },
    {
      label: 'Pending Payment',
      value: fmt(data.totalPendingPayment),
      sub: 'Approved for payment',
      icon: 'ri-time-line',
      color: 'bg-teal-50 text-teal-600 border-teal-200',
      dot: 'bg-teal-500',
    },
    {
      label: 'Total Received',
      value: fmt(data.totalPaidAmount),
      sub: `${data.paidInvoices} invoice(s) paid`,
      icon: 'ri-checkbox-circle-line',
      color: 'bg-green-50 text-green-600 border-green-200',
      dot: 'bg-green-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className={`relative rounded-xl border p-4 flex flex-col gap-2 ${kpi.color}`}
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/70">
              <i className={`${kpi.icon} text-xl`}></i>
            </div>
            <span className={`w-2.5 h-2.5 rounded-full ${kpi.dot}`}></span>
          </div>
          <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
          <div>
            <p className="text-xs font-semibold leading-tight">{kpi.label}</p>
            <p className="text-xs opacity-70 leading-tight">{kpi.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
