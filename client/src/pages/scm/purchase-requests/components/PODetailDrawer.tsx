import { useState } from 'react';
import { poData } from '../../../../mocks/po-data';

interface PODetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  poNumber: string | null;
}

export default function PODetailDrawer({ isOpen, onClose, poNumber }: PODetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');

  if (!isOpen || !poNumber) return null;

  const po = poData.find(p => p.poNumber === poNumber);
  if (!po) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-emerald-100 text-emerald-700';
      case 'Pending Approval':
        return 'bg-amber-100 text-amber-700';
      case 'Rejected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleViewPDF = () => {
    window.REACT_APP_NAVIGATE(`/scm/po-pdf-view?poNumber=${poNumber}`);
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-4xl bg-white shadow-2xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">{po.poNumber}</h2>
            <p className="text-sm text-gray-600 mt-1">Purchase Order Details</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-xl text-gray-600"></i>
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {/* Status Badge */}
          <div className="flex items-center gap-3 mb-6">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(po.status)}`}>
              {po.status}
            </span>
            <button
              onClick={handleViewPDF}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
            >
              <i className="ri-file-pdf-line mr-2"></i>
              View PDF
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'details'
                  ? 'text-teal-600 border-b-2 border-teal-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-file-list-3-line mr-2"></i>
              PO Details
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'history'
                  ? 'text-teal-600 border-b-2 border-teal-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-time-line mr-2"></i>
              Approval History
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* PO Summary */}
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">PO Summary</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">PO Number</p>
                    <p className="text-sm font-semibold text-gray-900">{po.poNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">PR Reference</p>
                    <p className="text-sm font-semibold text-teal-600">{po.prId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Created Date</p>
                    <p className="text-sm font-medium text-gray-900">{po.createdDate}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Expected Delivery</p>
                    <p className="text-sm font-medium text-gray-900">{po.expectedDeliveryDate}</p>
                  </div>
                </div>
              </div>

              {/* PR Details */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Purchase Request Details</h3>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Title</p>
                    <p className="text-sm font-medium text-gray-900">{po.prTitle}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Department</p>
                    <p className="text-sm font-medium text-gray-900">{po.department}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Requester</p>
                    <p className="text-sm font-medium text-gray-900">{po.requester}</p>
                  </div>
                </div>
              </div>

              {/* Vendor Information */}
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendor Information</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Vendor Name</p>
                    <p className="text-sm font-semibold text-gray-900">{po.vendor}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Payment Terms</p>
                    <p className="text-sm font-medium text-gray-900">{po.paymentTerms}</p>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Line Items</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">S.No</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Description</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Quantity</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Unit Price</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {po.lineItems.map((item, index) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.quantity}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Billing Summary */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">Subtotal</span>
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(po.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">GST ({po.gstPercentage}%)</span>
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(po.taxAmount)}</span>
                  </div>
                  <div className="pt-3 border-t border-gray-300 flex justify-between items-center">
                    <span className="text-base font-semibold text-gray-900">Grand Total</span>
                    <span className="text-2xl font-bold text-teal-600">{formatCurrency(po.grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Delivery Details */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Details</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Expected Delivery Date</p>
                    <p className="text-sm font-medium text-gray-900">{po.expectedDeliveryDate}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Delivery Address</p>
                    <p className="text-sm text-gray-900">{po.deliveryAddress}</p>
                  </div>
                </div>
              </div>

              {/* Special Instructions */}
              {po.specialInstructions && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Special Instructions</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{po.specialInstructions}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="relative">
              {po.approvalHistory && po.approvalHistory.length > 0 ? (
                po.approvalHistory.map((item, index) => (
                  <div key={index} className="flex gap-4 pb-8 relative">
                    {/* Timeline Line */}
                    {index !== po.approvalHistory!.length - 1 && (
                      <div className="absolute left-5 top-12 w-0.5 h-full bg-gray-200"></div>
                    )}

                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.action === 'Approved' || item.action === 'Created'
                        ? 'bg-emerald-100'
                        : item.action === 'Rejected'
                        ? 'bg-red-100'
                        : 'bg-amber-100'
                    }`}>
                      <i className={`${
                        item.action === 'Approved'
                          ? 'ri-check-line text-emerald-600'
                          : item.action === 'Created'
                          ? 'ri-file-add-line text-emerald-600'
                          : item.action === 'Rejected'
                          ? 'ri-close-line text-red-600'
                          : 'ri-time-line text-amber-600'
                      } text-lg`}></i>
                    </div>

                    {/* Content */}
                    <div className="flex-1 bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">{item.stage}</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {item.approver} <span className="text-gray-400">•</span> {item.role}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                          item.action === 'Approved' || item.action === 'Created'
                            ? 'bg-emerald-100 text-emerald-700'
                            : item.action === 'Rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {item.action}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{item.remarks}</p>
                      <p className="text-xs text-gray-500">
                        <i className="ri-calendar-line mr-1"></i>
                        {item.date}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <i className="ri-history-line text-5xl text-gray-300 mb-3"></i>
                  <p className="text-sm text-gray-500">No approval history available</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-8 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            Close
          </button>
          <button
            onClick={handleViewPDF}
            className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            <i className="ri-file-pdf-line mr-2"></i>
            View PDF
          </button>
        </div>
      </div>
    </>
  );
}