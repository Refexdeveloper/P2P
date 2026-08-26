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

export default function VendorExpandedRow({ vendor, loading, colSpan = 9, onEdit }: Props) {
  const [activeTab, setActiveTab] = useState<'details' | 'documents'>(
    vendor.documents?.length ? 'documents' : 'details'
  );
  const [error, setError] = useState('');

  const docTypes = ['gst', 'pan', 'cheque', 'msme', 'kyc', 'msme_declaration'] as const;
  const docMap = Object.fromEntries((vendor.documents || []).map((d) => [d.docType, d]));

  const handleDownload = async (docType: string, fileName: string) => {
    try {
      setError('');
      const blob = await vendorApi.fetchDocumentBlob(vendor.id, docType);
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
      const blob = await vendorApi.fetchDocumentBlob(vendor.id, docType);
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

  return (
    <tr>
      <td colSpan={colSpan} className="px-0 py-0 bg-slate-50 border-b border-teal-200">
        <div className="mx-6 my-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-teal-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <i className="ri-store-2-line text-teal-600 text-lg"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{vendor.name}</p>
                <p className="text-xs text-teal-600 font-semibold">{vendor.vendorCode}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                >
                  <i className="ri-edit-line"></i> Edit Vendor
                </button>
              )}
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 capitalize">
                {vendor.status}
              </span>
            </div>
          </div>

          <div className="flex border-b border-gray-100 px-6 bg-white">
            {[
              { key: 'details', label: 'Vendor Details', icon: 'ri-information-line' },
              { key: 'documents', label: 'Vendor Documents', icon: 'ri-folder-open-line' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as 'details' | 'documents')}
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

          <div className="p-6">
            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <p className="text-sm text-gray-500 text-center py-6">Loading vendor details...</p>
            ) : activeTab === 'details' ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'Vendor Code', value: vendor.vendorCode, icon: 'ri-hashtag', color: 'text-teal-600' },
                    { label: 'Vendor Type', value: vendor.vendorType, icon: 'ri-building-line', color: 'text-gray-900' },
                    { label: 'Category', value: vendor.category || '—', icon: 'ri-price-tag-3-line', color: 'text-gray-900' },
                    { label: 'Created', value: vendor.createdAt, icon: 'ri-calendar-line', color: 'text-gray-700' },
                    {
                      label: 'MSME',
                      value: vendor.msme && vendor.msme !== 'no' && vendor.msme !== 'yes' ? vendor.msme : (vendor.msme === 'yes' ? 'Yes' : '—'),
                      icon: 'ri-building-4-line',
                      color: 'text-gray-900',
                    },
                    {
                      label: 'MSME Category',
                      value: vendor.msmeType || '—',
                      icon: 'ri-list-check-2',
                      color: 'text-gray-900',
                    },
                    {
                      label: 'Documents Complete',
                      value: vendor.documentsComplete === 'yes' ? 'Yes' : 'No',
                      icon: 'ri-checkbox-circle-line',
                      color: vendor.documentsComplete === 'yes' ? 'text-emerald-700' : 'text-amber-700',
                    },
                  ].map((item) => (
                    <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <i className={`${item.icon} text-xs`}></i>{item.label}
                      </p>
                      <p className={`text-sm font-semibold ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <i className="ri-contacts-line text-teal-500"></i> Contact Information
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Contact Name</p>
                        <p className="text-sm font-medium text-gray-900">{vendor.contactName || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Email</p>
                        <p className="text-sm font-medium text-gray-900">{vendor.email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                        <p className="text-sm font-medium text-gray-900">{vendor.phone || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">GST Number</p>
                        <p className="text-sm font-medium text-gray-900">{vendor.gstNumber || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">PAN Number</p>
                        <p className="text-sm font-medium text-gray-900">{vendor.panNumber || '—'}</p>
                      </div>
                    </div>
                    {vendor.address && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-0.5">Address</p>
                        <p className="text-sm text-gray-800 leading-relaxed">{vendor.address}</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-teal-50 rounded-lg p-4 border border-teal-100">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <i className="ri-bank-line text-teal-500"></i> Bank Details
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Bank Name</p>
                        <p className="text-sm font-medium text-gray-900">{vendor.bankName || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Branch</p>
                        <p className="text-sm font-medium text-gray-900">{vendor.branch || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Account Number</p>
                        <p className="text-sm font-medium text-gray-900">{vendor.accountNumber || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">IFSC Code</p>
                        <p className="text-sm font-medium text-gray-900">{vendor.ifscCode || '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {docTypes.map((type) => {
                  const doc = docMap[type];
                  return (
                    <div
                      key={type}
                      className={`rounded-lg border p-4 ${
                        doc ? 'border-teal-200 bg-teal-50/50' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${doc ? 'bg-teal-100' : 'bg-gray-100'}`}>
                          <i className={`ri-file-text-line text-lg ${doc ? 'text-teal-600' : 'text-gray-300'}`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{DOC_LABELS[type]}</p>
                          {doc ? (
                            <>
                              <p className="text-xs text-gray-600 truncate mt-0.5" title={doc.fileName}>{doc.fileName}</p>
                              <p className="text-xs text-gray-400 mt-0.5">Uploaded {doc.uploadedAt}</p>
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
                            className="flex-1 px-2 py-1.5 text-xs font-medium text-teal-700 bg-white border border-teal-200 rounded-lg hover:bg-teal-50 cursor-pointer flex items-center justify-center gap-1"
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
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
