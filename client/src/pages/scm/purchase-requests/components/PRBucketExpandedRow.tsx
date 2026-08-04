import { useEffect, useState } from 'react';
import VendorComparisonMatrix from '../../../../components/rfq/VendorComparisonMatrix';
import { prApi, rfqApi, VendorComparisonData } from '../../../../services/api';

interface LineItem {
  id?: number;
  description?: string;
  category?: string;
  quantity?: number;
  unitPrice?: number;
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
  lineItems: LineItem[];
}

interface Props {
  prId: number;
  colSpan: number;
  statusLabel: string;
  showCreatePo?: boolean;
  onCreatePo?: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function PRBucketExpandedRow({
  prId,
  colSpan,
  statusLabel,
  showCreatePo = false,
  onCreatePo,
}: Props) {
  const [tab, setTab] = useState<'details' | 'items' | 'vendors'>('details');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pr, setPr] = useState<PRDetail | null>(null);
  const [comparison, setComparison] = useState<VendorComparisonData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [prRes, cmpRes] = await Promise.allSettled([
          prApi.get(prId),
          rfqApi.getComparison(prId),
        ]);

        if (cancelled) return;

        if (prRes.status === 'fulfilled') {
          const d = prRes.value.data as Record<string, unknown>;
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
            statusUI: String(d.statusUI || statusLabel),
            lineItems: items,
          });
        } else {
          throw prRes.reason instanceof Error ? prRes.reason : new Error('Failed to load PR');
        }

        if (cmpRes.status === 'fulfilled') {
          setComparison(cmpRes.value.data);
        } else {
          setComparison(null);
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
  }, [prId, statusLabel]);

  const tabs = [
    { key: 'details' as const, label: 'PR Details', icon: 'ri-information-line' },
    { key: 'items' as const, label: 'Line Items', icon: 'ri-list-check-2' },
    { key: 'vendors' as const, label: 'Vendor Comparison', icon: 'ri-table-line' },
  ];

  return (
    <tr>
      <td colSpan={colSpan} className="px-0 py-0 bg-slate-50 border-b border-teal-100">
        <div className="mx-5 my-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-teal-50 to-white border-b border-gray-100 gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ri-file-list-3-line text-teal-600"></i>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">
                  {pr?.prNumber || `PR #${prId}`}
                  {pr?.title ? ` — ${pr.title}` : ''}
                </p>
                <p className="text-xs text-gray-500">Expanded PR view</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {showCreatePo && (
                <button
                  type="button"
                  onClick={onCreatePo}
                  className="px-3 py-1.5 bg-teal-600 text-white rounded-md text-xs font-semibold"
                >
                  Create PO
                </button>
              )}
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-700 whitespace-nowrap">
                {pr?.statusUI || statusLabel}
              </span>
            </div>
          </div>

          <div className="flex border-b border-gray-100 px-5">
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
                {t.key === 'items' && pr ? ` (${pr.lineItems.length})` : ''}
                {t.key === 'vendors' && comparison ? ` (${comparison.vendorCount})` : ''}
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {[
                    ['Department', pr.department],
                    ['Requester', pr.requester],
                    ['Request Type', pr.requestType],
                    ['Priority', pr.priority],
                    ['Required Date', pr.requiredDate || '—'],
                    ['Submitted', pr.submittedDate || '—'],
                    ['Total Amount', formatCurrency(pr.totalAmount)],
                    ['Status', pr.statusUI],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                      <p className="text-sm font-medium text-gray-900">{value || '—'}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Business Justification
                  </h4>
                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3">
                    {pr.justification || 'No justification provided.'}
                  </p>
                </div>
                {comparison?.recommendedVendorName && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
                    <i className="ri-star-fill mr-1"></i>
                    Recommended vendor: <strong>{comparison.recommendedVendorName}</strong>
                  </div>
                )}
              </div>
            )}

            {!loading && !error && pr && tab === 'items' && (
              <div className="overflow-x-auto">
                {pr.lineItems.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">No line items found</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Qty</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Unit Price</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pr.lineItems.map((item, idx) => (
                        <tr key={item.id ?? idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-900">{item.description || '—'}</td>
                          <td className="px-3 py-2.5 text-gray-700">{item.category || '—'}</td>
                          <td className="px-3 py-2.5 text-right text-gray-700">{item.quantity ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right text-gray-700">
                            {formatCurrency(Number(item.unitPrice || 0))}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                            {formatCurrency(Number(item.total ?? Number(item.quantity || 0) * Number(item.unitPrice || 0)))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={5} className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">
                          Grand Total
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm font-bold text-teal-700">
                          {formatCurrency(pr.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )}

            {!loading && !error && tab === 'vendors' && (
              comparison ? (
                <VendorComparisonMatrix data={comparison} />
              ) : (
                <div className="py-8 text-center text-sm text-gray-500">
                  <i className="ri-store-2-line text-2xl text-gray-300 mb-2 block"></i>
                  No vendor comparison data available for this PR
                </div>
              )
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
