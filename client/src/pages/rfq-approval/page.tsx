import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/feature/DashboardLayout';
import { rfqApi, PostRfqPendingItem } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function RfqApprovalListPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<PostRfqPendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">RFQ Post-Approval Queue</h1>
        <p className="text-sm text-gray-600 mt-1">
          Review vendor comparison, negotiation rounds, and approve as <strong>{user?.role}</strong>
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading pending approvals...</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <i className="ri-checkbox-circle-line text-4xl text-gray-300"></i>
          <p className="text-gray-600 mt-3">No pending RFQ approvals</p>
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
              {items.map((item) => (
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
                      className="inline-flex max-w-full px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full truncate"
                      title={item.stageLabel}
                    >
                      {item.stageLabel}
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
                          item.stageLabel === 'SCM PO Create'
                            ? `/scm/create-po?prId=${item.prId}&from=rfq-approval`
                            : `/rfq-approval/${item.prId}?action=approve&from=rfq-approval`
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 whitespace-nowrap"
                      >
                        {item.stageLabel === 'SCM PO Create' ? 'Create PO' : 'Review'}{' '}
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
