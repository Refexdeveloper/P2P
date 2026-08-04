import { useNavigate } from 'react-router-dom';
import { VendorPOSummary } from '../../../../mocks/vendor-dashboard-data';

interface Props {
  data: VendorPOSummary[];
}

const statusConfig: Record<string, { bg: string; text: string; icon: string }> = {
  'Pending Acceptance': { bg: 'bg-amber-100', text: 'text-amber-700', icon: 'ri-time-line' },
  Accepted: { bg: 'bg-green-100', text: 'text-green-700', icon: 'ri-checkbox-circle-line' },
  Rejected: { bg: 'bg-red-100', text: 'text-red-700', icon: 'ri-close-circle-line' },
  'Partially Accepted': { bg: 'bg-sky-100', text: 'text-sky-700', icon: 'ri-subtract-line' },
};

const priorityDot: Record<string, string> = {
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-green-400',
};

const fmtAmt = (n: number) =>
  n >= 10000000
    ? `₹${(n / 10000000).toFixed(2)} Cr`
    : n >= 100000
    ? `₹${(n / 100000).toFixed(2)} L`
    : `₹${n.toLocaleString('en-IN')}`;

export default function VendorPOWidget({ data }: Props) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-shake-hands-line text-orange-500 text-lg"></i>
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">PO Acceptance</h3>
        </div>
        <button
          onClick={() => navigate('/scm/vendor-po-acceptance')}
          className="text-xs text-teal-600 font-medium hover:underline cursor-pointer whitespace-nowrap"
        >
          View All
        </button>
      </div>

      <div className="divide-y divide-gray-50">
        {data.map((po) => {
          const sc = statusConfig[po.status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', icon: 'ri-circle-line' };
          const pdot = priorityDot[po.priority] ?? 'bg-gray-400';
          return (
            <div
              key={po.poNumber}
              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => navigate('/scm/vendor-po-acceptance')}
            >
              <div className="flex-shrink-0">
                <span className={`inline-block w-2 h-2 rounded-full ${pdot}`}></span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate leading-tight">{po.prTitle}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{po.poNumber}</span>
                  <span className="text-gray-300">•</span>
                  <span className="text-xs text-gray-500">Delivery: {po.expectedDeliveryDate}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text} whitespace-nowrap`}>
                  <i className={`${sc.icon} mr-1`}></i>{po.status}
                </span>
                <span className="text-xs font-semibold text-gray-700">{fmtAmt(po.grandTotal)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
        <button
          onClick={() => navigate('/scm/vendor-po-acceptance')}
          className="w-full text-center text-xs font-semibold text-teal-600 hover:text-teal-700 cursor-pointer whitespace-nowrap"
        >
          Accept / Review POs <i className="ri-arrow-right-line"></i>
        </button>
      </div>
    </div>
  );
}
