import React, { useState } from 'react';
import PriorityBadge from '../../../../components/base/PriorityBadge';

interface PRItem {
  id: string;
  title: string;
  requester: string;
  department: string;
  amount: number;
  priority: string;
  status: string;
  submittedDate: string;
  dueDate: string;
  isOverdue: boolean;
  justification: string;
  lineItems: Array<{
    item: string;
    category: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  approvalHistory: Array<{
    stage: string;
    user: string;
    role: string;
    date: string;
    status: string;
    remarks: string;
  }>;
}

interface PRExpandedRowProps {
  pr: PRItem;
  onApprove: (pr: PRItem) => void;
  onReject: (pr: PRItem) => void;
  onRework: (pr: PRItem) => void;
}

const PRExpandedRow: React.FC<PRExpandedRowProps> = ({ pr, onApprove, onReject, onRework }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'items' | 'history'>('details');

  const totalAmount = pr.lineItems.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('details')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'details'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          PR Details
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'items'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Line Items ({pr.lineItems.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Approval History
        </button>
      </div>

      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">PR Number</label>
              <div className="text-sm font-medium text-gray-900 mt-1">{pr.id}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</label>
              <div className="text-sm font-medium text-gray-900 mt-1">{pr.title}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Requester</label>
              <div className="text-sm text-gray-900 mt-1">{pr.requester}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</label>
              <div className="text-sm text-gray-900 mt-1">{pr.department}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</label>
              <div className="mt-1">
                <PriorityBadge priority={pr.priority} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Amount</label>
              <div className="text-lg font-bold text-gray-900 mt-1">₹{pr.amount.toLocaleString()}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted Date</label>
              <div className="text-sm text-gray-900 mt-1">{pr.submittedDate}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Due Date</label>
              <div className="text-sm text-gray-900 mt-1 flex items-center gap-2">
                {pr.dueDate}
                {pr.isOverdue && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                    <i className="ri-alarm-warning-fill"></i>
                    Overdue
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-xl overflow-hidden border-2 border-amber-300 bg-amber-50 ring-2 ring-amber-200/50">
              <div className="px-3 py-2 bg-amber-100 border-b border-amber-300 flex items-center gap-2">
                <i className="ri-lightbulb-flash-line text-amber-700" aria-hidden />
                <label className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">
                  Business Justification
                </label>
              </div>
              <div className="px-3 py-3 text-sm text-amber-950 leading-relaxed whitespace-pre-wrap font-medium">
                {pr.justification || 'No business justification provided.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'items' && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Item Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Quantity</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Unit Price</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pr.lineItems.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.item}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">₹{item.unitPrice.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">₹{item.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">Total Amount:</td>
                  <td className="px-4 py-3 text-base font-bold text-teal-600 text-right">₹{totalAmount.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {pr.approvalHistory.map((history, index) => (
            <div key={index} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    history.status === 'Completed' || history.status === 'Approved'
                      ? 'bg-green-100 text-green-600'
                      : history.status === 'Rejected'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <i
                    className={`text-lg ${
                      history.status === 'Completed' || history.status === 'Approved'
                        ? 'ri-checkbox-circle-fill'
                        : history.status === 'Rejected'
                        ? 'ri-close-circle-fill'
                        : 'ri-time-line'
                    }`}
                  ></i>
                </div>
                {index < pr.approvalHistory.length - 1 && (
                  <div className="w-0.5 h-16 bg-gray-200 my-1"></div>
                )}
              </div>
              <div className="flex-1 pb-6">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{history.stage}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {history.user} • {history.role}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">{history.date}</div>
                </div>
                {history.remarks && (
                  <div className="text-sm text-gray-700 mt-2 bg-gray-50 rounded-lg p-3 border border-gray-200">
                    {history.remarks}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pr.status === 'Pending Approval' && (
        <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={() => onReject(pr)}
            className="px-5 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
          >
            <i className="ri-close-line mr-2"></i>
            Reject
          </button>
          <button
            onClick={() => onRework(pr)}
            className="px-5 py-2.5 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap"
          >
            <i className="ri-arrow-go-back-line mr-2"></i>
            Return for Rework
          </button>
          <button
            onClick={() => onApprove(pr)}
            className="px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
          >
            <i className="ri-check-line mr-2"></i>
            Approve PR
          </button>
        </div>
      )}
    </div>
  );
};

export default PRExpandedRow;