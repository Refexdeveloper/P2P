import { useState } from 'react';
import { poData, POData } from '../../../../mocks/po-data';

interface POApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  poNumber: string;
  onApprove: (remarks: string) => void;
  onReject: (remarks: string) => void;
}

export default function POApprovalModal({
  isOpen,
  onClose,
  poNumber,
  onApprove,
  onReject
}: POApprovalModalProps) {
  const [remarks, setRemarks] = useState('');
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);

  if (!isOpen) return null;

  const po = poData.find(p => p.poNumber === poNumber);
  if (!po) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleSubmit = () => {
    if (!remarks.trim()) {
      alert('Please enter remarks before submitting');
      return;
    }

    if (action === 'approve') {
      onApprove(remarks);
    } else if (action === 'reject') {
      onReject(remarks);
    }

    setRemarks('');
    setAction(null);
    onClose();
  };

  const handleCancel = () => {
    setRemarks('');
    setAction(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">PO Approval</h2>
            <p className="text-sm text-gray-600 mt-1">Review and approve/reject purchase order</p>
          </div>
          <button
            onClick={handleCancel}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-xl text-gray-600"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* PO Summary */}
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-teal-700 font-medium mb-1">PO Number</p>
                <p className="text-lg font-bold text-teal-900">{po.poNumber}</p>
              </div>
              <div>
                <p className="text-xs text-teal-700 font-medium mb-1">PR Reference</p>
                <p className="text-lg font-semibold text-teal-900">{po.prId}</p>
              </div>
              <div>
                <p className="text-xs text-teal-700 font-medium mb-1">Vendor</p>
                <p className="text-base font-semibold text-gray-900">{po.vendor}</p>
              </div>
              <div>
                <p className="text-xs text-teal-700 font-medium mb-1">Grand Total</p>
                <p className="text-xl font-bold text-teal-600">{formatCurrency(po.grandTotal)}</p>
              </div>
            </div>
          </div>

          {/* PR Details */}
          <div className="bg-gray-50 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Purchase Request Details</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Title</p>
                <p className="text-sm font-medium text-gray-900">{po.prTitle}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Department</p>
                <p className="text-sm font-medium text-gray-900">{po.department}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Requester</p>
                <p className="text-sm font-medium text-gray-900">{po.requester}</p>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Line Items</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Description</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Quantity</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {po.lineItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Billing Summary */}
          <div className="bg-gray-50 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Billing Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Subtotal</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(po.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">GST ({po.gstPercentage}%)</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(po.taxAmount)}</span>
              </div>
              <div className="pt-2 border-t border-gray-300 flex justify-between items-center">
                <span className="text-base font-semibold text-gray-900">Grand Total</span>
                <span className="text-xl font-bold text-teal-600">{formatCurrency(po.grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Delivery & Payment Terms */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Delivery Details</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Expected Delivery Date</p>
                  <p className="text-sm font-medium text-gray-900">{po.expectedDeliveryDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Delivery Address</p>
                  <p className="text-sm text-gray-900">{po.deliveryAddress}</p>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Terms</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Terms</p>
                  <p className="text-sm font-medium text-gray-900">{po.paymentTerms}</p>
                </div>
                {po.specialInstructions && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Special Instructions</p>
                    <p className="text-sm text-gray-900">{po.specialInstructions}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Remarks Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Remarks <span className="text-red-500">*</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter your remarks for approval or rejection..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setAction('reject');
              handleSubmit();
            }}
            className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-close-circle-line mr-2"></i>
            Reject PO
          </button>
          <button
            onClick={() => {
              setAction('approve');
              handleSubmit();
            }}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-checkbox-circle-line mr-2"></i>
            Approve PO
          </button>
        </div>
      </div>
    </div>
  );
}