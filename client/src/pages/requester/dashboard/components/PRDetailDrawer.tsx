import { useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../../../components/base/StatusBadge';
import PriorityBadge from '../../../../components/base/PriorityBadge';

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
  department: string;
  entityId?: number | null;
  entityName?: string;
  entityCode?: string;
  entityCostCenter?: string;
  priority: string;
  justification: string;
  requiredDate: string;
  totalAmount: number;
  status: string;
  statusFrontend: string;
  submittedDate: string;
  lineItems: LineItem[];
  approvalHistory: ApprovalHistoryItem[];
}

interface PRDetailDrawerProps {
  pr: PRDetail | null;
  loading: boolean;
  onClose: () => void;
}

export default function PRDetailDrawer({ pr, loading, onClose }: PRDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'items' | 'history'>('details');

  if (!pr && !loading) return null;

  const canResubmit = pr?.status === 'RETURNED' || pr?.statusFrontend === 'returned' || pr?.statusFrontend === 'draft';
  const isReturned = pr?.status === 'RETURNED' || pr?.statusFrontend === 'returned';

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
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
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-lg text-gray-500"></i>
            </button>
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

            <div className="px-6 pt-4 flex gap-2 border-b border-gray-100">
              {(['details', 'items', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                    activeTab === tab
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'items' ? `Line Items (${pr.lineItems.length})` : tab === 'history' ? 'Approval History' : 'Details'}
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
                      <p className="text-xs text-gray-500 mb-0.5">Required Date</p>
                      <p className="text-sm font-medium text-gray-900">{pr.requiredDate || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Total Amount</p>
                      <p className="text-sm font-bold text-gray-900">₹{pr.totalAmount.toLocaleString('en-IN')}</p>
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
                </>
              )}

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
                        <tr key={item.id ?? i}>
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
                    pr.approvalHistory.map((item, index) => (
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

            {canResubmit && (
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
                <Link
                  to={`/requester/edit-pr/${pr.id}`}
                  onClick={onClose}
                  className={`px-5 py-2.5 text-white text-sm font-medium rounded-lg transition-colors ${
                    isReturned ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-900 hover:bg-gray-800'
                  }`}
                >
                  <i className={`${isReturned ? 'ri-edit-line' : 'ri-send-plane-fill'} mr-1.5`}></i>
                  {isReturned ? 'Edit & Resubmit' : 'Edit & Submit'}
                </Link>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
