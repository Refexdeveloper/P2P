import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StatusBadge from '../../../../components/base/StatusBadge';
import PriorityBadge from '../../../../components/base/PriorityBadge';
import { prApi } from '../../../../services/api';
import { useAuth } from '../../../../contexts/AuthContext';
import PrVendorQuotationsPanel from '../../../../components/feature/PrVendorQuotationsPanel';
import { collapsePrAdminEditHistory } from '../../../../components/feature/ApprovalHistoryPanel';
import { formatPersonRoleSuffix } from '../../../../utils/roleDisplay';

const ADMIN_EDIT_ROLES = [
  'Super Admin',
  'SCM Manager',
  'SCM Buyer',
  'HOD Approver',
  'PR Manager',
  'CFO',
];

const REQUESTER_EDITABLE_STATUSES = new Set([
  'DRAFT',
  'RETURNED',
  'PENDING_HOD_APPROVAL',
  'PENDING_PR_MANAGER_APPROVAL',
  'PENDING_CFO_APPROVAL',
]);

function canRequesterEditPr(pr: { status?: string; statusFrontend?: string } | null) {
  if (!pr) return false;
  const raw = String(pr.status || '').toUpperCase();
  const front = String(pr.statusFrontend || pr.status || '').toLowerCase();
  return REQUESTER_EDITABLE_STATUSES.has(raw) || front === 'draft' || front === 'returned';
}

interface LineItem {
  id?: number;
  description: string;
  category: string;
  quantity: number;
  unitCost: number;
  total: number;
}

interface ApprovalHistoryItem {
  stage: string;
  user: string;
  role: string;
  date: string;
  status: string;
  remarks: string;
}

export interface PRDetail {
  id: number;
  prNumber: string;
  title: string;
  requestType: string;
  requestCategory?: string;
  projectDetail?: string;
  specialNotes?: string;
  department: string;
  entityId?: number | null;
  entityName?: string;
  entityCode?: string;
  entityCostCenter?: string;
  priority: string;
  justification: string;
  billingLocation?: string;
  billingGstNo?: string;
  billingAddress?: string;
  deliveryPoc?: string;
  deliveryPocEmail?: string;
  deliveryPocPhone?: string;
  projectManagerHo?: string;
  projectManagerContact?: string;
  projectManagerEmail?: string;
  placeOfDelivery?: string;
  expectedDeliveryTimeline?: string;
  paymentTerms?: string;
  requiredDate: string;
  totalAmount: number;
  status: string;
  statusFrontend: string;
  statusUI?: string;
  submittedDate: string;
  lineItems: LineItem[];
  approvalHistory: ApprovalHistoryItem[];
  attachments?: { id: number; fileName: string; size: number }[];
  poId?: number | null;
  poNumber?: string;
  poDocumentAvailable?: boolean;
}

interface PRDetailDrawerProps {
  pr: PRDetail | null;
  loading: boolean;
  onClose: () => void;
  onDeleteDraft?: (prId: number) => Promise<void>;
  deletingDraft?: boolean;
}

export default function PRDetailDrawer({
  pr,
  loading,
  onClose,
  onDeleteDraft,
  deletingDraft = false,
}: PRDetailDrawerProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'details' | 'items' | 'quotes' | 'history'>('details');
  const [hasQuotes, setHasQuotes] = useState(false);

  useEffect(() => {
    setActiveTab('details');
    setHasQuotes(false);
  }, [pr?.id]);

  if (!pr && !loading) return null;

  const isAdminEditor = Boolean(user?.role && ADMIN_EDIT_ROLES.includes(user.role));
  const canEdit = Boolean(pr && (isAdminEditor || canRequesterEditPr(pr)));
  const isReturned =
    pr?.status === 'RETURNED' ||
    pr?.statusFrontend === 'returned' ||
    String(pr?.statusUI || '').toLowerCase().includes('return');
  const isDraft = pr?.status === 'DRAFT' || pr?.statusFrontend === 'draft';

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {pr && (
                <>
                  <p className="text-[11px] font-bold tracking-wide text-gray-500 break-all">
                    {pr.prNumber}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={pr.statusUI || pr.statusFrontend} size="sm" />
                    <PriorityBadge priority={pr.priority} size="sm" />
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-gray-900 leading-snug break-words">
                    {pr.title}
                  </h3>
                </>
              )}
              {loading && <p className="text-sm text-gray-500">Loading PR details...</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {isDraft && user?.role === 'Requester' && onDeleteDraft && pr && (
                <button
                  type="button"
                  disabled={deletingDraft}
                  onClick={() => void onDeleteDraft(pr.id)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
                  title={deletingDraft ? 'Deleting…' : 'Delete draft'}
                >
                  <i className="ri-delete-bin-line"></i>
                  <span className="hidden sm:inline">{deletingDraft ? 'Deleting…' : 'Delete draft'}</span>
                </button>
              )}
              {canEdit && pr && (
                <Link
                  to={`/requester/edit-pr/${pr.id}`}
                  onClick={onClose}
                  className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-lg bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
                >
                  <i className="ri-edit-line"></i>
                  {isReturned ? 'Edit & Resubmit' : 'Edit PR'}
                </Link>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <i className="ri-close-line text-lg text-gray-500"></i>
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
        {pr && (
          <>
            {isReturned && (
              <div className="mx-4 mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2 sm:mx-6">
                <i className="ri-arrow-go-back-line text-orange-600 text-lg mt-0.5"></i>
                <div>
                  <p className="text-sm font-semibold text-orange-800">Returned for Rework</p>
                  <p className="text-xs text-orange-700 mt-0.5">
                    Review the feedback in approval history, update if needed, then resubmit.
                  </p>
                </div>
              </div>
            )}

            <div className="chip-scroll-fade border-b border-gray-100 px-4 pt-3 sm:px-6">
              <div className="chip-scroll gap-1 pb-0">
                {(['details', 'items', 'quotes', 'history'] as const)
                  .filter((tab) => tab !== 'quotes' || hasQuotes)
                  .map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab
                        ? 'border-gray-900 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'items'
                      ? `Line Items (${pr.lineItems.length})`
                      : tab === 'history'
                        ? 'History'
                        : tab === 'quotes'
                          ? 'Quotations'
                          : 'Details'}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 py-5 space-y-5 sm:px-6">
              {activeTab === 'details' && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="bg-gray-50 rounded-lg p-3 sm:col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Entity</p>
                      <p className="text-sm font-medium text-gray-900 break-words">
                        {pr.entityName || '—'}
                        {pr.entityCode ? (
                          <span className="text-gray-500 font-normal"> ({pr.entityCode})</span>
                        ) : null}
                      </p>
                      {pr.entityCostCenter ? (
                        <p className="text-xs text-gray-500 mt-1">Cost Center: {pr.entityCostCenter}</p>
                      ) : null}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Department</p>
                      <p className="text-sm font-medium text-gray-900 break-words">{pr.department}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Request Type</p>
                      <p className="text-sm font-medium text-gray-900">{pr.requestType}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Request Category</p>
                      <p className="text-sm font-medium text-gray-900">{pr.requestCategory || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 sm:col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Project Detail</p>
                      <p className="text-sm font-medium text-gray-900 break-words">{pr.projectDetail || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Required Date</p>
                      <p className="text-sm font-medium text-gray-900">{pr.requiredDate || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Expected Delivery Timeline</p>
                      <p className="text-sm font-medium text-gray-900 break-words">{pr.expectedDeliveryTimeline || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Payment Terms</p>
                      <p className="text-sm font-medium text-gray-900 break-words">{pr.paymentTerms || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Total Amount</p>
                      <p className="text-sm font-bold text-gray-900">₹{pr.totalAmount.toLocaleString('en-IN')}</p>
                    </div>
                    {pr.poDocumentAvailable && pr.poId ? (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 sm:col-span-2">
                        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-indigo-900">Purchase Order</p>
                            <p className="text-xs text-indigo-700 mt-0.5 break-words">
                              {pr.poNumber || `PO #${pr.poId}`}
                              {pr.statusUI ? ` · ${pr.statusUI}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigate(`/requester/po-document?poId=${pr.poId}`)}
                            className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                          >
                            <i className="ri-file-pdf-2-line" />
                            View PO Document
                          </button>
                        </div>
                      </div>
                    ) : pr.poId ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 sm:col-span-2">
                        <p className="text-sm font-semibold text-slate-800">Purchase Order</p>
                        <p className="text-xs text-slate-600 mt-0.5 break-words">
                          {pr.poNumber || `PO #${pr.poId}`}
                          {pr.statusUI ? ` · ${pr.statusUI}` : ''}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          PO document will be available after SCM Buyer final verification.
                        </p>
                      </div>
                    ) : null}
                    <div className="bg-gray-50 rounded-lg p-3 sm:col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Billing Region / GST</p>
                      <p className="text-sm font-medium text-gray-900 break-words">
                        {pr.billingLocation || '—'}
                        {pr.billingGstNo ? (
                          <span className="block text-xs font-mono text-gray-600 mt-0.5">{pr.billingGstNo}</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 sm:col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Billing Address</p>
                      <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap break-words">{pr.billingAddress || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">POC for Delivery</p>
                      <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap break-words">
                        {pr.deliveryPoc || '—'}
                        {pr.deliveryPocEmail || pr.deliveryPocPhone ? (
                          <span className="block text-xs text-gray-500 mt-0.5">
                            {[pr.deliveryPocPhone, pr.deliveryPocEmail].filter(Boolean).join(' · ')}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Project Manager at HO</p>
                      <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap break-words">
                        {pr.projectManagerHo || '—'}
                        {pr.projectManagerEmail || pr.projectManagerContact ? (
                          <span className="block text-xs text-gray-500 mt-0.5">
                            {[pr.projectManagerContact, pr.projectManagerEmail].filter(Boolean).join(' · ')}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Place of Delivery</p>
                      <p className="text-sm font-medium text-gray-900 break-words">{pr.placeOfDelivery || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 sm:col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Submitted Date</p>
                      <p className="text-sm font-medium text-gray-900">{pr.submittedDate || '—'}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Business Justification</h4>
                    <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 break-words">{pr.justification || '—'}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Special Notes</h4>
                    <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 whitespace-pre-wrap break-words">{pr.specialNotes || '—'}</p>
                  </div>
                  {pr.attachments && pr.attachments.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Attachments</h4>
                      <div className="space-y-2">
                        {pr.attachments.map((file) => (
                          <button
                            key={file.id}
                            type="button"
                            onClick={() => prApi.downloadAttachment(pr.id, file.id, file.fileName)}
                            className="w-full flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left hover:bg-white cursor-pointer"
                          >
                            <i className="ri-attachment-2 text-slate-500" />
                            <span className="text-sm text-slate-800 truncate">{file.fileName}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {hasQuotes && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('quotes')}
                      className="w-full flex items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-left hover:bg-teal-100/70"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-teal-900">View vendor quotations</span>
                        <span className="block text-xs text-teal-700 mt-0.5">Prices, rounds, and quotation files on this PR</span>
                      </span>
                      <i className="ri-arrow-right-s-line text-teal-700 text-lg" />
                    </button>
                  )}
                </>
              )}

              {pr.id ? (
                <div className={activeTab === 'quotes' ? '' : 'hidden'}>
                  <PrVendorQuotationsPanel prId={pr.id} onPresenceChange={setHasQuotes} />
                </div>
              ) : null}

              {activeTab === 'items' && (
                <>
                  {/* Mobile cards */}
                  <div className="space-y-3 md:hidden">
                    {pr.lineItems.map((item, i) => (
                      <div
                        key={item.id ?? `line-card-${i}`}
                        className="rounded-xl border border-gray-200 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0">
                            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-slate-100 px-1.5 text-[11px] font-bold text-slate-600">
                              #{i + 1}
                            </span>
                            <p className="mt-1.5 text-sm font-semibold text-gray-900 break-words">
                              {item.description}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{item.category || '—'}</p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-gray-900">
                            ₹{item.total.toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Qty</p>
                            <p className="text-sm text-gray-800 mt-0.5">{item.quantity}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Unit</p>
                            <p className="text-sm text-gray-800 mt-0.5">₹{item.unitCost.toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">Total</p>
                      <p className="text-sm font-bold text-gray-900">₹{pr.totalAmount.toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">#</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Description</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Qty</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Unit</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {pr.lineItems.map((item, i) => (
                          <tr key={item.id ?? `line-${i}`}>
                            <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-900">{item.description}</p>
                              <p className="text-xs text-gray-400">{item.category}</p>
                            </td>
                            <td className="px-3 py-2 text-right">{item.quantity}</td>
                            <td className="px-3 py-2 text-right">₹{item.unitCost.toLocaleString('en-IN')}</td>
                            <td className="px-3 py-2 text-right font-semibold">₹{item.total.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={4} className="px-3 py-2 text-right text-sm font-semibold text-gray-700">Total</td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">
                            ₹{pr.totalAmount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4">
                  {pr.approvalHistory.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-6">No approval history yet</p>
                  ) : (
                    collapsePrAdminEditHistory(
                      pr.approvalHistory.map((item) => ({
                        stage: item.stage,
                        user: item.user,
                        role: item.role,
                        date: item.date,
                        status: item.status,
                        remarks: item.remarks,
                      }))
                    ).map((item, index) => (
                      <div key={index} className="flex gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            item.status === 'Completed' || item.status === 'Approved' || item.status === 'Approve'
                              ? 'bg-emerald-100 text-emerald-600'
                              : item.status === 'Rejected' || item.status === 'Reject'
                              ? 'bg-red-100 text-red-600'
                              : item.status === 'Returned' || item.status?.toLowerCase().includes('return')
                              ? 'bg-orange-100 text-orange-600'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <i
                            className={`text-sm ${
                              item.status === 'Rejected' || item.status === 'Reject'
                                ? 'ri-close-circle-fill'
                                : item.status === 'Returned'
                                ? 'ri-arrow-go-back-fill'
                                : 'ri-checkbox-circle-fill'
                            }`}
                          ></i>
                        </div>
                        <div className="flex-1 pb-4 border-b border-gray-100 last:border-0 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 break-words">{item.stage}</p>
                              <p className="text-xs text-gray-500 break-words">
                                {item.user}
                                {formatPersonRoleSuffix(item.role, item.user)}
                              </p>
                            </div>
                            <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{item.date}</span>
                          </div>
                          {item.remarks && (
                            <p className="text-sm text-gray-700 mt-2 bg-gray-50 rounded-lg p-2 border border-gray-100 break-words">
                              {item.remarks}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
        </div>

        {canEdit && pr && (
          <div className="shrink-0 border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-4 flex justify-end gap-3 bg-white">
            <Link
              to={`/requester/edit-pr/${pr.id}`}
              onClick={onClose}
              className={`w-full sm:w-auto text-center px-5 py-2.5 text-white text-sm font-medium rounded-lg transition-colors ${
                isReturned ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-900 hover:bg-gray-800'
              }`}
            >
              <i className={`${isReturned ? 'ri-edit-line' : isDraft ? 'ri-send-plane-fill' : 'ri-edit-line'} mr-1.5`}></i>
              {isReturned ? 'Edit & Resubmit' : isDraft ? 'Edit & Submit' : 'Edit PR'}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
