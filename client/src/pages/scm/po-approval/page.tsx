
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

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

/** Manager still needs to act */
const isAwaitingManager = (status: string) => status === 'Pending Approval';

/** Manager already signed / final approved / sent */
const isManagerApproved = (status: string) =>
  status === 'PO Approved' ||
  status === 'Sent to Vendor' ||
  status === 'Pending Vendor Acceptance' ||
  status === 'Vendor Accepted' ||
  status === 'Partially Accepted' ||
  status === 'Pending Buyer Verify';

const isRejected = (status: string) => status === 'PO Rejected';

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    'Pending Approval': 'bg-amber-100 text-amber-700 border border-amber-200',
    'Pending Buyer Verify': 'bg-blue-100 text-blue-700 border border-blue-200',
    'PO Approved': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'Sent to Vendor': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'PO Rejected': 'bg-red-100 text-red-700 border border-red-200',
  };
  const icon: Record<string, string> = {
    'Pending Approval': 'ri-time-line',
    'Pending Buyer Verify': 'ri-shield-check-line',
    'PO Approved': 'ri-check-double-line',
    'Sent to Vendor': 'ri-mail-send-line',
    'PO Rejected': 'ri-close-circle-line',
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

function ExpandedRow({ po, onApprove, onReject, onSendBack, onEdit, onViewPdf, isPending }: ExpandedRowProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'items' | 'comparison' | 'history'>('details');
  const [comparisonData, setComparisonData] = useState<VendorComparisonData | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState('');
  const [filePreview, setFilePreview] = useState<{ url: string; fileName: string } | null>(null);

  useEffect(() => {
    if (activeTab !== 'comparison' || !po.prDbId) return;

    let cancelled = false;
    setComparisonLoading(true);
    setComparisonError('');

    rfqApi.getComparison(po.prDbId)
      .then((res) => {
        if (!cancelled) setComparisonData(res.data);
      })
      .catch((err) => {
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
  }, [activeTab, po.prDbId]);

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
      <td colSpan={9} className="px-0 py-0 bg-slate-50 border-b border-teal-200">
        <div className="mx-6 my-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Expanded Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gradient-to-r from-teal-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <i className="ri-file-text-line text-teal-600 text-lg"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{po.poNumber}</p>
                <p className="text-xs text-gray-500">{po.prTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onViewPdf}
                className="px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
              >
                <i className="ri-file-pdf-line"></i> View PDF
              </button>
              {isPending && (
                <>
                  <button
                    type="button"
                    onClick={onEdit}
                    className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <i className="ri-edit-line"></i> Edit PO
                  </button>
                  <button
                    onClick={onApprove}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 shadow-sm"
                  >
                    <i className="ri-quill-pen-line"></i> Sign &amp; Approve
                  </button>
                  <button
                    type="button"
                    onClick={onSendBack}
                    className="px-4 py-1.5 text-xs font-semibold text-orange-700 bg-white border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <i className="ri-arrow-go-back-line"></i> Send Back
                  </button>
                  <button
                    onClick={onReject}
                    className="px-4 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <i className="ri-close-circle-line"></i> Reject PO
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-6 bg-white">
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
                {/* PO Summary */}
                <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
                  {[
                    { label: 'PO Number', value: po.poNumber, icon: 'ri-file-text-line', color: 'text-teal-600' },
                    { label: 'PR Reference', value: po.prId, icon: 'ri-links-line', color: 'text-teal-600' },
                    { label: 'Created Date', value: po.createdDate, icon: 'ri-calendar-line', color: 'text-gray-700' },
                    { label: 'Expected Delivery', value: po.expectedDeliveryDate, icon: 'ri-truck-line', color: 'text-gray-700' },
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
                  {/* PR Details */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <i className="ri-file-list-3-line text-teal-500"></i> Purchase Request Details
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Title</p>
                        <p className="text-sm font-medium text-gray-900">{po.prTitle}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Department</p>
                        <p className="text-sm font-medium text-gray-900">{po.department}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Requester</p>
                        <p className="text-sm font-medium text-gray-900">{po.requester}</p>
                      </div>
                    </div>
                    <ManagerL2CommentsHighlight history={po.approvalHistory} />
                  </div>

                  {/* Vendor Info */}
                  <div className="bg-teal-50 rounded-lg p-4 border border-teal-100">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <i className="ri-store-2-line text-teal-500"></i> Vendor Information
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Vendor Name</p>
                        <p className="text-sm font-semibold text-gray-900">{po.vendor}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Payment Terms</p>
                        <p className="text-sm font-medium text-gray-900">{po.paymentTerms}</p>
                      </div>
                    </div>
                  </div>

                  {/* Delivery */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <i className="ri-map-pin-line text-teal-500"></i> Delivery Details
                    </h4>
                    <p className="text-xs text-gray-500 mb-1">Delivery Address</p>
                    <p className="text-sm text-gray-800 leading-relaxed">{po.deliveryAddress}</p>
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
                      <i className="ri-receipt-line text-teal-500"></i> Billing Summary
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
                          <span className="text-xl font-bold text-teal-600">{formatCurrency(po.grandTotal)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Created By</p>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-teal-100 rounded-full flex items-center justify-center">
                          <span className="text-teal-700 text-xs font-bold">
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
                    <tfoot className="bg-teal-50 border-t-2 border-teal-200">
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
                        <td className="px-4 py-3 text-base font-bold text-teal-600 text-right">{formatCurrency(po.grandTotal)}</td>
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
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3 p-3 bg-teal-50 border border-teal-100 rounded-lg text-sm">
                      <span className="font-semibold text-teal-800">{comparisonData.pr.prNumber}</span>
                      <span className="text-teal-700">{comparisonData.vendorCount} vendors quoted</span>
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
                    <VendorComparisonMatrix data={comparisonData} onPreviewFile={handlePreviewFile} />
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
    createdDate: String(raw.createdAt || ''),
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
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">SCM Manager — PO Sign &amp; Approve</h1>
        <p className="text-sm text-gray-500 mt-1">Sign PO with comments — after sign-off, SCM Buyer final-verifies before the vendor email is sent</p>
      </div>

      {loading && <p className="text-sm text-gray-500 mb-4">Loading purchase orders...</p>}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {[
          { key: 'pending', label: 'Pending Approval', value: stats.pending, icon: 'ri-time-line', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
          { key: 'approved', label: 'Approved', value: stats.approved, icon: 'ri-check-double-line', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
          { key: 'rejected', label: 'Rejected', value: stats.rejected, icon: 'ri-close-circle-line', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
          { key: 'all', label: 'Total POs', value: processedPOs.length, icon: 'ri-file-list-3-line', bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-100' },
        ].map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => setFilter(card.key)}
            className={`bg-white rounded-xl border ${card.border} p-5 flex items-center justify-between text-left transition-shadow hover:shadow-md cursor-pointer ${
              filter === card.key ? 'ring-2 ring-teal-500/30' : ''
            }`}
          >
            <div>
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className="text-3xl font-bold text-gray-900">{card.value}</p>
            </div>
            <div className={`w-12 h-12 ${card.bg} rounded-xl flex items-center justify-center`}>
              <i className={`${card.icon} text-2xl ${card.text}`}></i>
            </div>
          </button>
        ))}
      </div>

      {/* Pending Value Banner */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <i className="ri-money-rupee-circle-line text-white text-2xl"></i>
          </div>
          <div>
            <p className="text-teal-100 text-sm">Total Pending Approval Value</p>
            <p className="text-white text-2xl font-bold">{formatCurrency(stats.totalPendingValue)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-teal-100 text-xs">{stats.pending} PO{stats.pending !== 1 ? 's' : ''} awaiting your decision</p>
          <p className="text-white text-sm font-medium mt-0.5">Click any row to expand details</p>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* Table Header / Filters */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-gray-900">Purchase Order Approvals</h2>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="text"
                  placeholder="Search PO, vendor, requester..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 w-64"
                />
              </div>
              {/* Filter Tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'pending', label: 'Pending' },
                  { key: 'approved', label: 'Approved' },
                  { key: 'rejected', label: 'Rejected' },
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
            Showing <strong className="text-gray-700">{filteredPOs.length}</strong> purchase order{filteredPOs.length !== 1 ? 's' : ''} · Click any row to expand full details
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['', 'PO Number', 'PR Reference', 'Vendor', 'Department / Requester', 'Grand Total', 'Priority', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPOs.map((po) => {
                const isExpanded = expandedRow === po.poNumber;
                const isPending = isAwaitingManager(po.status);

                return (
                  <Fragment key={po.poNumber}>
                    <tr
                      onClick={() => toggleRow(po.poNumber)}
                      className={`border-b transition-colors cursor-pointer ${
                        isExpanded
                          ? 'bg-teal-50 border-teal-200'
                          : isPending
                          ? 'hover:bg-amber-50/40 border-gray-100'
                          : 'hover:bg-gray-50 border-gray-100'
                      }`}
                    >
                      {/* Expand Icon */}
                      <td className="px-4 py-4 w-8">
                        <div className={`w-6 h-6 flex items-center justify-center rounded transition-all ${isExpanded ? 'bg-teal-100 text-teal-600' : 'text-gray-400'}`}>
                          <i className={`text-sm transition-transform duration-200 ${isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
                        </div>
                      </td>

                      {/* PO Number */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm font-bold text-gray-900">{po.poNumber}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{po.createdDate}</p>
                      </td>

                      {/* PR Reference */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-teal-600">{po.prId}</span>
                      </td>

                      {/* Vendor */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <i className="ri-store-2-line text-gray-500 text-xs"></i>
                          </div>
                          <p className="text-sm font-medium text-gray-900 max-w-[160px] truncate">{po.vendor}</p>
                        </div>
                      </td>

                      {/* Department / Requester */}
                      <td className="px-4 py-4">
                        <p className="text-sm font-medium text-gray-900">{po.department}</p>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <i className="ri-user-line text-xs"></i>{po.requester}
                        </p>
                      </td>

                      {/* Grand Total */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(po.grandTotal)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{po.lineItems.length} item{po.lineItems.length !== 1 ? 's' : ''}</p>
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <PriorityBadge priority={po.priority} />
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <StatusBadge status={po.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleRow(po.poNumber)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                            title="Expand Details"
                          >
                            <i className={`text-sm ${isExpanded ? 'ri-eye-off-line' : 'ri-eye-line'}`}></i>
                          </button>
                          <button
                            onClick={() => {
                              const id = poIdMap[po.poNumber];
                              if (id) navigate(`/scm/po-pdf-view?poId=${id}`);
                            }}
                            className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                            title="View PDF"
                          >
                            <i className="ri-file-pdf-line text-sm"></i>
                          </button>
                          {isPending && (
                            <>
                              <button
                                onClick={() => {
                                  const id = poIdMap[po.poNumber];
                                  if (id) navigate(`/scm/create-po?poId=${id}`);
                                }}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit PO"
                              >
                                <i className="ri-edit-line text-sm"></i>
                              </button>
                              <button
                                onClick={() => openModal(po.poNumber, 'approve')}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="Sign & Approve (digital signature)"
                              >
                                <i className="ri-quill-pen-line text-sm"></i>
                              </button>
                              <button
                                onClick={() => openModal(po.poNumber, 'sendback')}
                                className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                                title="Send Back to Buyer"
                              >
                                <i className="ri-arrow-go-back-line text-sm"></i>
                              </button>
                              <button
                                onClick={() => openModal(po.poNumber, 'reject')}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Reject"
                              >
                                <i className="ri-close-line text-sm"></i>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Row */}
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
                          if (id) navigate(`/scm/create-po?poId=${id}`);
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
          <div className="py-16 text-center">
            <i className="ri-file-list-3-line text-5xl text-gray-200 mb-4 block"></i>
            <p className="text-gray-500 text-sm font-medium">No purchase orders found</p>
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

      {/* Approval Modal */}
      <POApprovalModal
        isOpen={modal.isOpen}
        type={modal.type}
        poNumber={modal.poNumber}
        prTitle={modal.prTitle}
        grandTotal={modal.grandTotal}
        onConfirm={handleConfirm}
        onClose={() => setModal(prev => ({ ...prev, isOpen: false }))}
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
