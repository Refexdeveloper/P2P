import { useNavigate } from 'react-router-dom';
import { formatCompactInr } from '../cfoFormat';

type Order = {
  poId?: number | null;
  prId?: number | null;
  poNumber: string;
  entity: string;
  vendorName: string;
  poAmount: number;
  poDate: string;
  status: string;
};

const formatCurrency = formatCompactInr;

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  Approved: { bg: 'bg-green-50', text: 'text-[#43A047]', dot: 'bg-[#43A047]' },
  'Pending Approval': { bg: 'bg-amber-50', text: 'text-[#FB8C00]', dot: 'bg-[#FB8C00]' },
  Rejected: { bg: 'bg-red-50', text: 'text-[#E53935]', dot: 'bg-[#E53935]' },
};

export default function RecentPOTable({ orders }: { orders: Order[] }) {
  const navigate = useNavigate();

  const openDetail = (po: Order) => {
    if (po.poId) {
      navigate(`/dashboard/po/${po.poId}`);
      return;
    }
    if (po.poNumber) {
      navigate(`/dashboard/po?poNumber=${encodeURIComponent(po.poNumber)}`);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-indigo-50/40 px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E88E5]/10 text-[#1E88E5]">
            <i className="ri-file-list-3-line text-lg" aria-hidden />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 sm:text-base">Recent Purchase Orders</h3>
            <p className="text-[11px] text-slate-500 sm:text-xs">{orders.length} records</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] whitespace-nowrap">
                PO Number
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] whitespace-nowrap">
                Entity
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] whitespace-nowrap">
                Vendor Name
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] whitespace-nowrap">
                PO Amount
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] whitespace-nowrap">
                PO Date
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] whitespace-nowrap">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {!orders.length ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <i className="ri-file-search-line text-4xl text-slate-200" />
                    <p className="text-sm text-slate-400">No recent purchase orders.</p>
                  </div>
                </td>
              </tr>
            ) : (
              orders.map((po) => {
                const cfg = statusConfig[po.status] ?? statusConfig['Pending Approval'];
                const clickable = Boolean(po.poId || po.poNumber);
                return (
                  <tr
                    key={po.poNumber}
                    onClick={() => clickable && openDetail(po)}
                    className={`border-b border-slate-100 transition-colors ${
                      clickable
                        ? 'cursor-pointer hover:bg-gradient-to-r hover:from-blue-50/40 hover:to-transparent'
                        : 'hover:bg-slate-50/80'
                    }`}
                    title={clickable ? 'View full PO details and documents' : undefined}
                  >
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span className="text-sm font-semibold text-[#1E88E5]">{po.poNumber}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-[#1E88E5]">
                        {po.entity}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span className="text-sm font-medium text-[#2C3E50]">{po.vendorName}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      <span className="text-sm font-bold text-[#2C3E50]">{formatCurrency(po.poAmount)}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span className="text-sm text-[#7F8C8D]">{po.poDate}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                        {po.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
