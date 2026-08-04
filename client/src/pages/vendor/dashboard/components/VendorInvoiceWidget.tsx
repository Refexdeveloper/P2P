import { useNavigate } from 'react-router-dom';
import { VendorInvoiceSummary } from '../../../../mocks/vendor-dashboard-data';

interface Props {
  data: VendorInvoiceSummary[];
}

const statusConfig: Record<string, { bg: string; text: string; icon: string }> = {
  Draft: { bg: 'bg-gray-100', text: 'text-gray-600', icon: 'ri-draft-line' },
  Submitted: { bg: 'bg-sky-100', text: 'text-sky-700', icon: 'ri-send-plane-line' },
  'Under Verification': { bg: 'bg-amber-100', text: 'text-amber-700', icon: 'ri-search-eye-line' },
  'Approved for Payment': { bg: 'bg-teal-100', text: 'text-teal-700', icon: 'ri-checkbox-circle-line' },
  Paid: { bg: 'bg-green-100', text: 'text-green-700', icon: 'ri-money-rupee-circle-line' },
  Discrepancy: { bg: 'bg-red-100', text: 'text-red-700', icon: 'ri-error-warning-line' },
  Rejected: { bg: 'bg-red-100', text: 'text-red-700', icon: 'ri-close-circle-line' },
};

const fmtAmt = (n: number) =>
  n >= 10000000
    ? `₹${(n / 10000000).toFixed(2)} Cr`
    : n >= 100000
    ? `₹${(n / 100000).toFixed(2)} L`
    : `₹${n.toLocaleString('en-IN')}`;

export default function VendorInvoiceWidget({ data }: Props) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-file-invoice-line text-violet-500 text-lg"></i>
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">Invoice Status</h3>
        </div>
        <button
          onClick={() => navigate('/scm/vendor-invoice')}
          className="text-xs text-teal-600 font-medium hover:underline cursor-pointer whitespace-nowrap"
        >
          View All
        </button>
      </div>

      <div className="divide-y divide-gray-50">
        {data.map((inv) => {
          const sc = statusConfig[inv.status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', icon: 'ri-file-line' };
          return (
            <div
              key={inv.invoiceNumber}
              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => navigate('/scm/vendor-invoice')}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate leading-tight">{inv.prTitle}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{inv.invoiceNumber}</span>
                  <span className="text-gray-300">•</span>
                  <span className="text-xs text-gray-500">Due: {inv.dueDate}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text} whitespace-nowrap`}>
                  <i className={`${sc.icon} mr-1`}></i>{inv.status}
                </span>
                <span className="text-xs font-semibold text-gray-700">{fmtAmt(inv.grandTotal)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
        <button
          onClick={() => navigate('/scm/vendor-invoice')}
          className="w-full text-center text-xs font-semibold text-teal-600 hover:text-teal-700 cursor-pointer whitespace-nowrap"
        >
          Submit / Track Invoice <i className="ri-arrow-right-line"></i>
        </button>
      </div>
    </div>
  );
}
