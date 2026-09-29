import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import SoftInsightCard from '../../../components/base/SoftInsightCard';
import { PM_PAGE_BG } from '../../../constants/pmTheme';
import { poApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { formatPersonRoleSuffix } from '../../../utils/roleDisplay';

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

const softWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;
const fieldCard =
  'relative overflow-hidden rounded-2xl bg-white p-3.5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)]';
const fieldLabel = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400';

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
  const { user } = useAuth();
  const requesterVerify = user?.role === 'Requester';
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
    setRemarks(requesterVerify ? 'Final verified' : 'Final verified by SCM Buyer');
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
      showToast(
        res.message ||
          (res.data?.poReleaseMailSent
            ? `${modal.po.poNumber} verified — PO release mail sent`
            : `${modal.po.poNumber} verified — PO release mail skipped (SCM vendor)`),
        'success'
      );
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
      <div className="min-h-full font-sans text-[#0F172A]" style={{ background: PM_PAGE_BG }}>
        <div className="space-y-4 p-2 pb-6 sm:p-4 lg:p-6">
          <header className="border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-1 pb-3 pt-1 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.12)] backdrop-blur-md sm:px-0 sm:pb-4">
            <h1 className="text-base font-semibold leading-snug tracking-tight text-slate-800 sm:text-2xl">
              Approved PO verification
            </h1>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-sm">
              {requesterVerify
                ? 'Review the PO after Mugesh signs. Verify sends it on for vendor acceptance. SCM team is not notified.'
                : 'Review Manager-signed POs. Own vendor: verify sends PO release mail. SCM vendor / Manual: no PO release mail.'}
            </p>
          </header>

          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-3 sm:gap-4">
            <SoftInsightCard title="Pending verification" value={rows.length} icon="ri-shield-check-line" theme="cyan" />
            <SoftInsightCard title="Pending Value" value={formatCurrency(totalValue)} icon="ri-money-rupee-circle-line" theme="blue" />
            <SoftInsightCard
              title="Workflow Step"
              value="After Sign"
              icon="ri-flow-chart"
              theme="violet"
              subtitle={requesterVerify ? 'After Mugesh sign' : 'After SCM Manager sign'}
            />
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px] sm:px-5">
            <div className="pointer-events-none absolute inset-0" style={softWash} />
            <div className="relative z-[1] flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search PO, PR, vendor..."
                  className="box-border h-11 w-full rounded-2xl border border-transparent bg-white pl-10 pr-4 text-sm shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] outline-none focus:border-[#90CAF9] focus:ring-2 focus:ring-[#1E88E5]/15"
                />
              </div>
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-800">{filtered.length}</span> awaiting verify
              </p>
            </div>
          </div>

          <div className="relative overflow-x-clip rounded-2xl border border-transparent bg-[#F8FAFC]/90 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
            <div className="pointer-events-none absolute inset-0" style={softWash} />
            {loading ? (
              <p className="relative z-[1] px-6 py-12 text-center text-sm text-slate-500">Loading POs...</p>
            ) : filtered.length === 0 ? (
              <div className="relative z-[1] py-14 text-center">
                <i className="ri-shield-check-line mb-3 block text-5xl text-slate-200"></i>
                <p className="text-sm font-medium text-slate-500">No POs pending final verify</p>
                <p className="mt-1 text-xs text-slate-400">Signed POs from SCM Manager will appear here</p>
              </div>
            ) : (
              <div className="relative z-[1] overflow-x-auto px-0 pb-3 pt-1">
                <table className="w-max min-w-full border-separate border-spacing-x-0 border-spacing-y-3 text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-30 whitespace-nowrap bg-[#F8FAFC] py-1 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        PO Number
                      </th>
                      <th className="w-[240px] max-w-[240px] bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        PR
                      </th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Vendor
                      </th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Requester
                      </th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Signed
                      </th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Amount
                      </th>
                      <th className="sticky right-0 z-30 whitespace-nowrap bg-[#F8FAFC] py-1 pl-3 pr-4 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((po) => {
                      const open = expandedId === po.id;
                      const rowBorder = open
                        ? 'border-[#90CAF9]'
                        : 'border-transparent group-hover:border-[#90CAF9]';
                      const rowShadow = open
                        ? 'shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)]'
                        : 'shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] group-hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.16)]';
                      return (
                        <Fragment key={po.id}>
                          <tr className="group cursor-pointer" onClick={() => setExpandedId(open ? null : po.id)}>
                            <td className="relative sticky left-0 z-20 h-px bg-[#F8FAFC] p-0 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-3 before:-top-3 before:z-0 before:bg-[#F8FAFC]">
                              <div className={`relative z-[1] flex h-full items-center gap-2.5 whitespace-nowrap rounded-l-2xl border border-r-0 bg-white py-4 pl-3 pr-3 transition-[border-color,box-shadow] sm:rounded-l-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}>
                                <button
                                  type="button"
                                  className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors ${
                                    open ? 'bg-[#1E88E5] text-white' : 'bg-[#E3F2FD] text-[#1E88E5] hover:bg-[#BBDEFB]'
                                  }`}
                                  aria-expanded={open}
                                  aria-label={open ? 'Collapse details' : 'Expand details'}
                                >
                                  <i className={`ri-arrow-${open ? 'down' : 'right'}-s-line text-base`}></i>
                                </button>
                                <span className="text-sm font-bold text-[#1E88E5]">{po.poNumber}</span>
                              </div>
                            </td>
                            <td className={`w-[240px] max-w-[240px] border border-x-0 bg-white px-3 py-4 align-middle transition-[border-color] sm:py-5 ${rowBorder}`} title={po.prTitle}>
                              <p className="truncate text-sm font-semibold text-[#2C3E50]">{po.prNumber}</p>
                              <p className="mt-0.5 truncate text-xs text-slate-500">{po.prTitle}</p>
                            </td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle text-sm text-[#2C3E50] transition-[border-color] sm:py-5 ${rowBorder}`}>
                              {po.vendorName || '—'}
                            </td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle transition-[border-color] sm:py-5 ${rowBorder}`}>
                              <p className="text-sm text-[#2C3E50]">{po.requester || '—'}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{po.department || '—'}</p>
                            </td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle text-sm text-slate-600 transition-[border-color] sm:py-5 ${rowBorder}`}>
                              <div className="flex items-center gap-2">
                                {po.signatureImageDataUrl ? (
                                  <img
                                    src={po.signatureImageDataUrl}
                                    alt={po.signatureName || 'SCM Manager signature'}
                                    className="h-8 max-w-[88px] rounded border border-slate-200 bg-white object-contain px-1"
                                  />
                                ) : null}
                                <div>
                                  <p>{po.signedAt || '—'}</p>
                                  {po.signatureName ? <p className="text-xs text-slate-400">by {po.signatureName}</p> : null}
                                </div>
                              </div>
                            </td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-right align-middle text-sm font-bold tabular-nums text-[#2C3E50] transition-[border-color] sm:py-5 ${rowBorder}`}>
                              {formatCurrency(po.grandTotal)}
                            </td>
                            <td
                              className="relative sticky right-0 z-20 h-px bg-[#F8FAFC] p-0 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-3 before:-top-3 before:z-0 before:bg-[#F8FAFC]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className={`relative z-[1] flex h-full flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap rounded-r-2xl border border-l-0 bg-white py-4 pl-3 pr-4 transition-[border-color,box-shadow] sm:rounded-r-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/scm/create-po?poId=${po.id}&from=buyer-verify`)}
                                  className="cursor-pointer whitespace-nowrap rounded-xl border border-transparent bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1E88E5] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9]"
                                >
                                  Edit PO
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openModal(po)}
                                  className="cursor-pointer whitespace-nowrap rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0]"
                                >
                                  Verify
                                </button>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/scm/po-pdf-view?poId=${po.id}`)}
                                  className="cursor-pointer rounded-xl bg-[#1E88E5] p-2 text-white hover:bg-[#1565C0]"
                                  title="View signed PO"
                                >
                                  <i className="ri-file-pdf-line"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                          {open && (
                            <tr>
                              <td colSpan={7} className="max-w-0 bg-transparent p-0">
                                <div className="relative my-1 overflow-hidden rounded-2xl border border-transparent bg-[#F5F7FA] px-4 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px] sm:px-5 sm:py-5">
                                  <p className="text-sm font-semibold text-[#2C3E50]">{po.poNumber} — Final verify checklist</p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    Confirm signed PDF and commercial terms. Vendor is not emailed from this step.
                                  </p>
                                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {[
                                          { label: 'Vendor', value: po.vendorName },
                                          { label: 'Payment Terms', value: po.paymentTerms || '—' },
                                          { label: 'Expected Delivery', value: po.expectedDeliveryDate || '—' },
                                          { label: 'Manager Signature', value: po.signatureName || '—' },
                                        ].map((item) => (
                                          <div key={item.label} className={fieldCard}>
                                            <div className="pointer-events-none absolute inset-0" style={softWash} />
                                            <div className="relative z-[1]">
                                              <p className={fieldLabel}>{item.label}</p>
                                              {item.label === 'Manager Signature' && po.signatureImageDataUrl ? (
                                                <img
                                                  src={po.signatureImageDataUrl}
                                                  alt={po.signatureName || 'SCM Manager signature'}
                                                  className="mt-1.5 h-12 max-w-[160px] object-contain"
                                                />
                                              ) : null}
                                              <p className="mt-1.5 break-words text-sm font-semibold text-[#2C3E50]">{item.value}</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                      <div>
                                        <p className={`${fieldLabel} mb-2`}>Line Items</p>
                                        <div className="space-y-2">
                                          {po.lineItems.map((li) => (
                                            <div key={li.id} className={`${fieldCard} flex items-start justify-between gap-3`}>
                                              <div className="pointer-events-none absolute inset-0" style={softWash} />
                                              <div className="relative z-[1] min-w-0">
                                                <p className="text-sm font-semibold text-[#2C3E50]">{li.description}</p>
                                                <p className="mt-0.5 text-xs text-slate-500">Qty {li.quantity}</p>
                                              </div>
                                              <p className="relative z-[1] shrink-0 text-sm font-bold tabular-nums text-[#2C3E50]">
                                                {formatCurrency(li.total)}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                    <div>
                                      <p className={`${fieldLabel} mb-2`}>Approval History</p>
                                      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                                        {po.approvalHistory.length === 0 ? (
                                          <div className={`${fieldCard} text-sm text-slate-500`}>No history</div>
                                        ) : (
                                          po.approvalHistory.map((item, idx) => (
                                            <div key={`${item.stage}-${idx}`} className={fieldCard}>
                                              <div className="pointer-events-none absolute inset-0" style={softWash} />
                                              <div className="relative z-[1]">
                                                <div className="flex items-start justify-between gap-2">
                                                  <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-[#2C3E50]">{item.stage}</p>
                                                    <p className="mt-0.5 text-xs text-slate-500">
                                                      {item.approver}
                                                      {formatPersonRoleSuffix(item.role, item.approver)}
                                                    </p>
                                                  </div>
                                                  <span className="shrink-0 rounded-full bg-[#E3F2FD] px-2 py-0.5 text-[10px] font-semibold text-[#1565C0]">
                                                    {item.action}
                                                  </span>
                                                </div>
                                                {item.remarks ? (
                                                  <p className="mt-2 rounded-xl bg-[#F8FAFC] p-2.5 text-sm text-slate-700">{item.remarks}</p>
                                                ) : null}
                                                <p className="mt-2 text-xs text-slate-400">{item.date}</p>
                                              </div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => navigate(`/scm/create-po?poId=${po.id}&from=buyer-verify`)}
                                          className="cursor-pointer rounded-xl border border-transparent bg-white px-4 py-2.5 text-sm font-semibold text-[#1E88E5] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9]"
                                        >
                                          Edit PO
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openModal(po)}
                                          className="cursor-pointer rounded-xl bg-[#1E88E5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1565C0]"
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
        </div>
      </div>

      {modal.open && modal.po && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-[#E3F2FD]">
              <h3 className="text-base font-bold text-[#0D47A1]">Approved PO verification</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Email goes to the requester, approvers, and SCM team with the signed PO attached. Vendor is not copied.
              </p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-500">{modal.po.poNumber}</span>
                  <span className="text-sm font-bold text-[#1565C0]">{formatCurrency(modal.po.grandTotal)}</span>
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
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/20 focus:border-[#1E88E5]"
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
                  className="px-5 py-2 text-sm font-semibold text-white rounded-lg cursor-pointer disabled:opacity-50 bg-[#1E88E5] hover:bg-[#1565C0]"
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
