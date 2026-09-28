import { VendorKPIData } from '../../../../mocks/vendor-dashboard-data';
import SoftInsightCard, { type InsightThemeName } from '../../../../components/base/SoftInsightCard';

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
  const kpis: Array<{
    label: string;
    value: string | number;
    sub: string;
    icon: string;
    theme: InsightThemeName;
  }> = [
    {
      label: 'Open RFQs',
      value: data.openRFQs,
      sub: `${data.pendingQuotes} need quote`,
      icon: 'ri-file-list-3-line',
      theme: 'orange',
    },
    {
      label: 'Re-quote Alerts',
      value: data.reQuoteRequested,
      sub: 'Action required',
      icon: 'ri-refresh-line',
      theme: 'rose',
    },
    {
      label: 'Pending PO Acceptance',
      value: data.pendingPOAcceptance,
      sub: `${data.acceptedPOs} accepted`,
      icon: 'ri-shake-hands-line',
      theme: 'cyan',
    },
    {
      label: 'Invoices Pending',
      value: data.pendingInvoices + data.draftInvoices,
      sub: `${data.discrepancyInvoices} discrepancy`,
      icon: 'ri-file-invoice-line',
      theme: 'violet',
    },
    {
      label: 'Pending Payment',
      value: fmt(data.totalPendingPayment),
      sub: 'Approved for payment',
      icon: 'ri-time-line',
      theme: 'blue',
    },
    {
      label: 'Total Received',
      value: fmt(data.totalPaidAmount),
      sub: `${data.paidInvoices} invoice(s) paid`,
      icon: 'ri-checkbox-circle-line',
      theme: 'green',
    },
  ];

  return (
    <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <SoftInsightCard
          key={kpi.label}
          title={kpi.label}
          value={kpi.value}
          subtitle={kpi.sub}
          icon={kpi.icon}
          theme={kpi.theme}
        />
      ))}
    </div>
  );
}
