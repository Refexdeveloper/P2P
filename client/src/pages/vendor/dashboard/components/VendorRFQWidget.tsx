import { useNavigate } from 'react-router-dom';
import { VendorRFQSummary } from '../../../../mocks/vendor-dashboard-data';

interface Props {
  data: VendorRFQSummary[];
}

const statusConfig: Record<string, { bg: string; text: string }> = {
  'Pending Quote': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Re-quote Requested': { bg: 'bg-red-100', text: 'text-red-700' },
  'Quote Submitted': { bg: 'bg-sky-100', text: 'text-sky-700' },
  'Quote Accepted': { bg: 'bg-green-100', text: 'text-green-700' },
  'Quote Rejected': { bg: 'bg-gray-100', text: 'text-gray-600' },
};

const fmtAmt = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(2)} L` : `₹${n.toLocaleString('en-IN')}`;

const daysLeft = (due: string) => {
  const d = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  if (d < 0) return { label: `${Math.abs(d)}d overdue`, color: 'text-red-500' };
  if (d === 0) return { label: 'Due today', color: 'text-red-500' };
  if (d <= 3) return { label: `${d}d left`, color: 'text-amber-500' };
  return { label: `${d}d left`, color: 'text-gray-400' };
};

export default function VendorRFQWidget({ data }: Props) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-file-list-3-line text-amber-500 text-lg"></i>
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">RFQ / Quotations</h3>
        </div>
        <button
          onClick={() => navigate('/scm/vendor-quotation-portal')}
          className="text-xs text-teal-600 font-medium hover:underline cursor-pointer whitespace-nowrap"
        >
          View All
        </button>
      </div>

      <div className="divide-y divide-gray-50">
        {data.map((rfq) => {
          const dl = daysLeft(rfq.dueDate);
          const sc = statusConfig[rfq.status] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
          return (
            <div
              key={rfq.rfqNumber}
              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => navigate('/scm/vendor-quotation-portal')}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate leading-tight">{rfq.prTitle}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{rfq.rfqNumber}</span>
                  <span className="text-gray-300">•</span>
                  <span className="text-xs text-gray-500">{rfq.buyerName}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text} whitespace-nowrap`}>
                  {rfq.status}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">{fmtAmt(rfq.estimatedValue)}</span>
                  <span className={`text-xs font-medium ${dl.color}`}>{dl.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
        <button
          onClick={() => navigate('/scm/vendor-quotation-portal')}
          className="w-full text-center text-xs font-semibold text-teal-600 hover:text-teal-700 cursor-pointer whitespace-nowrap"
        >
          Submit Quotation <i className="ri-arrow-right-line"></i>
        </button>
      </div>
    </div>
  );
}
