import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import PriorityBadge from '../../../../components/base/PriorityBadge';
import StatusBadge from '../../../../components/base/StatusBadge';
import PRExpandedRow from './PRExpandedRow';

interface PRItem {
  id: string;
  prId?: number;
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

interface PRTableProps {
  data: PRItem[];
  onApprove: (pr: PRItem) => void;
  onReject: (pr: PRItem) => void;
  onRework: (pr: PRItem) => void;
}

const PRTable: React.FC<PRTableProps> = ({ data, onApprove, onReject, onRework }) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const canTakeAction = (status: string) =>
    status === 'Pending Approval' || status === 'Pending RFQ Manager Approval';

  const isRfqApproval = (status: string) => status === 'Pending RFQ Manager Approval';

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-8"></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">PR Number</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Requester</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Department</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Submitted</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((pr) => (
              <React.Fragment key={pr.id}>
                <tr className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => toggleRow(pr.id)}>
                  <td className="px-4 py-3">
                    <button className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600">
                      <i className={`ri-arrow-${expandedRow === pr.id ? 'down' : 'right'}-s-line text-lg`}></i>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-teal-600">{pr.id}</span>
                    {pr.isOverdue && (
                      <span className="ml-2 inline-flex items-center">
                        <i className="ri-alarm-warning-fill text-red-500 text-sm"></i>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{pr.title}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{pr.requester}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-600">{pr.department}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-gray-900">₹{pr.amount.toLocaleString()}</div>
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={pr.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={pr.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-600">{pr.submittedDate}</div>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      {canTakeAction(pr.status) && isRfqApproval(pr.status) && pr.prId && (
                        <Link
                          to={`/rfq-approval/${pr.prId}`}
                          className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Review RFQ
                        </Link>
                      )}
                      {canTakeAction(pr.status) && !isRfqApproval(pr.status) && (
                        <>
                          <button
                            onClick={() => onApprove(pr)}
                            className="w-8 h-8 flex items-center justify-center bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                            title="Approve"
                          >
                            <i className="ri-check-line text-base"></i>
                          </button>
                          <button
                            onClick={() => onRework(pr)}
                            className="w-8 h-8 flex items-center justify-center bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors"
                            title="Return for Rework"
                          >
                            <i className="ri-arrow-go-back-line text-base"></i>
                          </button>
                          <button
                            onClick={() => onReject(pr)}
                            className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                            title="Reject"
                          >
                            <i className="ri-close-line text-base"></i>
                          </button>
                        </>
                      )}
                      {pr.status !== 'Pending Approval' && pr.status !== 'Pending RFQ Manager Approval' && (
                        <button
                          onClick={() => toggleRow(pr.id)}
                          className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                          title="View Details"
                        >
                          <i className="ri-eye-line text-base"></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedRow === pr.id && (
                  <tr>
                    <td colSpan={10} className="px-0 py-0 bg-gray-50">
                      <PRExpandedRow
                        pr={pr}
                        onApprove={onApprove}
                        onReject={onReject}
                        onRework={onRework}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PRTable;