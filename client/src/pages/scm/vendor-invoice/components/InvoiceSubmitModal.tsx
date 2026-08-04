import { useState } from 'react';
import type { VendorInvoiceData } from '../../../../mocks/vendor-invoice-data';

interface InvoiceSubmitModalProps {
  invoice: VendorInvoiceData | null;
  mode: 'submit' | 'resubmit';
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (invoiceNumber: string, remarks: string) => void;
}

export default function InvoiceSubmitModal({ invoice, mode, isOpen, onClose, onConfirm }: InvoiceSubmitModalProps) {
  const [remarks, setRemarks] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen || !invoice) return null;

  const handleSubmit = () => {
    if (!confirmed) return;
    onConfirm(invoice.invoiceNumber, remarks);
    setRemarks('');
    setConfirmed(false);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative bg-white rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-5 border-b border-gray-100 ${mode === 'resubmit' ? 'bg-amber-50' : 'bg-teal-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mode === 'resubmit' ? 'bg-amber-100' : 'bg-teal-100'}`}>
                <i className={`text-xl ${mode === 'resubmit' ? 'ri-refresh-line text-amber-600' : 'ri-send-plane-line text-teal-600'}`}></i>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{mode === 'resubmit' ? 'Re-submit Invoice' : 'Submit Invoice'}</p>
                <p className="text-xs text-gray-500">{invoice.invoiceNumber}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/60 rounded-lg cursor-pointer">
              <i className="ri-close-line text-gray-500 text-lg"></i>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Invoice summary */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">PO Number</span>
              <span className="font-semibold text-teal-600">{invoice.poNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Vendor</span>
              <span className="font-semibold text-gray-800">{invoice.vendorName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Invoice Date</span>
              <span className="font-semibold text-gray-800">{invoice.invoiceDate}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">GRN Reference</span>
              <span className="font-semibold text-gray-800">{invoice.grnNumber}</span>
            </div>
            <div className="pt-2 border-t border-gray-200 flex justify-between">
              <span className="text-sm font-bold text-gray-800">Invoice Amount</span>
              <span className="text-base font-black text-teal-600">{formatCurrency(invoice.grandTotal)}</span>
            </div>
          </div>

          {/* Discrepancy info for resubmit */}
          {mode === 'resubmit' && invoice.discrepancyReason && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs font-bold text-red-700 mb-1.5 flex items-center gap-1.5">
                <i className="ri-error-warning-line"></i> Discrepancy Raised
              </p>
              <p className="text-xs text-red-600 leading-relaxed">{invoice.discrepancyReason}</p>
            </div>
          )}

          {/* Attachments */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Attached Documents</p>
            <div className="space-y-1.5">
              {invoice.attachments.map((att) => (
                <div key={att} className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                  <i className="ri-file-pdf-2-line text-red-500 text-sm"></i>
                  <span className="text-xs text-gray-700 font-medium">{att}</span>
                  <i className="ri-check-line text-emerald-500 text-xs ml-auto"></i>
                </div>
              ))}
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              {mode === 'resubmit' ? 'Resubmission Note (required)' : 'Submission Remarks (optional)'}
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={mode === 'resubmit' ? 'Explain how the discrepancy was resolved...' : 'Any notes for the accounts team...'}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 resize-none"
            />
            <p className="text-right text-xs text-gray-400 mt-0.5">{remarks.length}/500</p>
          </div>

          {/* Confirm checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-teal-600 cursor-pointer"
            />
            <span className="text-xs text-gray-600 leading-relaxed">
              I confirm that all details in this invoice are accurate and the goods/services have been delivered as per the PO terms.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!confirmed || (mode === 'resubmit' && !remarks.trim())}
            className={`px-5 py-2 text-sm font-semibold text-white rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
              confirmed && (mode !== 'resubmit' || remarks.trim())
                ? mode === 'resubmit'
                  ? 'bg-amber-600 hover:bg-amber-700 cursor-pointer'
                  : 'bg-teal-600 hover:bg-teal-700 cursor-pointer'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            <i className={mode === 'resubmit' ? 'ri-refresh-line' : 'ri-send-plane-line'}></i>
            {mode === 'resubmit' ? 'Re-submit Invoice' : 'Submit Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
