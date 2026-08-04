import { useState } from 'react';
import PriorityBadge from '../../../../components/base/PriorityBadge';
import StatusBadge from '../../../../components/base/StatusBadge';
import PRExpandedRow from './PRExpandedRow';

interface PR {
  id: string;
  title: string;
  department: string;
  requester: string;
  amount: number;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: string;
  entity: string;
  entityName?: string;
  submittedDate: string;
  dueDate: string;
  justification: string;
  lineItems: {
    item: string;
    category: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  approvalHistory: {
    stage: string;
    user: string;
    role: string;
    date: string;
    status: string;
    remarks: string;
  }[];
  isHighValue: boolean;
  isOverdue?: boolean;
}

interface Entity {
  id: string;
  name: string;
  code: string;
  color: string;
}

interface PRTableProps {
  prs: PR[];
  entities: Entity[];
  onRefresh?: () => void;
}

export default function PRTable({ prs, entities, onRefresh }: PRTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleRow = (prId: string) => {
    setExpandedRow(expandedRow === prId ? null : prId);
  };

  const getEntityColor = (entityId: string) =>
    entities.find(e => e.id === entityId)?.color || '#6B7280';

  const getEntityCode = (entityId: string) =>
    entities.find(e => e.id === entityId)?.code || entityId;

  if (prs.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <i className="ri-inbox-line text-5xl text-gray-300"></i>
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">No Purchase Requests Found</h3>
        <p className="text-sm text-gray-500">Try adjusting your filters or search query</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full table-fixed">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="w-10 px-3 py-3"></th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-56">PR Details</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Entity</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Department</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Amount</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Priority</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Due Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {prs.map((pr) => (
            <>
              <tr
                key={pr.id}
                className={`hover:bg-gray-50 cursor-pointer transition-colors ${pr.isOverdue ? 'bg-red-50/30' : ''}`}
                onClick={() => toggleRow(pr.id)}
              >
                <td className="px-3 py-3">
                  <div className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors">
                    <i className={`ri-arrow-${expandedRow === pr.id ? 'down' : 'right'}-s-line text-base text-gray-500`}></i>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    {pr.isHighValue && (
                      <div className="w-6 h-6 flex items-center justify-center rounded bg-red-100 flex-shrink-0 mt-0.5">
                        <i className="ri-vip-crown-line text-xs text-red-600"></i>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{pr.id}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{pr.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">by {pr.requester}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getEntityColor(pr.entity) }}
                    ></div>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white whitespace-nowrap"
                      style={{ backgroundColor: getEntityColor(pr.entity) }}
                    >
                      {getEntityCode(pr.entity)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700 truncate block">{pr.department}</span>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <span className="text-sm font-bold text-gray-900">
                      ₹{(pr.amount / 100000).toFixed(1)}L
                    </span>
                    {pr.isOverdue && (
                      <span className="block text-xs text-red-500 font-medium mt-0.5">Overdue</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={pr.priority} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={pr.status} />
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-600">{pr.dueDate}</span>
                </td>
              </tr>
              {expandedRow === pr.id && (
                <tr key={`${pr.id}-expanded`}>
                  <td colSpan={8} className="bg-gray-50 border-t border-gray-100">
                    <PRExpandedRow pr={pr as any} entityColor={getEntityColor(pr.entity)} onRefresh={onRefresh} />
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
