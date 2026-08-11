import { useState, useMemo, useEffect, useCallback, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/feature/DashboardLayout';
import { GRNData, GRNStatus } from '../../mocks/grn-data';
import { poApi } from '../../services/api';
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
    poDate: po.createdAt || '',
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
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="ri-truck-line text-white text-xl"></i>
            </div>
            <div>
              <h3 className="text-white font-bold text-base">Confirm Goods Receipt</h3>
              <p className="text-teal-100 text-xs mt-0.5">{grn.grnNumber} · {grn.vendor}</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 mb-5">
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
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 resize-none"
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
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-check-line mr-1"></i> Confirm Receipt
            </button>
          </div>
        </div>
      </div>
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
      <td colSpan={10} className="px-0 py-0 bg-slate-50 border-b border-teal-200">
        <div className="mx-6 my-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Expanded Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gradient-to-r from-teal-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <i className="ri-truck-line text-teal-600 text-lg"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {grn.awaitingEntry ? grn.poNumber : grn.grnNumber}
                </p>
                <p className="text-xs text-gray-500">{grn.prTitle}</p>
              </div>
              <div className="ml-4 flex items-center gap-2">
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${receiptPct === 100 ? 'bg-emerald-500' : receiptPct > 0 ? 'bg-sky-500' : 'bg-gray-300'}`}
                    style={{ width: `${receiptPct}%` }}
                  ></div>
                </div>
                <span className="text-xs font-semibold text-gray-600">{receiptPct}% received</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {grn.awaitingEntry && onEnterGrn && (
                <button
                  onClick={onEnterGrn}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 shadow-sm"
                >
                  <i className="ri-checkbox-circle-line"></i> Mark as Received
                </button>
              )}
              {isPending && !grn.awaitingEntry && (
                <button
                  onClick={onMarkReceived}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 shadow-sm"
                >
                  <i className="ri-checkbox-circle-line"></i> Confirm Receipt
                </button>
              )}
              {isReceived && !grn.awaitingEntry && (
                <button
                  onClick={onApprove}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 shadow-sm"
                >
                  <i className="ri-shield-check-line"></i> PO vs GRN Check & Approve
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-6 bg-white">
            {[
              { key: 'details', label: 'GRN Details', icon: 'ri-information-line' },
              { key: 'items', label: 'Line Items', icon: 'ri-list-check-2' },
              { key: 'history', label: 'Receipt History', icon: 'ri-history-line' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'details' | 'items' | 'history')}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <i className={tab.icon}></i>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'details' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Top Summary Row */}
                <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
                  {[
                    { label: 'GRN Number', value: grn.grnNumber, icon: 'ri-file-text-line', color: 'text-teal-600' },
                    { label: 'PO Reference', value: grn.poNumber, icon: 'ri-links-line', color: 'text-teal-600' },
                    { label: 'Expected Delivery', value: grn.expectedDeliveryDate, icon: 'ri-calendar-line', color: 'text-gray-700' },
                    { label: 'Received Date', value: grn.receivedDate || 'Not yet received', icon: 'ri-truck-line', color: grn.receivedDate ? 'text-emerald-600' : 'text-amber-600' },
                  ].map((item) => (
                    <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <i className={`${item.icon} text-xs`}></i>{item.label}
                      </p>
                      <p className={`text-sm font-semibold ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Left Column */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <i className="ri-file-list-3-line text-teal-500"></i> Purchase Request Details
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">PR Title</p>
                        <p className="text-sm font-medium text-gray-900">{grn.prTitle}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Department</p>
                        <p className="text-sm font-medium text-gray-900">{grn.department}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Requester</p>
                        <p className="text-sm font-medium text-gray-900">{grn.requester}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-teal-50 rounded-lg p-4 border border-teal-100">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <i className="ri-store-2-line text-teal-500"></i> Vendor Information
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Vendor Name</p>
                        <p className="text-sm font-semibold text-gray-900">{grn.vendor}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Payment Terms</p>
                        <p className="text-sm font-medium text-gray-900">{grn.paymentTerms}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <i className="ri-map-pin-line text-teal-500"></i> Delivery Address
                    </h4>
                    <p className="text-sm text-gray-800 leading-relaxed">{grn.deliveryAddress}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <i className="ri-user-line text-teal-500"></i> Personnel
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Received By</p>
                        {grn.receivedBy ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-teal-100 rounded-full flex items-center justify-center">
                              <span className="text-teal-700 text-xs font-bold">
                                {grn.receivedBy.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-gray-800">{grn.receivedBy}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Not yet assigned</span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Inspected By</p>
                        {grn.inspectedBy ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center">
                              <span className="text-emerald-700 text-xs font-bold">
                                {grn.inspectedBy.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-gray-800">{grn.inspectedBy}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Not yet inspected</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {grn.remarks && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <i className="ri-chat-3-line"></i> Remarks
                      </h4>
                      <p className="text-sm text-gray-700 leading-relaxed">{grn.remarks}</p>
                    </div>
                  )}
                </div>

                {/* Right Column */}
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 rounded-lg p-4 sticky top-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-1.5">
                      <i className="ri-receipt-line text-teal-500"></i> Receipt Summary
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">PO Value</span>
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(grn.grandTotal)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Received Value</span>
                        <span className="text-sm font-medium text-emerald-600">{formatCurrency(grn.receivedValue)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Pending Value</span>
                        <span className="text-sm font-medium text-amber-600">{formatCurrency(grn.grandTotal - grn.receivedValue)}</span>
                      </div>
                      <div className="pt-3 border-t-2 border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">Receipt Progress</p>
                        <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${receiptPct === 100 ? 'bg-emerald-500' : receiptPct > 0 ? 'bg-sky-500' : 'bg-gray-300'}`}
                            style={{ width: `${receiptPct}%` }}
                          ></div>
                        </div>
                        <p className="text-xs font-semibold text-gray-700 mt-1.5 text-right">{receiptPct}% complete</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="text-gray-700 font-medium">{formatCurrency(grn.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">GST ({grn.gstPercentage}%)</span>
                        <span className="text-gray-700 font-medium">{formatCurrency(grn.taxAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold pt-1 border-t border-gray-200">
                        <span className="text-gray-900">Grand Total</span>
                        <span className="text-teal-600">{formatCurrency(grn.grandTotal)}</span>
                      </div>
                    </div>

                    {isReceived && (
                      <button
                        onClick={onApprove}
                        className="mt-4 w-full px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                      >
                        <i className="ri-shield-check-line"></i> PO vs GRN Check & Approve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'items' && (
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {['#', 'Item Description', 'Ordered Qty', 'Received Qty', 'Pending Qty', 'Unit Price', 'Total', 'Condition'].map((h) => (
                        <th
                          key={h}
                          className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap ${
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
                  <tbody className="divide-y divide-gray-100">
                    {grn.lineItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-500 text-center">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.description}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{item.orderedQty}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-emerald-600 text-right">{item.receivedQty}</td>
                        <td className={`px-4 py-3 text-sm font-semibold text-right ${item.pendingQty > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                          {item.pendingQty}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{formatCurrency(item.total)}</td>
                        <td className="px-4 py-3 text-right">
                          <ConditionBadge condition={item.condition} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-teal-50 border-t-2 border-teal-200">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-sm font-bold text-gray-700 text-right">Subtotal</td>
                      <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900 text-right">{formatCurrency(grn.subtotal)}</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="px-4 py-2 text-sm text-gray-600 text-right">GST ({grn.gstPercentage}%)</td>
                      <td colSpan={2} className="px-4 py-2 text-sm text-gray-700 text-right">{formatCurrency(grn.taxAmount)}</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-base font-bold text-gray-900 text-right">Grand Total</td>
                      <td colSpan={2} className="px-4 py-3 text-base font-bold text-teal-600 text-right">{formatCurrency(grn.grandTotal)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-0 max-w-2xl">
                {grn.receiptHistory.map((item, idx) => (
                  <div key={idx} className="flex gap-4 pb-6 relative">
                    {idx !== grn.receiptHistory.length - 1 && (
                      <div className="absolute left-4 top-10 w-0.5 h-full bg-gray-200"></div>
                    )}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.action.includes('Received') || item.action.includes('Closed') || item.action.includes('Confirmed') || item.action.includes('Approved') ? 'bg-emerald-100' :
                      item.action.includes('Rejected') || item.action.includes('Failed') ? 'bg-red-100' :
                      item.action.includes('Partial') ? 'bg-sky-100' : 'bg-amber-100'
                    }`}>
                      <i className={`text-sm ${
                        item.action.includes('Received') || item.action.includes('Closed') || item.action.includes('Confirmed') || item.action.includes('Approved') ? 'ri-check-line text-emerald-600' :
                        item.action.includes('Rejected') || item.action.includes('Failed') ? 'ri-close-line text-red-600' :
                        item.action.includes('Partial') ? 'ri-loader-2-line text-sky-600' :
                        'ri-time-line text-amber-600'
                      }`}></i>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.action}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{item.performedBy} · {item.role}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 mt-2 leading-relaxed">{item.notes}</p>
                      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        <i className="ri-calendar-line"></i>{item.date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function GRNPage() {
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
      const res = await poApi.listVendorAcceptance();
      const accepted = ((res.data as ApiPo[]) || []).filter(
        (p) => p.vendorAcceptanceStatus === 'accepted' || p.vendorAcceptanceStatus === 'partial'
      );
      setPendingFromPos(accepted.map(mapAcceptedPoToPendingGrn));
    } catch (err) {
      setPendingFromPos([]);
      showToast(err instanceof Error ? err.message : 'Failed to load vendor-accepted POs', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAcceptedPos();
  }, [loadAcceptedPos]);

  useEffect(() => {
    saveStoredGrns(newGRNs);
  }, [newGRNs]);

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

  const handleCreateGRN = (data: NewGRNData) => {
    const totalOrdered = data.lineItems.reduce((s, i) => s + i.orderedQty, 0);
    const totalReceived = data.lineItems.reduce((s, i) => s + i.receivedQty, 0);
    const allReceived = totalReceived === totalOrdered;
    const noneReceived = totalReceived === 0;
    const matchedPo = pendingFromPos.find((p) => p.poNumber === data.poNumber);

    const newGRN: GRNData = {
      grnNumber: data.grnNumber,
      poNumber: data.poNumber,
      poId: matchedPo?.poId || prefillPoId,
      prId: data.prId,
      prTitle: data.prTitle,
      vendor: data.vendor,
      department: data.department,
      requester: data.requester,
      poDate: matchedPo?.poDate || new Date().toISOString().split('T')[0],
      expectedDeliveryDate: data.expectedDeliveryDate,
      receivedDate: data.receivedDate,
      deliveryAddress: data.deliveryAddress,
      paymentTerms: data.paymentTerms,
      lineItems: data.lineItems.map(item => ({
        id: item.id,
        description: item.description,
        orderedQty: item.orderedQty,
        receivedQty: item.receivedQty,
        pendingQty: item.orderedQty - item.receivedQty,
        unitPrice: item.unitPrice,
        total: item.receivedQty * item.unitPrice,
        condition: item.condition,
      })),
      subtotal: data.subtotal,
      gstPercentage: data.gstPercentage,
      taxAmount: data.taxAmount,
      grandTotal: data.grandTotal,
      receivedValue: data.subtotal,
      status: noneReceived ? 'Pending Receipt' : allReceived ? 'Fully Received' : 'Partially Received',
      priority: matchedPo?.priority || 'medium',
      receivedBy: data.receivedBy || null,
      inspectedBy: data.inspectedBy || null,
      remarks: data.remarks,
      awaitingEntry: false,
      receiptHistory: [
        {
          action: 'GRN Created',
          performedBy: data.receivedBy || 'Store Keeper',
          role: 'Store Keeper',
          date: `${data.receivedDate} 10:00 AM`,
          notes: `GRN created for ${data.poNumber}. ${data.remarks || 'Goods received and recorded.'}`,
        },
      ],
    };

    setNewGRNs(prev => [newGRN, ...prev.filter((g) => g.poNumber !== data.poNumber)]);
    setCreateGRNOpen(false);
    setPrefillPoNumber(undefined);
    setPrefillPoId(undefined);
    showToast(`${data.grnNumber} created successfully!`, 'success');
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
      {/* Page Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Goods Receipt Note (GRN)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Vendor-accepted POs from approval — enter GRN with original PO data
          </p>
        </div>
        <button
          onClick={() => {
            setPrefillPoId(undefined);
            setPrefillPoNumber(undefined);
            setCreateGRNOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap shadow-sm"
        >
          <i className="ri-add-line text-base"></i>
          Enter GRN
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {[
          { label: 'Pending Receipt', value: stats.pending, icon: 'ri-time-line', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
          { label: 'Partially Received', value: stats.partial, icon: 'ri-loader-2-line', bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-100' },
          { label: 'Fully Received', value: stats.received, icon: 'ri-check-double-line', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
          { label: 'Quality Rejected', value: stats.rejected, icon: 'ri-close-circle-line', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
        ].map((card) => (
          <div key={card.label} className={`bg-white rounded-xl border ${card.border} p-5 flex items-center justify-between`}>
            <div>
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className="text-3xl font-bold text-gray-900">{card.value}</p>
            </div>
            <div className={`w-12 h-12 ${card.bg} rounded-xl flex items-center justify-center`}>
              <i className={`${card.icon} text-2xl ${card.text}`}></i>
            </div>
          </div>
        ))}
      </div>

      {/* Pending Value Banner */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <i className="ri-truck-line text-white text-2xl"></i>
          </div>
          <div>
            <p className="text-teal-100 text-sm">Total Pending Receipt Value</p>
            <p className="text-white text-2xl font-bold">
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(stats.totalPendingValue)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-teal-100 text-xs">{stats.pending + stats.partial} GRN{(stats.pending + stats.partial) !== 1 ? 's' : ''} awaiting receipt</p>
          <p className="text-white text-sm font-medium mt-0.5">Click any row to expand details</p>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* Filters */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-gray-900">GRN Register</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => loadAcceptedPos()}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                title="Refresh"
              >
                <i className={`ri-refresh-line text-sm ${loading ? 'animate-spin' : ''}`}></i>
              </button>
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="text"
                  placeholder="Search GRN, PO, vendor, requester..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 w-72"
                />
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'Pending Receipt', label: 'Pending' },
                  { key: 'Partially Received', label: 'Partial' },
                  { key: 'Fully Received', label: 'Received' },
                  { key: 'Quality Rejected', label: 'Rejected' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      filter === tab.key ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Showing <strong className="text-gray-700">{filteredGRNs.length}</strong> record
            {filteredGRNs.length !== 1 ? 's' : ''} from vendor-accepted POs · Click any row to expand
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-gray-400">
              <i className="ri-loader-4-line text-4xl block mb-2 animate-spin"></i>
              <p className="text-sm">Loading vendor-accepted POs…</p>
            </div>
          ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['', 'GRN / Status', 'PO Reference', 'Vendor', 'Department / Requester', 'PO Value', 'Receipt Progress', 'Priority', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
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

                return (
                  <Fragment key={grn.grnNumber}>
                    <tr
                      onClick={() => toggleRow(grn.grnNumber)}
                      className={`border-b transition-colors cursor-pointer ${
                        isExpanded
                          ? 'bg-teal-50 border-teal-200'
                          : isPending
                          ? 'hover:bg-amber-50/40 border-gray-100'
                          : 'hover:bg-gray-50 border-gray-100'
                      }`}
                    >
                      <td className="px-4 py-4 w-8">
                        <div className={`w-6 h-6 flex items-center justify-center rounded transition-all ${isExpanded ? 'bg-teal-100 text-teal-600' : 'text-gray-400'}`}>
                          <i className={`text-sm transition-transform duration-200 ${isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {grn.awaitingEntry ? (
                          <>
                            <p className="text-sm font-bold text-amber-700">Awaiting GRN</p>
                            <p className="text-xs text-gray-400 mt-0.5">Vendor accepted</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-bold text-gray-900">{grn.grnNumber}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{grn.poDate}</p>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-teal-600">{grn.poNumber}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{grn.prId}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <i className="ri-store-2-line text-gray-500 text-xs"></i>
                          </div>
                          <p className="text-sm font-medium text-gray-900 max-w-[150px] truncate">{grn.vendor}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-medium text-gray-900">{grn.department}</p>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <i className="ri-user-line text-xs"></i>{grn.requester}
                        </p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(grn.grandTotal)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{grn.lineItems.length} item{grn.lineItems.length !== 1 ? 's' : ''}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-sky-500' : 'bg-gray-300'}`}
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">{pct}%</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{totalReceived}/{totalOrdered} units</p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <PriorityBadge priority={grn.priority} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <GRNStatusBadge status={grn.status} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleRow(grn.grnNumber)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                            title="Expand Details"
                          >
                            <i className={`text-sm ${isExpanded ? 'ri-eye-off-line' : 'ri-eye-line'}`}></i>
                          </button>
                          {grn.awaitingEntry && (
                            <button
                              onClick={() => openEnterGrn(grn)}
                              className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                              title="Mark as Received — enter GRN fields"
                            >
                              <i className="ri-checkbox-circle-line text-sm"></i>
                            </button>
                          )}
                          {isPending && !grn.awaitingEntry && (
                            <button
                              onClick={() => setReceiptModal({ isOpen: true, grn })}
                              className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                              title="Confirm Receipt"
                            >
                              <i className="ri-checkbox-circle-line text-sm"></i>
                            </button>
                          )}
                          {isReceived && !grn.awaitingEntry && (
                            <button
                              onClick={() => setApprovalModal({ isOpen: true, grn })}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="PO vs GRN Check & Approve"
                            >
                              <i className="ri-shield-check-line text-sm"></i>
                            </button>
                          )}
                          <button
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                            title="Print GRN"
                          >
                            <i className="ri-printer-line text-sm"></i>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <ExpandedGRNRow
                        grn={grn}
                        onMarkReceived={() =>
                          grn.awaitingEntry
                            ? openEnterGrn(grn)
                            : setReceiptModal({ isOpen: true, grn })
                        }
                        onApprove={() => setApprovalModal({ isOpen: true, grn })}
                        onEnterGrn={() => openEnterGrn(grn)}
                      />
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          )}
        </div>

        {!loading && filteredGRNs.length === 0 && (
          <div className="py-16 text-center">
            <i className="ri-truck-line text-5xl text-gray-200 mb-4 block"></i>
            <p className="text-gray-500 text-sm font-medium">No vendor-accepted POs ready for GRN</p>
            <p className="text-xs text-gray-400 mt-1">Accept a PO on Vendor PO Acceptance first</p>
            {(searchTerm || filter !== 'all') && (
              <button
                onClick={() => { setSearchTerm(''); setFilter('all'); }}
                className="mt-3 px-4 py-2 text-sm font-medium text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
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
