import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/feature/DashboardLayout';
import { rfqApi, PostRfqPendingItem } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function RfqApprovalListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<PostRfqPendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isBuyer = user?.role === 'SCM Buyer';

  const load = useCallback(async () => {
    try {
      const res = await rfqApi.listPostApprovalPending();
      setItems(res.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingItems = items.filter((i) => i.approvalState === 'pending');
  const approvedItems = items.filter((i) => i.approvalState === 'approved');
  const pendingCount = pendingItems.length;
  const approvedCount = approvedItems.length;
  const visible = isBuyer ? pendingItems : items;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">RFQ Post-Approval Queue</h1>
        <p className="text-sm text-gray-600 mt-1">
          {isBuyer
            ? 'Pending SCM Manager RFQ approvals only. Approved RFQs are on Create PO.'
            : `Review vendor comparison, negotiation rounds, and approve as ${user?.role}`}
        </p>
      </div>

      {isBuyer && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="text-left bg-white rounded-xl border border-amber-300 ring-1 ring-amber-200 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Pending RFQ Approval</p>
                <p className="text-3xl font-bold text-gray-900">{pendingCount}</p>
                <p className="text-xs mt-1 text-amber-700">Waiting for SCM Manager</p>
              </div>
              <div className="w-11 h-11 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <i className="ri-time-line text-xl text-amber-700"></i>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/scm/create-po')}
            className="text-left bg-white rounded-xl border border-emerald-100 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Approved RFQ</p>
                <p className="text-3xl font-bold text-gray-900">{approvedCount}</p>
                <p className="text-xs mt-1 text-emerald-700">Ready to Create PO</p>
              </div>
              <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                <i className="ri-checkbox-circle-line text-xl text-emerald-700"></i>
              </div>
            </div>
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading RFQ approvals...</p>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <i className="ri-checkbox-circle-line text-4xl text-gray-300"></i>
          <p className="text-gray-600 mt-3">
            {isBuyer ? 'No pending RFQ approvals' : 'No RFQ approvals'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[1100px] table-fixed">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[150px]">PR Number</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Title</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[130px]">Entity</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[110px]">Department</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[110px]">Requester</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-20">Vendors</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[150px]">Recommended</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase w-[110px]">Amount</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[150px]">Stage</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase w-[140px]">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.prId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-3 text-sm font-bold text-gray-900 truncate" title={item.prNumber}>
                    {item.prNumber}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-800 truncate" title={item.title}>
                    {item.title}
                  </td>
                  <td
                    className="px-3 py-3 text-sm text-gray-700 truncate"
                    title={item.entityName ? `${item.entityName}${item.entityCode ? ` (${item.entityCode})` : ''}` : undefined}
                  >
                    {item.entityName || '—'}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-600 truncate" title={item.department}>
                    {item.department}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-600 truncate" title={item.requester}>
                    {item.requester}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-600">{item.vendorCount}</td>
                  <td
                    className="px-3 py-3 text-sm text-emerald-700 font-medium truncate"
                    title={item.recommendedVendor || undefined}
                  >
                    {item.recommendedVendor || '—'}
                  </td>
                  <td className="px-3 py-3 text-sm font-semibold text-gray-900 text-right tabular-nums whitespace-nowrap">
                    {formatCurrency(item.totalAmount)}
                  </td>
                  <td className="px-3 py-3 overflow-hidden">
                    <span
                      className={`inline-flex max-w-full px-2 py-1 text-xs font-semibold rounded-full truncate ${
                        item.approvalState === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                      title={item.stageLabel}
                    >
                      {item.approvalState === 'approved' ? 'Approved' : 'Pending'} · {item.stageLabel}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/rfq-approval/${item.prId}?from=rfq-approval`}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        title="Vendor Comparison"
                      >
                        <i className="ri-table-line text-lg"></i>
                      </Link>
                      <Link
                        to={
                          item.approvalState === 'approved' ||
                          item.stageLabel === 'SCM PO Create' ||
                          item.stageLabel === 'Approved — Create PO'
                            ? `/scm/create-po?prId=${item.prId}&from=rfq-approval`
                            : `/rfq-approval/${item.prId}?from=rfq-approval`
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 whitespace-nowrap"
                      >
                        {item.approvalState === 'approved' ||
                        item.stageLabel === 'SCM PO Create' ||
                        item.stageLabel === 'Approved — Create PO'
                          ? 'Create PO'
                          : isBuyer
                            ? 'View'
                            : 'Review'}{' '}
                        <i className="ri-arrow-right-line"></i>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
