import PriorityBadge from '../../../components/base/PriorityBadge';
import StatusBadge from '../../../components/base/StatusBadge';
import { formatDisplayDate, formatDisplayDateTime } from '../../../utils/formatDate';
import PrVendorQuotationsPanel from '../../../components/feature/PrVendorQuotationsPanel';
import { collapsePrAdminEditHistory } from '../../../components/feature/ApprovalHistoryPanel';
import { formatMoney } from '../../../constants/currency';
import { useState } from 'react';

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
  prId?: number;
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
  purchaseType?: string;
  isSass?: boolean;
  requireInvoiceUpload?: boolean;
  billingLocation?: string;
  billingGstNo?: string;
  billingAddress?: string;
  placeOfDelivery?: string;
  deliveryPoc?: string;
  lineItems: LineItem[];
  approvalHistory: ApprovalStep[];
  slaHours: number;
  slaRemaining: number;
  isOverdue: boolean;
}

interface TaskDetailDrawerProps {
  task: PRTask;
  loading?: boolean;
  /** When set, controls Approve / Send Back / Reject independently of PR/task status labels. */
  canAct?: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onReturn: (id: string) => void;
}

const CLOSED_STATUSES = new Set(['approved', 'rejected', 'returned']);

function canShowActions(status: string, canAct?: boolean) {
  if (typeof canAct === 'boolean') return canAct;
  const s = String(status || '').toLowerCase();
  if (CLOSED_STATUSES.has(s)) return false;
  if (s === 'pending_approval' || s === 'pending') return true;
  if (s.includes('pending')) return true;
  // Unknown labels (e.g. PENDING_HOD_APPROVAL, "Completed" stage leak) — still allow L1/L2 actions
  return !CLOSED_STATUSES.has(s);
}

export default function TaskDetailDrawer({
  task,
  loading = false,
  canAct,
  onClose,
  onApprove,
  onReject,
  onReturn,
}: TaskDetailDrawerProps) {
  const status = String(task.status || '').toLowerCase();
  const showActions = canShowActions(status, canAct);
  const lineItems = Array.isArray(task.lineItems) ? task.lineItems : [];
  const approvalHistory = collapsePrAdminEditHistory(
    (Array.isArray(task.approvalHistory) ? task.approvalHistory : []).map((step) => ({
      stage: step.step,
      step: step.step,
      approver: step.approver,
      role: step.role,
      date: step.date,
      status: step.status,
      remarks: step.remarks,
    }))
  );
  const [hasQuotes, setHasQuotes] = useState(false);
  const isOwnVendor = task.vendorSelection === 'own';
  const isSass =
    Boolean(task.isSass) ||
    ['sass', 'saas', 'cloud_subscription'].includes(
      String(task.purchaseType || '')
        .toLowerCase()
        .replace(/[\s-]+/g, '_')
    );
  /** Own Vendor / quoted PRs: show name, description, qty — hide unit cost & total.
   *  Cloud Subscription keeps full line pricing + quotation files. */
  const hideLinePricing = !isSass && (isOwnVendor || hasQuotes);

  const formatDate = (dateStr: string) => formatDisplayDate(dateStr);

  const formatDateTime = (dateStr: string) => formatDisplayDateTime(dateStr);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className={`shrink-0 border-b px-6 py-4 z-10 ${isSass ? 'bg-teal-50 border-teal-200' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-bold text-gray-500">{task.prNumber}</span>
                {isSass && (
                  <span className="px-2 py-0.5 bg-teal-600 text-white text-[10px] font-bold rounded tracking-wide">
                    CLOUD SUBSCRIPTION REQUEST
                  </span>
                )}
                <StatusBadge status={task.status} size="sm" />
                <PriorityBadge priority={(task.priority || 'medium').toLowerCase()} size="sm" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{task.title}</h3>
              {isSass && (
                <p className="text-xs text-teal-800 mt-1 font-medium">
                  Cloud Subscription path: L1 → Srivaths → Mugesh (approve + invoice) → Accounts (SCM
                  skipped)
                </p>
              )}
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
          <div className="flex-1 px-6 py-16 text-center text-gray-500 overflow-y-auto">
            <i className="ri-loader-4-line text-2xl animate-spin text-amber-600"></i>
            <p className="text-sm mt-3">Loading PR details…</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
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
                  <p className="text-xs text-gray-500 mb-0.5">{hideLinePricing ? 'Vendor Path' : 'Total Amount'}</p>
                  <p className="text-sm font-bold text-gray-900">
                    {hideLinePricing
                      ? 'Own Vendor'
                      : formatMoney(Number(task.totalAmount || 0), task.currency, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
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

            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Location, GSTIN &amp; Delivery
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Location</p>
                  <p className="text-sm font-medium text-gray-900">{task.billingLocation || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">GSTIN</p>
                  <p className="text-sm font-medium text-gray-900 font-mono tracking-wide">
                    {task.billingGstNo || '—'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                  <p className="text-xs text-gray-500 mb-0.5">Billing Address</p>
                  <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                    {task.billingAddress || '—'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                  <p className="text-xs text-gray-500 mb-0.5">Site / Delivery Address</p>
                  <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                    {task.placeOfDelivery || '—'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                  <p className="text-xs text-gray-500 mb-0.5">POC for Delivery</p>
                  <p className="text-sm font-medium text-gray-900">{task.deliveryPoc || '—'}</p>
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

            {task.prId ? (
              <div className={isSass || hasQuotes ? '' : 'hidden'}>
                <PrVendorQuotationsPanel
                  prId={task.prId}
                  currency={task.currency}
                  onPresenceChange={setHasQuotes}
                />
              </div>
            ) : null}

            {/* PR line items — Cloud Subscription always shows full lines; others hide when quotes exist */}
            {(isSass || !hasQuotes) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Line Items ({lineItems.length})
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
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Qty</th>
                      {!hideLinePricing && (
                        <>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Unit Cost</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Total</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.length === 0 ? (
                      <tr>
                        <td colSpan={hideLinePricing ? 4 : 6} className="px-3 py-6 text-center text-gray-400 text-sm">
                          No line items
                        </td>
                      </tr>
                    ) : (
                      lineItems.map((item, idx) => {
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
                            {!hideLinePricing && (
                              <>
                                <td className="px-3 py-2 text-right text-gray-700">
                                  {formatMoney(Number(item.unitCost || 0), task.currency, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                  {formatMoney(Number(item.total || 0), task.currency, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {!hideLinePricing && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td colSpan={5} className="px-3 py-2 text-right font-bold text-gray-700 uppercase text-xs">
                          Grand Total
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-gray-900">
                          {formatMoney(Number(task.totalAmount || 0), task.currency, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
            )}

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
                    const done =
                      status.includes('approv') ||
                      status.includes('complet') ||
                      status.includes('submit');
                    const rejected = status.includes('reject');
                    const returned = status.includes('return') || status.includes('rework');
                    return (
                      <div key={`${step.stage}-${step.date}-${idx}`} className="flex items-start gap-3 relative">
                        {idx < approvalHistory.length - 1 && (
                          <div className="absolute left-[11px] top-6 w-0.5 h-full bg-gray-200"></div>
                        )}
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            done
                              ? 'bg-emerald-100'
                              : rejected
                                ? 'bg-red-100'
                                : returned
                                  ? 'bg-orange-100'
                                  : 'bg-gray-100'
                          }`}
                        >
                          <i
                            className={`text-xs ${
                              done
                                ? 'ri-check-line text-emerald-600'
                                : rejected
                                  ? 'ri-close-line text-red-600'
                                  : returned
                                    ? 'ri-arrow-go-back-line text-orange-600'
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
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer — pinned so L1/L2 always see Approve / Send Back / Reject */}
        {showActions && (
          <div className="shrink-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => onApprove(task.id)}
              className={`flex-1 px-4 py-2.5 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 ${
                task.requireInvoiceUpload
                  ? 'bg-teal-600 hover:bg-teal-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <i
                className={
                  task.requireInvoiceUpload ? 'ri-file-upload-line' : 'ri-check-double-line'
                }
              ></i>
              {task.requireInvoiceUpload ? 'Approve & Upload Invoice' : 'Approve'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => onReturn(task.id)}
              className="flex-1 px-4 py-2.5 bg-white text-orange-600 text-sm font-semibold rounded-lg border border-orange-300 hover:bg-orange-50 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <i className="ri-arrow-go-back-line"></i> Send Back
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => onReject(task.id)}
              className="flex-1 px-4 py-2.5 bg-white text-red-600 text-sm font-semibold rounded-lg border border-red-300 hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <i className="ri-close-circle-line"></i> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
