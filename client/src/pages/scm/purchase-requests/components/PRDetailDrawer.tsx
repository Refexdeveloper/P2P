import { useState } from 'react';

interface LineItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: string;
}

interface VendorComparison {
  vendorName: string;
  quotedPrice: number;
  leadTime: number;
  paymentTerms: string;
  compliance: string;
  technicalScore: number;
  commercialScore: number;
  overallScore: number;
  recommended: boolean;
}

interface ApprovalHistoryItem {
  stage: string;
  approver: string;
  role: string;
  action: string;
  date: string;
  remarks: string;
}

interface PurchaseRequest {
  id: string;
  title: string;
  department: string;
  requester: string;
  amount: number;
  recommendedVendor: string;
  overallScore: number;
  status: string;
  requestedDate: string;
  requiredDate: string;
  priority: string;
  requestType: string;
  justification: string;
  lineItems: LineItem[];
  vendorComparison: VendorComparison[];
  approvalHistory: ApprovalHistoryItem[];
}

interface PRDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pr: PurchaseRequest | null;
  onCreatePO?: (prId: string) => void;
  onSendRFQ?: (prId: string) => void;
}

export default function PRDetailDrawer({ isOpen, onClose, pr, onCreatePO, onSendRFQ }: PRDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'vendors' | 'history'>('details');

  if (!isOpen || !pr) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ready for PO':
        return 'bg-emerald-100 text-emerald-700';
      case 'PO Created':
        return 'bg-blue-100 text-blue-700';
      case 'Pending':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-red-100 text-red-700';
      case 'Medium':
        return 'bg-amber-100 text-amber-700';
      case 'Low':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
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
            <h2 className="text-2xl font-semibold text-gray-900">{pr.id}</h2>
            <p className="text-sm text-gray-600 mt-1">{pr.title}</p>
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
          {/* Status & Priority Badges */}
          <div className="flex items-center gap-3 mb-6">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(pr.status)}`}>
              {pr.status}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(pr.priority)}`}>
              {pr.priority} Priority
            </span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
              {pr.requestType}
            </span>
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
              PR Details
            </button>
            <button
              onClick={() => setActiveTab('vendors')}
              className={`px-4 py-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'vendors'
                  ? 'text-teal-600 border-b-2 border-teal-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-group-line mr-2"></i>
              Vendor Comparison
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
              {/* Basic Information */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Department</p>
                    <p className="text-sm font-medium text-gray-900">{pr.department}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Requester</p>
                    <p className="text-sm font-medium text-gray-900">{pr.requester}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Requested Date</p>
                    <p className="text-sm font-medium text-gray-900">{pr.requestedDate}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Required Date</p>
                    <p className="text-sm font-medium text-gray-900">{pr.requiredDate}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                    <p className="text-lg font-semibold text-teal-600">{formatCurrency(pr.amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Recommended Vendor</p>
                    <p className="text-sm font-medium text-gray-900">{pr.recommendedVendor}</p>
                  </div>
                </div>
              </div>

              {/* Justification */}
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Justification</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{pr.justification}</p>
              </div>

              {/* Line Items */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Line Items</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Category</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Quantity</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Unit Price</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {pr.lineItems.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.category}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.quantity}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">Grand Total:</td>
                        <td className="px-4 py-3 text-sm font-bold text-teal-600 text-right">{formatCurrency(pr.amount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Recommended Vendor Highlight */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <i className="ri-star-fill text-emerald-600 text-xl"></i>
                  <h3 className="text-lg font-semibold text-gray-900">Recommended Vendor</h3>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Vendor Name</p>
                    <p className="text-sm font-semibold text-gray-900">{pr.recommendedVendor}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Quoted Price</p>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(pr.amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Overall Score</p>
                    <p className="text-sm font-semibold text-emerald-600">{pr.overallScore}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vendors' && (
            <div className="space-y-4">
              {pr.vendorComparison.map((vendor, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-6 ${
                    vendor.recommended
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h4 className="text-lg font-semibold text-gray-900">{vendor.vendorName}</h4>
                      {vendor.recommended && (
                        <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-medium rounded-full whitespace-nowrap">
                          <i className="ri-star-fill mr-1"></i>
                          Recommended
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Overall Score</p>
                      <p className={`text-2xl font-bold ${vendor.recommended ? 'text-emerald-600' : 'text-gray-900'}`}>
                        {vendor.overallScore}%
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-6">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Quoted Price</p>
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(vendor.quotedPrice)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Lead Time</p>
                      <p className="text-sm font-semibold text-gray-900">{vendor.leadTime} days</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Payment Terms</p>
                      <p className="text-sm font-semibold text-gray-900">{vendor.paymentTerms}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Compliance</p>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        vendor.compliance === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {vendor.compliance}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mt-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Technical Score</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${vendor.technicalScore}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 w-12 text-right">{vendor.technicalScore}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Commercial Score</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full"
                            style={{ width: `${vendor.commercialScore}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 w-12 text-right">{vendor.commercialScore}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="relative">
              {pr.approvalHistory.map((item, index) => (
                <div key={index} className="flex gap-4 pb-8 relative">
                  {/* Timeline Line */}
                  {index !== pr.approvalHistory.length - 1 && (
                    <div className="absolute left-5 top-12 w-0.5 h-full bg-gray-200"></div>
                  )}

                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    item.action === 'Approved' || item.action === 'Cleared' || item.action === 'Completed' || item.action === 'PO Created'
                      ? 'bg-emerald-100'
                      : item.action === 'Rejected'
                      ? 'bg-red-100'
                      : 'bg-blue-100'
                  }`}>
                    <i className={`${
                      item.action === 'Approved' || item.action === 'Cleared' || item.action === 'Completed'
                        ? 'ri-check-line text-emerald-600'
                        : item.action === 'PO Created'
                        ? 'ri-file-text-line text-emerald-600'
                        : item.action === 'Rejected'
                        ? 'ri-close-line text-red-600'
                        : 'ri-time-line text-blue-600'
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
                        item.action === 'Approved' || item.action === 'Cleared' || item.action === 'Completed' || item.action === 'PO Created'
                          ? 'bg-emerald-100 text-emerald-700'
                          : item.action === 'Rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
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
              ))}
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

          {/* Send RFQ button — visible for all statuses except PO Approved / PO Rejected */}
          {pr && pr.status !== 'PO Approved' && pr.status !== 'PO Rejected' && (
            <button
              onClick={() => {
                if (onSendRFQ) onSendRFQ(pr.id);
              }}
              className="px-6 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap flex items-center gap-2"
            >
              <i className="ri-mail-send-line"></i>
              Vendor Recommend / RFQ Entry
            </button>
          )}

          {pr && pr.status === 'Ready for PO' && (
            <button
              onClick={() => {
                if (onCreatePO) onCreatePO(pr.id);
              }}
              className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap flex items-center gap-2"
            >
              <i className="ri-file-add-line"></i>
              Create Purchase Order
            </button>
          )}
        </div>
      </div>
    </>
  );
}