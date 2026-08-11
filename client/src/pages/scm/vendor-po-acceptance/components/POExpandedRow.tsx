import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { poApi } from '../../../../services/api';

export type AcceptancePo = {
  id: number;
  poNumber: string;
  prNumber?: string;
  prTitle?: string;
  vendorName?: string;
  vendorEmail?: string;
  vendorAddress?: string;
  vendorGst?: string;
  vendorPan?: string;
  vendorPhone?: string;
  department?: string;
  requester?: string;
  grandTotal?: number;
  subtotal?: number;
  gstPercentage?: number;
  taxAmount?: number;
  paymentTerms?: string;
  incoterms?: string;
  deliveryAddress?: string;
  expectedDeliveryDate?: string;
  specialInstructions?: string;
  createdAt?: string;
  createdBy?: string;
  createdByRole?: string;
  signatureName?: string;
  signedAt?: string;
  signerComments?: string;
  vendorAcceptanceStatus?: string | null;
  vendorAcceptanceMode?: string | null;
  vendorAcceptanceRemarks?: string;
  vendorAcceptanceFileName?: string;
  vendorDeliveryConfirmedDate?: string;
  vendorAcceptedAt?: string;
  lineItems?: Array<{
    id?: string | number;
    itemName?: string;
    description?: string;
    category?: string;
    quantity?: number;
    unitPrice?: number;
    discount?: number;
    total?: number;
  }>;
  approvalHistory?: Array<{
    stage?: string;
    approver?: string;
    role?: string;
    action?: string;
    date?: string;
    remarks?: string;
  }>;
};

type Props = {
  po: AcceptancePo;
  onSendMail: () => void;
  onManual: () => void;
  onViewPdf: () => void;
  busy?: boolean;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    amount || 0
  );

export default function POExpandedRow({ po, onSendMail, onManual, onViewPdf, busy }: Props) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'details' | 'items' | 'response' | 'history'>('details');
  const pending = !po.vendorAcceptanceStatus || po.vendorAcceptanceStatus === 'pending';
  const canGoGrn =
    po.vendorAcceptanceStatus === 'accepted' || po.vendorAcceptanceStatus === 'partial';

  return (
    <tr>
      <td colSpan={8} className="px-0 py-0 bg-slate-50 border-b border-teal-200">
        <div className="mx-4 my-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-gradient-to-r from-teal-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center shrink-0">
                <i className="ri-file-text-line text-teal-600 text-lg"></i>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">{po.poNumber}</p>
                <p className="text-xs text-gray-500 truncate">
                  {po.prTitle || po.prNumber || 'Purchase order'} · {po.vendorName}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onViewPdf}
                className="px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg"
              >
                <i className="ri-file-pdf-line mr-1"></i> Signed PO
              </button>
              {pending && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onSendMail}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-lg disabled:opacity-50"
                  >
                    Send Mail
                  </button>
                  <button
                    type="button"
                    onClick={onManual}
                    className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg"
                  >
                    Manual Entry
                  </button>
                </>
              )}
              {canGoGrn && (
                <button
                  type="button"
                  onClick={() => navigate('/grn')}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg"
                >
                  Go to GRN <i className="ri-arrow-right-line ml-1"></i>
                </button>
              )}
            </div>
          </div>

          <div className="flex border-b border-gray-100 px-5 overflow-x-auto">
            {[
              { key: 'details', label: 'PO Details', icon: 'ri-information-line' },
              { key: 'items', label: 'Line Items', icon: 'ri-list-check-2' },
              { key: 'response', label: 'Vendor Response', icon: 'ri-reply-line' },
              { key: 'history', label: 'History', icon: 'ri-history-line' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap ${
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

          <div className="p-5">
            {activeTab === 'details' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'PO Number', value: po.poNumber },
                    { label: 'PR', value: po.prNumber || '—' },
                    { label: 'Created', value: po.createdAt || '—' },
                    { label: 'Expected Delivery', value: po.expectedDeliveryDate || '—' },
                  ].map((item) => (
                    <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                      <p className="text-sm font-semibold text-gray-900">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-teal-50 border border-teal-100 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Vendor</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Name</p>
                        <p className="font-semibold">{po.vendorName || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="font-medium">{po.vendorEmail || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="font-medium">{po.vendorPhone || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">GST</p>
                        <p className="font-medium">{po.vendorGst || '—'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Address</p>
                        <p className="font-medium">{po.vendorAddress || '—'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Delivery</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm mb-2">
                      <div>
                        <p className="text-xs text-gray-500">Payment Terms</p>
                        <p className="font-semibold">{po.paymentTerms || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Incoterms</p>
                        <p className="font-semibold">{po.incoterms || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Department</p>
                        <p className="font-medium">{po.department || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Requester</p>
                        <p className="font-medium">{po.requester || '—'}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">Delivery Address</p>
                    <p className="text-sm text-gray-800">{po.deliveryAddress || '—'}</p>
                  </div>

                  {po.specialInstructions ? (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                      <h4 className="text-xs font-bold text-amber-700 uppercase mb-2">Special instructions</h4>
                      <p className="text-sm text-gray-700">{po.specialInstructions}</p>
                    </div>
                  ) : null}
                </div>

                <div className="bg-gray-50 rounded-lg p-4 h-fit">
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Billing</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">{formatCurrency(Number(po.subtotal) || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">GST ({po.gstPercentage ?? 18}%)</span>
                      <span className="font-medium">{formatCurrency(Number(po.taxAmount) || 0)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="font-bold">Grand Total</span>
                      <span className="font-bold text-teal-600">
                        {formatCurrency(Number(po.grandTotal) || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-200 text-sm">
                    <p className="text-xs text-gray-500 mb-1">Signed by</p>
                    <p className="font-semibold">{po.signatureName || '—'}</p>
                    <p className="text-xs text-gray-500">{po.signedAt || ''}</p>
                    {po.signerComments ? (
                      <p className="text-xs text-gray-600 mt-2">{po.signerComments}</p>
                    ) : null}
                  </div>
                  {canGoGrn && (
                    <button
                      type="button"
                      onClick={() => navigate('/grn')}
                      className="mt-4 w-full py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg"
                    >
                      Go to GRN — then Mark as Received
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'items' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['#', 'Item', 'Description', 'Qty', 'Unit Price', 'Disc', 'Total'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(po.lineItems || []).map((li, idx) => (
                      <tr key={String(li.id || idx)} className="border-b">
                        <td className="px-3 py-2">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium">{li.itemName || '—'}</td>
                        <td className="px-3 py-2 text-gray-600 max-w-xs truncate" title={li.description}>
                          {(li.description || '').replace(/<[^>]+>/g, ' ') || '—'}
                        </td>
                        <td className="px-3 py-2">{li.quantity ?? 0}</td>
                        <td className="px-3 py-2">{formatCurrency(Number(li.unitPrice) || 0)}</td>
                        <td className="px-3 py-2">{formatCurrency(Number(li.discount) || 0)}</td>
                        <td className="px-3 py-2 font-semibold">{formatCurrency(Number(li.total) || 0)}</td>
                      </tr>
                    ))}
                    {!po.lineItems?.length && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                          No line items
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'response' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Acceptance status</p>
                  <p className="font-semibold capitalize">{po.vendorAcceptanceStatus || 'pending'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Mode</p>
                  <p className="font-semibold capitalize">{po.vendorAcceptanceMode || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 sm:col-span-2">
                  <p className="text-xs text-gray-500 mb-1">Remarks</p>
                  <p className="font-medium">{po.vendorAcceptanceRemarks || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Confirmed delivery</p>
                  <p className="font-medium">{po.vendorDeliveryConfirmedDate || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Responded at</p>
                  <p className="font-medium">{po.vendorAcceptedAt || '—'}</p>
                </div>
                {po.vendorAcceptanceFileName ? (
                  <div className="sm:col-span-2">
                    <a
                      href={poApi.getVendorAcceptanceFileUrl(po.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-teal-700 text-sm font-semibold hover:underline"
                    >
                      <i className="ri-attachment-2 mr-1"></i>
                      {po.vendorAcceptanceFileName}
                    </a>
                  </div>
                ) : null}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-3">
                {(po.approvalHistory || []).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No history yet</p>
                ) : (
                  (po.approvalHistory || []).map((h, i) => (
                    <div key={i} className="flex gap-3 border-b border-gray-100 pb-3">
                      <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
                        <i className="ri-checkbox-circle-line text-teal-600"></i>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {h.stage} · {h.action}
                        </p>
                        <p className="text-xs text-gray-500">
                          {h.approver || 'System'}
                          {h.role ? ` (${h.role})` : ''} · {h.date || ''}
                        </p>
                        {h.remarks ? <p className="text-xs text-gray-600 mt-1">{h.remarks}</p> : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
