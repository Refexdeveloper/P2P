import { useEffect, useState } from 'react';
import { masterApi, CategoryRecord, vendorApi, VendorRecord } from '../../../../services/api';

export interface CreateVendorFormData {
  vendorName: string;
  vendorType: 'Company' | 'Individual';
  gstNumber: string;
  panNumber: string;
  email: string;
  phone: string;
  contactName: string;
  address: string;
  category: string;
  msme: 'yes' | 'no';
  msmeType: '' | 'Micro' | 'Small' | 'Medium';
  documentsComplete: 'yes' | 'no';
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branch: string;
}

const EMPTY_FORM: CreateVendorFormData = {
  vendorName: '',
  vendorType: 'Company',
  gstNumber: '',
  panNumber: '',
  email: '',
  phone: '',
  contactName: '',
  address: '',
  category: '',
  msme: 'no',
  msmeType: '',
  documentsComplete: 'no',
  accountNumber: '',
  ifscCode: '',
  bankName: '',
  branch: '',
};

const MSME_TYPES = ['Micro', 'Small', 'Medium'] as const;

type DocType = 'gst' | 'pan' | 'cheque' | 'msme' | 'kyc' | 'msme_declaration';

const DOC_UPLOAD_FIELDS: { type: DocType; label: string }[] = [
  { type: 'gst', label: 'GST Certificate' },
  { type: 'pan', label: 'PAN Card' },
  { type: 'cheque', label: 'Cancelled Cheque' },
  { type: 'msme', label: 'MSME Certificate' },
  { type: 'kyc', label: 'KYC Form' },
  { type: 'msme_declaration', label: 'MSME Declaration Form' },
];

interface UploadedDoc {
  file: File;
  name: string;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface Props {
  vendor?: VendorRecord;
  onSuccess: (vendor?: VendorRecord) => void;
  onCancel: () => void;
  compact?: boolean;
}

function asYesNo(value?: string): 'yes' | 'no' {
  return String(value || '').toLowerCase() === 'yes' ? 'yes' : 'no';
}

function asMsmeType(value?: string): '' | 'Micro' | 'Small' | 'Medium' {
  return MSME_TYPES.includes(value as (typeof MSME_TYPES)[number])
    ? (value as 'Micro' | 'Small' | 'Medium')
    : '';
}

function vendorToForm(v: VendorRecord): CreateVendorFormData {
  return {
    vendorName: v.name,
    vendorType: (v.vendorType as 'Company' | 'Individual') || 'Company',
    gstNumber: v.gstNumber || '',
    panNumber: v.panNumber || '',
    email: v.email,
    phone: v.phone || '',
    contactName: v.contactName || '',
    address: v.address || '',
    category: v.category || '',
    msme: asYesNo(v.msme),
    msmeType: asYesNo(v.msme) === 'yes' ? asMsmeType(v.msmeType) : '',
    documentsComplete: asYesNo(v.documentsComplete),
    accountNumber: v.accountNumber || '',
    ifscCode: v.ifscCode || '',
    bankName: v.bankName || '',
    branch: v.branch || '',
  };
}

export default function CreateVendorForm({ vendor, onSuccess, onCancel, compact = false }: Props) {
  const isEdit = Boolean(vendor);
  const [form, setForm] = useState<CreateVendorFormData>(vendor ? vendorToForm(vendor) : EMPTY_FORM);
  const [files, setFiles] = useState<Partial<Record<DocType, UploadedDoc>>>({});
  const [existingDocs] = useState<Partial<Record<DocType, string>>>(() => {
    if (!vendor?.documents) return {};
    return Object.fromEntries(vendor.documents.map((d) => [d.docType, d.fileName]));
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);

  useEffect(() => {
    masterApi
      .listCategories({ status: 'active' })
      .then((res) => setCategories(res.data || []))
      .catch(() => setCategories([]));
  }, []);

  const categoryOptions = (() => {
    const names = categories.map((c) => c.name);
    if (form.category && !names.includes(form.category)) {
      return [form.category, ...names];
    }
    return names;
  })();

  const update = (name: keyof CreateVendorFormData, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'msme' && value !== 'yes') next.msmeType = '';
      return next;
    });
    setError('');
  };

  const handleFileChange = (type: DocType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFiles((prev) => ({ ...prev, [type]: { file, name: file.name } }));
    }
  };

  const removeFile = (type: DocType) => {
    setFiles((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vendorName.trim()) {
      setError('Vendor name is required');
      return;
    }
    if (!form.email.trim()) {
      setError('Email is required');
      return;
    }
    if (!form.category) {
      setError('Category is required');
      return;
    }
    if (form.msme === 'yes' && !form.msmeType) {
      setError('Select MSME category (Micro, Small or Medium)');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      const fileKeyMap: Record<DocType, { file: string; name: string }> = {
        gst: { file: 'gstFile', name: 'gstFileName' },
        pan: { file: 'panFile', name: 'panFileName' },
        cheque: { file: 'chequeFile', name: 'chequeFileName' },
        msme: { file: 'msmeFile', name: 'msmeFileName' },
        kyc: { file: 'kycFile', name: 'kycFileName' },
        msme_declaration: { file: 'msmeDeclarationFile', name: 'msmeDeclarationFileName' },
      };
      for (const type of DOC_UPLOAD_FIELDS.map((d) => d.type)) {
        const doc = files[type];
        if (doc) {
          const keys = fileKeyMap[type];
          payload[keys.file] = await readFileAsBase64(doc.file);
          payload[keys.name] = doc.name;
        }
      }
      if (isEdit && vendor) {
        const res = await vendorApi.update(vendor.id, payload);
        onSuccess(res.data);
      } else {
        const res = await vendorApi.create(payload);
        onSuccess(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEdit ? 'update' : 'create'} vendor`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Vendor' : 'Create New Vendor'}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {isEdit ? `Update details for ${vendor?.vendorCode}` : 'Add vendor details to the master list'}
          </p>
        </div>
        {!compact && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <i className="ri-arrow-left-line"></i>
            Back to List
          </button>
        )}
        {compact && (
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer"
            aria-label="Close"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <i className="ri-error-warning-line"></i>
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Vendor Name *</label>
            <input
              value={form.vendorName}
              onChange={(e) => update('vendorName', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              placeholder="Enter vendor name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Vendor Type</label>
            <div className="flex gap-4 mt-2">
              {(['Company', 'Individual'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={form.vendorType === t}
                    onChange={() => update('vendorType', t)}
                    className="text-teal-600"
                  />
                  <span className="text-sm text-gray-700">{t}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              placeholder="vendor@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              placeholder="9876543210"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Name</label>
            <input
              value={form.contactName}
              onChange={(e) => update('contactName', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              placeholder="Primary contact person"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">GST Number</label>
            <input
              value={form.gstNumber}
              onChange={(e) => update('gstNumber', e.target.value.toUpperCase())}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              placeholder="22AAAAA0000A1Z5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">PAN Number</label>
            <input
              value={form.panNumber}
              onChange={(e) => update('panNumber', e.target.value.toUpperCase())}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              placeholder="ABCDE1234F"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category *</label>
            <select
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
            >
              <option value="">Select category</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {form.category && (
              <p className="mt-1.5 text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded-md px-2 py-1 inline-flex items-center gap-1">
                <i className="ri-price-tag-3-line"></i>
                Selected: <span className="font-semibold">{form.category}</span>
              </p>
            )}
            {!categories.length && (
              <p className="mt-1 text-xs text-gray-400">No active categories in Category Master</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">MSME</label>
            <div className="flex gap-4 mt-2">
              {(['yes', 'no'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="msme"
                    checked={form.msme === v}
                    onChange={() => update('msme', v)}
                    className="text-teal-600"
                  />
                  <span className="text-sm text-gray-700">{v === 'yes' ? 'Yes' : 'No'}</span>
                </label>
              ))}
            </div>
          </div>
          {form.msme === 'yes' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">MSME Category *</label>
              <select
                value={form.msmeType}
                onChange={(e) => update('msmeType', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              >
                <option value="">Select MSME category</option>
                {MSME_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {form.msmeType && (
                <p className="mt-1.5 text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded-md px-2 py-1 inline-flex items-center gap-1">
                  <i className="ri-building-4-line"></i>
                  Selected: <span className="font-semibold">{form.msmeType}</span>
                </p>
              )}
            </div>
          )}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
            <textarea
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              placeholder="Complete address"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Bank Details (Optional)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Number</label>
            <input
              value={form.accountNumber}
              onChange={(e) => update('accountNumber', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">IFSC Code</label>
            <input
              value={form.ifscCode}
              onChange={(e) => update('ifscCode', e.target.value.toUpperCase())}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank Name</label>
            <input
              value={form.bankName}
              onChange={(e) => update('bankName', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Branch</label>
            <input
              value={form.branch}
              onChange={(e) => update('branch', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
            {isEdit ? 'Replace Documents (Optional)' : 'Upload Documents (Optional)'}
          </h3>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">Vendor documents complete</p>
            <div className="flex gap-4">
              {(['yes', 'no'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="documentsComplete"
                    checked={form.documentsComplete === v}
                    onChange={() => update('documentsComplete', v)}
                    className="text-teal-600"
                  />
                  <span className="text-sm text-gray-700">{v === 'yes' ? 'Yes' : 'No'}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DOC_UPLOAD_FIELDS.map(({ type, label }) => (
            <div key={type}>
              <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
              {existingDocs[type] && !files[type] && (
                <p className="text-xs text-teal-600 mb-2 flex items-center gap-1">
                  <i className="ri-file-text-line"></i>
                  Current: {existingDocs[type]}
                </p>
              )}
              {!files[type] ? (
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <i className="ri-upload-cloud-2-line text-2xl text-gray-400 mb-1"></i>
                  <span className="text-xs text-gray-500">Click to upload</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileChange(type, e)}
                  />
                </label>
              ) : (
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <i className="ri-file-text-line text-teal-600 text-lg flex-shrink-0"></i>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{files[type]!.name}</p>
                        <p className="text-xs text-gray-500">{(files[type]!.file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => removeFile(type)} className="text-red-500 hover:text-red-700 cursor-pointer">
                      <i className="ri-close-line text-lg"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 cursor-pointer flex items-center gap-2"
        >
          <i className="ri-save-line"></i>
          {submitting ? 'Saving...' : isEdit ? 'Update Vendor' : 'Save Vendor'}
        </button>
      </div>
    </form>
  );
}
