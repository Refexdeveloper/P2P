
import { useState } from 'react';
import StatusBadge from '../../../components/base/StatusBadge';
import PriorityBadge from '../../../components/base/PriorityBadge';

interface Task {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  assignedBy: string;
  assignedByRole: string;
  department: string;
  relatedDoc: string | null;
  relatedDocType: string | null;
  amount: number | null;
  createdDate: string;
  dueDate: string | null;
  slaHours: number | null;
  slaRemaining: number | null;
  isOverdue: boolean;
}

interface TaskCardProps {
  task: Task;
  onAction: (taskId: string, action: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function TaskCard({ task, onAction, isExpanded, onToggle }: TaskCardProps) {
  const [showActions, setShowActions] = useState(false);

  const getTypeIcon = (type: string) => {
    const icons: Record<string, { icon: string; bg: string; text: string }> = {
      approval: { icon: 'ri-checkbox-circle-line', bg: 'bg-emerald-50', text: 'text-emerald-600' },
      review: { icon: 'ri-file-search-line', bg: 'bg-sky-50', text: 'text-sky-600' },
      action: { icon: 'ri-flashlight-line', bg: 'bg-amber-50', text: 'text-amber-600' },
      info: { icon: 'ri-information-line', bg: 'bg-slate-100', text: 'text-slate-500' },
    };
    return icons[type] || icons.info;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      approval: 'Approval',
      review: 'Review',
      action: 'Action Required',
      info: 'For Information',
    };
    return labels[type] || type;
  };

  const getSlaColor = (remaining: number | null, isOverdue: boolean) => {
    if (isOverdue) return 'text-red-600 bg-red-50';
    if (remaining === null) return 'text-slate-400 bg-slate-50';
    if (remaining <= 8) return 'text-red-600 bg-red-50';
    if (remaining <= 24) return 'text-amber-600 bg-amber-50';
    return 'text-emerald-600 bg-emerald-50';
  };

  const getSlaText = (remaining: number | null, isOverdue: boolean) => {
    if (isOverdue) return 'Overdue';
    if (remaining === null) return 'No SLA';
    if (remaining <= 0) return 'Due now';
    if (remaining < 24) return `${remaining}h left`;
    return `${Math.ceil(remaining / 24)}d left`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const typeStyle = getTypeIcon(task.type);
  const slaColor = getSlaColor(task.slaRemaining, task.isOverdue);

  return (
    <div
      className={`bg-white rounded-lg border transition-all duration-200 ${
        task.isOverdue
          ? 'border-red-200 shadow-sm shadow-red-50'
          : task.status === 'completed'
          ? 'border-gray-100 opacity-75'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg ${typeStyle.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
            <i className={`${typeStyle.icon} ${typeStyle.text} text-lg`}></i>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeStyle.bg} ${typeStyle.text} whitespace-nowrap`}>
                    {getTypeLabel(task.type)}
                  </span>
                  <PriorityBadge priority={task.priority} size="sm" />
                  {task.isOverdue && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 whitespace-nowrap flex items-center gap-1">
                      <i className="ri-alarm-warning-line text-xs"></i>
                      Overdue
                    </span>
                  )}
                  {task.status === 'completed' && (
                    <StatusBadge status="approved" size="sm" />
                  )}
                  {task.status === 'in_progress' && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 whitespace-nowrap">
                      In Progress
                    </span>
                  )}
                </div>
                <h3 className={`text-sm font-semibold ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'} leading-snug`}>
                  {task.title}
                </h3>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {task.amount && (
                  <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
                    {'\u20B9'}{Number(task.amount || 0).toLocaleString('en-IN')}
                  </span>
                )}
                {task.slaRemaining !== null && (
                  <span className={`text-xs font-semibold px-2 py-1 rounded-md whitespace-nowrap ${slaColor}`}>
                    {getSlaText(task.slaRemaining, task.isOverdue)}
                  </span>
                )}
                <i className={`ri-arrow-${isExpanded ? 'up' : 'down'}-s-line text-gray-400 text-lg`}></i>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <i className="ri-user-line"></i>
                {task.assignedBy}
              </span>
              <span className="flex items-center gap-1">
                <i className="ri-building-line"></i>
                {task.department}
              </span>
              {task.relatedDoc && (
                <span className="flex items-center gap-1">
                  <i className="ri-file-text-line"></i>
                  {task.relatedDoc}
                </span>
              )}
              <span className="flex items-center gap-1">
                <i className="ri-calendar-line"></i>
                {formatDate(task.createdDate)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <p className="text-sm text-gray-600 leading-relaxed mb-4">{task.description}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {task.relatedDocType && (
              <div className="bg-gray-50 rounded-md p-2.5">
                <p className="text-xs text-gray-500 mb-0.5">Document Type</p>
                <p className="text-sm font-medium text-gray-900">{task.relatedDocType}</p>
              </div>
            )}
            <div className="bg-gray-50 rounded-md p-2.5">
              <p className="text-xs text-gray-500 mb-0.5">Assigned By</p>
              <p className="text-sm font-medium text-gray-900">{task.assignedBy}</p>
              <p className="text-xs text-gray-500">{task.assignedByRole}</p>
            </div>
            {task.dueDate && (
              <div className="bg-gray-50 rounded-md p-2.5">
                <p className="text-xs text-gray-500 mb-0.5">Due Date</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(task.dueDate)}</p>
                <p className="text-xs text-gray-500">{formatTime(task.dueDate)}</p>
              </div>
            )}
            {task.slaHours && (
              <div className="bg-gray-50 rounded-md p-2.5">
                <p className="text-xs text-gray-500 mb-0.5">SLA</p>
                <p className="text-sm font-medium text-gray-900">{task.slaHours}h total</p>
                <p className={`text-xs font-medium ${task.isOverdue ? 'text-red-600' : task.slaRemaining && task.slaRemaining <= 8 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {getSlaText(task.slaRemaining, task.isOverdue)}
                </p>
              </div>
            )}
          </div>

          {task.status !== 'completed' && (
            <div className="flex items-center gap-2 relative">
              {task.type === 'approval' && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onAction(task.id, 'approve'); }}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <i className="ri-check-line"></i> Approve
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onAction(task.id, 'reject'); }}
                    className="px-4 py-2 bg-white text-red-600 text-sm font-medium rounded-md border border-red-200 hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <i className="ri-close-line"></i> Reject
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onAction(task.id, 'sendback'); }}
                    className="px-4 py-2 bg-white text-amber-600 text-sm font-medium rounded-md border border-amber-200 hover:bg-amber-50 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <i className="ri-arrow-go-back-line"></i> Send Back
                  </button>
                </>
              )}
              {task.type === 'review' && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onAction(task.id, 'complete_review'); }}
                    className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-md hover:bg-sky-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <i className="ri-check-double-line"></i> Complete Review
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onAction(task.id, 'request_info'); }}
                    className="px-4 py-2 bg-white text-sky-600 text-sm font-medium rounded-md border border-sky-200 hover:bg-sky-50 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <i className="ri-question-line"></i> Request Info
                  </button>
                </>
              )}
              {task.type === 'action' && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onAction(task.id, 'mark_done'); }}
                    className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <i className="ri-check-line"></i> Mark Complete
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onAction(task.id, 'delegate'); }}
                    className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-md border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <i className="ri-user-shared-line"></i> Delegate
                  </button>
                </>
              )}
              {task.type === 'info' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAction(task.id, 'acknowledge'); }}
                  className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                >
                  <i className="ri-check-line"></i> Acknowledge
                </button>
              )}

              <div className="relative ml-auto">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                >
                  <i className="ri-more-2-fill"></i>
                </button>
                {showActions && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)}></div>
                    <div className="absolute right-0 bottom-full mb-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      <button
                        onClick={(e) => { e.stopPropagation(); onAction(task.id, 'view_doc'); setShowActions(false); }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                      >
                        <i className="ri-external-link-line"></i> View Document
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onAction(task.id, 'add_comment'); setShowActions(false); }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                      >
                        <i className="ri-chat-3-line"></i> Add Comment
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onAction(task.id, 'reassign'); setShowActions(false); }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                      >
                        <i className="ri-user-shared-line"></i> Reassign
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
