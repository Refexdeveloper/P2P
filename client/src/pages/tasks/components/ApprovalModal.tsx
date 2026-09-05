import { useEffect, useState } from 'react';
import { prApi } from '../../../services/api';
import { formatMoney } from '../../../constants/currency';

export type InvoiceUploadPayload = {
  fileName: string;
  fileData: string;
  invoiceDate?: string;
  invoiceNumber?: string;
};

interface ApprovalModalProps {
  isOpen: boolean;
  type: 'approve' | 'reject' | 'return';
  prNumber: string;
  prTitle: string;
  amount: number;
  currency?: string;
  prId?: number;
  askBusinessApproval?: boolean;
  /** Cloud Subscription Mugesh invoice-upload task */
  requireInvoiceUpload?: boolean;
  onConfirm: (
    remarks: string,
    returnTo?: string,
    goToBusinessApproval?: boolean,
    invoice?: InvoiceUploadPayload
  ) => void;
  onClose: () => void;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read invoice file'));
    reader.readAsDataURL(file);
  });
}

export default function ApprovalModal({
  isOpen,
  type,
  prNumber,
  prTitle,
  amount,
  currency = 'INR',
  prId,
  askBusinessApproval = false,
  requireInvoiceUpload = false,
  onConfirm,
  onClose,
}: ApprovalModalProps) {
  const [remarks, setRemarks] = useState('');
  const [returnTo, setReturnTo] = useState('');
  const [targets, setTargets] = useState<{ key: string; label: string }[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [goToBusinessApproval, setGoToBusinessApproval] = useState<boolean | null>(null);
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setRemarks('');
      setReturnTo('');
      setTargets([]);
      setGoToBusinessApproval(null);
      setInvoiceDate(new Date().toISOString().slice(0, 10));
      setInvoiceFile(null);
      setSubmitting(false);
      setError('');
      return;
    }
    if (type !== 'return' || !prId) return;

    let cancelled = false;
    setTargetsLoading(true);
    prApi
      .sendBackTargets(prId)
      .then((res) => {
        if (cancelled) return;
        const list = res.data || [];
        setTargets(list);
        setReturnTo(list[0]?.key || '');
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load previous stages');
        }
      })
      .finally(() => {
        if (!cancelled) setTargetsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, type, prId]);

  if (!isOpen) return null;

  const config = {
    approve: {
      title: requireInvoiceUpload
        ? 'Upload Cloud Subscription Invoice'
        : 'Approve Purchase Request',
      icon: requireInvoiceUpload ? 'ri-file-upload-line' : 'ri-check-double-line',
      headerBg: requireInvoiceUpload ? 'bg-teal-50' : 'bg-emerald-50',
      iconBg: requireInvoiceUpload ? 'bg-teal-100' : 'bg-emerald-100',
      iconColor: requireInvoiceUpload ? 'text-teal-600' : 'text-emerald-600',
      titleColor: requireInvoiceUpload ? 'text-teal-900' : 'text-emerald-900',
      btnBg: requireInvoiceUpload
        ? 'bg-teal-600 hover:bg-teal-700'
        : 'bg-emerald-600 hover:bg-emerald-700',
      btnIcon: requireInvoiceUpload ? 'ri-upload-2-line' : 'ri-check-double-line',
      btnText: requireInvoiceUpload ? 'Submit Invoice' : 'Confirm Approve',
      placeholder: 'Enter approval remarks...',
      requireRemarks: true,
    },
    reject: {
      title: 'Reject Purchase Request',
      icon: 'ri-close-circle-line',
      headerBg: 'bg-red-50',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      btnBg: 'bg-red-600 hover:bg-red-700',
      btnIcon: 'ri-close-circle-line',
      btnText: 'Confirm Reject',
      placeholder: 'Please provide reason for rejection...',
      requireRemarks: true,
    },
    return: {
      title: 'Send Back for Rework',
      icon: 'ri-arrow-go-back-line',
      headerBg: 'bg-orange-50',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      titleColor: 'text-orange-900',
      btnBg: 'bg-orange-600 hover:bg-orange-700',
      btnIcon: 'ri-arrow-go-back-line',
      btnText: 'Confirm Send Back',
      placeholder: 'Enter what needs to be reworked...',
      requireRemarks: true,
    },
  }[type];

  const handleSubmit = async () => {
    if (config.requireRemarks && !remarks.trim()) {
      setError('Please enter remarks');
      return;
    }
    if (type === 'reject' && remarks.trim().length < 10) {
      setError('Please provide a reason for rejection (minimum 10 characters)');
      return;
    }
    const selectedReturnTo = returnTo || targets[0]?.key || '';
    if (type === 'return' && prId && !selectedReturnTo) {
      setError('Select a previous stage to send back to');
      return;
    }
    if (type === 'approve' && askBusinessApproval && goToBusinessApproval === null) {
      setError('Select Yes or No for Business / CFO Approval');
      return;
    }
    if (type === 'approve' && requireInvoiceUpload) {
      if (!invoiceFile) {
        setError('Please upload the invoice file');
        return;
      }
    }

    let invoice: InvoiceUploadPayload | undefined;
    if (type === 'approve' && requireInvoiceUpload && invoiceFile) {
      try {
        setSubmitting(true);
        const fileData = await readFileAsBase64(invoiceFile);
        invoice = {
          fileName: invoiceFile.name,
          fileData,
          invoiceDate: invoiceDate || undefined,
        };
      } catch (err) {
        setSubmitting(false);
        setError(err instanceof Error ? err.message : 'Failed to read invoice file');
        return;
      }
    }

    onConfirm(
      remarks.trim(),
      type === 'return' ? selectedReturnTo : undefined,
      type === 'approve' && askBusinessApproval ? Boolean(goToBusinessApproval) : undefined,
      invoice
    );
    setRemarks('');
    setReturnTo('');
    setInvoiceFile(null);
    setSubmitting(false);
    setError('');
  };

  const handleClose = () => {
    setRemarks('');
    setReturnTo('');
    setInvoiceFile(null);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      <div
        className={`relative bg-white rounded-xl shadow-2xl w-full mx-4 overflow-hidden ${
          requireInvoiceUpload && type === 'approve' ? 'max-w-lg' : 'max-w-md'
        }`}
      >
        <div className={`px-6 py-4 ${config.headerBg}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.iconBg}`}>
              <i className={`text-xl ${config.icon} ${config.iconColor}`} />
            </div>
            <div>
              <h3 className={`text-base font-bold ${config.titleColor}`}>{config.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {requireInvoiceUpload && type === 'approve'
                  ? 'Upload invoice for this Cloud Subscription — then routed to Accounts'
                  : 'This action cannot be undone'}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-500">{prNumber}</span>
              <span className="text-sm font-bold text-gray-900">
                {formatMoney(Number(amount || 0), currency, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-800">{prTitle}</p>
          </div>

          {type === 'approve' && requireInvoiceUpload && (
            <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50/70 p-3 space-y-3">
              <p className="text-sm font-semibold text-teal-900">Upload invoice</p>
              <p className="text-xs text-teal-800 leading-relaxed">
                Cloud Subscription: Mugesh uploads the invoice here. After submit, mail goes to
                Requester, L1, L2 (Srivaths), and accounts_rgml_refexev@refex.co.in.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Invoice date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Invoice file <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                  onChange={(e) => {
                    setInvoiceFile(e.target.files?.[0] || null);
                    setError('');
                  }}
                  className="w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-teal-600 file:text-white file:text-sm file:font-semibold file:cursor-pointer"
                />
                {invoiceFile && (
                  <p className="text-xs text-teal-800 mt-1.5 truncate">Selected: {invoiceFile.name}</p>
                )}
              </div>
            </div>
          )}

          {type === 'approve' && askBusinessApproval && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900 mb-1">Go to Business Approval?</p>
              <p className="text-xs text-amber-800 mb-3 leading-relaxed">
                <strong>Yes</strong> → L2 Manager → CFO (if a CFO user is available)
                <br />
                <strong>No</strong> → L2 Manager → SCM RFQ (skip CFO)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setGoToBusinessApproval(true);
                    setError('');
                  }}
                  className={`flex-1 px-3 py-2.5 text-sm font-semibold rounded-lg border cursor-pointer text-center ${
                    goToBusinessApproval === true
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Yes — L2 → CFO
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGoToBusinessApproval(false);
                    setError('');
                  }}
                  className={`flex-1 px-3 py-2.5 text-sm font-semibold rounded-lg border cursor-pointer text-center ${
                    goToBusinessApproval === false
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  No — L2 → SCM RFQ
                </button>
              </div>
            </div>
          )}

          {type === 'return' && Boolean(prId) && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Send back to <span className="text-red-500">*</span>
              </label>
              <select
                value={returnTo}
                onChange={(e) => {
                  setReturnTo(e.target.value);
                  setError('');
                }}
                disabled={targetsLoading || !targets.length}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white"
              >
                {targetsLoading && <option value="">Loading previous stages...</option>}
                {!targetsLoading && !targets.length && <option value="">No previous stages</option>}
                {targets.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">PR will return to the selected stage for action.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Remarks <span className="text-red-500">*</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => {
                setRemarks(e.target.value);
                setError('');
              }}
              placeholder={config.placeholder}
              rows={3}
              maxLength={500}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 resize-none ${
                error
                  ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400'
                  : 'border-gray-200 focus:ring-teal-500/20 focus:border-teal-400'
              }`}
            />
            <div className="flex items-center justify-between mt-1">
              {error ? (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <i className="ri-error-warning-line" />
                  {error}
                </p>
              ) : (
                <span />
              )}
              <span className="text-xs text-gray-400">{remarks.length}/500</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-3 border-t border-gray-100">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className={`px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 shadow-sm ${config.btnBg} disabled:opacity-60`}
          >
            <i className={config.btnIcon} />
            {submitting ? 'Submitting…' : config.btnText}
          </button>
        </div>
      </div>
    </div>
  );
}
