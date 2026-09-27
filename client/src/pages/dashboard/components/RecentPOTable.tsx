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

      <div className="overflow-x-auto bg-[#F8FAFC]/70 px-2 pb-3 pt-1 sm:px-3 sm:pb-4">
        <table className="w-full min-w-0 border-separate border-spacing-x-0 border-spacing-y-3 text-sm">
          <thead>
            <tr>
              {['PO Number', 'Entity', 'Vendor Name', 'PO Amount', 'PO Date', 'Status'].map((h) => (
                <th
                  key={h}
                  className={`whitespace-nowrap px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 ${
                    h === 'PO Amount' ? 'text-right' : 'text-left'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!orders.length ? (
              <tr>
                <td
                  colSpan={6}
                  className="rounded-2xl border border-transparent bg-white px-5 py-16 text-center shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]"
                >
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
                const edge = clickable
                  ? 'border-transparent group-hover:border-[#90CAF9]'
                  : 'border-transparent';
                const shadow = 'shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]';
                return (
                  <tr
                    key={po.poNumber}
                    onClick={() => clickable && openDetail(po)}
                    className={`group ${clickable ? 'cursor-pointer' : ''}`}
                    title={clickable ? 'View full PO details and documents' : undefined}
                  >
                    <td className={`whitespace-nowrap rounded-l-2xl border border-r-0 bg-white px-3 py-4 transition-[border-color] sm:rounded-l-[18px] sm:py-5 ${edge} ${shadow}`}>
                      <span className="text-sm font-bold text-[#1E88E5]">{po.poNumber}</span>
                    </td>
                    <td className={`max-w-[180px] border border-x-0 bg-white px-3 py-4 transition-[border-color] sm:py-5 ${edge}`} title={po.entity}>
                      <p className="truncate text-sm text-[#2C3E50]">{po.entity}</p>
                    </td>
                    <td className={`max-w-[220px] border border-x-0 bg-white px-3 py-4 transition-[border-color] sm:py-5 ${edge}`} title={po.vendorName}>
                      <p className="truncate text-sm font-medium text-[#2C3E50]">{po.vendorName}</p>
                    </td>
                    <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-right transition-[border-color] sm:py-5 ${edge}`}>
                      <span className="text-sm font-bold tabular-nums text-[#2C3E50]">{formatCurrency(po.poAmount)}</span>
                    </td>
                    <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-sm text-slate-500 transition-[border-color] sm:py-5 ${edge}`}>
                      {po.poDate}
                    </td>
                    <td className={`whitespace-nowrap rounded-r-2xl border border-l-0 bg-white px-3 py-4 transition-[border-color] sm:rounded-r-[18px] sm:py-5 ${edge} ${shadow}`}>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
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
