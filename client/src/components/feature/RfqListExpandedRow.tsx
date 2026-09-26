import { useCallback, useEffect, useState } from 'react';
import VendorComparisonMatrix from '../rfq/VendorComparisonMatrix';
import ApprovalHistoryPanel, {
  ManagerL2CommentsHighlight,
  type ApprovalHistoryEntry,
} from './ApprovalHistoryPanel';
import PrDocumentsPanel from './PrDocumentsPanel';
import { prApi, rfqApi, type PrAttachmentRecord, type VendorComparisonData } from '../../services/api';

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
  workStartDate?: string;
  workEndDate?: string;
  expectedDeliveryTimeline?: string;
  paymentTerms?: string;
  billingLocation?: string;
  billingGstNo?: string;
  billingAddress?: string;
  deliveryPoc?: string;
  placeOfDelivery?: string;
  submittedDate: string;
  /** When PR entered SCM RFQ Entry / SCM Verify */
  prDate?: string;
  scmRfqEntryDate?: string;
  entityName?: string;
  entityCode?: string;
  scopeOfWork?: string;
  totalAmount: number;
  justification: string;
  specialNotes?: string;
  statusUI: string;
  vendorSelection?: string;
  lineItems: LineItem[];
  approvalHistory: ApprovalHistoryEntry[];
  attachments: PrAttachmentRecord[];
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

/** Soft white card + primary blue pastel wash (dashboard detail tiles) */
const softDetailCard =
  'relative min-w-0 overflow-hidden rounded-2xl border border-transparent bg-white p-3.5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px] sm:p-4';

const softDetailWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;

function SoftDetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className={softDetailCard}>
      <div className="pointer-events-none absolute inset-0" style={softDetailWash} />
      <div className="relative z-[1]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <div className="mt-1.5 break-words text-sm font-semibold text-[#2C3E50]">{value?.trim() ? value : '—'}</div>
      </div>
    </div>
  );
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
  const iconStyles =
    tone === 'address'
      ? 'bg-[#E3F2FD] text-[#1E88E5]'
      : 'bg-amber-50 text-amber-600';

  return (
    <div className={`${softDetailCard} flex min-h-[120px] gap-3 ${className}`}>
      <div className="pointer-events-none absolute inset-0" style={softDetailWash} />
      <div className={`relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconStyles}`}>
        <i className={`${icon} text-lg`}></i>
      </div>
      <div className="relative z-[1] min-w-0 flex-1">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className="break-words text-sm font-semibold leading-relaxed whitespace-pre-wrap text-[#2C3E50]">
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
  const [tab, setTab] = useState<'details' | 'items' | 'documents' | 'vendors' | 'history'>('details');
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
          const attachments = Array.isArray(d.attachments)
            ? (d.attachments as PrAttachmentRecord[])
                .filter((f) => Number(f?.id) > 0)
                .map((f) => ({
                  id: Number(f.id),
                  prId: Number(f.prId) || prId,
                  fileName: String(f.fileName || ''),
                  size: Number(f.size) || 0,
                  mimeType: f.mimeType ? String(f.mimeType) : undefined,
                  uploadedAt: f.uploadedAt ? String(f.uploadedAt) : undefined,
                }))
            : [];
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
            workStartDate: String(d.workStartDate || ''),
            workEndDate: String(d.workEndDate || ''),
            billingLocation: String(d.billingLocation || ''),
            billingGstNo: String(d.billingGstNo || ''),
            billingAddress: String(d.billingAddress || ''),
            deliveryPoc: String(d.deliveryPoc || ''),
            placeOfDelivery: String(d.placeOfDelivery || ''),
            submittedDate: String(d.submittedDate || ''),
            prDate: String(d.prDate || d.scmRfqEntryDate || ''),
            scmRfqEntryDate: String(d.scmRfqEntryDate || d.prDate || ''),
            entityName: String(d.entityName || ''),
            entityCode: String(d.entityCode || ''),
            scopeOfWork: String(d.scopeOfWork || ''),
            totalAmount: Number(d.totalAmount || 0),
            justification: String(d.justification || ''),
            specialNotes: String(d.specialNotes || ''),
            statusUI: String(d.statusUI || statusLabel || ''),
            vendorSelection: d.vendorSelection ? String(d.vendorSelection) : undefined,
            lineItems: items,
            approvalHistory: normalizeHistory(d.approvalHistory),
            attachments,
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
      key: 'documents' as const,
      label: `PR Documents${pr?.attachments?.length ? ` (${pr.attachments.length})` : ''}`,
      icon: 'ri-file-list-3-line',
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
      {/* max-w-0 keeps wide expand content from stretching / double-scrolling the parent table */}
      <td colSpan={colSpan} className="max-w-0 bg-transparent p-0 align-top">
        <div className="relative m-2 box-border w-full max-w-full overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:m-3 sm:rounded-[18px]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
            }}
          />
          <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/40 px-4 py-3.5 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#2C3E50]" title={pr ? `${pr.prNumber} — ${pr.title}` : undefined}>
                <span className="text-[#1E88E5]">{pr?.prNumber || `PR #${prId}`}</span>
                {pr?.title ? ` — ${pr.title}` : ''}
              </p>
              <p className="text-xs text-slate-500">PR details · Documents · Line items · Vendor comparison · Approval history</p>
            </div>
            <div className="flex max-w-full flex-shrink-0 flex-wrap items-center gap-2">
              {actionSlot}
              {(pr?.statusUI || statusLabel) && (
                <span className="whitespace-nowrap rounded-full bg-[#E3F2FD] px-2.5 py-1 text-xs font-semibold text-[#1E88E5]">
                  {pr?.statusUI || statusLabel}
                </span>
              )}
            </div>
          </div>

          <div className="relative z-[1] flex flex-wrap gap-x-1 border-b border-slate-100/80 px-2 sm:px-3">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors sm:px-4 ${
                  tab === t.key
                    ? 'border-[#1E88E5] text-[#1E88E5]'
                    : 'border-transparent text-slate-500 hover:text-[#2C3E50]'
                }`}
              >
                <i className={t.icon}></i>
                {t.label}
              </button>
            ))}
          </div>

          <div
            className={`relative z-[1] max-w-full overflow-x-auto p-4 sm:p-5 ${
              tab === 'details' ? 'bg-[#F5F7FA]' : ''
            }`}
          >
            {loading && (
              <div className="py-8 text-center text-sm text-slate-500">
                <i className="ri-loader-4-line mr-2 animate-spin text-lg text-[#1E88E5]"></i>
                Loading details...
              </div>
            )}

            {!loading && error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}

            {!loading && !error && pr && tab === 'details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['PR Number', pr.prNumber],
                    ['PR Date', pr.prDate || pr.scmRfqEntryDate || '—'],
                    [
                      'Entity',
                      pr.entityCode && pr.entityName
                        ? `${pr.entityCode} — ${pr.entityName}`
                        : pr.entityName || pr.entityCode || '—',
                    ],
                    ['Department', pr.department],
                    ['Requester', pr.requester],
                    ['Request Type', pr.requestType],
                    ['Request Category', pr.requestCategory || '—'],
                    ['Project Detail', pr.projectDetail || '—'],
                    ['Priority', pr.priority],
                    ['Required Date', pr.requiredDate || '—'],
                    ...(pr.workStartDate || pr.workEndDate
                      ? [
                          ['Work Start Date', pr.workStartDate || '—'] as [string, string],
                          ['Work End Date', pr.workEndDate || '—'] as [string, string],
                        ]
                      : []),
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
                    <SoftDetailField key={label} label={label} value={value} />
                  ))}
                </div>

                <HighlightInfoCard
                  label="Scope of Work"
                  value={pr.scopeOfWork}
                  icon="ri-file-list-3-line"
                  tone="notes"
                  className="min-h-[100px]"
                />

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <HighlightInfoCard
                    label="Place of Delivery"
                    value={pr.placeOfDelivery}
                    icon="ri-map-pin-line"
                    tone="address"
                    className="min-h-[120px] lg:col-span-2"
                  />
                  <HighlightInfoCard
                    label="Billing Address"
                    value={pr.billingAddress}
                    icon="ri-building-line"
                    tone="address"
                    className="min-h-[120px] lg:col-span-2"
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
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Business Justification
                  </h4>
                  <div className={softDetailCard}>
                    <div className="pointer-events-none absolute inset-0" style={softDetailWash} />
                    <p className="relative z-[1] min-h-[80px] break-words whitespace-pre-wrap text-sm leading-relaxed text-[#2C3E50]">
                      {pr.justification || 'No justification provided.'}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Manager &amp; L2 Comments
                  </h4>
                  <ManagerL2CommentsHighlight history={pr.approvalHistory} />
                </div>

                <div className={softDetailCard}>
                  <div className="pointer-events-none absolute inset-0" style={softDetailWash} />
                  <div className="relative z-[1]">
                    <PrDocumentsPanel prId={pr.id} attachments={pr.attachments} compact />
                  </div>
                </div>
              </div>
            )}

            {!loading && !error && pr && tab === 'documents' && (
              <PrDocumentsPanel prId={pr.id} attachments={pr.attachments} />
            )}

            {!loading && !error && pr && tab === 'items' && (
              <div className="min-w-0 w-full max-w-full overflow-x-auto">
                {pr.lineItems.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">No line items found</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 bg-[#F8FBFF]">
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
                        <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums text-[#1E88E5] whitespace-nowrap">
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
                <div className="min-w-0 w-full max-w-full space-y-4 rounded-2xl bg-[#F5F7FA] p-3 sm:rounded-[18px] sm:p-4">
                  <VendorComparisonMatrix
                    data={comparison}
                    compact
                    onPreviewFile={(submissionId, vendorName, fileName) => {
                      void handlePreviewFile(submissionId, vendorName, fileName);
                    }}
                  />
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-2xl border border-transparent bg-white px-4 py-10 text-center shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
                    }}
                  />
                  <div className="relative z-[1]">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E3F2FD] text-[#1E88E5]">
                      <i className="ri-store-2-line text-xl"></i>
                    </div>
                    <p className="text-sm font-medium text-slate-600">No vendor comparison data yet</p>
                    <p className="mt-1 text-xs text-slate-400">Open RFQ entry to add vendors and quotes</p>
                  </div>
                </div>
              )
            )}

            {!loading && !error && pr && tab === 'history' && (
              <div className="space-y-4 rounded-2xl bg-[#F5F7FA] p-3 sm:rounded-[18px] sm:p-4">
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
