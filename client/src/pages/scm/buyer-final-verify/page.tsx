import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { poApi } from '../../../services/api';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

interface VerifyPO {
  id: number;
  poNumber: string;
  prId: number;
  prNumber: string;
  prTitle: string;
  vendorName: string;
  department: string;
  requester: string;
  grandTotal: number;
  status: string;
  statusRaw: string;
  signedAt: string | null;
  signatureName: string;
  signatureImageDataUrl: string;
  signerComments: string;
  paymentTerms: string;
  expectedDeliveryDate: string;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  approvalHistory: Array<{
    stage: string;
    approver: string;
    role: string;
    action: string;
    date: string;
    remarks: string;
  }>;
}

function mapApiPo(raw: Record<string, unknown>): VerifyPO {
  return {
    id: Number(raw.id),
    poNumber: String(raw.poNumber || ''),
    prId: Number(raw.prId) || 0,
    prNumber: String(raw.prNumber || ''),
    prTitle: String(raw.prTitle || ''),
    vendorName: String(raw.vendorName || ''),
    department: String(raw.department || ''),
    requester: String(raw.requester || ''),
    grandTotal: Number(raw.grandTotal) || 0,
    status: String(raw.status || ''),
    statusRaw: String(raw.statusRaw || ''),
    signedAt: raw.signedAt ? String(raw.signedAt) : null,
    signatureName: String(raw.signatureName || ''),
    signatureImageDataUrl: String(raw.signatureImageDataUrl || ''),
    signerComments: String(raw.signerComments || ''),
    paymentTerms: String(raw.paymentTerms || ''),
    expectedDeliveryDate: String(raw.expectedDeliveryDate || ''),
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
  };
}

export default function BuyerFinalVerifyPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<VerifyPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [modal, setModal] = useState<{
    open: boolean;
    po: VerifyPO | null;
  }>({ open: false, po: null });
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await poApi.listPendingBuyerVerify();
      setRows((res.data as Record<string, unknown>[]).map(mapApiPo));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (po) =>
        po.poNumber.toLowerCase().includes(q) ||
        po.prNumber.toLowerCase().includes(q) ||
        po.prTitle.toLowerCase().includes(q) ||
        po.vendorName.toLowerCase().includes(q) ||
        po.requester.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalValue = useMemo(
    () => filtered.reduce((sum, po) => sum + po.grandTotal, 0),
    [filtered]
  );

  const openModal = (po: VerifyPO) => {
    setModal({ open: true, po });
    setRemarks('Final verified — requester, approvers, and SCM team notified (no vendor mail)');
    setError('');
  };

  const closeModal = () => {
    if (submitting) return;
    setModal({ open: false, po: null });
    setRemarks('');
    setError('');
  };

  const handleConfirm = async () => {
    if (!modal.po) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await poApi.finalVerify(modal.po.id, remarks.trim());
      showToast(res.message || `${modal.po.poNumber} verified — requester, approvers, and SCM team notified`, 'success');
      setExpandedId(null);
      closeModal();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">SCM Buyer — Final Verify</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review Manager-signed POs — verify (notifies requester, approvers, and SCM team with signed PO). Vendor is not emailed.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {[
          {
            label: 'Pending Final Verify',
            value: rows.length,
            icon: 'ri-shield-check-line',
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
          {
            label: 'Pending Value',
            value: formatCurrency(totalValue),
            icon: 'ri-money-rupee-circle-line',
            color: 'text-teal-600',
            bg: 'bg-teal-50',
          },
          {
            label: 'Workflow Step',
            value: 'After Manager Sign',
            icon: 'ri-flow-chart',
            color: 'text-slate-600',
            bg: 'bg-slate-50',
          },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
            <div className={`w-12 h-12 ${card.bg} rounded-xl flex items-center justify-center`}>
              <i className={`${card.icon} text-2xl ${card.color}`}></i>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-gray-900">Signed POs awaiting buyer verify</h2>
            <p className="text-xs text-gray-400 mt-1">
              Edit PO if needed, then verify to notify requester, approvers, and SCM team with the signed PO (no vendor mail)
            </p>
          </div>
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PO, PR, vendor..."
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-72 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
            />
          </div>
        </div>

        {loading ? (
          <p className="px-6 py-12 text-sm text-gray-500 text-center">Loading POs...</p>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <i className="ri-shield-check-line text-5xl text-gray-200 mb-4 block"></i>
            <p className="text-gray-500 text-sm font-medium">No POs pending final verify</p>
            <p className="text-xs text-gray-400 mt-1">Signed POs from SCM Manager will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['PO Number', 'PR', 'Vendor', 'Requester', 'Signed', 'Amount', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((po) => {
                  const open = expandedId === po.id;
                  return (
                    <Fragment key={po.id}>
                      <tr
                        className={`border-b cursor-pointer transition-colors ${
                          open ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-gray-100'
                        }`}
                        onClick={() => setExpandedId(open ? null : po.id)}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="text-sm font-bold text-teal-700">{po.poNumber}</span>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-gray-900">{po.prNumber}</p>
                          <p className="text-xs text-gray-500 truncate max-w-[220px]">{po.prTitle}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">{po.vendorName}</td>
                        <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                          {po.requester}
                          <p className="text-xs text-gray-400">{po.department}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {po.signatureImageDataUrl ? (
                              <img
                                src={po.signatureImageDataUrl}
                                alt={po.signatureName || 'SCM Manager signature'}
                                className="h-8 max-w-[88px] object-contain bg-white border border-gray-200 rounded px-1"
                              />
                            ) : null}
                            <div>
                              <p>{po.signedAt || '—'}</p>
                              {po.signatureName && (
                                <p className="text-xs text-gray-400">by {po.signatureName}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-gray-900 whitespace-nowrap">
                          {formatCurrency(po.grandTotal)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // Same edit page as SCM Manager (create-po?poId=…)
                                navigate(`/scm/create-po?poId=${po.id}&from=buyer-verify`);
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer"
                            >
                              Edit PO
                            </button>
                            <button
                              type="button"
                              onClick={() => openModal(po)}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 cursor-pointer"
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/scm/po-pdf-view?poId=${po.id}`)}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer"
                              title="View signed PO"
                            >
                              <i className="ri-file-pdf-line"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={7} className="px-0 py-0 bg-slate-50 border-b border-blue-200">
                            <div className="mx-6 my-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                              <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
                                <p className="text-sm font-bold text-gray-900">{po.poNumber} — Final verify checklist</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Confirm signed PDF and commercial terms. Vendor is not emailed from this step.
                                </p>
                              </div>
                              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-3">
                                    {[
                                      { label: 'Vendor', value: po.vendorName },
                                      { label: 'Payment Terms', value: po.paymentTerms || '—' },
                                      { label: 'Expected Delivery', value: po.expectedDeliveryDate || '—' },
                                      { label: 'Manager Signature', value: po.signatureName || '—' },
                                    ].map((item) => (
                                      <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                                        <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                                        {item.label === 'Manager Signature' && po.signatureImageDataUrl ? (
                                          <div>
                                            <img
                                              src={po.signatureImageDataUrl}
                                              alt={po.signatureName || 'SCM Manager signature'}
                                              className="h-14 max-w-[180px] object-contain bg-white border border-gray-200 rounded px-2 py-1 mb-1"
                                            />
                                            <p className="text-sm font-medium text-gray-800">{item.value}</p>
                                          </div>
                                        ) : (
                                          <p className="text-sm font-medium text-gray-800">{item.value}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Line Items</p>
                                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                                      <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            <th className="px-3 py-2 text-left text-xs text-gray-500">Description</th>
                                            <th className="px-3 py-2 text-right text-xs text-gray-500">Qty</th>
                                            <th className="px-3 py-2 text-right text-xs text-gray-500">Total</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {po.lineItems.map((li) => (
                                            <tr key={li.id} className="border-t border-gray-100">
                                              <td className="px-3 py-2 text-gray-800">{li.description}</td>
                                              <td className="px-3 py-2 text-right text-gray-600">{li.quantity}</td>
                                              <td className="px-3 py-2 text-right font-medium text-gray-800">
                                                {formatCurrency(li.total)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Approval History</p>
                                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                    {po.approvalHistory.length === 0 ? (
                                      <p className="text-sm text-gray-400">No history</p>
                                    ) : (
                                      po.approvalHistory.map((item, idx) => (
                                        <div key={`${item.stage}-${idx}`} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                          <div className="flex items-start justify-between gap-2">
                                            <div>
                                              <p className="text-sm font-semibold text-gray-900">{item.stage}</p>
                                              <p className="text-xs text-gray-500 mt-0.5">
                                                {item.approver} · {item.role}
                                              </p>
                                            </div>
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-600">
                                              {item.action}
                                            </span>
                                          </div>
                                          {item.remarks && (
                                            <p className="text-xs text-gray-600 mt-2">{item.remarks}</p>
                                          )}
                                          <p className="text-xs text-gray-400 mt-2">{item.date}</p>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                  <div className="mt-4 flex gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        navigate(`/scm/create-po?poId=${po.id}&from=buyer-verify`);
                                      }}
                                      className="px-4 py-2.5 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer"
                                    >
                                      Edit PO
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openModal(po)}
                                      className="flex-1 min-w-[160px] px-4 py-2.5 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 cursor-pointer"
                                    >
                                      Verify
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.open && modal.po && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-teal-50">
              <h3 className="text-base font-bold text-teal-900">Final Verify</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Email goes to the requester, approvers, and SCM team with the signed PO attached. Vendor is not copied.
              </p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-500">{modal.po.poNumber}</span>
                  <span className="text-sm font-bold text-teal-700">{formatCurrency(modal.po.grandTotal)}</span>
                </div>
                <p className="text-sm font-medium text-gray-800">{modal.po.prTitle}</p>
                <p className="text-xs text-gray-500 mt-1">{modal.po.vendorName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Verification remarks
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                  placeholder="Optional notes for audit trail"
                />
              </div>
              {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold text-white rounded-lg cursor-pointer disabled:opacity-50 bg-teal-600 hover:bg-teal-700"
                >
                  {submitting ? 'Processing...' : 'Verify'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold ${
              toast.type === 'success' ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'
            }`}
          >
            <i className={toast.type === 'success' ? 'ri-check-double-line' : 'ri-close-circle-line'}></i>
            {toast.text}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
