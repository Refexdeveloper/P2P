import { useState } from 'react';
import { InvoiceData } from '../../../../mocks/invoice-data';

interface Props {
  type: 'approve' | 'hold' | 'reject' | 'manager_approve';
  invoice: InvoiceData;
  onSubmit: (remarks: string) => void;
  onClose: () => void;
}

export default function InvoiceActionModal({ type, invoice, onSubmit, onClose }: Props) {
  const [remarks, setRemarks] = useState('');
  const [step, setStep] = useState<1 | 2>(1);

  const config = {
    approve: {
      title: 'Approve for Manager Review',
      desc: 'Confirm that the 3-way match is verified. This will send the invoice to Accounts Manager for final approval.',
      icon: 'ri-checkbox-circle-line',
      iconColor: 'text-teal-600',
      iconBg: 'bg-teal-100',
      btnColor: 'bg-teal-600 hover:bg-teal-700',
      btnLabel: 'Send to Manager',
      placeholder: 'Add verification remarks (optional)...',
      successTitle: 'Sent to Manager',
      successDesc: 'Invoice has been forwarded to Accounts Manager for final approval.',
    },
    hold: {
      title: 'Put Invoice On Hold',
      desc: 'Place this invoice on hold pending further clarification or document correction.',
      icon: 'ri-pause-circle-line',
      iconColor: 'text-orange-600',
      iconBg: 'bg-orange-100',
      btnColor: 'bg-orange-500 hover:bg-orange-600',
      btnLabel: 'Put On Hold',
      placeholder: 'Reason for hold (required)...',
      successTitle: 'Invoice On Hold',
      successDesc: 'Invoice has been placed on hold.',
    },
    reject: {
      title: 'Raise Discrepancy',
      desc: 'Flag this invoice with a discrepancy and notify the vendor for correction.',
      icon: 'ri-error-warning-line',
      iconColor: 'text-red-600',
      iconBg: 'bg-red-100',
      btnColor: 'bg-red-600 hover:bg-red-700',
      btnLabel: 'Raise Discrepancy',
      placeholder: 'Describe the discrepancy (required)...',
      successTitle: 'Discrepancy Raised',
      successDesc: 'Vendor has been notified about the discrepancy.',
    },
    manager_approve: {
      title: 'Manager Final Approval',
      desc: 'Review and provide final authorization for payment release. This invoice has been verified by Accounts Executive.',
      icon: 'ri-user-star-line',
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-100',
      btnColor: 'bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700',
      btnLabel: 'Authorize Payment',
      placeholder: 'Add manager approval remarks (optional)...',
      successTitle: 'Payment Authorized',
      successDesc: 'Invoice approved for payment processing.',
    },
  };

  const c = config[type];
  const requiresRemarks = type !== 'approve' && type !== 'manager_approve';
  const canSubmit = !requiresRemarks || remarks.trim().length > 0;

  const handleConfirm = () => {
    if (step === 1) {
      setStep(2);
    } else {
      onSubmit(remarks || 'No remarks provided.');
    }
  };

  if (step === 2) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
          <div className="p-6 space-y-4 text-center">
            <div className={`w-16 h-16 ${c.iconBg} rounded-full flex items-center justify-center mx-auto`}>
              <i className={`ri-checkbox-circle-fill ${c.iconColor} text-3xl`}></i>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{c.successTitle}</h3>
              <p className="text-sm text-gray-500 mt-1">{c.successDesc}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm text-left">
              <div className="flex justify-between">
                <span className="text-gray-500">Invoice</span>
                <span className="font-medium text-gray-800">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-bold text-gray-900">₹{invoice.invoiceGrandTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">New Status</span>
                <span className="font-medium text-teal-600">
                  {type === 'manager_approve' ? 'Approved for Payment' : type === 'approve' ? 'Pending Manager Approval' : type === 'hold' ? 'On Hold' : 'Discrepancy'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 ${c.iconBg} rounded-full flex items-center justify-center`}>
              <i className={`${c.icon} ${c.iconColor} text-xl`}></i>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">{c.title}</h3>
              <p className="text-xs text-gray-500">{c.desc}</p>
            </div>
          </div>

          {/* Invoice summary */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Invoice</span>
              <span className="font-medium text-gray-800">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vendor</span>
              <span className="font-medium text-gray-800">{invoice.vendor}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="font-bold text-gray-900">₹{invoice.invoiceGrandTotal.toLocaleString('en-IN')}</span>
            </div>
            {type === 'manager_approve' && (
              <div className="flex justify-between pt-1.5 border-t border-gray-200">
                <span className="text-gray-500">Current Status</span>
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  Pending Manager Approval
                </span>
              </div>
            )}
          </div>

          {/* Manager approval checklist */}
          {type === 'manager_approve' && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-blue-900">Verification Checklist</p>
              <div className="space-y-1.5">
                {[
                  '3-way match verified by Accounts Executive',
                  'PO and GRN documents confirmed',
                  'Invoice amount matches approved PO',
                  'Payment terms and due date verified',
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <i className="ri-checkbox-circle-fill text-teal-600 text-sm"></i>
                    <span className="text-xs text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Remarks {requiresRemarks && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value.slice(0, 500))}
              placeholder={c.placeholder}
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-0.5">{remarks.length}/500</p>
          </div>

          {/* Buttons */}
          <div className="flex items-center space-x-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              onClick={() => canSubmit && handleConfirm()}
              disabled={!canSubmit}
              className={`flex-1 px-4 py-2.5 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                canSubmit ? `${c.btnColor} cursor-pointer` : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {c.btnLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}