import { useState, useMemo, useEffect, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/feature/DashboardLayout';
import SoftInsightCard from '../../components/base/SoftInsightCard';
import { PM_PAGE_BG } from '../../constants/pmTheme';
import { formatPersonRoleSuffix } from '../../utils/roleDisplay';
import { GRNData, GRNStatus } from '../../mocks/grn-data';
import { accountsApi, fileToAttachmentPayload } from '../../services/api';
import CreateGRNModal, { NewGRNData } from './components/CreateGRNModal';
import GRNApprovalModal from './components/GRNApprovalModal';

const GRN_STORAGE_KEY = 'p2p_grn_entries_v1';

type ApiPo = {
  id: number;
  poNumber: string;
  prNumber?: string;
  prTitle?: string;
  vendorName?: string;
  department?: string;
  requester?: string;
  createdAt?: string;
  expectedDeliveryDate?: string;
  deliveryAddress?: string;
  paymentTerms?: string;
  gstPercentage?: number;
  subtotal?: number;
  taxAmount?: number;
  grandTotal?: number;
  priority?: string;
  vendorAcceptanceStatus?: string | null;
  vendorAcceptedAt?: string | null;
  vendorAcceptanceRemarks?: string;
  lineItems?: Array<{
    id?: string | number;
    itemName?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    total?: number;
  }>;
};

function loadStoredGrns(): GRNData[] {
  try {
    const raw = localStorage.getItem(GRN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GRNData[]) : [];
  } catch {
    return [];
  }
}

function saveStoredGrns(rows: GRNData[]) {
  try {
    localStorage.setItem(GRN_STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

function mapAcceptedPoToPendingGrn(po: ApiPo): GRNData {
  const lineItems = (po.lineItems || []).map((li, idx) => {
    const qty = Number(li.quantity) || 0;
    const unitPrice = Number(li.unitPrice) || 0;
    return {
      id: String(li.id || idx + 1),
      description: String(li.itemName || li.description || `Item ${idx + 1}`)
        .replace(/<[^>]+>/g, ' ')
        .trim(),
      orderedQty: qty,
      receivedQty: 0,
      pendingQty: qty,
      unitPrice,
      total: Number(li.total) || qty * unitPrice,
      condition: 'Pending Inspection' as const,
    };
  });

  return {
    grnNumber: `AWAITING-${po.poNumber}`,
    poNumber: po.poNumber,
    poId: po.id,
    prId: po.prNumber || '',
    prTitle: po.prTitle || '',
    vendor: po.vendorName || '',
    department: po.department || '',
    requester: po.requester || '',
    poDate: po.poDate || po.createdAt || '',
    expectedDeliveryDate: po.expectedDeliveryDate || '',
    receivedDate: null,
    deliveryAddress: po.deliveryAddress || '',
    paymentTerms: po.paymentTerms || '',
    lineItems,
    subtotal: Number(po.subtotal) || 0,
    gstPercentage: Number(po.gstPercentage) || 18,
    taxAmount: Number(po.taxAmount) || 0,
    grandTotal: Number(po.grandTotal) || 0,
    receivedValue: 0,
    status: 'Pending Receipt',
    priority: (po.priority === 'high' || po.priority === 'low' ? po.priority : 'medium') as
      | 'high'
      | 'medium'
      | 'low',
    receivedBy: null,
    inspectedBy: null,
    remarks: po.vendorAcceptanceRemarks || '',
    awaitingEntry: true,
    receiptHistory: [
      {
        action: 'Vendor Accepted — Ready for GRN',
        performedBy: po.vendorName || 'Vendor',
        role: 'Vendor',
        date: po.vendorAcceptedAt || po.createdAt || '',
        notes: `PO ${po.poNumber} accepted by vendor. Click Mark as Received to enter GRN details.`,
      },
    ],
  };
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const formatPercent = (received: number, total: number) => {
  if (total === 0) return 0;
  return Math.round((received / total) * 100);
};

const softWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;
const fieldCard =
  'relative overflow-hidden rounded-2xl bg-white p-3.5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)]';
const fieldLabel = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400';

function Field({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`${fieldCard} ${className}`}>
      <div className="pointer-events-none absolute inset-0" style={softWash} />
      <div className="relative z-[1]">
        <p className={fieldLabel}>{label}</p>
        <p className="mt-1.5 break-words text-sm font-semibold text-[#2C3E50]">{value || '—'}</p>
      </div>
    </div>
  );
}

const GRNStatusBadge = ({ status }: { status: GRNStatus }) => {
  const map: Record<GRNStatus, string> = {
    'Pending Receipt': 'bg-amber-100 text-amber-700 border border-amber-200',
    'Partially Received': 'bg-sky-100 text-sky-700 border border-sky-200',
    'Fully Received': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'Quality Rejected': 'bg-red-100 text-red-700 border border-red-200',
  };
  const icon: Record<GRNStatus, string> = {
    'Pending Receipt': 'ri-time-line',
    'Partially Received': 'ri-loader-2-line',
    'Fully Received': 'ri-check-double-line',
    'Quality Rejected': 'ri-close-circle-line',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${map[status]}`}>
      <i className={icon[status]}></i>
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

const ConditionBadge = ({ condition }: { condition: string }) => {
  const map: Record<string, string> = {
    'Good': 'bg-emerald-100 text-emerald-700',
    'Damaged': 'bg-red-100 text-red-700',
    'Pending Inspection': 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${map[condition] || 'bg-gray-100 text-gray-600'}`}>
      {condition}
    </span>
  );
};

interface ReceiptModalProps {
  isOpen: boolean;
  grn: GRNData | null;
  onConfirm: (remarks: string) => void;
  onClose: () => void;
}

function ReceiptModal({ isOpen, grn, onConfirm, onClose }: ReceiptModalProps) {
  const [remarks, setRemarks] = useState('');
  if (!isOpen || !grn) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-[#1E88E5] to-[#1565C0] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="ri-truck-line text-white text-xl"></i>
            </div>
            <div>
              <h3 className="text-white font-bold text-base">Confirm Goods Receipt</h3>
              <p className="text-sky-100 text-xs mt-0.5">{grn.grnNumber} · {grn.vendor}</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="bg-[#E3F2FD] border border-[#BBDEFB] rounded-xl p-4 mb-5">
            <p className="text-xs text-gray-500 mb-1">PO Reference</p>
            <p className="text-sm font-semibold text-gray-900">{grn.poNumber}</p>
            <p className="text-xs text-gray-500 mt-2 mb-1">Item(s)</p>
            <p className="text-sm text-gray-800">{grn.prTitle}</p>
          </div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Receipt Remarks <span className="text-gray-400 font-normal">(required)</span>
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter receipt notes, condition of goods, any discrepancies..."
            rows={3}
            maxLength={500}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/20 focus:border-[#1E88E5] resize-none"
          />
          <p className="text-xs text-gray-400 text-right mt-1">{remarks.length}/500</p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              onClick={() => { if (remarks.trim()) { onConfirm(remarks); setRemarks(''); } }}
              disabled={!remarks.trim()}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-[#1E88E5] rounded-xl hover:bg-[#1565C0] transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-check-line mr-1"></i> Confirm Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes?: number) {
  const n = Number(bytes) || 0;
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function GrnLineAttachments({
  attachments,
}: {
  attachments?: Array<{ id: number; fileName: string; size?: number }>;
}) {
  const [openingKey, setOpeningKey] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ url: string; fileName: string; kind: 'pdf' | 'image' | 'other' } | null>(
    null
  );

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const sniffKind = (blob: Blob, fileName: string): 'pdf' | 'image' | 'other' => {
    const type = String(blob.type || '').toLowerCase();
    const name = String(fileName || '').toLowerCase();
    if (type.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
    if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(name)) return 'image';
    return 'other';
  };

  const openFile = async (
    file: { id: number; fileName: string },
    download = false
  ) => {
    setError('');
    setOpeningKey(download ? `dl-${file.id}` : String(file.id));
    try {
      const blob = await accountsApi.fetchAuthFile(accountsApi.grnLineAttachmentUrl(file.id));
      const url = URL.createObjectURL(blob);
      if (download) {
        const a = document.createElement('a');
        a.href = url;
        a.download = file.fileName || 'grn-attachment';
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      if (preview?.url) URL.revokeObjectURL(preview.url);
      setPreview({ url, fileName: file.fileName, kind: sniffKind(blob, file.fileName) });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not open ${file.fileName}`);
    } finally {
      setOpeningKey('');
    }
  };

  if (!attachments?.length) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  return (
    <div className="space-y-1.5 min-w-[160px]">
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {attachments.map((file) => (
        <div key={file.id} className="flex items-center gap-2">
          <i className="ri-attachment-2 text-gray-400"></i>
          <span className="text-xs text-gray-800 truncate max-w-[140px]" title={file.fileName}>
            {file.fileName}
          </span>
          {file.size ? (
            <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatFileSize(file.size)}</span>
          ) : null}
          <button
            type="button"
            onClick={() => void openFile(file)}
            disabled={openingKey === String(file.id)}
            className="text-xs font-semibold text-[#1565C0] hover:underline disabled:opacity-50 cursor-pointer"
          >
            {openingKey === String(file.id) ? 'Opening…' : 'View'}
          </button>
          <button
            type="button"
            onClick={() => void openFile(file, true)}
            disabled={openingKey === `dl-${file.id}`}
            className="text-xs font-semibold text-gray-600 hover:underline disabled:opacity-50 cursor-pointer"
          >
            {openingKey === `dl-${file.id}` ? '…' : 'Download'}
          </button>
        </div>
      ))}
      {preview &&
        createPortal(
          <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <p className="text-sm font-semibold text-gray-900 truncate pr-4">{preview.fileName}</p>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(preview.url);
                    setPreview(null);
                  }}
                  className="text-gray-500 hover:text-gray-800 cursor-pointer"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>
              <div className="flex-1 min-h-0 bg-gray-100">
                {preview.kind === 'pdf' ? (
                  <iframe title={preview.fileName} src={preview.url} className="w-full h-[70vh]" />
                ) : preview.kind === 'image' ? (
                  <div className="h-[70vh] overflow-auto flex items-center justify-center p-4">
                    <img src={preview.url} alt={preview.fileName} className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-gray-600">
                    Preview is not available for this file type.{' '}
                    <button
                      type="button"
                      className="text-[#1565C0] font-semibold hover:underline cursor-pointer"
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = preview.url;
                        a.download = preview.fileName;
                        a.click();
                      }}
                    >
                      Download
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

interface ExpandedGRNRowProps {
  grn: GRNData;
  onMarkReceived: () => void;
  onApprove: () => void;
  onEnterGrn?: () => void;
}

function ExpandedGRNRow({ grn, onMarkReceived, onApprove, onEnterGrn }: ExpandedGRNRowProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'items' | 'history'>('details');
  const isPending = grn.status === 'Pending Receipt' || grn.status === 'Partially Received';
  const isReceived = grn.status === 'Fully Received' || grn.status === 'Partially Received';
  const totalOrdered = grn.lineItems.reduce((s, i) => s + i.orderedQty, 0);
  const totalReceived = grn.lineItems.reduce((s, i) => s + i.receivedQty, 0);
  const receiptPct = formatPercent(totalReceived, totalOrdered);

  return (
    <tr>
      <td colSpan={9} className="bg-transparent p-0">
        <div className="relative my-1 overflow-hidden rounded-2xl border border-transparent bg-[#F5F7FA] px-4 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px] sm:px-5 sm:py-5">
          <div className="relative z-[1] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#2C3E50]">
                  {grn.awaitingEntry ? grn.poNumber : grn.grnNumber}
                </p>
                <p className="truncate text-xs text-slate-500">{grn.prTitle}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-white">
                  <div
                    className={`h-full rounded-full ${receiptPct === 100 ? 'bg-emerald-500' : receiptPct > 0 ? 'bg-[#1E88E5]' : 'bg-slate-300'}`}
                    style={{ width: `${receiptPct}%` }}
                  ></div>
                </div>
                <span className="text-xs font-semibold text-slate-600">{receiptPct}% received</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {grn.awaitingEntry && onEnterGrn && (
                  <button
                    type="button"
                    onClick={onEnterGrn}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#1E88E5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0]"
                  >
                    <i className="ri-checkbox-circle-line"></i> Mark as Received
                  </button>
                )}
                {isPending && !grn.awaitingEntry && (
                  <button
                    type="button"
                    onClick={onMarkReceived}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#1E88E5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0]"
                  >
                    <i className="ri-checkbox-circle-line"></i> Confirm Receipt
                  </button>
                )}
                {isReceived && !grn.awaitingEntry && (
                  <button
                    type="button"
                    onClick={onApprove}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <i className="ri-shield-check-line"></i> PO vs GRN Check & Approve
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { key: 'details', label: 'Details' },
                { key: 'items', label: 'Line Items' },
                { key: 'history', label: 'History' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as 'details' | 'items' | 'history')}
                  className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                    activeTab === tab.key ? 'bg-[#1E88E5] text-white' : 'bg-white text-slate-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'details' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="GRN Number" value={grn.awaitingEntry ? 'Awaiting entry' : grn.grnNumber} />
                <Field label="PO Reference" value={grn.poNumber} />
                <Field label="Expected Delivery" value={grn.expectedDeliveryDate || '—'} />
                <Field label="Received Date" value={grn.receivedDate || 'Not yet received'} />
                <Field label="PR Title" value={grn.prTitle || '—'} className="sm:col-span-2" />
                <Field label="Department" value={grn.department || '—'} />
                <Field label="Requester" value={grn.requester || '—'} />
                <Field label="Vendor" value={grn.vendor || '—'} />
                <Field label="Payment Terms" value={grn.paymentTerms || '—'} />
                <Field label="Received By" value={grn.receivedBy || 'Not yet assigned'} />
                <Field label="Inspected By" value={grn.inspectedBy || 'Not yet inspected'} />
                <Field label="Delivery Address" value={grn.deliveryAddress || '—'} className="sm:col-span-2 lg:col-span-4" />
                <Field label="PO Value" value={formatCurrency(grn.grandTotal)} />
                <Field label="Received Value" value={formatCurrency(grn.receivedValue)} />
                <Field label="Pending Value" value={formatCurrency(grn.grandTotal - grn.receivedValue)} />
                <Field label="Receipt Progress" value={`${receiptPct}% · ${totalReceived}/${totalOrdered} units`} />
                <Field label="Subtotal" value={formatCurrency(grn.subtotal)} />
                <Field label={`GST (${grn.gstPercentage}%)`} value={formatCurrency(grn.taxAmount)} />
                <Field label="Grand Total" value={formatCurrency(grn.grandTotal)} />
                {grn.remarks ? (
                  <Field label="Remarks" value={grn.remarks} className="sm:col-span-2 lg:col-span-4" />
                ) : null}
                {isReceived && !grn.awaitingEntry && (
                  <button
                    type="button"
                    onClick={onApprove}
                    className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-semibold text-white sm:col-span-2 lg:col-span-4"
                  >
                    <i className="ri-shield-check-line"></i> PO vs GRN Check & Approve
                  </button>
                )}
              </div>
            )}

            {activeTab === 'items' && (
              <div className="overflow-x-auto rounded-2xl bg-white p-3 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {['#', 'Item Description', 'Ordered Qty', 'Received Qty', 'Pending Qty', 'Unit Price', 'Total', 'Condition', 'Attachments'].map((h) => (
                        <th
                          key={h}
                          className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 whitespace-nowrap ${
                            h === '#' ? 'text-center' :
                            ['Ordered Qty', 'Received Qty', 'Pending Qty', 'Unit Price', 'Total'].includes(h) ? 'text-right' :
                            'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grn.lineItems.map((item, idx) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-center text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium text-[#2C3E50]">{item.description}</td>
                        <td className="px-3 py-2 text-right">{item.orderedQty}</td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-600">{item.receivedQty}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${item.pendingQty > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {item.pendingQty}
                        </td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(item.total)}</td>
                        <td className="px-3 py-2 text-right">
                          <ConditionBadge condition={item.condition} />
                        </td>
                        <td className="px-3 py-2">
                          <GrnLineAttachments attachments={item.attachments} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200">
                      <td colSpan={5} className="px-3 py-3 text-right text-sm font-bold text-slate-700">Subtotal</td>
                      <td colSpan={2} className="px-3 py-3 text-right text-sm font-bold text-[#2C3E50]">{formatCurrency(grn.subtotal)}</td>
                      <td colSpan={2}></td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-right text-sm text-slate-600">GST ({grn.gstPercentage}%)</td>
                      <td colSpan={2} className="px-3 py-2 text-right text-sm text-slate-700">{formatCurrency(grn.taxAmount)}</td>
                      <td colSpan={2}></td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-right text-sm font-bold text-[#2C3E50]">Grand Total</td>
                      <td colSpan={2} className="px-3 py-3 text-right text-sm font-bold text-[#1E88E5]">{formatCurrency(grn.grandTotal)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-3">
                {grn.receiptHistory.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">No history yet</p>
                ) : (
                  grn.receiptHistory.map((item, idx) => {
                    const action = item.action.toLowerCase();
                    const rejected = action.includes('reject') || action.includes('failed');
                    const partial = action.includes('partial');
                    const done = action.includes('received') || action.includes('closed') || action.includes('confirmed') || action.includes('approved');
                    return (
                      <div key={idx} className={fieldCard}>
                        <div className="pointer-events-none absolute inset-0" style={softWash} />
                        <div className="relative z-[1] flex gap-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                              rejected ? 'bg-[#FFE4E6] text-[#F43F5E]' : partial ? 'bg-[#CFFAFE] text-[#06B6D4]' : done ? 'bg-[#D1FAE5] text-[#10B981]' : 'bg-[#FFEDD5] text-[#F97316]'
                            }`}
                          >
                            <i className={rejected ? 'ri-close-circle-line' : partial ? 'ri-loader-2-line' : done ? 'ri-checkbox-circle-line' : 'ri-time-line'}></i>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#2C3E50]">{item.action}</p>
                            <p className="text-xs text-slate-500">
                              {item.performedBy}
                              {formatPersonRoleSuffix(item.role, item.performedBy)} · {item.date}
                            </p>
                            {item.notes ? <p className="mt-1 text-xs text-slate-600">{item.notes}</p> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function GRNPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusUpdates, setStatusUpdates] = useState<Record<string, GRNStatus>>({});
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [receiptModal, setReceiptModal] = useState<{ isOpen: boolean; grn: GRNData | null }>({ isOpen: false, grn: null });
  const [approvalModal, setApprovalModal] = useState<{ isOpen: boolean; grn: GRNData | null }>({ isOpen: false, grn: null });
  const [createGRNOpen, setCreateGRNOpen] = useState(false);
  const [newGRNs, setNewGRNs] = useState<GRNData[]>(() => loadStoredGrns());
  const [pendingFromPos, setPendingFromPos] = useState<GRNData[]>([]);
  const [loading, setLoading] = useState(true);
  const [prefillPoNumber, setPrefillPoNumber] = useState<string | undefined>();
  const [prefillPoId, setPrefillPoId] = useState<number | undefined>();

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAcceptedPos = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, grnRes] = await Promise.all([
        accountsApi.listPendingGrnPos(),
        accountsApi.listGrns(),
      ]);
      const pending = ((pendingRes.data as Record<string, unknown>[]) || []).map((row) => {
        const mapped = mapAcceptedPoToPendingGrn({
          id: Number(row.poId),
          poNumber: String(row.poNumber || ''),
          prNumber: String(row.prId || ''),
          prTitle: String(row.prTitle || ''),
          vendorName: String(row.vendor || ''),
          department: String(row.department || ''),
          requester: String(row.requester || ''),
          createdAt: String(row.poDate || ''),
          expectedDeliveryDate: String(row.expectedDeliveryDate || ''),
          deliveryAddress: String(row.deliveryAddress || ''),
          paymentTerms: String(row.paymentTerms || ''),
          gstPercentage: Number(row.gstPercentage) || 18,
          subtotal: Number(row.subtotal) || 0,
          taxAmount: Number(row.taxAmount) || 0,
          grandTotal: Number(row.grandTotal) || 0,
          vendorAcceptanceStatus: String(row.vendorAcceptanceStatus || 'accepted'),
          vendorAcceptedAt: row.vendorAcceptedAt ? String(row.vendorAcceptedAt) : null,
          vendorAcceptanceRemarks: String(row.remarks || ''),
          lineItems: ((row.lineItems as Array<Record<string, unknown>>) || []).map((li) => ({
            id: li.id as string | number,
            itemName: String(li.description || ''),
            description: String(li.description || ''),
            quantity: Number(li.orderedQty) || 0,
            unitPrice: Number(li.unitPrice) || 0,
            total: Number(li.total) || 0,
          })),
        });
        return mapped;
      });
      setPendingFromPos(pending);

      const saved = ((grnRes.data as Record<string, unknown>[]) || []).map((g) => ({
        ...(g as unknown as GRNData),
        awaitingEntry: false,
      }));
      setNewGRNs(saved);
    } catch (err) {
      setPendingFromPos([]);
      showToast(err instanceof Error ? err.message : 'Failed to load GRN queue', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAcceptedPos();
  }, [loadAcceptedPos]);

  useEffect(() => {
    // Deep-link from Vendor Acceptance: highlight awaiting GRN only — do NOT auto-open popup.
    // Enter-fields popup opens when user clicks Mark as Received.
    const poNumber = searchParams.get('poNumber') || undefined;
    const poIdRaw = searchParams.get('poId');
    const poId = poIdRaw ? Number(poIdRaw) : undefined;
    if (poNumber || (poId && !Number.isNaN(poId))) {
      setPrefillPoNumber(poNumber);
      setPrefillPoId(poId && !Number.isNaN(poId) ? poId : undefined);
      if (searchParams.get('from') === 'vendor-acceptance') {
        showToast('PO ready for GRN — click Mark as Received to enter details', 'success');
      }
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEnterGrn = (grn: GRNData) => {
    setPrefillPoId(grn.poId);
    setPrefillPoNumber(grn.poNumber);
    setCreateGRNOpen(true);
  };

  const handleConfirmReceipt = (remarks: string) => {
    if (!receiptModal.grn) return;
    setStatusUpdates(prev => ({ ...prev, [receiptModal.grn!.grnNumber]: 'Fully Received' }));
    showToast(`${receiptModal.grn.grnNumber} marked as fully received`, 'success');
    setReceiptModal({ isOpen: false, grn: null });
    setExpandedRow(null);
  };

  const handleGRNApprove = (remarks: string) => {
    if (!approvalModal.grn) return;
    setStatusUpdates(prev => ({ ...prev, [approvalModal.grn!.grnNumber]: 'Fully Received' }));
    showToast(`${approvalModal.grn.grnNumber} approved successfully`, 'success');
    setApprovalModal({ isOpen: false, grn: null });
    setExpandedRow(null);
  };

  const handleGRNReject = (remarks: string) => {
    if (!approvalModal.grn) return;
    setStatusUpdates(prev => ({ ...prev, [approvalModal.grn!.grnNumber]: 'Quality Rejected' }));
    showToast(`${approvalModal.grn.grnNumber} rejected`, 'error');
    setApprovalModal({ isOpen: false, grn: null });
    setExpandedRow(null);
  };

  const handleCreateGRN = async (data: NewGRNData) => {
    const matchedPo = pendingFromPos.find((p) => p.poNumber === data.poNumber);
    const poId = matchedPo?.poId || prefillPoId;
    if (!poId) {
      showToast('PO reference missing — cannot submit GRN', 'error');
      return;
    }
    try {
      const res = await accountsApi.submitGrn({
        poId,
        grnNumber: data.grnNumber,
        receivedDate: data.receivedDate,
        receivedBy: data.receivedBy,
        inspectedBy: data.inspectedBy,
        remarks: data.remarks,
        lineItems: await Promise.all(
          data.lineItems.map(async (item) => ({
            id: item.id,
            poLineItemId: item.id,
            description: item.description,
            orderedQty: item.orderedQty,
            receivedQty: item.receivedQty,
            unitPrice: item.unitPrice,
            condition: item.condition,
            remarks: item.remarks,
            attachments: await Promise.all(
              (item.attachments || []).map(async (file) => {
                const payload = await fileToAttachmentPayload(file);
                return {
                  fileName: payload.fileName,
                  fileData: payload.data,
                  mimeType: payload.mimeType,
                };
              })
            ),
          }))
        ),
      });
      setCreateGRNOpen(false);
      setPrefillPoId(undefined);
      setPrefillPoNumber(undefined);
      showToast(
        res.message ||
          'GRN submitted — invoice base created. Opening Vendor Invoice to add invoice…',
        'success'
      );
      await loadAcceptedPos();
      navigate('/scm/vendor-invoice');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'GRN submit failed', 'error');
    }
  };

  const allGRNs = useMemo(() => {
    const enteredPoNumbers = new Set(newGRNs.map((g) => g.poNumber));
    const awaiting = pendingFromPos.filter((p) => !enteredPoNumbers.has(p.poNumber));
    return [...newGRNs, ...awaiting];
  }, [newGRNs, pendingFromPos]);

  const processedGRNs = useMemo(
    () => allGRNs.map(g => ({ ...g, status: statusUpdates[g.grnNumber] || g.status })),
    [allGRNs, statusUpdates]
  );

  const filteredGRNs = useMemo(() => {
    let result = [...processedGRNs];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(g =>
        g.grnNumber.toLowerCase().includes(q) ||
        g.poNumber.toLowerCase().includes(q) ||
        g.prId.toLowerCase().includes(q) ||
        g.vendor.toLowerCase().includes(q) ||
        g.department.toLowerCase().includes(q) ||
        g.requester.toLowerCase().includes(q)
      );
    }
    if (filter !== 'all') {
      result = result.filter(g => g.status === filter);
    }
    result.sort((a, b) => {
      const order: Record<GRNStatus, number> = {
        'Pending Receipt': 0,
        'Partially Received': 1,
        'Quality Rejected': 2,
        'Fully Received': 3,
      };
      return (order[a.status] ?? 4) - (order[b.status] ?? 4);
    });
    return result;
  }, [processedGRNs, searchTerm, filter]);

  const stats = useMemo(() => ({
    pending: processedGRNs.filter(g => g.status === 'Pending Receipt').length,
    partial: processedGRNs.filter(g => g.status === 'Partially Received').length,
    received: processedGRNs.filter(g => g.status === 'Fully Received').length,
    rejected: processedGRNs.filter(g => g.status === 'Quality Rejected').length,
    totalPendingValue: processedGRNs
      .filter(g => g.status === 'Pending Receipt' || g.status === 'Partially Received')
      .reduce((s, g) => s + (g.grandTotal - g.receivedValue), 0),
  }), [processedGRNs]);

  const toggleRow = (grnNumber: string) => {
    setExpandedRow(prev => prev === grnNumber ? null : grnNumber);
  };

  return (
    <DashboardLayout>
      <div className="min-h-full font-sans text-[#0F172A]" style={{ background: PM_PAGE_BG }}>
        <div className="space-y-4 p-2 pb-6 sm:p-4 lg:p-6">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-1 pb-3 pt-1 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.12)] backdrop-blur-md sm:px-0 sm:pb-4">
            <div>
              <h1 className="text-base font-semibold leading-snug tracking-tight text-slate-800 sm:text-2xl">Goods Receipt Note (GRN)</h1>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-sm">
                Vendor-accepted POs from approval — enter GRN with original PO data
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPrefillPoId(undefined);
                setPrefillPoNumber(undefined);
                setCreateGRNOpen(true);
              }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#1E88E5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1565C0]"
            >
              <i className="ri-add-line"></i>
              Enter GRN
            </button>
          </header>

          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
            <SoftInsightCard title="Pending Receipt" value={stats.pending} icon="ri-time-line" theme="orange" selected={filter === 'Pending Receipt'} onClick={() => setFilter(filter === 'Pending Receipt' ? 'all' : 'Pending Receipt')} />
            <SoftInsightCard title="Partially Received" value={stats.partial} icon="ri-loader-2-line" theme="cyan" selected={filter === 'Partially Received'} onClick={() => setFilter(filter === 'Partially Received' ? 'all' : 'Partially Received')} />
            <SoftInsightCard title="Fully Received" value={stats.received} icon="ri-check-double-line" theme="green" selected={filter === 'Fully Received'} onClick={() => setFilter(filter === 'Fully Received' ? 'all' : 'Fully Received')} />
            <SoftInsightCard title="Quality Rejected" value={stats.rejected} icon="ri-close-circle-line" theme="rose" selected={filter === 'Quality Rejected'} onClick={() => setFilter(filter === 'Quality Rejected' ? 'all' : 'Quality Rejected')} />
            <SoftInsightCard title="Pending Value" value={formatCurrency(stats.totalPendingValue)} icon="ri-truck-line" theme="blue" subtitle={`${stats.pending + stats.partial} awaiting receipt`} />
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)' }} />
            <div className="relative z-[1] flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1 max-w-md">
                <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type="text"
                  placeholder="Search GRN, PO, vendor, requester..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="box-border h-11 w-full rounded-2xl border border-transparent bg-white pl-10 pr-4 text-sm shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] outline-none focus:border-[#90CAF9] focus:ring-2 focus:ring-[#1E88E5]/15"
                />
              </div>
              <button type="button" onClick={() => loadAcceptedPos()} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl bg-white text-slate-500 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)]" title="Refresh">
                <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i>
              </button>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'Pending Receipt', label: 'Pending' },
                  { key: 'Partially Received', label: 'Partial' },
                  { key: 'Fully Received', label: 'Received' },
                  { key: 'Quality Rejected', label: 'Rejected' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFilter(tab.key)}
                    className={`cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold ${filter === tab.key ? 'bg-[#1E88E5] text-white' : 'bg-[#F8FAFC] text-slate-600'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="relative overflow-x-clip rounded-2xl border border-transparent bg-[#F8FAFC]/90 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(248,250,252,0) 55%)' }} />
            {loading ? (
              <p className="relative z-[1] p-8 text-sm text-slate-500">Loading vendor-accepted POs…</p>
            ) : filteredGRNs.length === 0 ? (
              <div className="relative z-[1] py-16 text-center">
                <p className="text-sm font-medium text-slate-500">No vendor-accepted POs ready for GRN</p>
                <p className="mt-1 text-xs text-slate-400">Accept a PO on Vendor PO Acceptance first</p>
                {(searchTerm || filter !== 'all') && (
                  <button type="button" onClick={() => { setSearchTerm(''); setFilter('all'); }} className="mt-3 cursor-pointer rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#1E88E5]">
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="relative z-[1] overflow-x-auto px-0 pb-3 pt-1">
                <table className="w-max min-w-full border-separate border-spacing-x-0 border-spacing-y-3 text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-30 whitespace-nowrap bg-[#F8FAFC] py-1 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">GRN</th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">PO</th>
                      <th className="w-[240px] max-w-[240px] bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Title</th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Vendor</th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Department</th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">PO Value</th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Progress</th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Status</th>
                      <th className="sticky right-0 z-30 whitespace-nowrap bg-[#F8FAFC] py-1 pl-3 pr-4 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGRNs.map((grn) => {
                      const isExpanded = expandedRow === grn.grnNumber;
                      const isPending = grn.status === 'Pending Receipt' || grn.status === 'Partially Received';
                      const isReceived = grn.status === 'Fully Received' || grn.status === 'Partially Received';
                      const totalOrdered = grn.lineItems.reduce((s, i) => s + i.orderedQty, 0);
                      const totalReceived = grn.lineItems.reduce((s, i) => s + i.receivedQty, 0);
                      const pct = formatPercent(totalReceived, totalOrdered);
                      const rowBorder = isExpanded ? 'border-[#90CAF9]' : 'border-transparent group-hover:border-[#90CAF9]';
                      const rowShadow = isExpanded ? 'shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)]' : 'shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] group-hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.16)]';
                      return (
                        <Fragment key={grn.grnNumber}>
                          <tr className="group cursor-pointer" onClick={() => toggleRow(grn.grnNumber)}>
                            <td className="relative sticky left-0 z-20 h-px bg-[#F8FAFC] p-0 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-3 before:-top-3 before:z-0 before:bg-[#F8FAFC]">
                              <div className={`relative z-[1] flex h-full items-center gap-2.5 whitespace-nowrap rounded-l-2xl border border-r-0 bg-white py-4 pl-3 pr-3 sm:rounded-l-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}>
                                <button type="button" className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl ${isExpanded ? 'bg-[#1E88E5] text-white' : 'bg-[#E3F2FD] text-[#1E88E5]'}`} aria-expanded={isExpanded}>
                                  <i className={`ri-arrow-${isExpanded ? 'down' : 'right'}-s-line text-base`}></i>
                                </button>
                                <div>
                                  <p className="text-sm font-bold text-[#1E88E5]">{grn.awaitingEntry ? 'Awaiting GRN' : grn.grnNumber}</p>
                                  <p className="text-xs text-slate-400">{grn.awaitingEntry ? 'Vendor accepted' : grn.poDate}</p>
                                </div>
                              </div>
                            </td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle sm:py-5 ${rowBorder}`}>
                              <p className="text-sm font-semibold text-[#2C3E50]">{grn.poNumber}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{grn.prId || '—'}</p>
                            </td>
                            <td className={`w-[240px] max-w-[240px] border border-x-0 bg-white px-3 py-4 align-middle sm:py-5 ${rowBorder}`} title={grn.prTitle}>
                              <p className="truncate text-sm font-semibold text-[#2C3E50]">{grn.prTitle || '—'}</p>
                            </td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle text-sm font-semibold text-[#2C3E50] sm:py-5 ${rowBorder}`}>{grn.vendor || '—'}</td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle sm:py-5 ${rowBorder}`}>
                              <p className="text-sm font-semibold text-[#2C3E50]">{grn.department || '—'}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{grn.requester || '—'}</p>
                            </td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-right align-middle text-sm font-bold tabular-nums text-[#2C3E50] sm:py-5 ${rowBorder}`}>
                              {formatCurrency(grn.grandTotal)}
                            </td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle sm:py-5 ${rowBorder}`}>
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                                  <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-[#1E88E5]' : 'bg-slate-300'}`} style={{ width: `${pct}%` }}></div>
                                </div>
                                <span className="text-xs font-semibold text-slate-600">{pct}%</span>
                              </div>
                              <p className="mt-1 text-xs text-slate-400">{totalReceived}/{totalOrdered} units</p>
                            </td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle sm:py-5 ${rowBorder}`}>
                              <GRNStatusBadge status={grn.status} />
                              <span className="ml-1.5"><PriorityBadge priority={grn.priority} /></span>
                            </td>
                            <td className="relative sticky right-0 z-20 h-px bg-[#F8FAFC] p-0 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-3 before:-top-3 before:z-0 before:bg-[#F8FAFC]" onClick={(e) => e.stopPropagation()}>
                              <div className={`relative z-[1] flex h-full flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap rounded-r-2xl border border-l-0 bg-white py-4 pl-3 pr-4 sm:rounded-r-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}>
                                {grn.awaitingEntry && (
                                  <button type="button" onClick={() => openEnterGrn(grn)} className="cursor-pointer whitespace-nowrap rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white">Mark received</button>
                                )}
                                {isPending && !grn.awaitingEntry && (
                                  <button type="button" onClick={() => setReceiptModal({ isOpen: true, grn })} className="cursor-pointer whitespace-nowrap rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white">Confirm</button>
                                )}
                                {isReceived && !grn.awaitingEntry && (
                                  <button type="button" onClick={() => setApprovalModal({ isOpen: true, grn })} className="cursor-pointer whitespace-nowrap rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white">Approve</button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <ExpandedGRNRow
                              grn={grn}
                              onMarkReceived={() => grn.awaitingEntry ? openEnterGrn(grn) : setReceiptModal({ isOpen: true, grn })}
                              onApprove={() => setApprovalModal({ isOpen: true, grn })}
                              onEnterGrn={() => openEnterGrn(grn)}
                            />
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={receiptModal.isOpen}
        grn={receiptModal.grn}
        onConfirm={handleConfirmReceipt}
        onClose={() => setReceiptModal({ isOpen: false, grn: null })}
      />

      {/* GRN Approval Modal */}
      <GRNApprovalModal
        isOpen={approvalModal.isOpen}
        grn={approvalModal.grn}
        onApprove={handleGRNApprove}
        onReject={handleGRNReject}
        onClose={() => setApprovalModal({ isOpen: false, grn: null })}
      />

      {/* Create GRN Modal */}
      <CreateGRNModal
        isOpen={createGRNOpen}
        onClose={() => {
          setCreateGRNOpen(false);
          setPrefillPoNumber(undefined);
          setPrefillPoId(undefined);
        }}
        onSubmit={handleCreateGRN}
        initialPoNumber={prefillPoNumber}
        initialPoId={prefillPoId}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={`px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold ${
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
