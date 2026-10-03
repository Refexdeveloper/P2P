import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { InvoiceData } from '../../../../mocks/invoice-data';
import { accountsApi, poApi, prApi, rfqApi } from '../../../../services/api';
import { formatPersonRoleSuffix } from '../../../../utils/roleDisplay';

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

interface Props {
  invoice: InvoiceData;
  onAction: (type: 'approve' | 'hold' | 'reject' | 'manager_approve', invoice: InvoiceData) => void;
}

type TabKey = 'match' | 'files' | 'lineitems' | 'history';

type PreviewKind = 'pdf' | 'image' | 'other';

type FilePreview = {
  url: string;
  fileName: string;
  kind: PreviewKind;
};

type FileRow = {
  key: string;
  kind: 'invoice' | 'po' | 'pr' | 'quotation';
  label: string;
  fileName: string;
  extra?: string;
  size?: number;
  uploadedAt?: string;
  url: string;
  open?: () => Promise<void>;
};

function formatFileSize(bytes?: number) {
  const n = Number(bytes) || 0;
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function sniffPreview(blob: Blob, fileName: string): PreviewKind {
  const type = String(blob.type || '').toLowerCase();
  const name = String(fileName || '').toLowerCase();
  if (type.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(name)) return 'image';
  return 'other';
}

function kindMeta(kind: FileRow['kind']) {
  if (kind === 'invoice') {
    return { badge: 'Invoice', icon: 'ri-file-invoice-line', tone: 'teal' };
  }
  if (kind === 'po') {
    return { badge: 'PO', icon: 'ri-file-text-line', tone: 'sky' };
  }
  if (kind === 'quotation') {
    return { badge: 'Quotation', icon: 'ri-file-paper-2-line', tone: 'amber' };
  }
  return { badge: 'PR document', icon: 'ri-file-list-3-line', tone: 'indigo' };
}

export default function InvoiceExpandedRow({ invoice, onAction }: Props) {
  const [tab, setTab] = useState<TabKey>('match');
  const [openingKey, setOpeningKey] = useState('');
  const [fileError, setFileError] = useState('');
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);

  const isSass = Boolean(invoice.isSass);
  const files = useMemo<FileRow[]>(() => {
    const rows: FileRow[] = [];
    if (invoice.hasInvoiceFile && invoice.id) {
      rows.push({
        key: `invoice-${invoice.id}`,
        kind: 'invoice',
        label: 'Vendor invoice',
        fileName: invoice.invoiceFileName || `Invoice-${invoice.id}`,
        extra: invoice.invoiceNumber,
        url: accountsApi.invoiceFileUrl(invoice.id),
      });
    }
    const poId = Number(invoice.poId) || 0;
    if (poId > 0) {
      const poLabel = String(invoice.poNumber || `PO-${poId}`).trim();
      rows.push({
        key: `po-${poId}`,
        kind: 'po',
        label: 'Purchase Order',
        fileName: `${poLabel}.pdf`,
        extra: poLabel,
        url: poApi.getPdfUrl(poId),
      });
    }
    (invoice.prAttachments || []).forEach((file) => {
      if (!file?.id || !file.fileName) return;
      const prId = Number(file.prId || invoice.prRecordId) || 0;
      rows.push({
        key: `pr-${file.id}`,
        kind: 'pr',
        label: 'PR / FSD document',
        fileName: file.fileName,
        extra: file.uploadedAt || '',
        size: file.size,
        uploadedAt: file.uploadedAt,
        url: prId ? prApi.attachmentFileUrl(prId, file.id) : '',
      });
    });
    (invoice.quotationFiles || []).forEach((file, idx) => {
      if (!file?.fileName) return;
      const extraId = Number(file.extraFileId || file.id) || 0;
      const submissionId = Number(file.submissionId) || 0;
      rows.push({
        key: `quote-${extraId || submissionId}-${idx}`,
        kind: 'quotation',
        label: 'Vendor quotation',
        fileName: file.fileName,
        extra: [file.vendorName, file.round ? `Round ${file.round}` : '']
          .filter(Boolean)
          .join(' · '),
        url: extraId
          ? rfqApi.quotationExtraFileUrl(extraId)
          : submissionId
            ? rfqApi.quotationFileUrl(submissionId)
            : '',
      });
    });
    return rows;
  }, [invoice]);

  useEffect(() => {
    return () => {
      if (filePreview?.url) URL.revokeObjectURL(filePreview.url);
    };
  }, [filePreview]);

  const openFile = async (row: FileRow, download = false) => {
    setFileError('');
    setOpeningKey(download ? `dl-${row.key}` : row.key);
    try {
      if (row.open && (download || !row.url)) {
        await row.open();
        return;
      }
      if (!row.url) {
        setFileError('File URL is not available');
        return;
      }
      const blob = await accountsApi.fetchAuthFile(row.url);
      if (download) {
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = row.fileName || 'document';
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      if (filePreview?.url) URL.revokeObjectURL(filePreview.url);
      const url = URL.createObjectURL(blob);
      setFilePreview({ url, fileName: row.fileName, kind: sniffPreview(blob, row.fileName) });
    } catch (err) {
      setFileError(err instanceof Error ? err.message : `Could not open ${row.fileName}`);
    } finally {
      setOpeningKey('');
    }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'match', label: isSass ? 'Match Summary' : '3-Way Match Summary' },
    { key: 'files', label: `Files (${files.length})` },
    { key: 'lineitems', label: 'Line Items Comparison' },
    { key: 'history', label: 'Approval History' },
  ];

  const filesPanel = (
    <div className="space-y-3">
      {fileError && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {fileError}
        </div>
      )}
      {files.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          No invoice, PR, or quotation files attached yet.
        </div>
      ) : (
        files.map((file) => {
          const meta = kindMeta(file.kind);
          const tone =
            meta.tone === 'teal'
              ? 'bg-[#E3F2FD] text-[#1565C0] border-[#90CAF9]'
              : meta.tone === 'sky'
                ? 'bg-sky-50 text-sky-800 border-sky-200'
                : meta.tone === 'amber'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200';
          return (
            <div
              key={file.key}
              className="flex flex-col sm:flex-row sm:items-start gap-3 rounded-xl border border-gray-200 bg-white px-3 sm:px-4 py-3 min-w-0 w-full"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
                <i className={`${meta.icon} text-lg`} />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${tone}`}>
                    {meta.badge}
                  </span>
                  {file.extra ? (
                    <span className="text-[11px] text-gray-500 break-words">{file.extra}</span>
                  ) : null}
                </div>
                <p className="text-sm font-semibold text-gray-900 break-all">{file.fileName}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {[file.label, formatFileSize(file.size), file.uploadedAt].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-start">
                <button
                  type="button"
                  disabled={openingKey === file.key}
                  onClick={() => void openFile(file, false)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#1565C0] bg-[#E3F2FD] border border-[#90CAF9] rounded-lg hover:bg-[#BBDEFB] disabled:opacity-50 whitespace-nowrap"
                >
                  {openingKey === file.key ? 'Opening…' : 'View'}
                </button>
                <button
                  type="button"
                  disabled={openingKey === `dl-${file.key}`}
                  onClick={() => void openFile(file, true)}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
                >
                  {openingKey === `dl-${file.key}` ? 'Saving…' : 'Download'}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const previewModal =
    filePreview &&
    createPortal(
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-xl">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center gap-3">
            <span className="font-semibold text-gray-900 truncate">{filePreview.fileName}</span>
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
          <div className="p-4 flex-1 overflow-auto bg-slate-50">
            {filePreview.kind === 'image' ? (
              <img src={filePreview.url} alt={filePreview.fileName} className="max-h-[75vh] mx-auto rounded-lg" />
            ) : filePreview.kind === 'other' ? (
              <p className="text-sm text-gray-600 text-center py-10">
                Preview is not available for this file type. Use Download.
              </p>
            ) : (
              <iframe
                title="Document preview"
                src={filePreview.url}
                className="w-full h-[75vh] border border-gray-200 rounded-lg bg-white"
              />
            )}
          </div>
        </div>
      </div>,
      document.body
    );

  const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <div className="relative z-[1] min-w-0 w-full max-w-full space-y-4 overflow-hidden">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Invoice Amount" value={`${money(invoice.invoiceGrandTotal)} · ${invoice.invoiceNumber}`} />
        <Field
          label={isSass ? 'PR / Cloud Amount' : 'PO Amount'}
          value={`${money(invoice.poGrandTotal)} · ${invoice.poNumber}`}
        />
        <Field
          label="GRN Received Value"
          value={isSass ? 'N/A · Cloud Subscription — no GRN' : `${money(invoice.grnReceivedValue)} · ${invoice.grnNumber || '—'}`}
        />
        <Field label="Overall Match" value={invoice.matchStatus.overallMatch ? 'Full Match' : 'Mismatch'} />
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              tab === t.key ? 'bg-[#1E88E5] text-white' : 'bg-white text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'match' && (
        <div className="space-y-4">
          {/* Match checks */}
          <div className="grid min-w-0 w-full grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'PO Match', ok: invoice.matchStatus.poMatch, desc: 'Invoice vs Purchase Order' },
              {
                label: 'GRN Match',
                ok: invoice.matchStatus.grnMatch,
                desc: isSass ? 'Not required for Cloud Subscription' : 'Invoice vs Goods Receipt',
              },
              { label: 'Price Match', ok: invoice.matchStatus.priceMatch, desc: 'Unit prices verified' },
            ].map((check) => (
              <div key={check.label} className={fieldCard}>
                <div className="pointer-events-none absolute inset-0" style={softWash} />
                <div className="relative z-[1] flex items-center gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${check.ok ? 'bg-[#D1FAE5] text-[#10B981]' : 'bg-[#FFE4E6] text-[#F43F5E]'}`}>
                    <i className={check.ok ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'}></i>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#2C3E50]">{check.label}</p>
                    <p className="break-words text-xs text-slate-500">{check.ok ? 'Matched' : 'Mismatch'} · {check.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Discrepancies */}
          {invoice.discrepancies.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-error-warning-line text-red-600 text-base"></i>
                </div>
                <p className="text-sm font-semibold text-red-700">Discrepancies Found</p>
              </div>
              <ul className="space-y-1">
                {invoice.discrepancies.map((d, i) => (
                  <li key={i} className="flex items-start space-x-2 text-sm text-red-600">
                    <span className="mt-1 text-xs">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Documents & files ({files.length})
              </p>
              {files.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTab('files')}
                  className="text-xs font-semibold text-[#1565C0] hover:underline"
                >
                  Open files tab
                </button>
              )}
            </div>
            {filesPanel}
          </div>

          {/* Vendor & Invoice Info */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Invoice No." value={invoice.invoiceNumber} />
            <Field label="Invoice Date" value={invoice.invoiceDate || '—'} />
            <Field label="Due Date" value={invoice.dueDate || '—'} />
            <Field label="Payment Terms" value={invoice.paymentTerms || '—'} />
            <Field label="Subtotal" value={money(invoice.invoiceSubtotal)} />
            <Field label="GST" value={money(invoice.invoiceGST)} />
            <Field label="Grand Total" value={money(invoice.invoiceGrandTotal)} />
            <Field label="Vendor" value={invoice.vendor || '—'} />
            <Field label="GSTIN" value={invoice.vendorGSTIN || '—'} />
            <Field label="Department" value={invoice.department || '—'} />
            <Field label="Requester" value={invoice.requester || '—'} />
            <Field label="PR Title" value={invoice.prTitle || '—'} />
            <Field label="Address" value={invoice.vendorAddress || '—'} className="sm:col-span-2 lg:col-span-4" />
          </div>

          {/* Accounts Remarks */}
          {invoice.accountsRemarks && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start space-x-2">
              <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                <i className="ri-sticky-note-line text-amber-600 text-sm"></i>
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-700">Accounts Remarks</p>
                <p className="text-sm text-amber-800 mt-0.5">{invoice.accountsRemarks}</p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center space-x-3 pt-1">
            {invoice.status === 'Pending Manager Approval' && (
              <button
                onClick={() => onAction('manager_approve', invoice)}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-[#1E88E5] text-white text-sm font-medium rounded-lg hover:from-blue-700 hover:to-[#1565C0] transition-colors cursor-pointer whitespace-nowrap flex items-center space-x-2"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-user-star-line text-sm"></i>
                </div>
                <span>Manager Approve Payment</span>
              </button>
            )}
            {(invoice.status === 'Pending Verification' || invoice.status === 'Matched') && (
              <button
                onClick={() => onAction('approve', invoice)}
                className="px-4 py-2 bg-[#1E88E5] text-white text-sm font-medium rounded-lg hover:bg-[#1565C0] transition-colors cursor-pointer whitespace-nowrap flex items-center space-x-2"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-checkbox-circle-line text-sm"></i>
                </div>
                <span>Send to Manager</span>
              </button>
            )}
            {(invoice.status === 'Pending Verification' || invoice.status === 'Discrepancy') && (
              <button
                onClick={() => onAction('hold', invoice)}
                className="px-4 py-2 bg-orange-100 text-orange-700 text-sm font-medium rounded-lg hover:bg-orange-200 transition-colors cursor-pointer whitespace-nowrap flex items-center space-x-2"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-pause-circle-line text-sm"></i>
                </div>
                <span>Put On Hold</span>
              </button>
            )}
            {invoice.status !== 'Approved for Payment' && invoice.status !== 'Discrepancy' && invoice.status !== 'Pending Manager Approval' && (
              <button
                onClick={() => onAction('reject', invoice)}
                className="px-4 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors cursor-pointer whitespace-nowrap flex items-center space-x-2"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-close-circle-line text-sm"></i>
                </div>
                <span>Raise Discrepancy</span>
              </button>
            )}
          </div>
        </div>
      )}

      {tab === 'files' && filesPanel}

      {tab === 'lineitems' && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full min-w-0 table-fixed text-sm [&_td]:break-words [&_th]:break-words">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Description</th>
                <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3">Invoice Qty</th>
                <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3">PO Qty</th>
                <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3">GRN Qty</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3">Invoice Price</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3">PO Price</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3">Invoice Total</th>
                <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3">Qty OK</th>
                <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3">Price OK</th>
                <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3">GRN OK</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item) => (
                <tr key={item.id} className={`border-b border-gray-100 ${!item.qtyMatch || !item.priceMatch || !item.grnMatch ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3 text-gray-800 text-xs">{item.description}</td>
                  <td className="px-3 py-3 text-center text-gray-700">{item.invoicedQty}</td>
                  <td className="px-3 py-3 text-center text-gray-700">{item.poQty}</td>
                  <td className={`px-3 py-3 text-center font-medium ${item.grnQty < item.invoicedQty ? 'text-red-600' : 'text-gray-700'}`}>
                    {isSass ? 'N/A' : item.grnQty}
                  </td>
                  <td className={`px-3 py-3 text-right ${!item.priceMatch ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                    ₹{item.invoicedUnitPrice.toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700">
                    ₹{item.poUnitPrice.toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-900">
                    ₹{item.invoicedTotal.toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex justify-center">
                      {item.qtyMatch ? (
                        <i className="ri-checkbox-circle-fill text-[#1E88E5] text-base"></i>
                      ) : (
                        <i className="ri-close-circle-fill text-red-500 text-base"></i>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex justify-center">
                      {item.priceMatch ? (
                        <i className="ri-checkbox-circle-fill text-[#1E88E5] text-base"></i>
                      ) : (
                        <i className="ri-close-circle-fill text-red-500 text-base"></i>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex justify-center">
                      {isSass || item.grnMatch ? (
                        <i className="ri-checkbox-circle-fill text-[#1E88E5] text-base"></i>
                      ) : (
                        <i className="ri-close-circle-fill text-red-500 text-base"></i>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">
                  Invoice Grand Total
                </td>
                <td className="px-3 py-3 text-right font-bold text-gray-900">
                  ₹{invoice.invoiceGrandTotal.toLocaleString('en-IN')}
                </td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {invoice.approvalHistory.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No history yet</p>
          ) : (
            invoice.approvalHistory.map((h, i) => (
              <div key={i} className={fieldCard}>
                <div className="pointer-events-none absolute inset-0" style={softWash} />
                <div className="relative z-[1] flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#D1FAE5] text-[#10B981]">
                    <i className="ri-checkbox-circle-line"></i>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#2C3E50]">{h.action}</p>
                    <p className="text-xs text-slate-500">
                      {h.performedBy}
                      {formatPersonRoleSuffix(h.role, h.performedBy)} · {h.date}
                    </p>
                    {h.notes ? <p className="mt-1 text-xs text-slate-600">{h.notes}</p> : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {previewModal}
    </div>
  );
}
