import { useEffect, useState } from 'react';
import ApprovalHistoryPanel, {
  ManagerL2CommentsHighlight,
  type ApprovalHistoryEntry,
} from '../../../../components/feature/ApprovalHistoryPanel';
import { poApi, prApi } from '../../../../services/api';

type TrackRowLite = {
  prId: number;
  poId: number | null;
  prNumber: string;
  poNumber: string | null;
  title: string;
  department: string;
  requester: string;
  vendorName: string;
  amount: number;
  statusLabel: string;
  requiredDate: string;
  createdAt: string;
};

type Props = {
  row: TrackRowLite;
  colSpan?: number;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

function normalizeHistory(raw: unknown): ApprovalHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const r = item as Record<string, unknown>;
    return {
      stage: String(r.stage || ''),
      approver: String(r.approver || r.user || 'System'),
      user: String(r.user || r.approver || 'System'),
      role: String(r.role || ''),
      action: String(r.action || r.status || 'Updated'),
      status: String(r.status || r.action || ''),
      date: String(r.date || ''),
      remarks: String(r.remarks || ''),
    };
  });
}

export default function TrackPoExpandedRow({ row, colSpan = 9 }: Props) {
  const [tab, setTab] = useState<'details' | 'history'>('details');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pr, setPr] = useState<Record<string, unknown> | null>(null);
  const [po, setPo] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<ApprovalHistoryEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const tasks: Promise<unknown>[] = [];
        if (row.prId) tasks.push(prApi.get(row.prId));
        if (row.poId) tasks.push(poApi.get(row.poId));

        const results = await Promise.allSettled(tasks);
        if (cancelled) return;

        let prData: Record<string, unknown> | null = null;
        let poData: Record<string, unknown> | null = null;
        let idx = 0;

        if (row.prId) {
          const prRes = results[idx++];
          if (prRes.status === 'fulfilled') {
            prData = (prRes.value as { data: Record<string, unknown> }).data;
          }
        }
        if (row.poId) {
          const poRes = results[idx++];
          if (poRes.status === 'fulfilled') {
            poData = (poRes.value as { data: Record<string, unknown> }).data;
          }
        }

        setPr(prData);
        setPo(poData);

        // Prefer full PO history (PR + PO stages); fall back to PR history
        const poHist = normalizeHistory(poData?.approvalHistory);
        const prHist = normalizeHistory(prData?.approvalHistory);
        setHistory(poHist.length ? poHist : prHist);

        if (!prData && !poData) {
          setError('Could not load PR / PO details');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [row.prId, row.poId]);

  const tabs = [
    { key: 'details' as const, label: 'PR Details', icon: 'ri-information-line' },
    {
      key: 'history' as const,
      label: `Approval History${history.length ? ` (${history.length})` : ''}`,
      icon: 'ri-history-line',
    },
  ];

  return (
    <tr>
      <td colSpan={colSpan} className="p-0 bg-slate-50 border-b border-teal-100">
        <div className="m-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-gradient-to-r from-teal-50 to-white border-b border-gray-100">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">
                {row.prNumber || `PR #${row.prId}`}
                {row.poNumber ? ` · ${row.poNumber}` : ''}
              </p>
              <p className="text-xs text-gray-500 truncate">{row.title}</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-700">
              {row.statusLabel}
            </span>
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

            {!loading && !error && tab === 'details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    ['PR Number', String(pr?.prNumber || row.prNumber || '—')],
                    ['PO Number', String(po?.poNumber || row.poNumber || '—')],
                    ['Department', String(pr?.department || row.department || '—')],
                    ['Requester', String(pr?.requester || row.requester || '—')],
                    ['Vendor', String(po?.vendorName || row.vendorName || '—')],
                    ['Amount', formatCurrency(Number(po?.grandTotal ?? pr?.totalAmount ?? row.amount) || 0)],
                    ['Required / Delivery', String(po?.expectedDeliveryDate || pr?.requiredDate || row.requiredDate || '—')],
                    ['Created / Submitted', String(po?.createdAt || pr?.submittedDate || row.createdAt || '—')],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3 min-w-0">
                      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                      <p className="text-sm font-medium text-gray-900 break-words" title={value}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Business Justification
                  </h4>
                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 break-words">
                    {String(pr?.justification || 'No justification provided.')}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Manager &amp; L2 Comments
                  </h4>
                  <ManagerL2CommentsHighlight history={history} />
                </div>
              </div>
            )}

            {!loading && !error && tab === 'history' && (
              <div className="space-y-4">
                <ManagerL2CommentsHighlight history={history} />
                <ApprovalHistoryPanel history={history} />
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
