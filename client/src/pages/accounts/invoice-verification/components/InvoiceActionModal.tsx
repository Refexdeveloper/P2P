import { useState } from 'react';
import { InvoiceData } from '../../../../mocks/invoice-data';

export type InvoiceActionType =
  | 'approve'
  | 'hold'
  | 'reject'
  | 'send_back'
  | 'manager_approve'
  | 'manager_reject'
  | 'manager_send_back';

interface Props {
  type: InvoiceActionType;
  invoice: InvoiceData;
  onSubmit: (remarks: string) => void;
  onClose: () => void;
}

export default function InvoiceActionModal({ type, invoice, onSubmit, onClose }: Props) {
  const [remarks, setRemarks] = useState('');
  const [step, setStep] = useState<1 | 2>(1);

  const config: Record<
    InvoiceActionType,
    {
      title: string;
      desc: string;
      icon: string;
      iconColor: string;
      iconBg: string;
      btnColor: string;
      btnLabel: string;
      placeholder: string;
      successTitle: string;
      successDesc: string;
    }
  > = {
    approve: {
      title: 'Approve',
      desc: 'Confirm the 3-way match. This sends the invoice to Accounts Manager for final approval.',
      icon: 'ri-checkbox-circle-line',
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      btnColor: 'bg-emerald-600 hover:bg-emerald-700',
      btnLabel: 'Approve',
      placeholder: 'Add remarks (optional)...',
      successTitle: 'Approved',
      successDesc: 'Invoice forwarded to Accounts Manager.',
    },
    hold: {
      title: 'Send Back',
      desc: 'Send this invoice back for correction or clarification before verification can continue.',
      icon: 'ri-arrow-go-back-line',
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      btnColor: 'bg-amber-500 hover:bg-amber-600',
      btnLabel: 'Send Back',
      placeholder: 'Reason for send back (required)...',
      successTitle: 'Sent Back',
      successDesc: 'Invoice sent back for rework.',
    },
    send_back: {
      title: 'Send Back',
      desc: 'Send this invoice back for correction or clarification before verification can continue.',
      icon: 'ri-arrow-go-back-line',
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      btnColor: 'bg-amber-500 hover:bg-amber-600',
      btnLabel: 'Send Back',
      placeholder: 'Reason for send back (required)...',
      successTitle: 'Sent Back',
      successDesc: 'Invoice sent back for rework.',
    },
    reject: {
      title: 'Reject',
      desc: 'Reject this invoice and flag a discrepancy for correction.',
      icon: 'ri-close-circle-line',
      iconColor: 'text-red-600',
      iconBg: 'bg-red-50',
      btnColor: 'bg-red-600 hover:bg-red-700',
      btnLabel: 'Reject',
      placeholder: 'Reason for rejection (required)...',
      successTitle: 'Rejected',
      successDesc: 'Invoice rejected with discrepancy.',
    },
    manager_approve: {
      title: 'Approve',
      desc: 'Authorize payment release. This invoice was verified by Accounts.',
      icon: 'ri-checkbox-circle-line',
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      btnColor: 'bg-emerald-600 hover:bg-emerald-700',
      btnLabel: 'Approve',
      placeholder: 'Add remarks (optional)...',
      successTitle: 'Approved',
      successDesc: 'Invoice approved for payment processing.',
    },
    manager_send_back: {
      title: 'Send Back',
      desc: 'Return this invoice to Accounts verification for rework.',
      icon: 'ri-arrow-go-back-line',
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      btnColor: 'bg-amber-500 hover:bg-amber-600',
      btnLabel: 'Send Back',
      placeholder: 'Reason for send back (required)...',
      successTitle: 'Sent Back',
      successDesc: 'Invoice returned to Accounts verification.',
    },
    manager_reject: {
      title: 'Reject',
      desc: 'Reject this invoice at manager review.',
      icon: 'ri-close-circle-line',
      iconColor: 'text-red-600',
      iconBg: 'bg-red-50',
      btnColor: 'bg-red-600 hover:bg-red-700',
      btnLabel: 'Reject',
      placeholder: 'Reason for rejection (required)...',
      successTitle: 'Rejected',
      successDesc: 'Invoice rejected by Accounts Manager.',
    },
  };

  const c = config[type];
  const requiresRemarks = !['approve', 'manager_approve'].includes(type);
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
                <span className="font-bold text-gray-900">
                  ₹{invoice.invoiceGrandTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-[#1E88E5] text-white text-sm font-semibold rounded-lg hover:bg-[#1565C0]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${c.iconBg} rounded-xl flex items-center justify-center`}>
              <i className={`${c.icon} ${c.iconColor} text-lg`}></i>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">{c.title}</h3>
              <p className="text-xs text-gray-500">{invoice.invoiceNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            ×
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">{c.desc}</p>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Remarks {requiresRemarks ? <span className="text-red-500">*</span> : null}
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              placeholder={c.placeholder}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E88E5]"
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleConfirm}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 ${c.btnColor}`}
          >
            {c.btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
