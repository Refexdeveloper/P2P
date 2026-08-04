import { InvoiceData, PaymentStatus } from '../../../../mocks/invoice-data';

interface PaymentTableProps {
  invoices: InvoiceData[];
  expandedRow: string | null;
  onToggleRow: (invoiceNumber: string) => void;
  onUploadPayment: (invoice: InvoiceData) => void;
  renderExpanded: (invoice: InvoiceData) => React.ReactNode;
}

export default function PaymentTable({
  invoices,
  expandedRow,
  onToggleRow,
  onUploadPayment,
  renderExpanded,
}: PaymentTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    const styles: Record<PaymentStatus, string> = {
      'Pending Payment': 'bg-amber-50 text-amber-700 border-amber-200',
      'Paid': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Overdue': 'bg-red-50 text-red-700 border-red-200',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap ${styles[status]}`}>
        {status}
      </span>
    );
  };

  const isOverdue = (dueDate: string, paymentStatus?: PaymentStatus) => {
    if (paymentStatus === 'Paid') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Invoice #
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Vendor
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              PO / GRN
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Department
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Invoice Amount
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Due Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Payment Status
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {invoices.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-500">
                No approved invoices found
              </td>
            </tr>
          ) : (
            invoices.map((invoice) => {
              const isExpanded = expandedRow === invoice.invoiceNumber;
              const overdue = isOverdue(invoice.dueDate, invoice.paymentStatus);
              return (
                <>
                  <tr
                    key={invoice.invoiceNumber}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                      isExpanded ? 'bg-teal-50/30' : ''
                    }`}
                    onClick={() => onToggleRow(invoice.invoiceNumber)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <i
                            className={`text-gray-400 text-sm transition-transform ${
                              isExpanded ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'
                            }`}
                          ></i>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{invoice.invoiceNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{invoice.vendor}</div>
                      <div className="text-xs text-gray-500">{invoice.vendorGSTIN}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-600">
                        <div className="font-medium">{invoice.poNumber}</div>
                        <div className="text-gray-500">{invoice.grnNumber}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{invoice.department}</div>
                      <div className="text-xs text-gray-500">{invoice.requester}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(invoice.invoiceGrandTotal)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                        {formatDate(invoice.dueDate)}
                      </div>
                      {overdue && (
                        <div className="text-xs text-red-500 flex items-center space-x-1 mt-0.5">
                          <i className="ri-alert-line text-xs"></i>
                          <span>Overdue</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getPaymentStatusBadge(invoice.paymentStatus || 'Pending Payment')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center space-x-2">
                        {invoice.paymentStatus === 'Pending Payment' || invoice.paymentStatus === 'Overdue' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUploadPayment(invoice);
                            }}
                            className="px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <i className="ri-upload-line mr-1"></i>
                            Upload Payment
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">Payment completed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="px-0 py-0 bg-gray-50">
                        {renderExpanded(invoice)}
                      </td>
                    </tr>
                  )}
                </>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}