import { useState } from 'react';
import SignatureCapture, { SignaturePayload } from './SignatureCapture';

interface POApprovalModalProps {
  isOpen: boolean;
  type: 'approve' | 'reject' | 'sendback';
  poNumber: string;
  prTitle: string;
  grandTotal: number;
  onConfirm: (remarks: string, signature?: SignaturePayload) => void | Promise<void>;
  onClose: () => void;
}

export default function POApprovalModal({
  isOpen,
  type,
  poNumber,
  prTitle,
  grandTotal,
  onConfirm,
  onClose,
}: POApprovalModalProps) {
  const [remarks, setRemarks] = useState('');
  const [signature, setSignature] = useState<SignaturePayload | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isApprove = type === 'approve';
  const isSendBack = type === 'sendback';

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const handleSubmit = async () => {
    if (type === 'approve' && remarks.trim().length < 3) {
      setError('Please enter comments for signing (minimum 3 characters)');
      return;
    }
    const hasSignature = Boolean(
      signature?.signatureImage ||
      signature?.signatureId ||
      (signature?.dsc?.holderName && signature?.dsc?.serial)
    );
    if (type === 'approve' && !hasSignature) {
      setError('Fill DSC holder name and certificate serial no., or draw / upload a signature');
      return;
    }
    if (type === 'reject' && remarks.trim().length < 10) {
      setError('Please provide a reason for rejection (minimum 10 characters)');
      return;
    }
    if (type === 'sendback' && remarks.trim().length < 10) {
      setError('Please provide send-back remarks (minimum 10 characters)');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(remarks.trim(), isApprove ? signature || undefined : undefined);
      setRemarks('');
      setSignature(null);
      setError('');
      onClose();
    } catch {
      // parent shows toast
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setRemarks('');
    setSignature(null);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className={`relative bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full mx-0 sm:mx-4 max-h-[92dvh] overflow-hidden flex flex-col ${isApprove ? 'max-w-xl' : 'max-w-md'}`}>
        <div className={`px-4 sm:px-6 py-4 ${isApprove ? 'bg-emerald-50' : isSendBack ? 'bg-orange-50' : 'bg-red-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isApprove ? 'bg-emerald-100' : isSendBack ? 'bg-orange-100' : 'bg-red-100'}`}>
              <i className={`text-xl ${isApprove ? 'ri-check-double-line text-emerald-600' : isSendBack ? 'ri-arrow-go-back-line text-orange-600' : 'ri-close-circle-line text-red-600'}`} />
            </div>
            <div>
              <h3 className={`text-base font-bold ${isApprove ? 'text-emerald-900' : isSendBack ? 'text-orange-900' : 'text-red-900'}`}>
                {isApprove ? 'Sign & Approve Purchase Order' : isSendBack ? 'Send Back Purchase Order' : 'Reject Purchase Order'}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {isApprove
                  ? 'Confirm to sign the PO. Next step is SCM Buyer Final Verify — vendor mail is not sent now.'
                  : isSendBack
                    ? 'PO returns to SCM Buyer as draft so they can revise and resubmit for sign'
                    : 'This action cannot be undone'}
              </p>
            </div>
          </div>
        </div>

        <div className={`px-4 sm:px-6 py-4 space-y-4 overflow-y-auto flex-1 ${isApprove ? 'max-h-[70vh]' : ''}`}>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-500">{poNumber}</span>
              <span className="text-sm font-bold text-teal-700">{formatCurrency(grandTotal)}</span>
            </div>
            <p className="text-sm font-medium text-gray-800">{prTitle}</p>
          </div>

          {isApprove && (
            <SignatureCapture
              onChange={(payload) => {
                setSignature(payload);
                setError('');
              }}
            />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isApprove ? 'Comments / Signature Note *' : 'Remarks'} {!isApprove && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={remarks}
              onChange={(e) => { setRemarks(e.target.value); setError(''); }}
              placeholder={
                isApprove
                  ? 'Enter approval comments (shown on signed PDF and in email)...'
                  : isSendBack
                    ? 'Tell the buyer what to correct before resubmitting...'
                    : 'Please provide reason for rejection...'
              }
              rows={3}
              maxLength={500}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 resize-none ${
                error.toLowerCase().includes('comment') || error.toLowerCase().includes('remarks')
                  ? 'border-red-300 focus:ring-red-500/20'
                  : 'border-gray-200 focus:ring-teal-500/20 focus:border-teal-400'
              }`}
            />
            <div className="flex items-center justify-between mt-1">
              {error ? (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <i className="ri-error-warning-line" />{error}
                </p>
              ) : <span />}
              <span className="text-xs text-gray-400">{remarks.length}/500</span>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 bg-gray-50 flex items-center justify-end gap-3 border-t border-gray-100 flex-shrink-0">
          <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 shadow-sm disabled:opacity-50 ${
              isApprove ? 'bg-emerald-600 hover:bg-emerald-700' : isSendBack ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <i className={isApprove ? 'ri-check-double-line' : isSendBack ? 'ri-arrow-go-back-line' : 'ri-close-circle-line'} />
            {submitting ? 'Processing...' : isApprove ? 'Confirm' : isSendBack ? 'Send Back to Buyer' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}
