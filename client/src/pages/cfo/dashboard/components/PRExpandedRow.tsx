import { useState } from 'react';
import PriorityBadge from '../../../../components/base/PriorityBadge';
import ApprovalModal from '../../../tasks/components/ApprovalModal';
import { prApi } from '../../../../services/api';

interface LineItem {
  id: string;
  itemName: string;
  description: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  totalPrice: number;
  category: string;
}

interface ApprovalHistoryItem {
  stage: string;
  approver: string;
  role: string;
  action: string;
  remarks: string;
  timestamp: string;
}

interface PR {
  id: string;
  title: string;
  department: string;
  requester: string;
  amount: number;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: string;
  entity: string;
  submittedDate: string;
  dueDate: string;
  justification: string;
  vendorSelection?: 'own' | 'scm';
  purchaseType?: string;
  isSass?: boolean;
  requireInvoiceUpload?: boolean;
  lineItems: LineItem[];
  approvalHistory: ApprovalHistoryItem[];
  isHighValue: boolean;
}

interface PRExpandedRowProps {
  pr: PR & { prId?: number };
  entityColor: string;
  onRefresh?: () => void;
}

export default function PRExpandedRow({ pr, entityColor, onRefresh }: PRExpandedRowProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'items' | 'history'>('details');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | 'return'>('approve');
  const isOwnVendor = pr.vendorSelection === 'own';
  const requireInvoice = Boolean(pr.requireInvoiceUpload);

  const tabs = [
    { id: 'details' as const, label: 'PR Details', icon: 'ri-file-text-line' },
    { id: 'items' as const, label: 'Line Items', icon: 'ri-list-check' },
    { id: 'history' as const, label: 'Approval History', icon: 'ri-time-line' },
  ];

  const handleAction = (action: 'approve' | 'reject' | 'return') => {
    setApprovalAction(action);
    setShowApprovalModal(true);
  };

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'approved':
        return 'text-teal-600 bg-teal-50';
      case 'rejected':
        return 'text-red-600 bg-red-50';
      case 'info requested':
        return 'text-amber-600 bg-amber-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="p-6">
      {/* Tabs */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'text-white shadow-lg'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
              style={activeTab === tab.id ? { backgroundColor: entityColor } : {}}
            >
              <i className={tab.icon}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => handleAction('return')}
            className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <i className="ri-arrow-go-back-line"></i>
            Send Back
          </button>
          <button
            onClick={() => handleAction('reject')}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <i className="ri-close-circle-line"></i>
            Reject
          </button>
          <button
            onClick={() => handleAction('approve')}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <i className={requireInvoice ? 'ri-file-upload-line' : 'ri-checkbox-circle-line'}></i>
            {requireInvoice ? 'Approve & Upload Invoice' : 'Approve'}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Request Information</h4>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">PR Number</p>
                  <p className="text-sm font-semibold text-gray-900">{pr.id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Title</p>
                  <p className="text-sm text-gray-900">{pr.title}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Requester</p>
                  <p className="text-sm text-gray-900">{pr.requester}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Department</p>
                  <p className="text-sm text-gray-900">{pr.department}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Priority</p>
                  <PriorityBadge priority={pr.priority} />
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Timeline & Amount</h4>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Submitted Date</p>
                  <p className="text-sm text-gray-900">{pr.submittedDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Due Date</p>
                  <p className="text-sm text-gray-900">{pr.dueDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Amount</p>
                  <p className="text-2xl font-bold text-gray-900">₹{(pr.amount / 100000).toFixed(2)}L</p>
                </div>
                {pr.isHighValue && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg">
                    <i className="ri-vip-crown-line text-red-600"></i>
                    <span className="text-sm font-medium text-red-700">High Value PR - CFO Approval Required</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Business Justification</h4>
            <p className="text-sm text-gray-700 leading-relaxed">{pr.justification}</p>
          </div>
        </div>
      )}

      {activeTab === 'items' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Item Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                {!isOwnVendor && (
                  <>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pr.lineItems.map((item, index) => {
                const name = String(item.itemName || item.description || '—').trim() || '—';
                const desc = String(item.description || '').trim();
                const showDesc = desc && desc !== name;
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{showDesc ? desc : '—'}</td>
                    {!isOwnVendor && (
                      <>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                          {Number(item.quantity) || 0}
                          {item.unit && !/^\d+(\.\d+)?$/.test(String(item.unit).trim()) ? (
                            <span className="text-xs text-gray-400 font-normal ml-1">{item.unit}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          ₹{item.estimatedPrice.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                          ₹{item.totalPrice.toLocaleString()}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {!isOwnVendor && (
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={6} className="px-4 py-3 text-right text-sm text-gray-900">
                    Grand Total:
                  </td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-gray-900">
                    ₹{pr.amount.toLocaleString()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="space-y-4">
            {pr.approvalHistory.map((item, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getActionColor(item.action)}`}>
                    <i className={`${
                      item.action.toLowerCase() === 'approved' ? 'ri-checkbox-circle-line' :
                      item.action.toLowerCase() === 'rejected' ? 'ri-close-circle-line' :
                      'ri-question-line'
                    } text-lg`}></i>
                  </div>
                  {index < pr.approvalHistory.length - 1 && (
                    <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                  )}
                </div>
                <div className="flex-1 pb-6">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{item.stage}</p>
                      <p className="text-sm text-gray-600">{item.approver} • {item.role}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getActionColor(item.action)}`}>
                      {item.action}
                    </span>
                  </div>
                  {item.remarks && (
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mb-2">{item.remarks}</p>
                  )}
                  <p className="text-xs text-gray-500">{item.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && (
        <ApprovalModal
          isOpen={showApprovalModal}
          type={approvalAction}
          prNumber={pr.id}
          prTitle={pr.title}
          amount={pr.amount}
          prId={pr.prId}
          requireInvoiceUpload={approvalAction === 'approve' && requireInvoice}
          onClose={() => setShowApprovalModal(false)}
          onConfirm={async (remarks, returnTo, _goToBusiness, invoice) => {
            if (!pr.prId) return;
            const apiAction =
              approvalAction === 'approve'
                ? 'approve'
                : approvalAction === 'return'
                  ? 'return'
                  : 'reject';
            await prApi.approve(pr.prId, apiAction, remarks || 'CFO action', {
              ...(returnTo ? { returnTo } : {}),
              ...(invoice ? { invoice } : {}),
            });
            setShowApprovalModal(false);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}