import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { accountsApi } from '../../../services/api';
import type { VendorInvoiceStatus } from '../../../mocks/vendor-invoice-data';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    amount || 0
  );

type Row = {
  id: number;
  invoiceNumber: string;
  poNumber: string;
  grnNumber: string;
  prId: string;
  prTitle: string;
  vendorName: string;
  vendorEmail: string;
  department: string;
  status: VendorInvoiceStatus;
  statusRaw: string;
  grandTotal: number;
  poGrandTotal: number;
  grnReceivedValue: number;
  hasInvoiceFile: boolean;
  invoiceDate: string;
  dueDate: string;
  vendorInvoiceMode: string | null;
  vendorNotifiedAt: string | null;
  canSendMail: boolean;
  canManualEntry: boolean;
  lineItems: Array<{ id: string; description: string; poQty: number; grnQty: number; unitPrice: number; total: number }>;
};

const STATUS_UI: Record<string, VendorInvoiceStatus> = {
  awaiting_upload: 'Draft',
  pending_verification: 'Submitted',
  pending_manager_approval: 'Under Verification',
  approved_for_payment: 'Approved for Payment',
  paid: 'Paid',
  on_hold: 'Discrepancy',
  discrepancy: 'Discrepancy',
  rejected: 'Rejected',
};

function mapRow(raw: Record<string, unknown>): Row {
  const statusRaw = String(raw.statusRaw || '');
  return {
    id: Number(raw.id),
    invoiceNumber: String(raw.invoiceNumber || `DRAFT-${raw.id}`),
    poNumber: String(raw.poNumber || ''),
    grnNumber: String(raw.grnNumber || ''),
    prId: String(raw.prId || ''),
    prTitle: String(raw.prTitle || ''),
    vendorName: String(raw.vendor || ''),
    vendorEmail: String(raw.vendorEmail || ''),
    department: String(raw.department || ''),
    status: STATUS_UI[statusRaw] || 'Draft',
    statusRaw,
    grandTotal: Number(raw.invoiceGrandTotal) || Number(raw.poGrandTotal) || 0,
    poGrandTotal: Number(raw.poGrandTotal) || 0,
    grnReceivedValue: Number(raw.grnReceivedValue) || 0,
    hasInvoiceFile: Boolean(raw.hasInvoiceFile),
    invoiceDate: String(raw.invoiceDate || ''),
    dueDate: String(raw.dueDate || ''),
    vendorInvoiceMode: raw.vendorInvoiceMode ? String(raw.vendorInvoiceMode) : null,
    vendorNotifiedAt: raw.vendorNotifiedAt ? String(raw.vendorNotifiedAt) : null,
    canSendMail: Boolean(raw.canSendMail),
    canManualEntry: Boolean(raw.canManualEntry),
    lineItems: ((raw.lineItems as Array<Record<string, unknown>>) || []).map((li, idx) => ({
      id: String(li.id || idx + 1),
      description: String(li.description || ''),
      poQty: Number(li.poQty) || 0,
      grnQty: Number(li.grnQty) || 0,
      unitPrice: Number(li.poUnitPrice || li.invoicedUnitPrice) || 0,
      total: Number(li.poTotal || li.invoicedTotal) || 0,
    })),
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

export default function VendorInvoicePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [uploadRow, setUploadRow] = useState<Row | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    remarks: '',
    file: null as File | null,
  });

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 4500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountsApi.listInvoices();
      setRows(((res.data as Record<string, unknown>[]) || []).map(mapRow));
    } catch (err) {
      setRows([]);
      showToast(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.invoiceNumber.toLowerCase().includes(q) ||
        r.poNumber.toLowerCase().includes(q) ||
        r.grnNumber.toLowerCase().includes(q) ||
        r.vendorName.toLowerCase().includes(q) ||
        r.vendorEmail.toLowerCase().includes(q)
    );
  }, [rows, searchTerm]);

  const draftCount = rows.filter((r) => r.canSendMail || r.canManualEntry).length;

  const openManual = (row: Row) => {
    setForm({
      invoiceNumber: row.invoiceNumber.startsWith('DRAFT-') ? '' : row.invoiceNumber,
      invoiceDate: row.invoiceDate || new Date().toISOString().slice(0, 10),
      dueDate: row.dueDate || '',
      remarks: '',
      file: null,
    });
    setUploadRow(row);
  };

  const handleSendMail = async (row: Row) => {
    if (!row.vendorEmail) {
      showToast('Vendor email is missing on this PO');
      return;
    }
    setBusyId(row.id);
    try {
      const res = await accountsApi.sendVendorInvoiceMail(row.id);
      const portalUrl = String((res.data as Record<string, unknown>)?.portalUrl || '');
      showToast(
        portalUrl
          ? `${res.message || 'Mail prepared'}${res.data && (res.data as Record<string, unknown>).mailSkipped ? ` · Link: ${portalUrl}` : ''}`
          : res.message || 'Invoice request mailed'
      );
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Send mail failed');
    } finally {
      setBusyId(null);
    }
  };

  const submitManual = async () => {
    if (!uploadRow) return;
    if (!form.invoiceNumber.trim() || !form.file) {
      showToast('Invoice number and file are required');
      return;
    }
    setUploading(true);
    try {
      const fileData = await fileToBase64(form.file);
      await accountsApi.manualInvoiceEntry(uploadRow.id, {
        invoiceNumber: form.invoiceNumber.trim(),
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || null,
        remarks: form.remarks,
        fileName: form.file.name,
        fileData,
        invoiceGrandTotal: uploadRow.poGrandTotal,
        invoiceSubtotal: uploadRow.poGrandTotal,
        invoiceTax: 0,
      });
      setUploadRow(null);
      showToast('Invoice recorded via manual entry — sent to Accounts for verification');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Manual entry failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 max-w-md px-4 py-3 bg-teal-700 text-white text-sm rounded-lg shadow-lg break-all">
            {toast}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendor Invoice</h1>
            <p className="text-sm text-gray-500 mt-1">
              After GRN, <strong>Send Mail</strong> so the vendor uploads the invoice, or use{' '}
              <strong>Manual Entry</strong> to record it yourself
            </p>
          </div>
          <div className="flex items-center gap-2">
            {draftCount > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                {draftCount} awaiting invoice
              </span>
            )}
            <Link
              to="/accounts/invoice-verification"
              className="px-3 py-2 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg"
            >
              Accounts verification →
            </Link>
            <button
              type="button"
              onClick={load}
              className="px-3 py-2 text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg cursor-pointer"
            >
              Refresh
            </button>
        </div>
      </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="relative max-w-md">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search invoice / PO / GRN / vendor"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </div>
          </div>

          {loading ? (
            <p className="p-8 text-sm text-gray-500">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-500 text-sm">
              No invoice base entries yet. Submit GRN (Mark as Received) first — that creates the invoice row.
          </div>
          ) : (
        <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Invoice</th>
                    <th className="px-4 py-3 text-left">PO / GRN</th>
                    <th className="px-4 py-3 text-left">Vendor</th>
                    <th className="px-4 py-3 text-right">PO amount</th>
                    <th className="px-4 py-3 text-left">Mode</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((row) => {
                    const open = expandedId === row.id;
                return (
                      <Fragment key={row.id}>
                        <tr className={`hover:bg-gray-50 ${open ? 'bg-amber-50/40' : ''}`}>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className="font-semibold text-gray-900 cursor-pointer"
                              onClick={() => setExpandedId(open ? null : row.id)}
                            >
                              <i className={`ri-arrow-${open ? 'down' : 'right'}-s-line mr-1 text-gray-400`} />
                              {row.invoiceNumber}
                            </button>
                      </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">{row.poNumber}</div>
                            <div className="text-xs text-gray-400">{row.grnNumber || '—'}</div>
                      </td>
                          <td className="px-4 py-3">
                            <div className="text-gray-700">{row.vendorName}</div>
                            <div className="text-xs text-gray-400">{row.vendorEmail || 'No email'}</div>
                      </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            {formatCurrency(row.poGrandTotal)}
                      </td>
                          <td className="px-4 py-3 text-xs text-gray-600 capitalize">
                            {row.vendorInvoiceMode || '—'}
                            {row.vendorNotifiedAt ? (
                              <div className="text-[10px] text-gray-400 mt-0.5">Sent {row.vendorNotifiedAt}</div>
                            ) : null}
                      </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700">
                              {row.status}
                            </span>
                      </td>
                          <td className="px-4 py-3">
                            {row.canSendMail || row.canManualEntry ? (
                              <div className="flex flex-wrap gap-2">
                                {row.canSendMail && (
                                  <button
                                    type="button"
                                    disabled={busyId === row.id || !row.vendorEmail}
                                    onClick={() => handleSendMail(row)}
                                    className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 cursor-pointer"
                                    title={!row.vendorEmail ? 'Vendor email missing' : 'Email vendor invoice link'}
                                  >
                                    {busyId === row.id ? 'Sending…' : 'Send Mail'}
                                  </button>
                                )}
                                {row.canManualEntry && (
                          <button
                                    type="button"
                                    onClick={() => openManual(row)}
                                    className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                                  >
                                    Manual Entry
                          </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Uploaded</span>
                            )}
                          </td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={7} className="px-4 py-4 bg-slate-50">
                              <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-gray-50 rounded-lg p-3">
                                  <p className="text-xs text-gray-500">PR</p>
                                  <p className="text-sm font-semibold">{row.prId || '—'}</p>
                                  <p className="text-xs text-gray-600 mt-1">{row.prTitle}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3">
                                  <p className="text-xs text-gray-500">GRN received value</p>
                                  <p className="text-sm font-semibold">{formatCurrency(row.grnReceivedValue)}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3">
                                  <p className="text-xs text-gray-500">Department</p>
                                  <p className="text-sm font-semibold">{row.department || '—'}</p>
                                </div>
                                {(row.canSendMail || row.canManualEntry) && (
                                  <div className="md:col-span-3 flex flex-wrap gap-2">
                                    {row.canSendMail && (
                            <button
                                        type="button"
                                        disabled={busyId === row.id || !row.vendorEmail}
                                        onClick={() => handleSendMail(row)}
                                        className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-lg disabled:opacity-50 cursor-pointer"
                                      >
                                        {busyId === row.id ? 'Sending…' : 'Send Mail'}
                            </button>
                          )}
                                    {row.canManualEntry && (
                            <button
                                        type="button"
                                        onClick={() => openManual(row)}
                                        className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg cursor-pointer"
                                      >
                                        Manual Entry
                            </button>
                          )}
                                  </div>
                                )}
                                <div className="md:col-span-3 border border-gray-200 rounded-lg overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead className="bg-gray-50 text-gray-500">
                                      <tr>
                                        <th className="px-3 py-2 text-left">Item</th>
                                        <th className="px-3 py-2 text-right">PO qty</th>
                                        <th className="px-3 py-2 text-right">GRN qty</th>
                                        <th className="px-3 py-2 text-right">Unit price</th>
                                        <th className="px-3 py-2 text-right">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {row.lineItems.map((li) => (
                                        <tr key={li.id} className="border-t border-gray-100">
                                          <td className="px-3 py-2">{li.description}</td>
                                          <td className="px-3 py-2 text-right">{li.poQty}</td>
                                          <td className="px-3 py-2 text-right">{li.grnQty}</td>
                                          <td className="px-3 py-2 text-right">{formatCurrency(li.unitPrice)}</td>
                                          <td className="px-3 py-2 text-right font-semibold">
                                            {formatCurrency(li.total)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
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

      {uploadRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !uploading && setUploadRow(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 bg-amber-50 border-b border-amber-100">
              <h3 className="text-base font-bold text-amber-900">Manual Invoice Entry</h3>
              <p className="text-xs text-gray-600 mt-1">
                PO {uploadRow.poNumber} · GRN {uploadRow.grnNumber || '—'} ·{' '}
                {formatCurrency(uploadRow.poGrandTotal)}
              </p>
            </div>
            <div className="p-6 space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Invoice number *
                <input
                  value={form.invoiceNumber}
                  onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. INV-2026-0001"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-gray-700">
                  Invoice date
                  <input
                    type="date"
                    value={form.invoiceDate}
                    onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Due date
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-gray-700">
                Invoice file *
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="mt-1 w-full text-sm"
                  onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Remarks
                <textarea
                  rows={2}
                  value={form.remarks}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setUploadRow(null)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={submitManual}
                  className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {uploading ? 'Saving…' : 'Save Invoice'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
