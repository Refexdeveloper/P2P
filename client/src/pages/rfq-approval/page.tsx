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
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['PR Number', 'Title', 'Department', 'Requester', 'Vendors', 'Recommended', 'Amount', 'Stage', 'Action'].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.prId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">{item.prNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-800 max-w-[200px] truncate">{item.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.department}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.requester}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.vendorCount}</td>
                  <td className="px-4 py-3 text-sm text-emerald-700 font-medium">{item.recommendedVendor || '—'}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(item.totalAmount)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                      {item.stageLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/rfq-approval/${item.prId}`}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        title="Vendor Comparison"
                      >
                        <i className="ri-table-line text-lg"></i>
                      </Link>
                      <Link
                        to={`/rfq-approval/${item.prId}?action=approve`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700"
                      >
                        Review <i className="ri-arrow-right-line"></i>
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
