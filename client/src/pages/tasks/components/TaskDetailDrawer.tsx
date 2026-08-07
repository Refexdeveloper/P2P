import PriorityBadge from '../../../components/base/PriorityBadge';
import StatusBadge from '../../../components/base/StatusBadge';

interface LineItem {
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
  lineItems: LineItem[];
  approvalHistory: ApprovalStep[];
  slaHours: number;
  slaRemaining: number;
  isOverdue: boolean;
}

interface TaskDetailDrawerProps {
  task: PRTask;
  loading?: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export default function TaskDetailDrawer({
  task,
  loading = false,
  onClose,
  onApprove,
  onReject,
}: TaskDetailDrawerProps) {
  const isPending = task.status === 'pending_approval';
  const lineItems = Array.isArray(task.lineItems) ? task.lineItems : [];
  const approvalHistory = Array.isArray(task.approvalHistory) ? task.approvalHistory : [];

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr || '—';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr || '—';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white shadow-2xl overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-gray-500">{task.prNumber}</span>
                <StatusBadge status={task.status} size="sm" />
                <PriorityBadge priority={(task.priority || 'medium').toLowerCase()} size="sm" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{task.title}</h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-lg text-gray-500"></i>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center text-gray-500">
            <i className="ri-loader-4-line text-2xl animate-spin text-amber-600"></i>
            <p className="text-sm mt-3">Loading PR details…</p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-6">
            {/* Requester Info */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {task.requesterAvatar || 'R'}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{task.requester}</p>
                <p className="text-xs text-gray-500">
                  {task.requesterRole} &middot; {task.department || '—'}
                </p>
              </div>
            </div>

            {/* PR Details Grid */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                PR Details
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Entity</p>
                  <p className="text-sm font-medium text-gray-900">
                    {task.entityName || '—'}
                    {task.entityCode ? (
                      <span className="block text-xs text-gray-500 font-normal mt-0.5">{task.entityCode}</span>
                    ) : null}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Department</p>
                  <p className="text-sm font-medium text-gray-900">{task.department || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Category</p>
                  <p className="text-sm font-medium text-gray-900">{task.category || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Request Type</p>
                  <p className="text-sm font-medium text-gray-900">{task.requestType || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Required Date</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(task.requiredDate)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Total Amount</p>
                  <p className="text-sm font-bold text-gray-900">
                    ₹{Number(task.totalAmount || 0).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Current Stage</p>
                  <p className="text-sm font-medium text-gray-900">{task.currentApprover || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Submitted</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(task.submittedDate)}</p>
                </div>
              </div>
            </div>

            {/* Justification */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Business Justification
              </h4>
              <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3">
                {task.justification || 'No justification provided.'}
              </p>
            </div>

            {/* Line Items */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Line Items ({lineItems.length})
              </h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">#</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Description</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Qty</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Unit Cost</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-sm">
                          No line items
                        </td>
                      </tr>
                    ) : (
                      lineItems.map((item, idx) => (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{item.description}</td>
                          <td className="px-3 py-2 text-center text-gray-700">
                            {item.qty} {item.unit}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">
                            ₹{Number(item.unitCost || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">
                            ₹{Number(item.total || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td colSpan={4} className="px-3 py-2 text-right font-bold text-gray-700 uppercase text-xs">
                        Grand Total
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-gray-900">
                        ₹{Number(task.totalAmount || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Approval History */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Approval History
              </h4>
              {approvalHistory.length === 0 ? (
                <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-3">No approval history yet.</p>
              ) : (
                <div className="space-y-0">
                  {approvalHistory.map((step, idx) => {
                    const status = String(step.status || '').toLowerCase();
                    const done = status.includes('approv') || status.includes('complet') || status.includes('submit');
                    const rejected = status.includes('reject');
                    return (
                      <div key={idx} className="flex items-start gap-3 relative">
                        {idx < approvalHistory.length - 1 && (
                          <div className="absolute left-[11px] top-6 w-0.5 h-full bg-gray-200"></div>
                        )}
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            done ? 'bg-emerald-100' : rejected ? 'bg-red-100' : 'bg-gray-100'
                          }`}
                        >
                          <i
                            className={`text-xs ${
                              done
                                ? 'ri-check-line text-emerald-600'
                                : rejected
                                ? 'ri-close-line text-red-600'
                                : 'ri-time-line text-gray-400'
                            }`}
                          ></i>
                        </div>
                        <div className="pb-4 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">{step.step}</p>
                            <span className="text-xs text-gray-400">{formatDateTime(step.date)}</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {step.approver} &middot; {step.role}
                          </p>
                          {step.remarks && (
                            <p className="text-xs text-gray-600 mt-0.5 italic">
                              &ldquo;{step.remarks}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {isPending && !loading && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center gap-3">
            <button
              onClick={() => onApprove(task.id)}
              className="flex-1 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 shadow-sm"
            >
              <i className="ri-check-double-line"></i> Approve
            </button>
            <button
              onClick={() => onReject(task.id)}
              className="flex-1 px-5 py-2.5 bg-white text-red-600 text-sm font-semibold rounded-lg border border-red-300 hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
            >
              <i className="ri-close-circle-line"></i> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
