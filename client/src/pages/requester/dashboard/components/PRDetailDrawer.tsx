import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../../../components/base/StatusBadge';
import PriorityBadge from '../../../../components/base/PriorityBadge';
import { prApi } from '../../../../services/api';
import { useAuth } from '../../../../contexts/AuthContext';
import PrVendorQuotationsPanel from '../../../../components/feature/PrVendorQuotationsPanel';
import { collapsePrAdminEditHistory } from '../../../../components/feature/ApprovalHistoryPanel';

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
  placeOfDelivery?: string;
  expectedDeliveryTimeline?: string;
  paymentTerms?: string;
  requiredDate: string;
  totalAmount: number;
  status: string;
  statusFrontend: string;
  submittedDate: string;
  lineItems: LineItem[];
  approvalHistory: ApprovalHistoryItem[];
  attachments?: { id: number; fileName: string; size: number }[];
}

interface PRDetailDrawerProps {
  pr: PRDetail | null;
  loading: boolean;
  onClose: () => void;
}

export default function PRDetailDrawer({ pr, loading, onClose }: PRDetailDrawerProps) {
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
  const isReturned = pr?.status === 'RETURNED' || pr?.statusFrontend === 'returned';
  const isDraft = pr?.status === 'DRAFT' || pr?.statusFrontend === 'draft';

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              {pr && (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-500">{pr.prNumber}</span>
                    <StatusBadge status={pr.statusFrontend} size="sm" />
                    <PriorityBadge priority={pr.priority} size="sm" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">{pr.title}</h3>
                </>
              )}
              {loading && <p className="text-sm text-gray-500">Loading PR details...</p>}
            </div>
            <div className="flex items-center gap-2">
              {canEdit && pr && (
                <Link
                  to={`/requester/edit-pr/${pr.id}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <i className="ri-edit-line"></i>
                  {isReturned ? 'Edit & Resubmit' : 'Edit PR'}
                </Link>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-lg text-gray-500"></i>
              </button>
            </div>
          </div>
        </div>

        {pr && (
          <>
            {isReturned && (
              <div className="mx-6 mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
                <i className="ri-arrow-go-back-line text-orange-600 text-lg mt-0.5"></i>
                <div>
                  <p className="text-sm font-semibold text-orange-800">Returned for Rework</p>
                  <p className="text-xs text-orange-700 mt-0.5">
                    Review the feedback in approval history, update if needed, then resubmit.
                  </p>
                </div>
              </div>
            )}

            <div className="px-6 pt-4 flex gap-2 border-b border-gray-100 overflow-x-auto">
              {(['details', 'items', 'quotes', 'history'] as const)
                .filter((tab) => tab !== 'quotes' || hasQuotes)
                .map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'items'
                    ? `Line Items (${pr.lineItems.length})`
                    : tab === 'history'
                      ? 'Approval History'
                      : tab === 'quotes'
                        ? 'Vendor Quotations'
                        : 'Details'}
                </button>
              ))}
            </div>

            <div className="px-6 py-5 space-y-5">
              {activeTab === 'details' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Entity</p>
                      <p className="text-sm font-medium text-gray-900">
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
                      <p className="text-sm font-medium text-gray-900">{pr.department}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Request Type</p>
                      <p className="text-sm font-medium text-gray-900">{pr.requestType}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Request Category</p>
                      <p className="text-sm font-medium text-gray-900">{pr.requestCategory || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Project Detail</p>
                      <p className="text-sm font-medium text-gray-900">{pr.projectDetail || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Required Date</p>
                      <p className="text-sm font-medium text-gray-900">{pr.requiredDate || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Expected Delivery Timeline</p>
                      <p className="text-sm font-medium text-gray-900">{pr.expectedDeliveryTimeline || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Payment Terms</p>
                      <p className="text-sm font-medium text-gray-900">{pr.paymentTerms || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Total Amount</p>
                      <p className="text-sm font-bold text-gray-900">₹{pr.totalAmount.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Billing Region / GST</p>
                      <p className="text-sm font-medium text-gray-900">
                        {pr.billingLocation || '—'}
                        {pr.billingGstNo ? (
                          <span className="block text-xs font-mono text-gray-600 mt-0.5">{pr.billingGstNo}</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Billing Address</p>
                      <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">{pr.billingAddress || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">POC for Delivery</p>
                      <p className="text-sm font-medium text-gray-900">{pr.deliveryPoc || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Place of Delivery</p>
                      <p className="text-sm font-medium text-gray-900">{pr.placeOfDelivery || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Submitted Date</p>
                      <p className="text-sm font-medium text-gray-900">{pr.submittedDate || '—'}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Business Justification</h4>
                    <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3">{pr.justification || '—'}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Special Notes</h4>
                    <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{pr.specialNotes || '—'}</p>
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
                <div className="border border-gray-200 rounded-lg overflow-hidden">
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
                        <div className="flex-1 pb-4 border-b border-gray-100 last:border-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{item.stage}</p>
                              <p className="text-xs text-gray-500">{item.user} · {item.role}</p>
                            </div>
                            <span className="text-xs text-gray-400 whitespace-nowrap">{item.date}</span>
                          </div>
                          {item.remarks && (
                            <p className="text-sm text-gray-700 mt-2 bg-gray-50 rounded-lg p-2 border border-gray-100">
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

            {canEdit && (
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
                <Link
                  to={`/requester/edit-pr/${pr.id}`}
                  onClick={onClose}
                  className={`px-5 py-2.5 text-white text-sm font-medium rounded-lg transition-colors ${
                    isReturned ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-900 hover:bg-gray-800'
                  }`}
                >
                  <i className={`${isReturned ? 'ri-edit-line' : isDraft ? 'ri-send-plane-fill' : 'ri-edit-line'} mr-1.5`}></i>
                  {isReturned ? 'Edit & Resubmit' : isDraft ? 'Edit & Submit' : 'Edit PR'}
                </Link>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
