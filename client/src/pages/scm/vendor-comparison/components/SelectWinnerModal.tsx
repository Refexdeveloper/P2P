import { useState } from 'react';

interface SelectWinnerModalProps {
  isOpen: boolean;
  prId: string;
  prTitle: string;
  recommendedVendor: string;
  overallScore: number;
  amount: number;
  onConfirm: (remarks: string) => void;
  onClose: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function SelectWinnerModal({
  isOpen,
  prId,
  prTitle,
  recommendedVendor,
  overallScore,
  amount,
  onConfirm,
  onClose,
}: SelectWinnerModalProps) {
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<'confirm' | 'success'>('confirm');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (remarks.trim().length < 5) {
      setError('Please provide approval remarks (minimum 5 characters)');
      return;
    }
    setStep('success');
  };

  const handleClose = () => {
    setRemarks('');
    setError('');
    setStep('confirm');
    onClose();
  };

  const handleDone = () => {
    onConfirm(remarks.trim());
    setRemarks('');
    setError('');
    setStep('confirm');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={step === 'confirm' ? handleClose : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {step === 'confirm' ? (
          <>
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-5 border-b border-emerald-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="ri-trophy-line text-emerald-600 text-2xl"></i>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Select Winner & Proceed to PO</h3>
                  <p className="text-xs text-gray-500 mt-0.5">This will finalize the vendor selection and initiate PO creation</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* PR Summary */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Purchase Request</span>
                  <span className="text-xs font-bold text-teal-600">{prId}</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-3">{prTitle}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Estimated Value</p>
                    <p className="text-sm font-bold text-teal-700">{formatCurrency(amount)}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Overall Score</p>
                    <p className="text-sm font-bold text-emerald-700">{overallScore}/100</p>
                  </div>
                </div>
              </div>

              {/* Selected Vendor */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className="ri-store-2-line text-emerald-600 text-lg"></i>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-emerald-600 font-medium mb-0.5">Selected Winner</p>
                    <p className="text-sm font-bold text-gray-900">{recommendedVendor}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <i className="ri-star-fill text-xs"></i> Recommended
                  </span>
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-2">
                {[
                  'Vendor comparison reviewed and verified',
                  'Technical & commercial scores evaluated',
                  'Quotation documents checked',
                  'Budget availability confirmed',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <i className="ri-check-line text-emerald-600 text-xs"></i>
                    </div>
                    <p className="text-xs text-gray-600">{item}</p>
                  </div>
                ))}
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Approval Remarks <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => { setRemarks(e.target.value); setError(''); }}
                  placeholder="Provide remarks for selecting this vendor as the winner..."
                  rows={3}
                  maxLength={500}
                  className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 resize-none ${
                    error ? 'border-red-300 focus:ring-red-500/20' : 'border-gray-200 focus:ring-teal-500/20 focus:border-teal-400'
                  }`}
                />
                <div className="flex items-center justify-between mt-1">
                  {error ? (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>{error}
                    </p>
                  ) : <span />}
                  <span className="text-xs text-gray-400">{remarks.length}/500</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-3 border-t border-gray-100">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 shadow-sm"
              >
                <i className="ri-trophy-line"></i>
                Confirm Winner Selection
              </button>
            </div>
          </>
        ) : (
          /* Success State */
          <div className="px-6 py-10 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5">
              <i className="ri-check-double-line text-emerald-600 text-4xl"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Winner Selected Successfully!</h3>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-semibold text-gray-800">{recommendedVendor}</span> has been selected as the winning vendor.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              The procurement process will now proceed to <span className="font-semibold text-teal-700">PO Creation</span>.
            </p>

            <div className="w-full bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">PR Reference</span>
                <span className="font-semibold text-gray-900">{prId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Selected Vendor</span>
                <span className="font-semibold text-emerald-700">{recommendedVendor}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">PO Value</span>
                <span className="font-semibold text-teal-700">{formatCurrency(amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Next Step</span>
                <span className="font-semibold text-gray-900">Create Purchase Order</span>
              </div>
            </div>

            <div className="flex gap-3 w-full">
              <button
                onClick={handleDone}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium whitespace-nowrap cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleDone();
                  window.REACT_APP_NAVIGATE('/scm/create-po');
                }}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <i className="ri-file-add-line"></i>
                Create PO Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
