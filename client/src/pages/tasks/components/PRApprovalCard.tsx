
import React from 'react';
import PriorityBadge from '../../../components/base/PriorityBadge';
import { formatDisplayDate, formatDisplayDateTime } from '../../../utils/formatDate';
import { collapsePrAdminEditHistory } from '../../../components/feature/ApprovalHistoryPanel';

interface LineItem {
  itemName?: string;
  description: string;
  qty: number;
  unit: string;
  unitCost: number;
  total: number;
}

interface ApprovalStep {
  step: string;
  approver: string;
  role: string;
  date: string;
  status: string;
  remarks: string;
}

interface PRTask {
  id: string;
  prNumber: string;
  title: string;
  requester: string;
  requesterRole: string;
  requesterAvatar: string;
  department: string;
  entityName?: string;
  entityCode?: string;
  requestType: string;
  category: string;
  priority: string;
  status: string;
  totalAmount: number;
  currency: string;
  submittedDate: string;
  requiredDate: string;
  currentApprover: string;
  justification: string;
  vendorSelection?: 'own' | 'scm';
  lineItems: LineItem[];
  approvalHistory: ApprovalStep[];
  slaHours: number;
  slaRemaining: number;
  isOverdue: boolean;
}

interface PRApprovalCardProps {
  task: PRTask;
  isExpanded: boolean;
  onToggle: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onReturn?: (id: string) => void;
}

export default function PRApprovalCard({
  task,
  isExpanded,
  onToggle,
  onApprove,
  onReject,
  onReturn,
}: PRApprovalCardProps) {
  const formatDate = (dateStr: string) => formatDisplayDate(dateStr);

  const formatDateTime = (dateStr: string) => formatDisplayDateTime(dateStr);
  const isOwnVendor = task.vendorSelection === 'own';
  const approvalHistory = collapsePrAdminEditHistory(
    (task.approvalHistory || []).map((step) => ({
      stage: step.step,
      step: step.step,
      approver: step.approver,
      role: step.role,
      date: step.date,
      status: step.status,
      remarks: step.remarks,
    }))
  );

  const getSlaColor = () => {
    if (task.isOverdue) return 'text-red-600 bg-red-50 border-red-200';
    if (task.slaRemaining <= 8) return 'text-red-600 bg-red-50 border-red-200';
    if (task.slaRemaining <= 24) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  };

  const getSlaText = () => {
    if (task.isOverdue) return 'Overdue';
    if (task.slaRemaining <= 0) return 'Due now';
    if (task.slaRemaining < 24) return `${task.slaRemaining}h left`;
    return `${Math.ceil(task.slaRemaining / 24)}d left`;
  };

  const getStatusStyle = () => {
    switch (task.status) {
      case 'pending_approval':
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-700',
          border: 'border-amber-200',
          label: 'Pending Approval',
          icon: 'ri-time-line',
        };
      case 'approved':
        return {
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
          label: 'Approved',
          icon: 'ri-check-double-line',
        };
      case 'rejected':
        return {
          bg: 'bg-red-50',
          text: 'text-red-700',
          border: 'border-red-200',
          label: 'Rejected',
          icon: 'ri-close-circle-line',
        };
      default:
        return {
          bg: 'bg-gray-50',
          text: 'text-gray-700',
          border: 'border-gray-200',
          label: task.status,
          icon: 'ri-question-line',
        };
    }
  };

  const getTypeColor = () => {
    switch (task.requestType) {
      case 'Capex':
        return 'bg-indigo-50 text-indigo-700';
      case 'Opex':
        return 'bg-teal-50 text-teal-700';
      case 'Service':
        return 'bg-rose-50 text-rose-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  const statusStyle = getStatusStyle();
  const isPending = task.status === 'pending_approval';

  return (
    <div
      className={`bg-white rounded-lg border transition-all duration-200 ${
        task.isOverdue && isPending
          ? 'border-red-300 shadow-sm shadow-red-50'
          : task.status === 'rejected'
          ? 'border-red-200'
          : task.status === 'approved'
          ? 'border-emerald-200'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      {/* Card Header */}
      <div className="p-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
              isPending
                ? 'bg-amber-100 text-amber-700'
                : task.status === 'approved'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {task.requesterAvatar}
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-bold text-gray-500">{task.prNumber}</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${getTypeColor()} whitespace-nowrap`}
                  >
                    {task.requestType}
                  </span>
                  <PriorityBadge priority={task.priority} size="sm" />
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text} whitespace-nowrap flex items-center gap-1`}
                  >
                    <i className={`${statusStyle.icon} text-xs`}></i>
                    {statusStyle.label}
                  </span>
                  {task.isOverdue && isPending && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 whitespace-nowrap flex items-center gap-1">
                      <i className="ri-alarm-warning-line text-xs"></i>
                      Overdue
                    </span>
                  )}
                </div>
                <h3
                  className={`text-sm font-semibold leading-snug ${
                    task.status === 'rejected' ? 'text-gray-500' : 'text-gray-900'
                  }`}
                >
                  {task.title}
                </h3>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500 flex-wrap">
                  <span className="flex items-center gap-1">
                    <i className="ri-user-line"></i>
                    {task.requester} &middot; {task.requesterRole}
                  </span>
                  <span className="flex items-center gap-1 min-w-0">
                    <i className="ri-community-line"></i>
                    <span className="truncate" title={task.entityName || undefined}>
                      {task.entityName || '—'}
                      {task.entityCode ? ` (${task.entityCode})` : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-building-line"></i>
                    {task.department || '—'}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="ri-calendar-line"></i>
                    {formatDate(task.submittedDate)}
                  </span>
                </div>
              </div>

              {/* Right Side */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <p className="text-base font-bold text-gray-900">
                    {'\u20B9'}{Number(task.totalAmount || 0).toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-gray-400">
                    {task.lineItems.length} item{task.lineItems.length > 1 ? 's' : ''}
                  </p>
                </div>
                {isPending && (
                  <span className={`text-xs font-semibold px-2 py-1 rounded-md whitespace-nowrap border ${getSlaColor()}`}>
                    {getSlaText()}
                  </span>
                )}
                <i className={`ri-arrow-${isExpanded ? 'up' : 'down'}-s-line text-gray-400 text-lg`}></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Justification */}
          <div className="px-5 pt-4 pb-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Business Justification
            </h4>
            <p className="text-sm text-gray-700 leading-relaxed">{task.justification}</p>
          </div>

          {/* PR Details Grid */}
          <div className="px-5 pb-3">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-gray-50 rounded-md p-2.5">
                <p className="text-xs text-gray-500 mb-0.5">Entity</p>
                <p className="text-sm font-medium text-gray-900 truncate" title={task.entityName || undefined}>
                  {task.entityName || '—'}
                  {task.entityCode ? (
                    <span className="block text-xs text-gray-500 font-normal">{task.entityCode}</span>
                  ) : null}
                </p>
              </div>
              <div className="bg-gray-50 rounded-md p-2.5">
                <p className="text-xs text-gray-500 mb-0.5">Category</p>
                <p className="text-sm font-medium text-gray-900">{task.category}</p>
              </div>
              <div className="bg-gray-50 rounded-md p-2.5">
                <p className="text-xs text-gray-500 mb-0.5">Request Type</p>
                <p className="text-sm font-medium text-gray-900">{task.requestType}</p>
              </div>
              <div className="bg-gray-50 rounded-md p-2.5">
                <p className="text-xs text-gray-500 mb-0.5">Required Date</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(task.requiredDate)}</p>
              </div>
              <div className="bg-gray-50 rounded-md p-2.5">
                <p className="text-xs text-gray-500 mb-0.5">Current Stage</p>
                <p className="text-sm font-medium text-gray-900">{task.currentApprover}</p>
              </div>
              <div className="bg-gray-50 rounded-md p-2.5">
                <p className="text-xs text-gray-500 mb-0.5">{isOwnVendor ? 'Vendor Path' : 'Total Amount'}</p>
                <p className="text-sm font-bold text-gray-900">
                  {isOwnVendor
                    ? 'Own Vendor'
                    : `\u20B9${Number(task.totalAmount || 0).toLocaleString('en-IN')}`}
                </p>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="px-5 pb-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Line Items
            </h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">#</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                      Item Name
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                      Description
                    </th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                      Qty
                    </th>
                    {!isOwnVendor && (
                      <>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                          Unit
                        </th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                          Unit Cost
                        </th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                          Total
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {task.lineItems.map((item, idx) => {
                    const name = String(item.itemName || item.description || '—').trim() || '—';
                    const desc = String(item.description || '').trim();
                    const showDesc = desc && desc !== name;
                    return (
                      <tr key={idx} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{name}</td>
                        <td className="px-3 py-2 text-gray-600">{showDesc ? desc : '—'}</td>
                        <td className="px-3 py-2 text-center text-gray-700 tabular-nums">
                          {Number(item.qty) || 0}
                          {item.unit && !/^\d+(\.\d+)?$/.test(String(item.unit).trim()) ? (
                            <span className="text-xs text-gray-400 font-normal ml-1">{item.unit}</span>
                          ) : null}
                        </td>
                        {!isOwnVendor && (
                          <>
                            <td className="px-3 py-2 text-center text-gray-500">
                              {item.unit && !/^\d+(\.\d+)?$/.test(String(item.unit).trim()) ? item.unit : 'Nos'}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {'\u20B9'}{Number(item.unitCost || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-900">
                              {'\u20B9'}{Number(item.total || 0).toLocaleString('en-IN')}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                {!isOwnVendor && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td colSpan={6} className="px-3 py-2 text-right font-bold text-gray-700 uppercase text-xs">
                        Grand Total
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-gray-900">
                        {'\u20B9'}{Number(task.totalAmount || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Approval History */}
          <div className="px-5 pb-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Approval History
            </h4>
            <div className="space-y-0">
              {approvalHistory.map((step, idx) => (
                <div key={`${step.stage}-${step.date}-${idx}`} className="flex items-start gap-3 relative">
                  {idx < approvalHistory.length - 1 && (
                    <div className="absolute left-[11px] top-6 w-0.5 h-full bg-gray-200"></div>
                  )}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      String(step.status || '').toLowerCase().includes('approv') ||
                      String(step.status || '').toLowerCase().includes('complet')
                        ? 'bg-emerald-100'
                        : String(step.status || '').toLowerCase().includes('reject')
                        ? 'bg-red-100'
                        : 'bg-gray-100'
                    }`}
                  >
                    <i
                      className={`text-xs ${
                        String(step.status || '').toLowerCase().includes('approv') ||
                        String(step.status || '').toLowerCase().includes('complet')
                          ? 'ri-check-line text-emerald-600'
                          : String(step.status || '').toLowerCase().includes('reject')
                          ? 'ri-close-line text-red-600'
                          : 'ri-time-line text-gray-400'
                      }`}
                    ></i>
                  </div>
                  <div className="pb-4 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{step.stage || step.step}</p>
                      <span className="text-xs text-gray-400">{formatDateTime(step.date)}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {step.approver}
                    </p>
                    {step.remarks && (
                      <p className="text-xs text-gray-600 mt-0.5 italic">
                        &ldquo;{step.remarks}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons - Only for pending */}
          {isPending && (
            <div className="px-5 pb-4 pt-1 flex items-center gap-3 border-t border-gray-100 mt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove(task.id);
                }}
                className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 shadow-sm"
              >
                <i className="ri-check-double-line"></i> Approve
              </button>
              {onReturn && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReturn(task.id);
                  }}
                  className="px-5 py-2.5 bg-white text-orange-600 text-sm font-semibold rounded-lg border border-orange-300 hover:bg-orange-50 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2"
                >
                  <i className="ri-arrow-go-back-line"></i> Send Back
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReject(task.id);
                }}
                className="px-5 py-2.5 bg-white text-red-600 text-sm font-semibold rounded-lg border border-red-300 hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2"
              >
                <i className="ri-close-circle-line"></i> Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
