import { useState } from 'react';

interface AcceptanceModalProps {
  isOpen: boolean;
  type: 'accept' | 'reject' | 'partial';
  poNumber: string;
  prTitle: string;
  vendorName: string;
  grandTotal: number;
  onConfirm: (remarks: string, deliveryDate?: string) => void;
  onClose: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function AcceptanceModal({
  isOpen,
  type,
  poNumber,
  prTitle,
  vendorName,
  grandTotal,
  onConfirm,
  onClose,
}: AcceptanceModalProps) {
  const [remarks, setRemarks] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!remarks.trim()) {
      setError('Please provide remarks before confirming.');
      return;
    }
    if (type === 'reject' && remarks.trim().length < 20) {
      setError('Please provide a detailed reason for rejection (at least 20 characters).');
      return;
    }
    setError('');
    onConfirm(remarks.trim(), deliveryDate || undefined);
    setRemarks('');
    setDeliveryDate('');
  };

  const handleClose = () => {
    setRemarks('');
    setDeliveryDate('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  const config = {
    accept: {
      icon: 'ri-check-double-line',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      title: 'Accept Purchase Order',
      subtitle: 'Confirm acceptance of this PO. You commit to delivering as per terms.',
      bannerBg: 'bg-emerald-50 border-emerald-200',
      bannerText: 'text-emerald-700',
      btnBg: 'bg-emerald-600 hover:bg-emerald-700',
      btnLabel: 'Confirm Acceptance',
      remarksPlaceholder: 'Add acknowledgment remarks or any notes on delivery, lead time, or special conditions...',
    },
    reject: {
      icon: 'ri-close-circle-line',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      title: 'Reject Purchase Order',
      subtitle: 'Please provide a clear reason for rejection so the team can act accordingly.',
      bannerBg: 'bg-red-50 border-red-200',
      bannerText: 'text-red-700',
      btnBg: 'bg-red-600 hover:bg-red-700',
      btnLabel: 'Confirm Rejection',
      remarksPlaceholder: 'Explain the reason for rejection (e.g. pricing mismatch, delivery timeline conflict, stock unavailability, terms not acceptable)...',
    },
    partial: {
      icon: 'ri-git-commit-line',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      title: 'Partially Accept Purchase Order',
      subtitle: 'Accept part of the PO and specify which items or quantities you can fulfill.',
      bannerBg: 'bg-amber-50 border-amber-200',
      bannerText: 'text-amber-700',
      btnBg: 'bg-amber-600 hover:bg-amber-700',
      btnLabel: 'Confirm Partial Acceptance',
      remarksPlaceholder: 'Specify which line items or quantities you are accepting, and reasons for partial fulfillment...',
    },
  }[type];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${config.iconBg} rounded-xl flex items-center justify-center`}>
              <i className={`${config.icon} ${config.iconColor} text-lg`}></i>
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">{config.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{config.subtitle}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {/* PO Summary Banner */}
        <div className={`mx-6 mt-5 rounded-lg border p-4 ${config.bannerBg}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${config.bannerText} mb-1`}>Purchase Order</p>
              <p className="text-sm font-bold text-gray-900">{poNumber}</p>
              <p className="text-xs text-gray-600 mt-0.5">{prTitle}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Grand Total</p>
              <p className="text-base font-bold text-gray-900">{formatCurrency(grandTotal)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-200/70">
            <i className="ri-store-2-line text-gray-500 text-xs"></i>
            <p className="text-xs text-gray-600">Vendor: <span className="font-semibold text-gray-800">{vendorName}</span></p>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          {/* Confirmed Delivery Date (for accept / partial) */}
          {(type === 'accept' || type === 'partial') && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Confirmed Delivery Date <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
              />
              <p className="text-xs text-gray-400 mt-1">Confirm when you can deliver. Leave blank to use the PO delivery date.</p>
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Remarks <span className="text-red-500">*</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setRemarks(e.target.value);
                  setError('');
                }
              }}
              placeholder={config.remarksPlaceholder}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 resize-none"
            />
            <div className="flex items-center justify-between mt-1">
              <p className={`text-xs ${error ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                {error || (type === 'reject' ? 'Min 20 characters required' : 'Required')}
              </p>
              <p className="text-xs text-gray-400">{remarks.length}/500</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 px-4 py-2.5 text-white rounded-lg transition-colors text-sm font-semibold cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 ${config.btnBg}`}
          >
            <i className={config.icon}></i>
            {config.btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
