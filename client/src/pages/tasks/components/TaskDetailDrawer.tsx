import PriorityBadge from '../../../components/base/PriorityBadge';
import StatusBadge from '../../../components/base/StatusBadge';
import { formatDisplayDate, formatDisplayDateTime } from '../../../utils/formatDate';
import PrVendorQuotationsPanel from '../../../components/feature/PrVendorQuotationsPanel';
import { collapsePrAdminEditHistory } from '../../../components/feature/ApprovalHistoryPanel';
import { formatMoney } from '../../../constants/currency';
import { useEffect, useState } from 'react';

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
  requesterEmail?: string;
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
  isSassInvoiceUpload?: boolean;
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
  const [activeTab, setActiveTab] = useState<'details' | 'items' | 'quotes' | 'history'>('details');
  const isOwnVendor = task.vendorSelection === 'own';

  useEffect(() => {
    setActiveTab('details');
    setHasQuotes(false);
  }, [task.id]);

  const isSass =
    Boolean(task.isSass) ||
    ['sass', 'saas', 'cloud_subscription'].includes(
      String(task.purchaseType || '')
        .toLowerCase()
        .replace(/[\s-]+/g, '_')
    );
  const isOnlinePurchase = ['online_purchase', 'onlinepurchase', 'op'].includes(
    String(task.purchaseType || '')
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
  );
  const isInvoiceFlow = isSass || isOnlinePurchase;
  /** Own Vendor / quoted PRs: show name, description, qty — hide unit cost & total.
   *  Cloud Subscription keeps full line pricing + quotation files. */
  const hideLinePricing = !isInvoiceFlow && (isOwnVendor || hasQuotes);

  const formatDate = (dateStr: string) => formatDisplayDate(dateStr);
  const formatDateTime = (dateStr: string) => formatDisplayDateTime(dateStr);

  const showQuotesTab = Boolean(task.prId) && (isSass || hasQuotes);
  const showItemsTab = isInvoiceFlow || !hasQuotes;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div
          className={`shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4 z-10 ${
            isInvoiceFlow ? 'bg-teal-50 border-teal-200' : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold tracking-wide text-gray-500 break-all">
                {task.prNumber}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {isOnlinePurchase && (
                  <span className="px-2 py-0.5 bg-sky-700 text-white text-[10px] font-bold rounded tracking-wide">
                    ONLINE PURCHASE
                  </span>
                )}
                {isSass && !isOnlinePurchase && (
                  <span className="px-2 py-0.5 bg-teal-600 text-white text-[10px] font-bold rounded tracking-wide">
                    CLOUD SUBSCRIPTION
                  </span>
                )}
                <StatusBadge status={task.status} size="sm" />
                <PriorityBadge priority={(task.priority || 'medium').toLowerCase()} size="sm" />
              </div>
              <h3 className="mt-2 text-base font-semibold text-gray-900 leading-snug break-words">
                {task.title}
              </h3>
              {isOnlinePurchase && (
                <p className="text-xs text-sky-900 mt-1.5 font-medium break-words">
                  Online Purchase path: User Approval → Mugesh L1 → Srivaths L2 → Mugesh Invoice Upload →
                  Completed (SCM skipped)
                </p>
              )}
              {isSass && !isOnlinePurchase && (
                <p className="text-xs text-teal-800 mt-1.5 font-medium break-words">
                  {String(task.requesterEmail || task.requester || '')
                    .toLowerCase()
                    .includes('mugesh')
                    ? 'Cloud Subscription path: L1 → Mugesh Invoice Upload → Accounts (Mugesh self-approval & Srivaths L2 skipped; SCM skipped)'
                    : 'Cloud Subscription path: L1 → Mugesh → Srivaths (L2; skipped if L1 was Srivaths) → Mugesh Invoice → Accounts (SCM skipped)'}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              aria-label="Close"
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
          <>
            <div className="chip-scroll-fade shrink-0 border-b border-gray-100 px-4 pt-3 sm:px-6">
              <div className="chip-scroll gap-1 pb-0">
                {(
                  [
                    { id: 'details' as const, label: 'Details' },
                    ...(showItemsTab
                      ? [{ id: 'items' as const, label: `Line Items (${lineItems.length})` }]
                      : []),
                    ...(showQuotesTab ? [{ id: 'quotes' as const, label: 'Quotations' }] : []),
                    { id: 'history' as const, label: 'History' },
                  ]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-gray-900 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 space-y-5 sm:px-6">
              {activeTab === 'details' && (
                <>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {task.requesterAvatar || 'R'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 break-words">{task.requester}</p>
                      <p className="text-xs text-gray-500 break-words">
                        {task.requesterRole} &middot; {task.department || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="bg-gray-50 rounded-xl p-3 sm:col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Entity</p>
                      <p className="text-sm font-medium text-gray-900 break-words">
                        {task.entityName || '—'}
                        {task.entityCode ? (
                          <span className="text-gray-500 font-normal"> ({task.entityCode})</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Department</p>
                      <p className="text-sm font-medium text-gray-900 break-words">{task.department || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Request Type</p>
                      <p className="text-sm font-medium text-gray-900">{task.requestType || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Category</p>
                      <p className="text-sm font-medium text-gray-900 break-words">{task.category || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Required Date</p>
                      <p className="text-sm font-medium text-gray-900">{formatDate(task.requiredDate)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
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
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Current Stage</p>
                      <p className="text-sm font-medium text-gray-900 break-words">{task.currentApprover || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 sm:col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Submitted</p>
                      <p className="text-sm font-medium text-gray-900">{formatDate(task.submittedDate)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Location</p>
                      <p className="text-sm font-medium text-gray-900 break-words">{task.billingLocation || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-0.5">GSTIN</p>
                      <p className="text-sm font-medium text-gray-900 font-mono tracking-wide break-all">
                        {task.billingGstNo || '—'}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 sm:col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Billing Address</p>
                      <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap break-words">
                        {task.billingAddress || '—'}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 sm:col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Site / Delivery Address</p>
                      <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap break-words">
                        {task.placeOfDelivery || '—'}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 sm:col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">POC for Delivery</p>
                      <p className="text-sm font-medium text-gray-900 break-words">{task.deliveryPoc || '—'}</p>
                    </div>
                  </div>

                  <div className="rounded-xl overflow-hidden border-2 border-amber-300 bg-amber-50 ring-2 ring-amber-200/50">
                    <div className="px-3.5 py-2.5 bg-amber-100 border-b border-amber-300 flex items-center gap-2">
                      <i className="ri-lightbulb-flash-line text-amber-700" aria-hidden />
                      <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-wide">
                        Business Justification
                      </h4>
                    </div>
                    <p className="px-3.5 py-3 text-sm text-amber-950 leading-relaxed whitespace-pre-wrap font-medium break-words">
                      {task.justification || 'No business justification provided.'}
                    </p>
                  </div>

                  {showQuotesTab && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('quotes')}
                      className="w-full flex items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-left hover:bg-teal-100/70"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-teal-900">View vendor quotations</span>
                        <span className="block text-xs text-teal-700 mt-0.5">
                          Prices, rounds, and quotation files on this PR
                        </span>
                      </span>
                      <i className="ri-arrow-right-s-line text-teal-700 text-lg" />
                    </button>
                  )}
                </>
              )}

              {task.prId ? (
                <div className={activeTab === 'quotes' ? '' : 'hidden'}>
                  <PrVendorQuotationsPanel
                    prId={task.prId}
                    currency={task.currency}
                    onPresenceChange={setHasQuotes}
                  />
                </div>
              ) : null}

              {activeTab === 'items' && showItemsTab && (
                <>
                  <div className="space-y-3 md:hidden">
                    {lineItems.length === 0 ? (
                      <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-4 text-center">No line items</p>
                    ) : (
                      lineItems.map((item, idx) => {
                        const name = String(item.itemName || item.description || '—').trim() || '—';
                        const desc = String(item.description || '').trim();
                        const showDesc = desc && desc !== name;
                        return (
                          <div
                            key={idx}
                            className="rounded-xl border border-gray-200 bg-white p-4"
                          >
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="min-w-0">
                                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-slate-100 px-1.5 text-[11px] font-bold text-slate-600">
                                  #{idx + 1}
                                </span>
                                <p className="mt-1.5 text-sm font-semibold text-gray-900 break-words">{name}</p>
                                {showDesc ? (
                                  <p className="text-xs text-gray-400 mt-0.5 break-words">{desc}</p>
                                ) : null}
                              </div>
                              {!hideLinePricing && (
                                <p className="shrink-0 text-sm font-bold text-gray-900">
                                  {formatMoney(Number(item.total || 0), task.currency, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </p>
                              )}
                            </div>
                            <div className={`grid gap-3 ${hideLinePricing ? 'grid-cols-1' : 'grid-cols-2'}`}>
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Qty</p>
                                <p className="text-sm text-gray-800 mt-0.5">
                                  {Number(item.qty) || 0}
                                  {item.unit && !/^\d+(\.\d+)?$/.test(String(item.unit).trim()) ? (
                                    <span className="text-xs text-gray-400 ml-1">{item.unit}</span>
                                  ) : null}
                                </p>
                              </div>
                              {!hideLinePricing && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                    Unit Cost
                                  </p>
                                  <p className="text-sm text-gray-800 mt-0.5">
                                    {formatMoney(Number(item.unitCost || 0), task.currency, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    {!hideLinePricing && lineItems.length > 0 && (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-700">Grand Total</p>
                        <p className="text-sm font-bold text-gray-900">
                          {formatMoney(Number(task.totalAmount || 0), task.currency, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="hidden md:block border border-gray-200 rounded-lg overflow-hidden">
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
                        {lineItems.length === 0 ? (
                          <tr>
                            <td
                              colSpan={hideLinePricing ? 4 : 6}
                              className="px-3 py-6 text-center text-gray-400 text-sm"
                            >
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
                </>
              )}

              {activeTab === 'history' && (
                <div>
                  {approvalHistory.length === 0 ? (
                    <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-3">No approval history yet.</p>
                  ) : (
                    <div className="space-y-0">
                      {approvalHistory.map((step, idx) => {
                        const stepStatus = String(step.status || '').toLowerCase();
                        const done =
                          stepStatus.includes('approv') ||
                          stepStatus.includes('complet') ||
                          stepStatus.includes('submit');
                        const rejected = stepStatus.includes('reject');
                        const returned = stepStatus.includes('return') || stepStatus.includes('rework');
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
                            <div className="pb-4 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-gray-900 break-words">
                                  {step.stage || step.step}
                                </p>
                                <span className="text-xs text-gray-400">{formatDateTime(step.date)}</span>
                              </div>
                              <p className="text-xs text-gray-500 break-words">{step.approver}</p>
                              {step.remarks && (
                                <p className="text-xs text-gray-600 mt-0.5 italic break-words">
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
              )}
            </div>
          </>
        )}

        {/* Footer — pinned so L1/L2 always see Approve / Send Back / Reject */}
        {showActions && (
          <div className="shrink-0 bg-white border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => onApprove(task.id)}
              className={`flex-1 px-4 py-2.5 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 ${
                task.requireInvoiceUpload || task.isSassInvoiceUpload
                  ? 'bg-teal-600 hover:bg-teal-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <i
                className={
                  task.requireInvoiceUpload || task.isSassInvoiceUpload
                    ? 'ri-file-upload-line'
                    : 'ri-check-double-line'
                }
              ></i>
              {task.isSassInvoiceUpload || task.requireInvoiceUpload ? 'Upload Invoice' : 'Approve'}
            </button>
            {!task.isSassInvoiceUpload && (
              <div className="flex gap-2 sm:contents">
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
        )}
      </div>
    </div>
  );
}
