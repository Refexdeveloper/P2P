import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountsApi, poApi } from '../../../../services/api';
import { formatPersonRoleSuffix } from '../../../../utils/roleDisplay';

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
  signerDesignation?: string;
  signedPdfPath?: string;
  signedAt?: string;
  signerComments?: string;
  vendorAcceptanceStatus?: string | null;
  vendorAcceptanceMode?: string | null;
  vendorAcceptanceRemarks?: string;
  vendorAcceptanceFileName?: string;
  vendorDeliveryConfirmedDate?: string;
  vendorAcceptedAt?: string;
  purchaseType?: string;
  purchaseTypeLabel?: string;
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

export default function POExpandedRow({ po, onSendMail, onManual, onViewPdf, busy }: Props) {
  const navigate = useNavigate();
  const pending = !po.vendorAcceptanceStatus || po.vendorAcceptanceStatus === 'pending';
  const accepted =
    po.vendorAcceptanceStatus === 'accepted' || po.vendorAcceptanceStatus === 'partial';
  const completed = !pending && Boolean(po.vendorAcceptanceStatus);
  const isWorkOrder = po.purchaseType === 'work_order';
  const [activeTab, setActiveTab] = useState<'details' | 'items' | 'response' | 'history'>(
    completed ? 'response' : 'details'
  );
  const [openingFile, setOpeningFile] = useState(false);
  const [fileError, setFileError] = useState('');

  const openAcceptanceFile = async () => {
    setFileError('');
    setOpeningFile(true);
    try {
      const blob = await accountsApi.fetchAuthFile(poApi.getVendorAcceptanceFileUrl(po.id));
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Could not open acceptance file');
    } finally {
      setOpeningFile(false);
    }
  };

  const downloadAcceptanceFile = async () => {
    setFileError('');
    setOpeningFile(true);
    try {
      const blob = await accountsApi.fetchAuthFile(poApi.getVendorAcceptanceFileUrl(po.id));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = String(po.vendorAcceptanceFileName || 'vendor-acceptance.pdf').replace(/^.*[/\\]/, '');
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Could not download acceptance file');
    } finally {
      setOpeningFile(false);
    }
  };

  return (
    <tr>
      <td colSpan={7} className="bg-transparent p-0">
        <div className="relative my-1 overflow-hidden rounded-2xl border border-transparent bg-[#F5F7FA] px-4 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px] sm:px-5 sm:py-5">
          <div className="relative z-[1] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#2C3E50]">{po.poNumber}</p>
                <p className="truncate text-xs text-slate-500">
                  {po.prTitle || po.prNumber || 'Purchase order'} · {po.vendorName}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onViewPdf}
                  className="cursor-pointer rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-[#1565C0] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)]"
                >
                  <i className="ri-file-pdf-line mr-1"></i> Signed PO
                </button>
                {pending && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onSendMail}
                      title="Email requester to upload Vendor Signed PO (CC: L1, SCM Manager, user approvers)"
                      className="cursor-pointer rounded-xl bg-[#1E88E5] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Send Mail
                    </button>
                    <button
                      type="button"
                      onClick={onManual}
                      className="cursor-pointer rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)]"
                    >
                      Manual Entry
                    </button>
                  </>
                )}
                {accepted && isWorkOrder && (
                  <button
                    type="button"
                    onClick={() => navigate('/requester/vendor-invoice')}
                    className="cursor-pointer rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Upload invoice <i className="ri-arrow-right-line ml-1"></i>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { key: 'details', label: 'Details' },
                { key: 'items', label: 'Line Items' },
                { key: 'response', label: 'Vendor Response' },
                { key: 'history', label: 'History' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
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
                <Field label="PO Number" value={po.poNumber} />
                <Field label="PR" value={po.prNumber || '—'} />
                <Field label="Created" value={po.createdAt || '—'} />
                <Field label="Expected Delivery" value={po.expectedDeliveryDate || '—'} />
                <Field label="Vendor" value={po.vendorName || '—'} />
                <Field label="Email" value={po.vendorEmail || '—'} />
                <Field label="Phone" value={po.vendorPhone || '—'} />
                <Field label="GST" value={po.vendorGst || '—'} />
                <Field label="Address" value={po.vendorAddress || '—'} className="sm:col-span-2 lg:col-span-4" />
                <Field label="Payment Terms" value={po.paymentTerms || '—'} />
                <Field label="Incoterms" value={po.incoterms || '—'} />
                <Field label="Department" value={po.department || '—'} />
                <Field label="Requester" value={po.requester || '—'} />
                <Field label="Delivery Address" value={po.deliveryAddress || '—'} className="sm:col-span-2 lg:col-span-4" />
                <Field label="Subtotal" value={formatCurrency(Number(po.subtotal) || 0)} />
                <Field label={`GST (${po.gstPercentage ?? 18}%)`} value={formatCurrency(Number(po.taxAmount) || 0)} />
                <Field label="Grand Total" value={formatCurrency(Number(po.grandTotal) || 0)} />
                <Field label="Signed By" value={po.signatureName || '—'} />
                <Field label="Designation" value={po.signerDesignation || '—'} />
                <div className="rounded-2xl bg-white px-3.5 py-3 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Signed Document</p>
                  {po.signedPdfPath ? (
                    <button
                      type="button"
                      className="mt-1 text-sm font-semibold text-[#1565C0] underline"
                      onClick={() => {
                        void poApi.fetchPdfBlob(po.id).then((blob) => {
                          const url = URL.createObjectURL(blob);
                          window.open(url, '_blank', 'noopener,noreferrer');
                        });
                      }}
                    >
                      Uploaded signed PO
                    </button>
                  ) : (
                    <p className="mt-1 text-sm text-slate-800">—</p>
                  )}
                </div>
                {po.specialInstructions ? (
                  <Field label="Special Instructions" value={po.specialInstructions} className="sm:col-span-2 lg:col-span-4" />
                ) : null}
                {accepted && isWorkOrder && (
                  <button
                    type="button"
                    onClick={() => navigate('/requester/vendor-invoice')}
                    className="cursor-pointer rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-semibold text-white sm:col-span-2 lg:col-span-4"
                  >
                    Next: upload vendor invoice
                  </button>
                )}
                {accepted && !isWorkOrder && (
                  <div className="rounded-2xl bg-white px-3.5 py-3 text-xs font-medium text-emerald-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] sm:col-span-2 lg:col-span-4">
                    GRN and invoice are complete — acceptance recorded for Accounts verification.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'items' && (
              <div className="overflow-x-auto rounded-2xl bg-white p-3 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {['#', 'Item', 'Description', 'Qty', 'Unit Price', 'Disc', 'Total'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(po.lineItems || []).map((li, idx) => (
                      <tr key={String(li.id || idx)} className="border-t border-slate-100">
                        <td className="px-3 py-2">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium">{li.itemName || '—'}</td>
                        <td className="max-w-xs truncate px-3 py-2 text-slate-600" title={li.description}>
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
                        <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                          No line items
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'response' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Acceptance Status" value={po.vendorAcceptanceStatus || 'pending'} />
                <Field label="Mode" value={po.vendorAcceptanceMode || '—'} />
                <Field label="Remarks" value={po.vendorAcceptanceRemarks || '—'} className="sm:col-span-2" />
                <Field label="Confirmed Delivery" value={po.vendorDeliveryConfirmedDate || '—'} />
                <Field label="Responded At" value={po.vendorAcceptedAt || '—'} />
                {completed ? (
                  <div className={`${fieldCard} sm:col-span-2`}>
                    <div className="pointer-events-none absolute inset-0" style={softWash} />
                    <div className="relative z-[1]">
                      <p className={fieldLabel}>Vendor signed / acceptance file</p>
                      {fileError ? <p className="mt-2 text-xs text-rose-600">{fileError}</p> : null}
                      {po.vendorAcceptanceFileName ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-[#2C3E50]">
                            <i className="ri-file-pdf-2-line shrink-0 text-[#1565C0]"></i>
                            <span className="truncate">{po.vendorAcceptanceFileName}</span>
                          </span>
                          <button
                            type="button"
                            disabled={openingFile}
                            onClick={() => void openAcceptanceFile()}
                            className="cursor-pointer rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-[#1565C0] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] disabled:opacity-50"
                          >
                            {openingFile ? 'Opening…' : 'Open'}
                          </button>
                          <button
                            type="button"
                            disabled={openingFile}
                            onClick={() => void downloadAcceptanceFile()}
                            className="cursor-pointer rounded-xl bg-[#1E88E5] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Download
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">No acceptance file was uploaded for this response.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white px-3.5 py-3 text-sm text-slate-500 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] sm:col-span-2">
                    Vendor signed PO file will appear here after acceptance is completed.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-3">
                {(po.approvalHistory || []).length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">No history yet</p>
                ) : (
                  (po.approvalHistory || []).map((h, i) => {
                    const action = String(h.action || '').toLowerCase();
                    const rejected = action.includes('reject');
                    const returned = action.includes('return') || action.includes('send back');
                    return (
                      <div key={i} className={fieldCard}>
                        <div className="pointer-events-none absolute inset-0" style={softWash} />
                        <div className="relative z-[1] flex gap-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                              rejected ? 'bg-[#FFE4E6] text-[#F43F5E]' : returned ? 'bg-[#FFEDD5] text-[#F97316]' : 'bg-[#D1FAE5] text-[#10B981]'
                            }`}
                          >
                            <i className={rejected ? 'ri-close-circle-line' : returned ? 'ri-arrow-go-back-line' : 'ri-checkbox-circle-line'}></i>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#2C3E50]">
                              {h.stage || 'Step'} · {h.action || '—'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {h.approver || 'System'}
                              {formatPersonRoleSuffix(h.role, h.approver)} · {h.date || ''}
                            </p>
                            {h.remarks ? <p className="mt-1 text-xs text-slate-600">{h.remarks}</p> : null}
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
