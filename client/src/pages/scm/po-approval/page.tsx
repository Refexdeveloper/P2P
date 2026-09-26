
import { useState, useMemo, useEffect, useCallback, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import ApprovalHistoryPanel, {
  ManagerL2CommentsHighlight,
} from '../../../components/feature/ApprovalHistoryPanel';
import POApprovalModal from './components/POApprovalModal';
import VendorComparisonMatrix from '../../../components/rfq/VendorComparisonMatrix';
import { poApi, rfqApi, VendorComparisonData } from '../../../services/api';
import type { POData } from '../../../mocks/po-data';
import { PM_BTN_PRIMARY, PM_BTN_SECONDARY, PM_PAGE_BG } from '../../../constants/pmTheme';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const softWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;

const softCard =
  'relative overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]';

const KPI_THEMES = [
  { value: '#F59E0B', iconBg: '#FEF3C7', wash: 'rgba(245, 158, 11, 0.14)' },
  { value: '#43A047', iconBg: '#E8F5E9', wash: 'rgba(67, 160, 71, 0.14)' },
  { value: '#EF4444', iconBg: '#FEE2E2', wash: 'rgba(239, 68, 68, 0.12)' },
  { value: '#1E88E5', iconBg: '#E3F2FD', wash: 'rgba(30, 136, 229, 0.14)' },
] as const;

/** Manager still needs to act */
const isAwaitingManager = (status: string) => {
  const s = String(status || '');
  return s === 'Pending SCM Manager Sign' || s === 'Pending Approval' || s === 'pending_approval';
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
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      <i className={icon[status] || 'ri-question-line'}></i>
      {status}
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
}

function ExpandedRow({ po, poId, onApprove, onReject, onSendBack, onEdit, onViewPdf, isPending }: ExpandedRowProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'items' | 'comparison' | 'history'>('details');
  const [comparisonData, setComparisonData] = useState<(VendorComparisonData & { source?: string }) | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState('');
  const [filePreview, setFilePreview] = useState<{ url: string; fileName: string } | null>(null);

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
      <td colSpan={9} className="p-0 max-w-0 bg-transparent">
        <div className="min-w-0 w-full max-w-full my-3 sm:my-4 px-1 sm:px-2">
        <div className={`${softCard} min-w-0 max-w-full`}>
          <div className="pointer-events-none absolute inset-0" style={softWash} />
          {/* Expanded Header */}
          <div className="relative z-[1] flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3 px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/40">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-10 h-10 bg-[#E3F2FD] rounded-xl flex items-center justify-center flex-shrink-0 text-[#1E88E5]">
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
                  <button
                    type="button"
                    onClick={onEdit}
                    className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <i className="ri-edit-line"></i> Edit PO
                  </button>
                  <button
                    onClick={onApprove}
                    className={`${PM_BTN_PRIMARY} !px-3 !py-1.5 !text-xs`}
                  >
                    <i className="ri-quill-pen-line"></i> Sign &amp; Approve
                  </button>
                  <button
                    type="button"
                    onClick={onSendBack}
                    className="px-3 py-1.5 sm:px-4 text-xs font-semibold text-orange-700 bg-white border border-orange-200 rounded-xl hover:bg-orange-50 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <i className="ri-arrow-go-back-line"></i> Send Back
                  </button>
                  <button
                    onClick={onReject}
                    className="px-3 py-1.5 sm:px-4 text-xs font-semibold text-rose-600 bg-white border border-rose-200 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <i className="ri-close-circle-line"></i> Reject PO
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="relative z-[1] flex border-b border-slate-100 px-2 sm:px-6 bg-white overflow-x-auto">
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
                    ? 'border-[#1E88E5] text-[#1E88E5]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <i className={tab.icon}></i>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="relative z-[1] p-3 sm:p-6 min-w-0 max-w-full overflow-x-auto">
            {activeTab === 'details' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* PO Summary */}
                <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
                  {[
                    { label: 'PO Number', value: po.poNumber, icon: 'ri-file-text-line', color: 'text-[#1E88E5]' },
                    { label: 'PR Reference', value: po.prId, icon: 'ri-links-line', color: 'text-[#1E88E5]' },
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
                      <i className="ri-file-list-3-line text-[#1E88E5]"></i> Purchase Request Details
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
                  <div className="rounded-xl border border-[#BBDEFB]/80 bg-[#E3F2FD]/40 p-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <i className="ri-store-2-line text-[#1E88E5]"></i> Vendor Information
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
                      <i className="ri-map-pin-line text-[#1E88E5]"></i> Delivery Details
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
                      <i className="ri-receipt-line text-[#1E88E5]"></i> Billing Summary
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
                          <span className="text-xl font-bold text-[#1E88E5]">{formatCurrency(po.grandTotal)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Created By</p>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-[#E3F2FD] rounded-full flex items-center justify-center">
                          <span className="text-[#1565C0] text-xs font-bold">
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
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 text-center">{item.quantity}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[#E3F2FD]/50 border-t-2 border-[#90CAF9]">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-sm font-bold text-gray-700 text-right">Subtotal</td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">{formatCurrency(po.subtotal)}</td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="px-4 py-2 text-sm text-gray-600 text-right">GST ({po.gstPercentage}%)</td>
                        <td className="px-4 py-2 text-sm text-gray-700 text-right">{formatCurrency(po.taxAmount)}</td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-base font-bold text-gray-900 text-right">Grand Total</td>
                        <td className="px-4 py-3 text-base font-bold text-[#1E88E5] text-right">{formatCurrency(po.grandTotal)}</td>
                        <td></td>
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
                    <div className="flex flex-wrap items-center gap-3 p-3 bg-[#E3F2FD]/50 border border-[#BBDEFB] rounded-lg text-sm">
                      <span className="font-semibold text-[#1565C0]">{comparisonData.pr.prNumber}</span>
                      <span className="text-[#1565C0]">{comparisonData.vendorCount} vendors quoted</span>
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
                    <VendorComparisonMatrix
                      data={comparisonData}
                      poId={poId}
                      onPreviewFile={handlePreviewFile}
                    />
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
  const [searchParams] = useSearchParams();
  const [poList, setPoList] = useState<POData[]>([]);
  const [poIdMap, setPoIdMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
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
      description: String(li.description || ''),
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
        const res = await poApi.sign(modal.poId, remarks, signature);
        showToast(res.message || `${modal.poNumber} signed — SCM Buyer final verify next`, 'success');
        setExpandedRow(null);
        navigate(`/scm/po-pdf-view?poId=${modal.poId}&from=po-approval`);
        return;
      } else if (modal.type === 'sendback') {
        const res = await poApi.sendBack(modal.poId, remarks);
        showToast(res.message || `${modal.poNumber} sent back to SCM Buyer for revision`, 'success');
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

  return (
    <DashboardLayout>
      <div className="min-h-full font-sans text-[#0F172A]" style={{ background: PM_PAGE_BG }}>
        <div className="p-2 pb-6 sm:p-4 lg:p-6">
          <header className="mb-4 border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-1 pb-3 pt-1 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.12)] backdrop-blur-md sm:mb-5 sm:px-0 sm:pb-4">
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-snug tracking-tight text-slate-800 sm:text-2xl md:text-3xl">
                SCM Manager — PO Sign &amp; Approve
              </h1>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-sm">
                Sign PO with comments — after sign-off, SCM Buyer final-verifies before the vendor email is sent
              </p>
            </div>
          </header>

          {loading && <p className="mb-4 text-sm text-slate-500">Loading purchase orders...</p>}

          <section className="mb-5">
            <div className="mb-1.5 px-0.5 sm:mb-3">
              <h2 className="text-xs font-bold tracking-wide text-slate-700 sm:text-base">Work Insights</h2>
            </div>
            <div className="grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4 sm:gap-4">
              {(
                [
                  { key: 'pending', label: 'Pending Approval', value: stats.pending, icon: 'ri-time-line', theme: KPI_THEMES[0] },
                  { key: 'approved', label: 'Approved', value: stats.approved, icon: 'ri-check-double-line', theme: KPI_THEMES[1] },
                  { key: 'rejected', label: 'Rejected', value: stats.rejected, icon: 'ri-close-circle-line', theme: KPI_THEMES[2] },
                  { key: 'all', label: 'Total POs', value: processedPOs.length, icon: 'ri-file-list-3-line', theme: KPI_THEMES[3] },
                ] as const
              ).map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => setFilter(card.key)}
                  className={`group relative box-border flex h-full min-h-[112px] w-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-[box-shadow,border-color] duration-200 hover:border-[#90CAF9] hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)] sm:min-h-[128px] sm:rounded-[18px] sm:p-5 ${
                    filter === card.key ? 'border-[#90CAF9]' : 'border-transparent'
                  }`}
                >
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: `radial-gradient(120% 90% at 100% 0%, ${card.theme.wash} 0%, rgba(255,255,255,0) 55%)`,
                    }}
                  />
                  <div className="relative z-[1] flex flex-1 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px]">
                        {card.label}
                      </p>
                      <p
                        className="mt-2 text-3xl font-bold tabular-nums leading-none tracking-tight sm:mt-3 sm:text-[2.15rem]"
                        style={{ color: card.theme.value }}
                      >
                        {card.value}
                      </p>
                    </div>
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11"
                      style={{ backgroundColor: card.theme.iconBg, color: card.theme.value }}
                    >
                      <i className={`${card.icon} text-lg sm:text-xl`} aria-hidden />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <div className="relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-r from-[#1E88E5] to-[#1565C0] p-4 shadow-[0_14px_32px_-14px_rgba(21,101,192,0.45)] sm:rounded-[18px] sm:p-5">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background:
                  'radial-gradient(90% 120% at 100% 0%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 55%)',
              }}
            />
            <div className="relative z-[1] flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                  <i className="ri-money-rupee-circle-line text-2xl text-white"></i>
                </div>
                <div>
                  <p className="text-sm text-sky-100">Total Pending Approval Value</p>
                  <p className="text-xl font-bold text-white sm:text-2xl">
                    {formatCurrency(stats.totalPendingValue)}
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs text-sky-100">
                  {stats.pending} PO{stats.pending !== 1 ? 's' : ''} awaiting your decision
                </p>
                <p className="mt-0.5 text-sm font-medium text-white">Click any row to expand details</p>
              </div>
            </div>
          </div>

          <div className={`${softCard}`}>
            <div className="pointer-events-none absolute inset-0" style={softWash} />
            <div className="relative z-[1] border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/40 px-3 py-4 sm:px-5 sm:py-5">
              <div className="flex flex-col items-stretch justify-between gap-3 lg:flex-row lg:flex-wrap lg:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E3F2FD] text-[#1E88E5]">
                    <i className="ri-checkbox-circle-line text-lg"></i>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#2C3E50] sm:text-base">
                      Purchase Order Approvals
                    </h2>
                    <p className="text-xs text-slate-500">
                      Showing <strong className="text-slate-700">{filteredPOs.length}</strong> purchase
                      order{filteredPOs.length !== 1 ? 's' : ''} · Click any row to expand
                    </p>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                  <div className="relative min-w-0 flex-1 sm:flex-none">
                    <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400"></i>
                    <input
                      type="text"
                      placeholder="Search PO, vendor, requester..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-xl border border-transparent bg-white py-2 pl-9 pr-4 text-sm text-[#0F172A] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] outline-none placeholder:text-slate-400 focus:border-[#90CAF9] focus:ring-2 focus:ring-[#1E88E5]/20 sm:w-64"
                    />
                  </div>
                  <div className="flex gap-1 overflow-x-auto rounded-xl bg-[#F1F5F9] p-1">
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
                        className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          filter === tab.key
                            ? 'bg-white text-[#1E88E5] shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-[1] space-y-2 p-3 md:hidden">
              {filteredPOs.map((po) => {
                const isExpanded = expandedRow === po.poNumber;
                const isPending = isAwaitingManager(po.status);
                return (
                  <div
                    key={`m-${po.poNumber}`}
                    className={`overflow-hidden rounded-2xl border bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] sm:rounded-[18px] ${
                      isExpanded ? 'border-[#90CAF9]' : 'border-transparent'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleRow(po.poNumber)}
                      className="flex w-full items-start gap-3 px-3 py-3 text-left"
                    >
                      <div
                        className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${
                          isExpanded ? 'bg-[#1E88E5] text-white' : 'bg-[#E3F2FD] text-[#1E88E5]'
                        }`}
                      >
                        <i className={`text-sm ${isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-bold text-[#1E88E5]">{po.poNumber}</p>
                          <StatusBadge status={po.status} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{po.prTitle || po.prId}</p>
                        <p className="mt-1 truncate text-xs text-slate-600">{po.vendor}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-[#2C3E50]">
                            {formatCurrency(po.grandTotal)}
                          </span>
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
                              onApprove={() => openModal(po.poNumber, 'approve')}
                              onReject={() => openModal(po.poNumber, 'reject')}
                              onSendBack={() => openModal(po.poNumber, 'sendback')}
                              onEdit={() => {
                                const id = poIdMap[po.poNumber];
                                if (id) navigate(`/scm/create-po?poId=${id}&from=po-approval`);
                              }}
                              onViewPdf={() => {
                                const id = poIdMap[po.poNumber];
                                if (id) navigate(`/scm/po-pdf-view?poId=${id}`);
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

            <div className="relative z-[1] hidden overflow-x-auto px-2 pb-3 pt-1 md:block sm:px-3 sm:pb-4">
              <table className="w-full min-w-0 border-separate border-spacing-x-0 border-spacing-y-3 text-sm">
                <thead>
                  <tr>
                    {[
                      '',
                      'PO Number',
                      'PR Reference',
                      'Vendor',
                      'Department / Requester',
                      'Grand Total',
                      'Priority',
                      'Status',
                      'Actions',
                    ].map((h) => (
                      <th
                        key={h || 'expand'}
                        className={`whitespace-nowrap px-3 pb-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 ${
                          h === 'Actions' ? 'text-right' : ''
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPOs.map((po) => {
                    const isExpanded = expandedRow === po.poNumber;
                    const isPending = isAwaitingManager(po.status);
                    const rowBorder = isExpanded
                      ? 'border-[#90CAF9]'
                      : 'border-transparent group-hover:border-[#90CAF9]';
                    const rowShadow = isExpanded
                      ? 'shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)]'
                      : 'shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]';

                    return (
                      <Fragment key={po.poNumber}>
                        <tr
                          onClick={() => toggleRow(po.poNumber)}
                          className="group cursor-pointer"
                        >
                          <td className={`rounded-l-2xl border border-r-0 bg-white px-3 py-4 transition-[border-color] sm:rounded-l-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}>
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                                isExpanded ? 'bg-[#1E88E5] text-white' : 'bg-[#E3F2FD] text-[#1E88E5]'
                              }`}
                            >
                              <i className={`text-sm ${isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
                            </div>
                          </td>
                          <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 transition-[border-color] sm:py-5 ${rowBorder}`}>
                            <p className="text-sm font-bold text-[#1E88E5]">{po.poNumber}</p>
                            <p className="mt-0.5 text-xs text-slate-400">{po.createdDate}</p>
                          </td>
                          <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 transition-[border-color] sm:py-5 ${rowBorder}`}>
                            <span className="text-sm font-medium text-[#1E88E5]">{po.prId}</span>
                          </td>
                          <td className={`border border-x-0 bg-white px-3 py-4 transition-[border-color] sm:py-5 ${rowBorder}`}>
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#E3F2FD] text-[#1E88E5]">
                                <i className="ri-store-2-line text-xs"></i>
                              </div>
                              <p className="max-w-[160px] truncate text-sm font-medium text-[#2C3E50]">
                                {po.vendor}
                              </p>
                            </div>
                          </td>
                          <td className={`border border-x-0 bg-white px-3 py-4 transition-[border-color] sm:py-5 ${rowBorder}`}>
                            <p className="text-sm font-medium text-[#2C3E50]">{po.department}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                              <i className="ri-user-line text-xs"></i>
                              {po.requester}
                            </p>
                          </td>
                          <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 transition-[border-color] sm:py-5 ${rowBorder}`}>
                            <p className="text-sm font-bold tabular-nums text-[#2C3E50]">
                              {formatCurrency(po.grandTotal)}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {po.lineItems.length} item{po.lineItems.length !== 1 ? 's' : ''}
                            </p>
                          </td>
                          <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 transition-[border-color] sm:py-5 ${rowBorder}`}>
                            <PriorityBadge priority={po.priority} />
                          </td>
                          <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 transition-[border-color] sm:py-5 ${rowBorder}`}>
                            <StatusBadge status={po.status} />
                          </td>
                          <td
                            className={`whitespace-nowrap rounded-r-2xl border border-l-0 bg-white px-3 py-4 transition-[border-color] sm:rounded-r-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => toggleRow(po.poNumber)}
                                className="cursor-pointer rounded-xl p-1.5 text-slate-500 transition-colors hover:bg-[#E3F2FD] hover:text-[#1E88E5]"
                                title="Expand Details"
                              >
                                <i className={`text-sm ${isExpanded ? 'ri-eye-off-line' : 'ri-eye-line'}`}></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const id = poIdMap[po.poNumber];
                                  if (id) navigate(`/scm/po-pdf-view?poId=${id}`);
                                }}
                                className="cursor-pointer rounded-xl p-1.5 text-[#1E88E5] transition-colors hover:bg-[#E3F2FD]"
                                title="View PDF"
                              >
                                <i className="ri-file-pdf-line text-sm"></i>
                              </button>
                              {isPending && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const id = poIdMap[po.poNumber];
                                      if (id) navigate(`/scm/create-po?poId=${id}&from=po-approval`);
                                    }}
                                    className="cursor-pointer rounded-xl p-1.5 text-amber-600 transition-colors hover:bg-amber-50"
                                    title="Edit PO"
                                  >
                                    <i className="ri-edit-line text-sm"></i>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openModal(po.poNumber, 'approve')}
                                    className="cursor-pointer rounded-xl p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50"
                                    title="Sign & Approve (digital signature)"
                                  >
                                    <i className="ri-quill-pen-line text-sm"></i>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openModal(po.poNumber, 'sendback')}
                                    className="cursor-pointer rounded-xl p-1.5 text-orange-600 transition-colors hover:bg-orange-50"
                                    title="Send Back to Buyer"
                                  >
                                    <i className="ri-arrow-go-back-line text-sm"></i>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openModal(po.poNumber, 'reject')}
                                    className="cursor-pointer rounded-xl p-1.5 text-rose-500 transition-colors hover:bg-rose-50"
                                    title="Reject"
                                  >
                                    <i className="ri-close-line text-sm"></i>
                                  </button>
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
                            onApprove={() => openModal(po.poNumber, 'approve')}
                            onReject={() => openModal(po.poNumber, 'reject')}
                            onSendBack={() => openModal(po.poNumber, 'sendback')}
                            onEdit={() => {
                              const id = poIdMap[po.poNumber];
                              if (id) navigate(`/scm/create-po?poId=${id}&from=po-approval`);
                            }}
                            onViewPdf={() => {
                              const id = poIdMap[po.poNumber];
                              if (id) navigate(`/scm/po-pdf-view?poId=${id}`);
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
              <div className="relative z-[1] py-16 text-center">
                <i className="ri-file-list-3-line mb-4 block text-5xl text-slate-200"></i>
                <p className="text-sm font-medium text-slate-500">No purchase orders found</p>
                {(searchTerm || filter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setFilter('all');
                    }}
                    className="mt-3 cursor-pointer whitespace-nowrap rounded-xl bg-[#E3F2FD] px-4 py-2 text-sm font-medium text-[#1E88E5] transition-colors hover:bg-[#BBDEFB]"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <POApprovalModal
        isOpen={modal.isOpen}
        type={modal.type}
        poNumber={modal.poNumber}
        prTitle={modal.prTitle}
        grandTotal={modal.grandTotal}
        onConfirm={handleConfirm}
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
