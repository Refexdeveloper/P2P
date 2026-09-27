import { useState } from 'react';
import { vendorApi, VendorRecord } from '../../../../services/api';

const DOC_LABELS: Record<string, string> = {
  gst: 'GST Certificate',
  pan: 'PAN Card',
  cheque: 'Cancelled Cheque',
  msme: 'MSME Certificate',
  kyc: 'KYC Form',
  msme_declaration: 'MSME Declaration Form',
};

function docLabel(docType: string, fileName?: string) {
  if (DOC_LABELS[docType]) return DOC_LABELS[docType];
  if (String(docType).startsWith('other__')) return fileName || 'Other document';
  return docType;
}

interface Props {
  vendor: VendorRecord;
  loading?: boolean;
  colSpan?: number;
  onEdit?: () => void;
}

function fileActionError(err: unknown, fallback: string) {
  const raw = err instanceof Error ? err.message : fallback;
  try {
    const parsed = JSON.parse(raw) as { message?: string };
    if (parsed?.message) return parsed.message;
  } catch {
    /* keep raw */
  }
  return raw;
}

function mimeFromFileName(fileName: string, fallback = 'application/octet-stream') {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lower.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  return fallback;
}

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

export default function VendorExpandedRow({ vendor, loading, colSpan = 8, onEdit }: Props) {
  const [activeTab, setActiveTab] = useState<'details' | 'documents'>(
    vendor.documents?.length ? 'documents' : 'details'
  );
  const [error, setError] = useState('');

  const docTypes = ['gst', 'pan', 'cheque', 'msme', 'kyc', 'msme_declaration'] as const;
  const docMap = Object.fromEntries((vendor.documents || []).map((d) => [d.docType, d]));
  const otherDocs = (vendor.documents || []).filter((d) =>
    String(d.docType || '').startsWith('other__')
  );

  const handleDownload = async (docType: string, fileName: string) => {
    try {
      setError('');
      const bust = docMap[docType]?.uploadedAt || Date.now();
      const blob = await vendorApi.fetchDocumentBlob(vendor.id, docType, bust);
      const typed = new Blob([blob], { type: mimeFromFileName(fileName, blob.type) });
      const url = URL.createObjectURL(typed);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(fileActionError(err, 'Could not download file'));
    }
  };

  const handleViewFile = async (docType: string) => {
    const fileName = docMap[docType]?.fileName || 'document.pdf';
    const lower = fileName.toLowerCase();
    if (/\.(xls|xlsx|doc|docx)$/.test(lower)) {
      await handleDownload(docType, fileName);
      return;
    }
    try {
      setError('');
      const bust = docMap[docType]?.uploadedAt || Date.now();
      const blob = await vendorApi.fetchDocumentBlob(vendor.id, docType, bust);
      const typed = new Blob([blob], {
        type: mimeFromFileName(fileName, blob.type || 'application/pdf'),
      });
      const url = URL.createObjectURL(typed);
      const opened = window.open(url, '_blank');
      if (!opened) {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(fileActionError(err, 'Could not open file'));
    }
  };

  const msmeValue =
    vendor.msme && vendor.msme !== 'no' && vendor.msme !== 'yes'
      ? vendor.msme
      : vendor.msme === 'yes'
        ? 'Yes'
        : '—';

  return (
    <tr>
      <td colSpan={colSpan} className="bg-transparent p-0">
        <div className="relative my-1 overflow-hidden rounded-2xl border border-transparent bg-[#F5F7FA] px-4 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px] sm:px-5 sm:py-5">
          <div className="relative z-[1] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#2C3E50]">{vendor.name}</p>
                <p className="text-xs font-semibold text-[#1E88E5]">{vendor.vendorCode}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onEdit && (
                  <button
                    type="button"
                    onClick={onEdit}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-[#1565C0] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)]"
                  >
                    <i className="ri-edit-line"></i> Edit Vendor
                  </button>
                )}
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold capitalize text-emerald-700">
                  {vendor.status}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { key: 'details', label: 'Details' },
                { key: 'documents', label: 'Documents' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as 'details' | 'documents')}
                  className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                    activeTab === tab.key ? 'bg-[#1E88E5] text-white' : 'bg-white text-slate-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {error && (
              <div className="rounded-2xl bg-white px-4 py-3 text-sm text-rose-700">{error}</div>
            )}

            {loading ? (
              <p className="py-6 text-center text-sm text-slate-500">Loading vendor details...</p>
            ) : activeTab === 'details' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Vendor Code" value={vendor.vendorCode} />
                <Field label="Vendor Type" value={vendor.vendorType || '—'} />
                <Field label="Category" value={vendor.category || '—'} />
                <Field label="Created" value={vendor.createdAt || '—'} />
                <Field label="MSME" value={msmeValue} />
                <Field label="MSME Category" value={vendor.msmeType || '—'} />
                <Field label="Documents Complete" value={vendor.documentsComplete === 'yes' ? 'Yes' : 'No'} />
                <Field label="Status" value={vendor.status || '—'} />
                <Field label="Contact Name" value={vendor.contactName || '—'} />
                <Field label="Email" value={vendor.email || '—'} />
                <Field label="Phone" value={vendor.phone || '—'} />
                <Field label="GST Number" value={vendor.gstNumber || '—'} />
                <Field label="PAN Number" value={vendor.panNumber || '—'} />
                <Field label="Bank Name" value={vendor.bankName || '—'} />
                <Field label="Branch" value={vendor.branch || '—'} />
                <Field label="Account Number" value={vendor.accountNumber || '—'} />
                <Field label="IFSC Code" value={vendor.ifscCode || '—'} />
                <Field label="Address" value={vendor.address || '—'} className="sm:col-span-2 lg:col-span-4" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {docTypes.map((type) => {
                    const doc = docMap[type];
                    return (
                      <div key={type} className={fieldCard}>
                        <div className="pointer-events-none absolute inset-0" style={softWash} />
                        <div className="relative z-[1]">
                        <div className="flex items-start gap-3 mb-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              doc ? 'bg-[#E3F2FD]' : 'bg-gray-100'
                            }`}
                          >
                            <i
                              className={`ri-file-text-line text-lg ${
                                doc ? 'text-[#1E88E5]' : 'text-gray-300'
                              }`}
                            ></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{DOC_LABELS[type]}</p>
                            {doc ? (
                              <>
                                <p
                                  className="text-xs text-gray-600 truncate mt-0.5"
                                  title={doc.fileName}
                                >
                                  {doc.fileName}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  Uploaded {doc.uploadedAt}
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-gray-400 mt-0.5">Not uploaded</p>
                            )}
                          </div>
                        </div>
                        {doc && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewFile(type)}
                              className="flex-1 px-2 py-1.5 text-xs font-medium text-[#1565C0] bg-white border border-[#90CAF9] rounded-lg hover:bg-[#E3F2FD] cursor-pointer flex items-center justify-center gap-1"
                            >
                              <i className="ri-eye-line"></i> View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownload(type, doc.fileName)}
                              className="flex-1 px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer flex items-center justify-center gap-1"
                            >
                              <i className="ri-download-line"></i> Download
                            </button>
                          </div>
                        )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {otherDocs.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                      Other uploaded documents ({otherDocs.length})
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {otherDocs.map((doc) => (
                        <div key={doc.docType} className={fieldCard}>
                          <div className="pointer-events-none absolute inset-0" style={softWash} />
                          <div className="relative z-[1]">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#E3F2FD]">
                              <i className="ri-file-text-line text-lg text-[#1E88E5]"></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {docLabel(doc.docType, doc.fileName)}
                              </p>
                              <p
                                className="text-xs text-gray-600 truncate mt-0.5"
                                title={doc.fileName}
                              >
                                {doc.fileName}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                Uploaded {doc.uploadedAt}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewFile(doc.docType)}
                              className="flex-1 px-2 py-1.5 text-xs font-medium text-[#1565C0] bg-white border border-[#90CAF9] rounded-lg hover:bg-[#E3F2FD] cursor-pointer flex items-center justify-center gap-1"
                            >
                              <i className="ri-eye-line"></i> View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownload(doc.docType, doc.fileName)}
                              className="flex-1 px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer flex items-center justify-center gap-1"
                            >
                              <i className="ri-download-line"></i> Download
                            </button>
                          </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
