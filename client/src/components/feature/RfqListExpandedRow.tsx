import { useCallback, useEffect, useState } from 'react';
import VendorComparisonMatrix from '../rfq/VendorComparisonMatrix';
import ApprovalHistoryPanel, {
  ManagerL2CommentsHighlight,
  type ApprovalHistoryEntry,
} from './ApprovalHistoryPanel';
import { prApi, rfqApi, type VendorComparisonData } from '../../services/api';

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
  requestCategory?: string;
  projectDetail?: string;
  priority: string;
  requiredDate: string;
  expectedDeliveryTimeline?: string;
  paymentTerms?: string;
  billingLocation?: string;
  billingGstNo?: string;
  billingAddress?: string;
  deliveryPoc?: string;
  placeOfDelivery?: string;
  submittedDate: string;
  totalAmount: number;
  justification: string;
  specialNotes?: string;
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

function HighlightInfoCard({
  label,
  value,
  icon,
  tone,
  className = '',
}: {
  label: string;
  value?: string | null;
  icon: string;
  tone: 'address' | 'notes';
  className?: string;
}) {
  const styles = {
    address: {
      box: 'bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 border-teal-200',
      icon: 'bg-teal-600 text-white',
      label: 'text-teal-700',
      value: 'text-teal-950',
    },
    notes: {
      box: 'bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 border-amber-200',
      icon: 'bg-amber-500 text-white',
      label: 'text-amber-800',
      value: 'text-amber-950',
    },
  }[tone];

  return (
    <div className={`rounded-xl border p-4 min-h-[120px] flex gap-3 ${styles.box} ${className}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${styles.icon}`}>
        <i className={`${icon} text-lg`}></i>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${styles.label}`}>{label}</p>
        <p className={`text-sm font-semibold leading-relaxed whitespace-pre-wrap break-words ${styles.value}`}>
          {value?.trim() ? value : '—'}
        </p>
      </div>
    </div>
  );
}

export default function RfqListExpandedRow({
  prId,
  colSpan,
  statusLabel = '',
  actionSlot,
}: Props) {
  const [tab, setTab] = useState<'details' | 'items' | 'vendors' | 'history'>('details');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pr, setPr] = useState<PRDetail | null>(null);
  const [comparison, setComparison] = useState<VendorComparisonData | null>(null);

  const handlePreviewFile = useCallback(async (submissionId: number, _vendorName: string, fileName: string) => {
    try {
      const token = localStorage.getItem('p2p_token');
      const res = await fetch(rfqApi.quotationFileUrl(submissionId), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Could not load file');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'quotation';
        a.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      alert(`Could not preview ${fileName}`);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      setComparison(null);
      try {
        const [prRes, cmpRes] = await Promise.allSettled([prApi.get(prId), rfqApi.getComparison(prId)]);
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
            requestCategory: String(d.requestCategory || ''),
            projectDetail: String(d.projectDetail || ''),
            priority: String(d.priority || d.priorityLower || ''),
            requiredDate: String(d.requiredDate || ''),
            expectedDeliveryTimeline: String(d.expectedDeliveryTimeline || ''),
            paymentTerms: String(d.paymentTerms || ''),
            billingLocation: String(d.billingLocation || ''),
            billingGstNo: String(d.billingGstNo || ''),
            billingAddress: String(d.billingAddress || ''),
            deliveryPoc: String(d.deliveryPoc || ''),
            placeOfDelivery: String(d.placeOfDelivery || ''),
            submittedDate: String(d.submittedDate || ''),
            totalAmount: Number(d.totalAmount || 0),
            justification: String(d.justification || ''),
            specialNotes: String(d.specialNotes || ''),
            statusUI: String(d.statusUI || statusLabel || ''),
            vendorSelection: d.vendorSelection ? String(d.vendorSelection) : undefined,
            lineItems: items,
            approvalHistory: normalizeHistory(d.approvalHistory),
          });
        } else {
          throw prRes.reason instanceof Error ? prRes.reason : new Error('Failed to load PR details');
        }

        if (cmpRes.status === 'fulfilled') {
          setComparison(cmpRes.value.data);
        } else {
          setComparison(null);
        }
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
      key: 'vendors' as const,
      label: `Vendor Comparison${comparison?.vendorCount ? ` (${comparison.vendorCount})` : ''}`,
      icon: 'ri-table-line',
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
              <p className="text-xs text-gray-500">PR details · Line items · Vendor comparison · Approval history</p>
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
                    ['Request Category', pr.requestCategory || '—'],
                    ['Project Detail', pr.projectDetail || '—'],
                    ['Priority', pr.priority],
                    ['Required Date', pr.requiredDate || '—'],
                    ['Expected Timeline', pr.expectedDeliveryTimeline || '—'],
                    ['Payment Terms', pr.paymentTerms || '—'],
                    ['Billing Region', pr.billingLocation || '—'],
                    ['Billing GSTIN', pr.billingGstNo || '—'],
                    ['POC for Delivery', pr.deliveryPoc || '—'],
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <HighlightInfoCard
                    label="Place of Delivery"
                    value={pr.placeOfDelivery}
                    icon="ri-map-pin-line"
                    tone="address"
                    className="lg:col-span-2 min-h-[120px]"
                  />
                  <HighlightInfoCard
                    label="Billing Address"
                    value={pr.billingAddress}
                    icon="ri-building-line"
                    tone="address"
                    className="lg:col-span-2 min-h-[120px]"
                  />
                </div>

                <HighlightInfoCard
                  label="Special Notes"
                  value={pr.specialNotes}
                  icon="ri-sticky-note-line"
                  tone="notes"
                  className="min-h-[120px]"
                />

                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Business Justification
                  </h4>
                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 break-words whitespace-pre-wrap min-h-[80px]">
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

            {!loading && !error && pr && tab === 'vendors' && (
              comparison ? (
                <div className="min-w-0 w-full max-w-full">
                  <VendorComparisonMatrix
                    data={comparison}
                    compact
                    onPreviewFile={(submissionId, vendorName, fileName) => {
                      void handlePreviewFile(submissionId, vendorName, fileName);
                    }}
                  />
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-gray-500">
                  <i className="ri-store-2-line text-2xl text-gray-300 mb-2 block"></i>
                  No vendor comparison data yet — open RFQ entry to add vendors and quotes
                </div>
              )
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
