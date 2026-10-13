import { Fragment, useEffect, useState } from 'react';
import { formatCompactInr } from '../cfoFormat';
import TrackPoExpandedRow from '../../scm/track-po/components/TrackPoExpandedRow';

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
const PAGE_SIZE = 5;

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  Approved: { bg: 'bg-green-50', text: 'text-[#43A047]', dot: 'bg-[#43A047]' },
  'Pending Approval': { bg: 'bg-amber-50', text: 'text-[#FB8C00]', dot: 'bg-[#FB8C00]' },
  Rejected: { bg: 'bg-red-50', text: 'text-[#E53935]', dot: 'bg-[#E53935]' },
};

export default function RecentPOTable({
  orders,
  publicView = false,
  page = 1,
  pageSize = PAGE_SIZE,
  total,
  onPageChange,
}: {
  orders: Order[];
  publicView?: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [localPage, setLocalPage] = useState(1);
  const serverPaged = typeof onPageChange === 'function';
  const rowTotal = serverPaged ? total ?? orders.length : orders.length;
  const pageCount = Math.max(1, Math.ceil(rowTotal / pageSize));
  const currentPage = Math.min(Math.max(1, serverPaged ? page : localPage), pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const pageOrders = serverPaged ? orders : orders.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setExpandedKey(null);
  }, [currentPage, orders]);

  const goToPage = (next: number) => {
    setExpandedKey(null);
    if (onPageChange) onPageChange(next);
    else setLocalPage(next);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-indigo-50/40 px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E88E5]/10 text-[#1E88E5]">
            <i className="ri-file-list-3-line text-lg" aria-hidden />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 sm:text-base">Purchase Orders</h3>
            <p className="text-[11px] text-slate-500 sm:text-xs">
              {rowTotal
                ? `${pageStart + 1}–${Math.min(pageStart + pageOrders.length, rowTotal)} of ${rowTotal}`
                : '0 records'}
            </p>
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
                    <p className="text-sm text-slate-400">No purchase orders for these filters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              pageOrders.map((po) => {
                const cfg = statusConfig[po.status] ?? statusConfig['Pending Approval'];
                const rowKey = `${po.poId || po.poNumber}`;
                const open = expandedKey === rowKey;
                const edge = open ? 'border-[#90CAF9]' : 'border-transparent group-hover:border-[#90CAF9]';
                const shadow = 'shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]';
                return (
                  <Fragment key={rowKey}>
                  <tr
                    onClick={() => setExpandedKey(open ? null : rowKey)}
                    className="group cursor-pointer"
                    title="Show PO details, documents, PR, and approval history"
                  >
                    <td className={`whitespace-nowrap rounded-l-2xl border border-r-0 bg-white px-3 py-4 transition-[border-color] sm:rounded-l-[18px] sm:py-5 ${edge} ${shadow}`}>
                      <div className="flex items-center gap-2">
                        <i className={`ri-arrow-${open ? 'down' : 'right'}-s-line text-base text-slate-400`} aria-hidden />
                        <span className="text-sm font-bold text-[#1E88E5]">{po.poNumber}</span>
                      </div>
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
                  {open && po.poId ? (
                    <TrackPoExpandedRow
                      colSpan={6}
                      publicInsights={publicView}
                      row={{
                        prId: Number(po.prId) || 0,
                        poId: po.poId,
                        prNumber: po.prId ? `PR-${po.prId}` : '',
                        poNumber: po.poNumber,
                        title: po.poNumber,
                        department: '',
                        requester: '',
                        vendorName: po.vendorName,
                        amount: po.poAmount,
                        statusLabel: po.status,
                        entityName: po.entity,
                        requiredDate: '',
                        createdAt: po.poDate,
                      }}
                    />
                  ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
        {rowTotal > pageSize ? (
          <div className="mt-1 flex items-center justify-between gap-3 px-2 pb-1">
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="inline-flex h-9 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-[#1E88E5] hover:bg-[#E3F2FD] disabled:cursor-not-allowed disabled:text-slate-300"
            >
              <i className="ri-arrow-left-s-line" />
              Previous
            </button>
            <p className="text-xs font-semibold text-slate-500">
              Page {currentPage} of {pageCount}
            </p>
            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= pageCount}
              className="inline-flex h-9 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-[#1E88E5] hover:bg-[#E3F2FD] disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Next
              <i className="ri-arrow-right-s-line" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
