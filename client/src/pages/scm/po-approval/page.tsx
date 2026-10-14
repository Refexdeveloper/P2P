
import { useState, useMemo, useEffect, useCallback, useRef, Fragment, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import ApprovalHistoryPanel, {
  ManagerL2CommentsHighlight,
} from '../../../components/feature/ApprovalHistoryPanel';
import POApprovalModal from './components/POApprovalModal';
import VendorComparisonMatrix from '../../../components/rfq/VendorComparisonMatrix';
import { poApi, rfqApi, VendorComparisonData } from '../../../services/api';
import type { POData } from '../../../mocks/po-data';
import { PM_BTN_PRIMARY, PM_BTN_SECONDARY } from '../../../constants/pmTheme';
import AnimatedKpiCard, { type KpiVariant } from '../../../components/feature/AnimatedKpiCard';
import '../../../styles/dashboard-fx.css';
import { useAuth } from '../../../contexts/AuthContext';
import { isMugeshUser } from '../../../utils/roleDisplay';
import meetSignature from '../../../assets/signatures/meet_g_default.png';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

function htmlToPlain(html: string): string {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function lineItemDescription(li: Record<string, unknown>) {
  const name = htmlToPlain(String(li.itemName || ''));
  const description = htmlToPlain(String(li.description || ''));
  if (name && description && name.toLowerCase() !== description.toLowerCase()) {
    return `${name}\n${description}`;
  }
  return name || description || '—';
}

const softWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;



/** Manager still needs to act */
function poaGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const isAwaitingManager = (status: string) => {
  const s = String(status || '');
  return (
    s === 'Pending SCM Manager Sign' ||
    s === 'Pending Approval' ||
    s === 'pending_approval' ||
    s === 'Sign & Upload'
  );
};

const isRejected = (status: string) => {
  const s = String(status || '');
  return s === 'PO Rejected' || s === 'WO Rejected' || s === 'rejected';
};

/** Manager already signed — includes buyer verify, vendor, GRN, invoice, payment */
const isManagerApproved = (status: string) => {
  const s = String(status || '');
  if (isAwaitingManager(s) || isRejected(s)) return false;
  if (!s || s === 'Draft' || s === 'Cancelled' || s === 'Imported') return false;
  return true;
};
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    'Pending SCM Manager Sign': 'bg-amber-100 text-amber-700 border border-amber-200',
    'Pending Approval': 'bg-amber-100 text-amber-700 border border-amber-200',
    'SCM Manager Signed — Buyer Verify': 'bg-blue-100 text-blue-700 border border-blue-200',
    'Pending Buyer Verify': 'bg-blue-100 text-blue-700 border border-blue-200',
    'PO Approved': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'WO Approved': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'Sent to Vendor': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'Pending Vendor Acceptance': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'Vendor Accepted': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'Partially Accepted': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'Awaiting GRN': 'bg-cyan-100 text-cyan-700 border border-cyan-200',
    'GRN Completed': 'bg-cyan-100 text-cyan-700 border border-cyan-200',
    'Invoice Entry': 'bg-indigo-100 text-indigo-700 border border-indigo-200',
    'Pending Accounts Approval': 'bg-indigo-100 text-indigo-700 border border-indigo-200',
    'Approved for Payment': 'bg-indigo-100 text-indigo-700 border border-indigo-200',
    Paid: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'PO Rejected': 'bg-red-100 text-red-700 border border-red-200',
    'WO Rejected': 'bg-red-100 text-red-700 border border-red-200',
    'Vendor Rejected': 'bg-red-100 text-red-700 border border-red-200',
  };
  const icon: Record<string, string> = {
    'Pending SCM Manager Sign': 'ri-time-line',
    'Pending Approval': 'ri-time-line',
    'SCM Manager Signed — Buyer Verify': 'ri-shield-check-line',
    'Pending Buyer Verify': 'ri-shield-check-line',
    'PO Approved': 'ri-check-double-line',
    'WO Approved': 'ri-check-double-line',
    'Sent to Vendor': 'ri-mail-send-line',
    'PO Rejected': 'ri-close-circle-line',
    'WO Rejected': 'ri-close-circle-line',
  };
  return (
    <span
      title={status}
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-600'}`}
    >
      <i className={`${icon[status] || 'ri-question-line'} shrink-0`}></i>
      <span className="truncate">{status}</span>
    </span>
  );
};

const PriorityBadge = ({ priority }: { priority: string }) => {
  const map: Record<string, string> = {
    high: 'bg-red-50 text-red-600 border border-red-200',
    medium: 'bg-amber-50 text-amber-600 border border-amber-200',
    low: 'bg-gray-100 text-gray-500 border border-gray-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold capitalize whitespace-nowrap ${map[priority] || 'bg-gray-100 text-gray-500'}`}>
      <i className="ri-flag-line text-xs"></i>
      {priority}
    </span>
  );
};

interface ExpandedRowProps {
  po: POData;
  poId?: number;
  onApprove: () => void;
  onReject: () => void;
  onSendBack: () => void;
  onEdit: () => void;
  onViewPdf: () => void;
  isPending: boolean;
  mugeshMode?: boolean;
}

function ExpandedRow({ po, poId, onApprove, onReject, onSendBack, onEdit, onViewPdf, isPending, mugeshMode = false }: ExpandedRowProps) {
  const expandWrapRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'items' | 'comparison' | 'history'>('details');
  const [comparisonData, setComparisonData] = useState<(VendorComparisonData & { source?: string }) | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState('');
  const [filePreview, setFilePreview] = useState<{ url: string; fileName: string } | null>(null);

  useEffect(() => {
    const el = expandWrapRef.current;
    if (!el) return;
    const scrollParent = el.closest('[data-po-approval-scroll]') as HTMLElement | null;
    const update = () => {
      const w = scrollParent?.clientWidth ?? el.parentElement?.clientWidth ?? 0;
      if (w > 0) setPanelWidth(w);
    };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (scrollParent && ro) ro.observe(scrollParent);
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'comparison') return;
    if (!po.prDbId && !poId) return;

    let cancelled = false;
    setComparisonLoading(true);
    setComparisonError('');

    const load = po.prDbId
      ? rfqApi.getComparison(po.prDbId)
      : poApi.getComparison(Number(poId));

    load
      .then((res) => {
        if (!cancelled) setComparisonData(res.data);
      })
      .catch(async (err) => {
        // Manual / no-PR: fall back to PO comparison endpoint
        if (po.prDbId && poId) {
          try {
            const fallback = await poApi.getComparison(Number(poId));
            if (!cancelled) {
              setComparisonData(fallback.data);
              setComparisonError('');
            }
            return;
          } catch {
            /* use original error */
          }
        }
        if (!cancelled) {
          setComparisonData(null);
          setComparisonError(err instanceof Error ? err.message : 'Failed to load vendor comparison');
        }
      })
      .finally(() => {
        if (!cancelled) setComparisonLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, po.prDbId, poId]);

  const handlePreviewFile = async (submissionId: number, _vendorName: string, fileName: string) => {
    try {
      const token = localStorage.getItem('p2p_token');
      const res = await fetch(rfqApi.quotationFileUrl(submissionId), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Could not load file');
      const blob = await res.blob();
      setFilePreview({ url: URL.createObjectURL(blob), fileName });
    } catch {
      setComparisonError(`Failed to preview ${fileName}`);
    }
  };

  useEffect(() => {
    return () => {
      if (filePreview?.url) URL.revokeObjectURL(filePreview.url);
    };
  }, [filePreview]);

  return (
    <tr>
      <td colSpan={9} className="max-w-0 bg-transparent p-0 align-top">
        <div
          ref={expandWrapRef}
          className="sticky left-0 z-[5] box-border min-w-0"
          style={{
            width: panelWidth ? `${panelWidth}px` : '100%',
            maxWidth: panelWidth ? `${panelWidth}px` : '100%',
          }}
        >
        <div className="box-border w-full max-w-full overflow-x-hidden px-2 py-2 sm:px-3">
        <div className="relative min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-transparent bg-[#F5F7FA] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
          <div className="pointer-events-none absolute inset-0" style={softWash} />
          {/* Expanded Header */}
          <div className="relative z-[1] flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3 px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-100/80 bg-gradient-to-r from-white to-[#e6f6f8]/40">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-10 h-10 bg-[#e6f6f8] rounded-xl flex items-center justify-center flex-shrink-0 text-[#0f6b7a]">
                <i className="ri-file-text-line text-lg"></i>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#2C3E50] truncate">{po.poNumber}</p>
                <p className="text-xs text-slate-500 truncate">{po.prTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={onViewPdf}
                className={`${PM_BTN_SECONDARY} !px-3 !py-1.5 !text-xs`}
              >
                <i className="ri-file-pdf-line"></i> View PDF
              </button>
              {isPending && (
                <>
                  {!mugeshMode && (
                  <button
                    type="button"
                    onClick={onEdit}
                    className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <i className="ri-edit-line"></i> Edit PO
                  </button>
                  )}
                  <button
                    onClick={onApprove}
                    className={`${PM_BTN_PRIMARY} !px-3 !py-1.5 !text-xs`}
                  >
                    <i className="ri-quill-pen-line"></i> {mugeshMode ? 'Approve' : 'Sign & Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={onSendBack}
                    className="px-3 py-1.5 sm:px-4 text-xs font-semibold text-orange-700 bg-white border border-orange-200 rounded-xl hover:bg-orange-50 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <i className="ri-arrow-go-back-line"></i> {mugeshMode ? 'Send Back to Requester' : 'Send Back'}
                  </button>
                  {!mugeshMode && (
                  <button
                    onClick={onReject}
                    className="px-3 py-1.5 sm:px-4 text-xs font-semibold text-rose-600 bg-white border border-rose-200 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <i className="ri-close-circle-line"></i> Reject PO
                  </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="relative z-[1] flex flex-wrap border-b border-slate-100 bg-white px-2 sm:px-6">
            {[
              { key: 'details', label: 'PO Details', icon: 'ri-information-line' },
              { key: 'items', label: 'Line Items', icon: 'ri-list-check-2' },
              { key: 'comparison', label: 'Vendor Comparison', icon: 'ri-bar-chart-box-line' },
              { key: 'history', label: `Approval History${po.approvalHistory.length ? ` (${po.approvalHistory.length})` : ''}`, icon: 'ri-history-line' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'details' | 'items' | 'comparison' | 'history')}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-[#0f6b7a] text-[#0f6b7a]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <i className={tab.icon}></i>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="relative z-[1] min-w-0 max-w-full overflow-x-hidden p-3 sm:p-6">
            {activeTab === 'details' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* PO Summary */}
                <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
                  {[
                    { label: 'PO Number', value: po.poNumber, icon: 'ri-file-text-line', color: 'text-[#0f6b7a]' },
                    { label: 'PR Reference', value: po.prId, icon: 'ri-links-line', color: 'text-[#0f6b7a]' },
                    { label: 'PO Date', value: po.createdDate, icon: 'ri-calendar-line', color: 'text-[#2C3E50]' },
                    { label: 'Expected Delivery', value: po.expectedDeliveryDate, icon: 'ri-truck-line', color: 'text-[#2C3E50]' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-transparent bg-[#F8FAFC] p-3">
                      <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                        <i className={`${item.icon} text-xs`}></i>{item.label}
                      </p>
                      <p className={`text-sm font-semibold ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Left Column */}
                <div className="lg:col-span-2 space-y-4">
                  {/* PR Details */}
                  <div className="rounded-xl border border-transparent bg-[#F8FAFC] p-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <i className="ri-file-list-3-line text-[#0f6b7a]"></i> Purchase Request Details
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Title</p>
                        <p className="text-sm font-medium text-[#2C3E50]">{po.prTitle}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Department</p>
                        <p className="text-sm font-medium text-[#2C3E50]">{po.department}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Requester</p>
                        <p className="text-sm font-medium text-[#2C3E50]">{po.requester}</p>
                      </div>
                    </div>
                    <ManagerL2CommentsHighlight history={po.approvalHistory} />
                  </div>

                  {/* Vendor Info */}
                  <div className="rounded-xl border border-[#c5e6eb]/80 bg-[#e6f6f8]/40 p-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <i className="ri-store-2-line text-[#0f6b7a]"></i> Vendor Information
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Vendor Name</p>
                        <p className="text-sm font-semibold text-[#2C3E50]">{po.vendor}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Payment Terms</p>
                        <p className="text-sm font-medium text-[#2C3E50]">{po.paymentTerms}</p>
                      </div>
                    </div>
                  </div>

                  {/* Delivery */}
                  <div className="rounded-xl border border-transparent bg-[#F8FAFC] p-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <i className="ri-map-pin-line text-[#0f6b7a]"></i> Delivery Details
                    </h4>
                    <p className="text-xs text-slate-500 mb-1">Delivery Address</p>
                    <p className="text-sm text-[#2C3E50] leading-relaxed">{po.deliveryAddress}</p>
                  </div>

                  {po.specialInstructions && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <i className="ri-alert-line"></i> Special Instructions
                      </h4>
                      <p className="text-sm text-gray-700 leading-relaxed">{po.specialInstructions}</p>
                    </div>
                  )}
                </div>

                {/* Right Column - Billing */}
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 rounded-lg p-4 lg:sticky lg:top-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-1.5">
                      <i className="ri-receipt-line text-[#0f6b7a]"></i> Billing Summary
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Subtotal</span>
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(po.subtotal)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">GST ({po.gstPercentage}%)</span>
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(po.taxAmount)}</span>
                      </div>
                      <div className="pt-3 border-t-2 border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-gray-900">Grand Total</span>
                          <span className="text-xl font-bold text-[#0f6b7a]">{formatCurrency(po.grandTotal)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Created By</p>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-[#e6f6f8] rounded-full flex items-center justify-center">
                          <span className="text-[#0b5361] text-xs font-bold">
                            {(po.createdBy || 'SB').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-800">{po.createdBy || 'SCM Buyer'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'items' && (
              <div>
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {['#', 'Item Description', 'Qty', 'Unit Price', 'Total'].map((h) => (
                          <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide ${h === '#' || h === 'Qty' ? 'text-center' : h === 'Unit Price' || h === 'Total' ? 'text-right' : 'text-left'}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {po.lineItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-500 text-center">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-pre-line">{item.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 text-center">{item.quantity}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[#e6f6f8]/50 border-t-2 border-[#a9dbe2]">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-700 text-right">Subtotal</td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">{formatCurrency(po.subtotal)}</td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="px-4 py-2 text-sm text-gray-600 text-right">GST ({po.gstPercentage}%)</td>
                        <td className="px-4 py-2 text-sm text-gray-700 text-right">{formatCurrency(po.taxAmount)}</td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-base font-bold text-gray-900 text-right">Grand Total</td>
                        <td className="px-4 py-3 text-base font-bold text-[#0f6b7a] text-right">{formatCurrency(po.grandTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'comparison' && (
              <div>
                {comparisonLoading ? (
                  <div className="py-16 text-center text-gray-400">
                    <i className="ri-loader-4-line animate-spin text-2xl"></i>
                    <p className="mt-2 text-sm">Loading vendor comparison...</p>
                  </div>
                ) : comparisonError ? (
                  <div className="py-8 px-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {comparisonError}
                  </div>
                ) : comparisonData ? (
                  <div className="space-y-4 min-w-0 max-w-full">
                    <div className="flex flex-wrap items-center gap-3 p-3 bg-[#e6f6f8]/50 border border-[#c5e6eb] rounded-lg text-sm">
                      <span className="font-semibold text-[#0b5361]">{comparisonData.pr.prNumber}</span>
                      <span className="text-[#0b5361]">{comparisonData.vendorCount} vendors quoted</span>
                      {(comparisonData as { source?: string }).source === 'manual' && (
                        <span className="text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
                          Manual Create comparison
                        </span>
                      )}
                      {(comparisonData as { source?: string }).source === 'default' && (
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                          Default (PO vendor)
                        </span>
                      )}
                      {comparisonData.recommendedVendorName && (
                        <span className="text-emerald-700 font-medium">
                          <i className="ri-star-fill mr-1"></i>
                          Recommended: {comparisonData.recommendedVendorName}
                        </span>
                      )}
                      {po.vendor && (
                        <span className="text-gray-700">
                          PO Vendor: <strong>{po.vendor}</strong>
                        </span>
                      )}
                    </div>
                    <div className="max-w-full overflow-x-auto">
                      <VendorComparisonMatrix
                        data={comparisonData}
                        poId={poId}
                        onPreviewFile={handlePreviewFile}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic py-8 text-center">No vendor comparison data available.</p>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-4">
                <ManagerL2CommentsHighlight history={po.approvalHistory} />
                <ApprovalHistoryPanel history={po.approvalHistory} />
              </div>
            )}
          </div>
        </div>
        </div>
        </div>

        {filePreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <span className="font-semibold text-gray-900">{filePreview.fileName}</span>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(filePreview.url);
                    setFilePreview(null);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 text-xl cursor-pointer"
                >
                  ×
                </button>
              </div>
              <div className="p-4 flex-1 overflow-auto">
                {/\.pdf$/i.test(filePreview.fileName) ? (
                  <iframe title="Quotation preview" src={filePreview.url} className="w-full h-[70vh] border border-gray-200 rounded-lg" />
                ) : (
                  <img src={filePreview.url} alt={filePreview.fileName} className="max-h-[70vh] mx-auto rounded-lg" />
                )}
              </div>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function POApprovalPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mugeshMode = isMugeshUser(user);
  const meetMode = String(user?.email || '').trim().toLowerCase() === 'meet.g@refex.co.in';
  const [searchParams] = useSearchParams();
  const [poList, setPoList] = useState<POData[]>([]);
  const [poIdMap, setPoIdMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filter, setFilter] = useState(() => {
    const f = String(searchParams.get('filter') || 'all').toLowerCase();
    return ['all', 'pending', 'approved', 'rejected'].includes(f) ? f : 'all';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'approve' | 'reject' | 'sendback';
    poId: number;
    poNumber: string;
    prTitle: string;
    grandTotal: number;
  }>({ isOpen: false, type: 'approve', poId: 0, poNumber: '', prTitle: '', grandTotal: 0 });

  const mapApiPo = (raw: Record<string, unknown>): POData => ({
    poNumber: String(raw.poNumber),
    prId: String(raw.prNumber),
    prDbId: Number(raw.prId) || 0,
    prTitle: String(raw.prTitle || ''),
    vendor: String(raw.vendorName || ''),
    department: String(raw.department || ''),
    requester: String(raw.requester || ''),
    grandTotal: Number(raw.grandTotal) || 0,
    subtotal: Number(raw.subtotal) || 0,
    gstPercentage: Number(raw.gstPercentage) || 18,
    taxAmount: Number(raw.taxAmount) || 0,
    status: String(raw.status) as POData['status'],
    priority: (String(raw.priority || 'medium').toLowerCase() as POData['priority']),
    createdDate: String(raw.poDate || raw.createdAt || ''),
    expectedDeliveryDate: String(raw.expectedDeliveryDate || ''),
    paymentTerms: String(raw.paymentTerms || ''),
    incoterms: String(raw.incoterms || ''),
    deliveryAddress: String(raw.deliveryAddress || ''),
    specialInstructions: String(raw.specialInstructions || ''),
    createdBy: String(raw.createdBy || 'SCM Buyer'),
    lineItems: ((raw.lineItems as Array<Record<string, unknown>>) || []).map((li) => ({
      id: String(li.id),
      description: lineItemDescription(li),
      quantity: Number(li.quantity) || 0,
      unitPrice: Number(li.unitPrice) || 0,
      total: Number(li.total) || 0,
    })),
    approvalHistory: ((raw.approvalHistory as Array<Record<string, unknown>>) || []).map((item) => ({
      stage: String(item.stage || ''),
      approver: String(item.approver || item.user || 'System'),
      role: String(item.role || ''),
      action: String(item.action || item.status || 'Updated'),
      date: String(item.date || ''),
      remarks: String(item.remarks || ''),
    })),
  });

  const loadPos = useCallback(async () => {
    try {
      setLoading(true);
      const res = await poApi.list();
      const rawList = (res.data as Record<string, unknown>[]) || [];
      const items = rawList.map(mapApiPo);
      const idMap: Record<string, number> = {};
      rawList.forEach((r) => {
        idMap[String(r.poNumber)] = Number(r.id);
      });
      setPoList(items);
      setPoIdMap(idMap);
    } catch (err) {
      console.error('Failed to load POs for manager approval', err);
      setPoList([]);
      setPoIdMap({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPos();
  }, [loadPos]);

  useEffect(() => {
    const raw = searchParams.get('filter');
    const f = String(raw || 'all').toLowerCase();
    if (!['all', 'pending', 'approved', 'rejected'].includes(f)) return;
    setFilter(f);
    if (raw && f !== 'all') {
      window.requestAnimationFrame(() =>
        document.getElementById('po-approval-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      );
    }
  }, [searchParams]);

  useEffect(() => {
    const poId = Number(searchParams.get('poId') || 0);
    if (!poId || !poList.length) return;
    const poNumber = Object.entries(poIdMap).find(([, id]) => id === poId)?.[0];
    if (poNumber) setExpandedRow(poNumber);
  }, [searchParams, poList, poIdMap]);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const openModal = (poNumber: string, type: 'approve' | 'reject' | 'sendback') => {
    const po = poList.find((p) => p.poNumber === poNumber);
    const poId = poIdMap[poNumber];
    if (!po || !poId) return;
    setModal({ isOpen: true, type, poId, poNumber, prTitle: po.prTitle, grandTotal: po.grandTotal });
  };

  const startSign = (poNumber: string) => {
    openModal(poNumber, 'approve');
  };

  const handleConfirm = async (
    remarks: string,
    signature?: {
      signatureImage?: string;
      signatureId?: number;
      saveToGallery?: boolean;
      signatureName?: string;
      dsc?: { holderName: string; serial: string; issuer: string; validTill: string };
    }
  ) => {
    try {
      if (modal.type === 'approve') {
        const res = mugeshMode
          ? await poApi.mugeshSign(modal.poId, { remarks })
          : await poApi.sign(modal.poId, remarks, signature);
        showToast(
          res.message ||
            (mugeshMode
              ? `${modal.poNumber} signed — Buyer Final Verify is with the requester`
              : `${modal.poNumber} signed — SCM Buyer final verify next`),
          'success'
        );
        setExpandedRow(null);
        navigate(`/scm/po-pdf-view?poId=${modal.poId}&from=po-approval`);
        return;
      } else if (modal.type === 'sendback') {
        const res = mugeshMode
          ? await poApi.mugeshSendBack(modal.poId, remarks)
          : await poApi.sendBack(modal.poId, remarks);
        showToast(
          res.message ||
            (mugeshMode
              ? `${modal.poNumber} sent back to the requester`
              : `${modal.poNumber} sent back to SCM Buyer for revision`),
          'success'
        );
      } else {
        await poApi.reject(modal.poId, remarks);
        showToast(`${modal.poNumber} has been rejected`, 'error');
      }
      setExpandedRow(null);
      await loadPos();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', 'error');
      throw err;
    }
  };

  const processedPOs = poList;

  const filteredPOs = useMemo(() => {
    let result = [...processedPOs];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(po =>
        po.poNumber.toLowerCase().includes(q) ||
        po.prId.toLowerCase().includes(q) ||
        po.prTitle.toLowerCase().includes(q) ||
        po.vendor.toLowerCase().includes(q) ||
        po.requester.toLowerCase().includes(q) ||
        po.department.toLowerCase().includes(q)
      );
    }
    if (filter === 'pending') {
      result = result.filter((po) => isAwaitingManager(po.status));
    } else if (filter === 'approved') {
      result = result.filter((po) => isManagerApproved(po.status));
    } else if (filter === 'rejected') {
      result = result.filter((po) => isRejected(po.status));
    }
    // Pending first
    result.sort((a, b) => {
      const aP = isAwaitingManager(a.status) ? 0 : 1;
      const bP = isAwaitingManager(b.status) ? 0 : 1;
      return aP - bP;
    });
    return result;
  }, [processedPOs, searchTerm, filter]);

  const stats = useMemo(() => ({
    pending: processedPOs.filter((p) => isAwaitingManager(p.status)).length,
    approved: processedPOs.filter((p) => isManagerApproved(p.status)).length,
    rejected: processedPOs.filter((p) => isRejected(p.status)).length,
    totalPendingValue: processedPOs
      .filter((p) => isAwaitingManager(p.status))
      .reduce((s, p) => s + p.grandTotal, 0),
  }), [processedPOs]);

  const toggleRow = (poNumber: string) => {
    setExpandedRow(prev => prev === poNumber ? null : poNumber);
  };

  const goTable = () =>
    window.requestAnimationFrame(() =>
      document.getElementById('po-approval-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );

  const tabCounts: Record<string, number> = {
    all: processedPOs.length,
    pending: stats.pending,
    approved: stats.approved,
    rejected: stats.rejected,
  };

  return (
    <DashboardLayout>
      <div className="tasks-fx min-h-full font-sans text-[#0F172A]">
        <section className="tfx-hero">
          <div className="tfx-bubbles" aria-hidden="true">
            <i /><i /><i /><i /><i /><i /><i />
          </div>
          <div className="tfx-hero-content">
            <div className="tfx-hi">
              {poaGreeting()}, {user?.name || 'there'} <span className="tfx-wave">👋</span>
            </div>
            <h1>
              <span className="tfx-shimmer">{mugeshMode ? 'PO Approval' : 'PO Sign & Approve'}</span>
            </h1>
            <p className="max-w-[640px]">
              {mugeshMode
                ? 'Requester-created POs. Your default signature, name Mugesh M, and designation IT Infrastructure Head are printed on the PDF.'
                : 'Sign POs with comments — after sign-off, SCM Buyer final-verifies before the vendor email is sent'}
            </p>
          </div>
          <div className="tfx-period hidden min-[992px]:block">
            <p className="tfx-period-lbl">Pending approval value</p>
            <div className="flex items-center gap-3 px-1 pb-1">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6f6f8] text-[#0f6b7a]">
                <i className="ri-money-rupee-circle-line text-xl" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold tabular-nums text-slate-900">
                  {formatCurrency(stats.totalPendingValue)}
                </p>
                <p className="text-xs text-slate-500">
                  {stats.pending} PO{stats.pending !== 1 ? 's' : ''} awaiting you
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="tfx-kpis mb-4">
          {loading ? (
            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="min-h-[170px] animate-pulse rounded-[18px] bg-white/90 shadow-[0_10px_30px_rgba(20,90,120,0.08)]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:grid-cols-4">
              {(
                [
                  { key: 'pending', label: 'Pending Approval', value: stats.pending, variant: 'pending_approval', sub: stats.pending ? 'Awaiting your sign-off' : 'Nothing waiting', live: stats.pending > 0 },
                  { key: 'approved', label: 'Approved', value: stats.approved, variant: 'approved', sub: 'Signed by you', live: false },
                  { key: 'rejected', label: 'Rejected', value: stats.rejected, variant: 'rejected', sub: stats.rejected ? 'Declined POs' : 'No rejected POs', live: false },
                  { key: 'all', label: 'Total POs', value: processedPOs.length, variant: 'all', sub: 'All purchase orders', live: false },
                ] as const
              ).map((card, i) => (
                <AnimatedKpiCard
                  key={card.key}
                  title={card.label}
                  value={card.value}
                  variant={card.variant as KpiVariant}
                  index={i}
                  total={processedPOs.length}
                  subtitle={card.sub}
                  live={card.live}
                  selected={filter === card.key}
                  toastText={`Showing ${card.label.toLowerCase()} POs`}
                  onClick={() => {
                    setFilter(card.key);
                    goTable();
                  }}
                />
              ))}
            </div>
          )}
        </section>

        <div className="p-2 pb-4 pt-0 sm:p-3 sm:pt-0 lg:p-6 lg:pt-0">
          <section
            id="po-approval-table"
            className="tfx-panel relative scroll-mt-24 overflow-hidden rounded-2xl border border-white/70 bg-white"
          >
            <div className="flex flex-col gap-3 px-4 py-4">
              <div className="flex items-center gap-3.5 pb-1">
                <div className="tfx-panel-ic flex h-12 w-12 items-center justify-center rounded-xl">
                  <i className="ri-checkbox-circle-line text-lg sm:text-xl" aria-hidden />
                </div>
                <div>
                  <h2 className="tfx-panel-title text-lg font-semibold text-slate-900">Purchase Order Approvals</h2>
                  <p className="mt-1.5 text-sm text-slate-500">
                    Showing <strong className="text-slate-800">{filteredPOs.length}</strong> purchase order
                    {filteredPOs.length !== 1 ? 's' : ''} · click any row to expand
                  </p>
                </div>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                <div className="relative shrink-0">
                  <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                  <input
                    type="text"
                    placeholder="Search PO, vendor, requester..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="tfx-input h-10 w-72 rounded-xl border bg-white pl-10 pr-4 text-sm outline-none"
                  />
                </div>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'pending', label: 'Pending' },
                  { key: 'approved', label: 'Approved' },
                  { key: 'rejected', label: 'Rejected' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFilter(tab.key)}
                    className={`tfx-tab inline-flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-xs font-semibold ${
                      filter === tab.key ? 'is-active border border-transparent text-white' : 'border border-[#e3eaef] bg-white text-slate-700'
                    }`}
                  >
                    {tab.label}
                    <span className="tfx-cnt">{tabCounts[tab.key] ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2.5 px-3 pb-3 md:hidden">
              {filteredPOs.map((po, rowIndex) => {
                const isExpanded = expandedRow === po.poNumber;
                const isPending = isAwaitingManager(po.status);
                return (
                  <div
                    key={`m-${po.poNumber}`}
                    style={{ '--r': rowIndex } as CSSProperties}
                    className={`tfx-card overflow-hidden rounded-2xl border bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] ${
                      isExpanded ? 'border-[#a9dbe2]' : 'border-[#e9f0f3]'
                    }`}
                  >
                    <button type="button" onClick={() => toggleRow(po.poNumber)} className="flex w-full items-start gap-3 px-3 py-3 text-left">
                      <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${isExpanded ? 'bg-[#0f6b7a] text-white' : 'bg-[#e6f6f8] text-[#0f6b7a]'}`}>
                        <i className={`text-sm ${isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-bold text-[#0f6b7a]">{po.poNumber}</p>
                          <StatusBadge status={po.status} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{po.prTitle || po.prId}</p>
                        <p className="mt-1 truncate text-xs text-slate-600">{po.vendor}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{formatCurrency(po.grandTotal)}</span>
                          <PriorityBadge priority={po.priority} />
                        </div>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-0 pb-2">
                        <table className="w-full">
                          <tbody>
                            <ExpandedRow
                              po={po}
                              poId={poIdMap[po.poNumber]}
                              isPending={isPending}
                              mugeshMode={mugeshMode}
                              onApprove={() => startSign(po.poNumber)}
                              onReject={() => openModal(po.poNumber, 'reject')}
                              onSendBack={() => openModal(po.poNumber, 'sendback')}
                              onEdit={() => {
                                const id = poIdMap[po.poNumber];
                                if (id) navigate(`/scm/create-po?poId=${id}&from=po-approval`);
                              }}
                              onViewPdf={() => {
                                const id = poIdMap[po.poNumber];
                                if (id) navigate(`/scm/po-pdf-view?poId=${id}&from=po-approval`);
                              }}
                            />
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop — row-card table, no sticky columns */}
            <div data-po-approval-scroll className="hidden overflow-x-auto px-4 pb-4 pt-1 md:block">
              <table className="rfx-table w-full min-w-[1180px] border-separate border-spacing-x-0 border-spacing-y-2.5 text-sm">
                <colgroup>
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '13%' }} />
                </colgroup>
                <thead>
                  <tr>
                    {(
                      [
                        { h: 'PO Number', align: 'left', pad: 'pl-[calc(1.25rem+4px)] pr-3' },
                        { h: 'PR Reference', align: 'left', pad: 'px-3' },
                        { h: 'Vendor', align: 'left', pad: 'px-3' },
                        { h: 'Department / Requester', align: 'left', pad: 'px-3' },
                        { h: 'Grand Total', align: 'right', pad: 'px-3' },
                        { h: 'Priority', align: 'left', pad: 'px-3' },
                        { h: 'Status', align: 'left', pad: 'px-3' },
                        { h: 'Actions', align: 'right', pad: 'pl-3 pr-5' },
                      ] as const
                    ).map(({ h, align, pad }) => (
                      <th
                        key={h}
                        className={`tfx-th py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 ${pad} ${
                          align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPOs.map((po, rowIndex) => {
                    const isExpanded = expandedRow === po.poNumber;
                    const isPending = isAwaitingManager(po.status);
                    const tone = isPending ? 'teal' : isRejected(po.status) ? 'red' : isManagerApproved(po.status) ? 'green' : 'teal';
                    return (
                      <Fragment key={po.poNumber}>
                        <tr
                          onClick={() => toggleRow(po.poNumber)}
                          className={`rfx-row tone-${tone} cursor-pointer${isExpanded ? ' is-open' : ''}`}
                          style={{ '--r': rowIndex } as CSSProperties}
                        >
                          <td className="pl-5 pr-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="rfx-ticon">
                                <i className={isExpanded ? 'ri-arrow-up-s-line' : 'ri-file-text-line'} aria-hidden />
                              </span>
                              <div className="min-w-0">
                                <p className="rfx-prno truncate">{po.poNumber}</p>
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                                  <i className="ri-calendar-line" aria-hidden />
                                  {po.createdDate}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="overflow-hidden px-3 text-sm font-medium text-[#0f6b7a]" title={po.prId}>
                            <span className="block truncate">{po.prId}</span>
                          </td>
                          <td className="overflow-hidden px-3" title={po.vendor}>
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e6f6f8] text-[#0f6b7a]">
                                <i className="ri-store-2-line text-xs" aria-hidden />
                              </span>
                              <p className="min-w-0 truncate text-sm font-medium text-slate-800">{po.vendor}</p>
                            </div>
                          </td>
                          <td className="overflow-hidden px-3">
                            <span className="rfx-dept" title={po.department}>
                              <i />
                              <span className="truncate">{po.department}</span>
                            </span>
                            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                              <i className="ri-user-line text-xs" aria-hidden />
                              {po.requester}
                            </p>
                          </td>
                          <td className="overflow-hidden px-3 text-right">
                            <p className="text-sm font-bold tabular-nums text-slate-900">{formatCurrency(po.grandTotal)}</p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {po.lineItems.length} item{po.lineItems.length !== 1 ? 's' : ''}
                            </p>
                          </td>
                          <td className="overflow-hidden px-3">
                            <PriorityBadge priority={po.priority} />
                          </td>
                          <td className="overflow-hidden px-3" title={po.status}>
                            <span className="rfx-status inline-flex max-w-full">
                              <StatusBadge status={po.status} />
                            </span>
                          </td>
                          <td className="pl-3 pr-5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-nowrap items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const id = poIdMap[po.poNumber];
                                  if (id) navigate(`/scm/po-pdf-view?poId=${id}&from=po-approval`);
                                }}
                                className="rfx-act"
                                title="View PDF"
                              >
                                <i className="ri-file-pdf-2-line" />
                              </button>
                              {isPending && (
                                <>
                                  {!mugeshMode && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const id = poIdMap[po.poNumber];
                                        if (id) navigate(`/scm/create-po?poId=${id}&from=po-approval`);
                                      }}
                                      className="rfx-act"
                                      title="Edit PO"
                                    >
                                      <i className="ri-edit-line" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => startSign(po.poNumber)}
                                    className="rfx-act solid"
                                    title={mugeshMode ? 'Approve' : 'Sign & Approve (digital signature)'}
                                  >
                                    <i className="ri-quill-pen-line" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openModal(po.poNumber, 'sendback')}
                                    className="rfx-act warn"
                                    title={mugeshMode ? 'Send Back to Requester' : 'Send Back to Buyer'}
                                  >
                                    <i className="ri-arrow-go-back-line" />
                                  </button>
                                  {!mugeshMode && (
                                    <button
                                      type="button"
                                      onClick={() => openModal(po.poNumber, 'reject')}
                                      className="rfx-act danger"
                                      title="Reject"
                                    >
                                      <i className="ri-close-line" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <ExpandedRow
                            po={po}
                            poId={poIdMap[po.poNumber]}
                            isPending={isPending}
                            mugeshMode={mugeshMode}
                            onApprove={() => startSign(po.poNumber)}
                            onReject={() => openModal(po.poNumber, 'reject')}
                            onSendBack={() => openModal(po.poNumber, 'sendback')}
                            onEdit={() => {
                              const id = poIdMap[po.poNumber];
                              if (id) navigate(`/scm/create-po?poId=${id}&from=po-approval`);
                            }}
                            onViewPdf={() => {
                              const id = poIdMap[po.poNumber];
                              if (id) navigate(`/scm/po-pdf-view?poId=${id}&from=po-approval`);
                            }}
                          />
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredPOs.length === 0 && (
              <div className="py-14 text-center">
                <i className="ri-file-list-3-line mb-3 block text-5xl text-[#c5e6eb]"></i>
                <p className="text-sm font-medium text-slate-500">No purchase orders found</p>
                {(searchTerm || filter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setFilter('all');
                    }}
                    className="tfx-btn secondary sm mt-3"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <POApprovalModal
        isOpen={modal.isOpen}
        type={modal.type}
        poNumber={modal.poNumber}
        prTitle={modal.prTitle}
        grandTotal={modal.grandTotal}
        sendBackTitle={mugeshMode ? 'Send back to requester' : undefined}
        sendBackHint={
          mugeshMode
            ? 'This PO returns to the requester who created it. SCM Buyer and SCM Manager are not notified.'
            : undefined
        }
        onConfirm={handleConfirm}
        presetSignature={meetMode ? { name: 'Meet G', imageSrc: meetSignature } : null}
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
      />

      {toast && (
        <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-6 sm:bottom-6">
          <div className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold shadow-lg ${
            toast.type === 'success' ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'
          }`}>
            <i className={toast.type === 'success' ? 'ri-check-double-line' : 'ri-close-circle-line'}></i>
            {toast.text}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
