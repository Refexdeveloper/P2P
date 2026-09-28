import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import InvoiceStatsCards from './components/InvoiceStatsCards';
import InvoiceTable from './components/InvoiceTable';
import InvoiceActionModal from './components/InvoiceActionModal';
import { InvoiceData, InvoiceStatus } from '../../../mocks/invoice-data';
import { accountsApi } from '../../../services/api';
import { PM_PAGE_BG } from '../../../constants/pmTheme';
import { useAuth } from '../../../contexts/AuthContext';

function mapApiInvoice(raw: Record<string, unknown>): InvoiceData {
  return {
    id: Number(raw.id),
    invoiceNumber: String(raw.invoiceNumber || `DRAFT-${raw.id}`),
    invoiceDate: String(raw.invoiceDate || ''),
    submittedDate: String(raw.submittedDate || ''),
    dueDate: String(raw.dueDate || ''),
    vendor: String(raw.vendor || ''),
    vendorGSTIN: String(raw.vendorGSTIN || ''),
    vendorAddress: String(raw.vendorAddress || ''),
    poId: Number(raw.poId) || 0,
    poNumber: String(raw.poNumber || ''),
    grnNumber: String(raw.grnNumber || ''),
    prId: String(raw.prId || ''),
    prTitle: String(raw.prTitle || ''),
    department: String(raw.department || ''),
    requester: String(raw.requester || ''),
    paymentTerms: String(raw.paymentTerms || ''),
    lineItems: ((raw.lineItems as InvoiceData['lineItems']) || []).map((li) => ({
      ...li,
      id: String(li.id),
    })),
    invoiceSubtotal: Number(raw.invoiceSubtotal) || 0,
    invoiceGST: Number(raw.invoiceGST) || 0,
    invoiceGrandTotal: Number(raw.invoiceGrandTotal) || 0,
    poGrandTotal: Number(raw.poGrandTotal) || 0,
    grnReceivedValue: Number(raw.grnReceivedValue) || 0,
    matchStatus: (raw.matchStatus as InvoiceData['matchStatus']) || {
      poMatch: true,
      grnMatch: true,
      priceMatch: true,
      overallMatch: true,
    },
    discrepancies: (raw.discrepancies as string[]) || [],
    status: (raw.status as InvoiceStatus) || 'Pending Verification',
    statusRaw: String(raw.statusRaw || ''),
    priority: (raw.priority as InvoiceData['priority']) || 'medium',
    accountsRemarks: String(raw.accountsRemarks || ''),
    approvalHistory: (raw.approvalHistory as InvoiceData['approvalHistory']) || [],
    paymentStatus: raw.paymentStatus as InvoiceData['paymentStatus'],
    paymentDetails: raw.paymentDetails as InvoiceData['paymentDetails'],
    hasInvoiceFile: Boolean(raw.hasInvoiceFile),
    invoiceFileName: (raw.invoiceFileName as string) || null,
    prRecordId: Number(raw.prRecordId) || 0,
    purchaseType: String(raw.purchaseType || ''),
    isSass: Boolean(raw.isSass),
    prAttachments: (raw.prAttachments as InvoiceData['prAttachments']) || [],
    quotationFiles: (raw.quotationFiles as InvoiceData['quotationFiles']) || [],
    poStatus: String(raw.poStatus || ''),
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function InvoiceVerificationPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'Accounts Manager' || user?.role === 'Super Admin' || user?.role === 'SCM Manager';
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [toast, setToast] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'hold' | 'reject' | 'manager_approve';
    invoice: InvoiceData;
  } | null>(null);
  const [uploadModal, setUploadModal] = useState<InvoiceData | null>(null);
  const [uploadForm, setUploadForm] = useState({
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    remarks: '',
    file: null as File | null,
  });
  const [uploading, setUploading] = useState(false);

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountsApi.listInvoices();
      setInvoices(((res.data as Record<string, unknown>[]) || []).map(mapApiInvoice));
    } catch (err) {
      setInvoices([]);
      showToast(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.grnNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.prId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.prTitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAction = (
    type: 'approve' | 'hold' | 'reject' | 'manager_approve' | 'upload',
    invoice: InvoiceData
  ) => {
    if (type === 'upload') {
      setUploadForm({
        invoiceNumber: invoice.invoiceNumber.startsWith('DRAFT-') ? '' : invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate || new Date().toISOString().slice(0, 10),
        dueDate: invoice.dueDate || '',
        remarks: '',
        file: null,
      });
      setUploadModal(invoice);
      return;
    }
    if (type === 'manager_approve' && !isManager) {
      showToast('Only Accounts Manager can approve for payment');
      return;
    }
    setActionModal({ type, invoice });
  };

  const handleSubmitAction = async (remarks: string) => {
    if (!actionModal?.invoice.id) return;
    const { type, invoice } = actionModal;
    try {
      if (type === 'manager_approve') {
        await accountsApi.managerApprove(invoice.id, 'approve', remarks);
        showToast('Manager approved — ready for payment upload');
      } else {
        await accountsApi.verifyInvoice(invoice.id, type, remarks);
        showToast(type === 'approve' ? 'Sent to Accounts Manager' : 'Invoice updated');
      }
      setActionModal(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const handleUploadSubmit = async () => {
    if (!uploadModal?.id) return;
    if (!uploadForm.invoiceNumber.trim() || !uploadForm.file) {
      showToast('Invoice number and file are required');
      return;
    }
    setUploading(true);
    try {
      const fileData = await fileToBase64(uploadForm.file);
      await accountsApi.uploadInvoice(uploadModal.id, {
        invoiceNumber: uploadForm.invoiceNumber.trim(),
        invoiceDate: uploadForm.invoiceDate,
        dueDate: uploadForm.dueDate || null,
        remarks: uploadForm.remarks,
        fileName: uploadForm.file.name,
        fileData,
        invoiceGrandTotal: uploadModal.poGrandTotal,
        invoiceSubtotal: uploadModal.invoiceSubtotal || uploadModal.poGrandTotal,
        invoiceTax: uploadModal.invoiceGST,
      });
      setUploadModal(null);
      showToast('Invoice uploaded — original PO/GRN shown for verification');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-full font-sans text-[#0F172A]" style={{ background: PM_PAGE_BG }}>
        <div className="w-full min-w-0 max-w-full space-y-4 p-2 pb-6 sm:p-4 lg:p-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 rounded-xl bg-[#1565C0] px-4 py-3 text-sm text-white shadow-lg">
            {toast}
          </div>
        )}

        <header className="flex flex-col gap-3 border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-1 pb-3 pt-1 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.12)] backdrop-blur-md sm:flex-row sm:items-start sm:justify-between sm:px-0 sm:pb-4">
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-snug tracking-tight text-slate-800 sm:text-2xl">3-Way Match</h1>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-sm">
              {isManager ? 'Accounts Manager' : 'Accounts Payable'} · Invoice vs PO vs GRN · open a row to review the match
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex cursor-pointer items-center gap-2 self-start rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#1565C0] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)]"
          >
            <i className="ri-refresh-line"></i>
            Refresh
          </button>
        </header>

        <InvoiceStatsCards invoices={invoices} filter={statusFilter} onFilter={setStatusFilter} />

        <div className="relative overflow-hidden rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
            }}
          />
          <div className="relative z-[1] space-y-3">
            <div className="relative w-full min-w-0 max-w-md">
              <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input
                type="text"
                placeholder="Search by invoice, vendor, PO, GRN, or PR..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="box-border h-11 w-full min-w-0 rounded-2xl border border-transparent bg-white pl-10 pr-4 text-sm shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] outline-none focus:border-[#90CAF9] focus:ring-2 focus:ring-[#1E88E5]/15"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['all', 'All'],
                  ['Pending Verification', 'Pending'],
                  ['Matched', 'Matched'],
                  ['Pending Manager Approval', 'Manager'],
                  ['Approved for Payment', 'Approved'],
                  ['Discrepancy', 'Discrepancy'],
                  ['On Hold', 'On Hold'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key as 'all' | InvoiceStatus)}
                  className={`cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                    statusFilter === key ? 'bg-[#1E88E5] text-white' : 'bg-[#F8FAFC] text-slate-600'
                  }`}
                >
                  {label} (
                  {key === 'all' ? invoices.length : invoices.filter((i) => i.status === key).length})
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading invoices…</p>
        ) : filteredInvoices.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-500">
            No invoice base entries yet. Submit a GRN to create one with original PO data.
          </div>
        ) : (
          <InvoiceTable invoices={filteredInvoices} onAction={handleAction} />
        )}
        </div>
      </div>

      {actionModal && (
        <InvoiceActionModal
          type={actionModal.type}
          invoice={actionModal.invoice}
          onSubmit={handleSubmitAction}
          onClose={() => setActionModal(null)}
        />
      )}

      {uploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !uploading && setUploadModal(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 bg-amber-50 border-b border-amber-100">
              <h3 className="text-base font-bold text-amber-900">Upload Invoice</h3>
              <p className="text-xs text-gray-600 mt-1">
                PO {uploadModal.poNumber} · GRN {uploadModal.grnNumber || '—'} · Original amount{' '}
                ₹{uploadModal.poGrandTotal.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 rounded-lg p-3">
                <div>
                  <p className="text-gray-500">Vendor</p>
                  <p className="font-semibold text-gray-800">{uploadModal.vendor}</p>
                </div>
                <div>
                  <p className="text-gray-500">GRN received value</p>
                  <p className="font-semibold text-gray-800">
                    ₹{uploadModal.grnReceivedValue.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <label className="block text-sm font-medium text-gray-700">
                Invoice number *
                <input
                  value={uploadForm.invoiceNumber}
                  onChange={(e) => setUploadForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-gray-700">
                  Invoice date
                  <input
                    type="date"
                    value={uploadForm.invoiceDate}
                    onChange={(e) => setUploadForm((f) => ({ ...f, invoiceDate: e.target.value }))}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Due date
                  <input
                    type="date"
                    value={uploadForm.dueDate}
                    onChange={(e) => setUploadForm((f) => ({ ...f, dueDate: e.target.value }))}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-gray-700">
                Invoice file (PDF/image) *
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) =>
                    setUploadForm((f) => ({ ...f, file: e.target.files?.[0] || null }))
                  }
                  className="mt-1 w-full text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Remarks
                <textarea
                  value={uploadForm.remarks}
                  onChange={(e) => setUploadForm((f) => ({ ...f, remarks: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setUploadModal(null)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={handleUploadSubmit}
                  className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 cursor-pointer disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : 'Upload & Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
