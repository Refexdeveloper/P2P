import { InvoiceData } from '../../../../mocks/invoice-data';
import SoftInsightCard from '../../../../components/base/SoftInsightCard';

interface PaymentStatsCardsProps {
  invoices: InvoiceData[];
}

export default function PaymentStatsCards({ invoices }: PaymentStatsCardsProps) {
  const approvedInvoices = invoices.filter((inv) => inv.status === 'Approved for Payment');
  
  const totalPayable = approvedInvoices.reduce((sum, inv) => sum + inv.invoiceGrandTotal, 0);
  const paid = approvedInvoices.filter((inv) => inv.paymentStatus === 'Paid').length;
  const paidAmount = approvedInvoices
    .filter((inv) => inv.paymentStatus === 'Paid')
    .reduce((sum, inv) => sum + inv.invoiceGrandTotal, 0);
  const pending = approvedInvoices.filter((inv) => inv.paymentStatus === 'Pending Payment').length;
  const pendingAmount = approvedInvoices
    .filter((inv) => inv.paymentStatus === 'Pending Payment')
    .reduce((sum, inv) => sum + inv.invoiceGrandTotal, 0);
  const overdue = approvedInvoices.filter((inv) => inv.paymentStatus === 'Overdue').length;
  const overdueAmount = approvedInvoices
    .filter((inv) => inv.paymentStatus === 'Overdue')
    .reduce((sum, inv) => sum + inv.invoiceGrandTotal, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
      <SoftInsightCard
        title="Total Payable"
        value={formatCurrency(totalPayable)}
        subtitle={`${approvedInvoices.length} invoices approved`}
        icon="ri-money-rupee-circle-line"
        theme="blue"
      />
      <SoftInsightCard
        title="Paid"
        value={formatCurrency(paidAmount)}
        subtitle={`${paid} payments completed`}
        icon="ri-checkbox-circle-line"
        theme="green"
      />
      <SoftInsightCard
        title="Pending Payment"
        value={formatCurrency(pendingAmount)}
        subtitle={`${pending} awaiting payment`}
        icon="ri-time-line"
        theme="orange"
      />
      <SoftInsightCard
        title="Overdue"
        value={formatCurrency(overdueAmount)}
        subtitle={`${overdue} payments overdue`}
        icon="ri-alert-line"
        theme="rose"
      />
    </div>
  );
}