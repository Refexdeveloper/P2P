import { useEffect, useState } from 'react';
import ApprovalHistoryPanel, {
  ManagerL2CommentsHighlight,
  type ApprovalHistoryEntry,
} from './ApprovalHistoryPanel';
import { prApi } from '../../services/api';

interface LineItem {
  id?: number;
  description?: string;
  category?: string;
  quantity?: number;
  unitPrice?: number;
  unitCost?: number;
  total?: number;
}

interface PRDetail {
  id: number;
  prNumber: string;
  title: string;
  department: string;
  requester: string;
  requestType: string;
  priority: string;
  requiredDate: string;
  submittedDate: string;
  totalAmount: number;
  justification: string;
  statusUI: string;
  vendorSelection?: string;
  lineItems: LineItem[];
  approvalHistory: ApprovalHistoryEntry[];
}

interface Props {
  prId: number;
  colSpan: number;
  statusLabel?: string;
  /** Optional action button in the expand header */
  actionSlot?: React.ReactNode;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

function normalizeHistory(raw: unknown): ApprovalHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const h = item as Record<string, unknown>;
    return {
      stage: String(h.stage || ''),
      approver: String(h.approver || h.user || 'System'),
      user: String(h.user || h.approver || 'System'),
      role: String(h.role || ''),
      action: String(h.action || h.status || 'Updated'),
      status: String(h.status || h.action || ''),
      date: String(h.date || ''),
      remarks: String(h.remarks || ''),
    };
  });
}

export default function RfqListExpandedRow({
  prId,
  colSpan,
  statusLabel = '',
  actionSlot,
}: Props) {
  const [tab, setTab] = useState<'details' | 'items' | 'history'>('details');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pr, setPr] = useState<PRDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await prApi.get(prId);
        if (cancelled) return;
        const d = res.data as Record<string, unknown>;
        const items = Array.isArray(d.lineItems) ? (d.lineItems as LineItem[]) : [];
        setPr({
          id: Number(d.id),
          prNumber: String(d.prNumber || ''),
          title: String(d.title || ''),
          department: String(d.department || ''),
          requester: String(d.requester || ''),
          requestType: String(d.requestType || ''),
          priority: String(d.priority || d.priorityLower || ''),
          requiredDate: String(d.requiredDate || ''),
          submittedDate: String(d.submittedDate || ''),
          totalAmount: Number(d.totalAmount || 0),
          justification: String(d.justification || ''),
          statusUI: String(d.statusUI || statusLabel || ''),
          vendorSelection: d.vendorSelection ? String(d.vendorSelection) : undefined,
          lineItems: items,
          approvalHistory: normalizeHistory(d.approvalHistory),
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load PR details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [prId, statusLabel]);

  const tabs = [
    { key: 'details' as const, label: 'PR Details', icon: 'ri-information-line' },
    {
      key: 'items' as const,
      label: `Line Items${pr ? ` (${pr.lineItems.length})` : ''}`,
      icon: 'ri-list-check-2',
    },
    {
      key: 'history' as const,
      label: `Approval History${pr?.approvalHistory?.length ? ` (${pr.approvalHistory.length})` : ''}`,
      icon: 'ri-history-line',
    },
  ];

  return (
    <tr>
      <td colSpan={colSpan} className="p-0 bg-slate-50 border-b border-teal-100">
        <div className="m-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-gradient-to-r from-teal-50 to-white border-b border-gray-100">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 truncate" title={pr ? `${pr.prNumber} — ${pr.title}` : undefined}>
                {pr?.prNumber || `PR #${prId}`}
                {pr?.title ? ` — ${pr.title}` : ''}
              </p>
              <p className="text-xs text-gray-500">Full PR details · Line items · Approval history</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              {actionSlot}
              {(pr?.statusUI || statusLabel) && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-700 whitespace-nowrap">
                  {pr?.statusUI || statusLabel}
                </span>
              )}
            </div>
          </div>

          <div className="flex border-b border-gray-100 px-3 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  tab === t.key
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <i className={t.icon}></i>
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {loading && (
              <div className="py-8 text-center text-sm text-gray-500">
                <i className="ri-loader-4-line animate-spin text-lg text-teal-600 mr-2"></i>
                Loading details...
              </div>
            )}

            {!loading && error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}

            {!loading && !error && pr && tab === 'details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    ['PR Number', pr.prNumber],
                    ['Department', pr.department],
                    ['Requester', pr.requester],
                    ['Request Type', pr.requestType],
                    ['Priority', pr.priority],
                    ['Required Date', pr.requiredDate || '—'],
                    ['Submitted', pr.submittedDate || '—'],
                    ['Total Amount', formatCurrency(pr.totalAmount)],
                    [
                      'Vendor Path',
                      pr.vendorSelection === 'own'
                        ? 'Own Vendor'
                        : pr.vendorSelection === 'scm'
                          ? 'SCM Vendor Selection'
                          : '—',
                    ],
                    ['Status', pr.statusUI || '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3 min-w-0">
                      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                      <p className="text-sm font-medium text-gray-900 break-words" title={String(value || '')}>
                        {value || '—'}
                      </p>
                    </div>
                  ))}
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Business Justification
                  </h4>
                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 break-words">
                    {pr.justification || 'No justification provided.'}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Manager &amp; L2 Comments
                  </h4>
                  <ManagerL2CommentsHighlight history={pr.approvalHistory} />
                </div>
              </div>
            )}

            {!loading && !error && pr && tab === 'items' && (
              <div className="overflow-x-auto">
                {pr.lineItems.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">No line items found</p>
                ) : (
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase w-10">#</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase w-[140px]">Category</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase w-16">Qty</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase w-[110px]">Unit Price</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase w-[110px]">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pr.lineItems.map((item, idx) => {
                        const unit = Number(item.unitPrice ?? item.unitCost ?? 0);
                        const total = Number(item.total ?? Number(item.quantity || 0) * unit);
                        return (
                          <tr key={item.id ?? idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2.5 text-gray-500">{idx + 1}</td>
                            <td className="px-3 py-2.5 font-medium text-gray-900 break-words">
                              {item.description || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-gray-700 truncate" title={item.category || undefined}>
                              {item.category || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-700 tabular-nums">
                              {item.quantity ?? '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-700 tabular-nums whitespace-nowrap">
                              {formatCurrency(unit)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                              {formatCurrency(total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={5} className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">
                          Grand Total
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm font-bold text-teal-700 tabular-nums whitespace-nowrap">
                          {formatCurrency(pr.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )}

            {!loading && !error && pr && tab === 'history' && (
              <div className="space-y-4">
                <ManagerL2CommentsHighlight history={pr.approvalHistory} />
                <ApprovalHistoryPanel history={pr.approvalHistory} />
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
