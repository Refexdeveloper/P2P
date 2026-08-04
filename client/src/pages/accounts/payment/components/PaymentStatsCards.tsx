import { InvoiceData } from '../../../../mocks/invoice-data';

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Payable</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalPayable)}</p>
            <p className="text-xs text-gray-500 mt-1">{approvedInvoices.length} invoices approved</p>
          </div>
          <div className="w-12 h-12 flex items-center justify-center bg-blue-50 rounded-lg">
            <i className="ri-money-rupee-circle-line text-blue-600 text-xl"></i>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Paid</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(paidAmount)}</p>
            <p className="text-xs text-gray-500 mt-1">{paid} payments completed</p>
          </div>
          <div className="w-12 h-12 flex items-center justify-center bg-emerald-50 rounded-lg">
            <i className="ri-checkbox-circle-line text-emerald-600 text-xl"></i>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending Payment</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(pendingAmount)}</p>
            <p className="text-xs text-gray-500 mt-1">{pending} awaiting payment</p>
          </div>
          <div className="w-12 h-12 flex items-center justify-center bg-amber-50 rounded-lg">
            <i className="ri-time-line text-amber-600 text-xl"></i>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Overdue</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(overdueAmount)}</p>
            <p className="text-xs text-gray-500 mt-1">{overdue} payments overdue</p>
          </div>
          <div className="w-12 h-12 flex items-center justify-center bg-red-50 rounded-lg">
            <i className="ri-alert-line text-red-600 text-xl"></i>
          </div>
        </div>
      </div>
    </div>
  );
}