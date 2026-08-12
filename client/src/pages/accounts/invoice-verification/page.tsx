import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import InvoiceStatsCards from './components/InvoiceStatsCards';
import InvoiceTable from './components/InvoiceTable';
import InvoiceActionModal from './components/InvoiceActionModal';
import { InvoiceData, InvoiceStatus } from '../../../mocks/invoice-data';
import { accountsApi } from '../../../services/api';
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
      inv.grnNumber.toLowerCase().includes(searchTerm.toLowerCase());
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
      <div className="p-8">
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-teal-700 text-white text-sm rounded-lg shadow-lg">
            {toast}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Invoice Verification</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-3 py-1 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-sm font-semibold rounded-full">
                {isManager ? 'Accounts Manager' : 'Accounts Payable'}
              </span>
              <span className="text-gray-500 text-sm">
                Original PO/GRN data + invoice upload → manager approval
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            className="px-4 py-2 text-sm font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg cursor-pointer"
          >
            Refresh
          </button>
        </div>

        <InvoiceStatsCards invoices={invoices} />

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex-1 relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Search by invoice, vendor, PO, or GRN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="flex gap-1 p-2 flex-wrap">
            {(
              [
                ['all', 'All'],
                ['Pending Verification', 'Pending / Upload'],
                ['Pending Manager Approval', 'Pending Manager'],
                ['Approved for Payment', 'Approved'],
                ['Discrepancy', 'Discrepancy'],
                ['On Hold', 'On Hold'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key as 'all' | InvoiceStatus)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === key ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {label} (
                {key === 'all'
                  ? invoices.length
                  : invoices.filter((i) => i.status === key).length}
                )
              </button>
            ))}
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
