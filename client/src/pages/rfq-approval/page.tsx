import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/feature/DashboardLayout';
import { rfqApi, PostRfqPendingItem, ScmRfqEntryItem } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { finalizeGoPo, rfqEntryPath } from '../../utils/scmGoPo';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function RfqApprovalListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<PostRfqPendingItem[]>([]);
  const [goPoItems, setGoPoItems] = useState<ScmRfqEntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [goPoPrId, setGoPoPrId] = useState<number | null>(null);
  const isBuyer = user?.role === 'SCM Buyer';

  const load = useCallback(async () => {
    try {
      const [postRes, entryRes] = await Promise.all([
        rfqApi.listPostApprovalPending(),
        isBuyer
          ? rfqApi.listScmEntryPending().catch(() => ({ data: [] as ScmRfqEntryItem[] }))
          : Promise.resolve({ data: [] as ScmRfqEntryItem[] }),
      ]);
      setItems(postRes.data);
      setGoPoItems(entryRes.data || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [isBuyer]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingItems = items.filter((i) => i.approvalState === 'pending');
  const pendingCount = pendingItems.length;
  const goPoCount = goPoItems.length;
  const visible = isBuyer ? pendingItems : items;

  const handleGoPo = async (item: ScmRfqEntryItem) => {
    if (!item.canGoPo) {
      navigate(rfqEntryPath(item.prId));
      return;
    }
    setGoPoPrId(item.prId);
    setError('');
    try {
      const result = await finalizeGoPo(item);
      if (result.isOwn) {
        navigate(result.nextPath);
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Go PO failed');
    } finally {
      setGoPoPrId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{isBuyer ? 'RFQ Approval' : 'RFQ Post-Approval Queue'}</h1>
        <p className="text-sm text-gray-600 mt-1">
          {isBuyer
            ? 'Go PO finalizes RFQ. Those tasks stay here until SCM Manager approves, then Create PO.'
            : `Review vendor comparison, negotiation rounds, and approve as ${user?.role}`}
        </p>
      </div>

      {isBuyer && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="text-left bg-white rounded-xl border border-teal-300 ring-1 ring-teal-200 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Ready for Go PO</p>
                <p className="text-3xl font-bold text-gray-900">{goPoCount}</p>
                <p className="text-xs mt-1 text-teal-700">Finalize RFQ from this queue</p>
              </div>
              <div className="w-11 h-11 bg-teal-100 rounded-xl flex items-center justify-center shrink-0">
                <i className="ri-shopping-cart-2-line text-xl text-teal-700"></i>
              </div>
            </div>
          </div>
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
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading RFQ approvals...</p>
      ) : visible.length === 0 && goPoItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <i className="ri-checkbox-circle-line text-4xl text-gray-300"></i>
          <p className="text-gray-600 mt-3">
            {isBuyer ? 'No RFQ approval tasks' : 'No RFQ approvals'}
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
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase w-[180px]">Action</th>
              </tr>
            </thead>
            <tbody>
              {goPoItems.map((item) => (
                <tr key={`gopo-${item.prId}`} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-3 text-sm font-bold text-gray-900 truncate" title={item.prNumber}>
                    {item.prNumber}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-800 truncate" title={item.title}>
                    {item.title}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-700 truncate">—</td>
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
                      className="inline-flex max-w-full px-2 py-1 text-xs font-semibold rounded-full truncate bg-teal-100 text-teal-800"
                      title={item.status}
                    >
                      Ready for Go PO
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={rfqEntryPath(item.prId)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 whitespace-nowrap"
                      >
                        Open RFQ
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleGoPo(item)}
                        disabled={goPoPrId === item.prId}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 whitespace-nowrap disabled:opacity-50"
                      >
                        {goPoPrId === item.prId ? 'Go PO…' : 'Go PO'}
                        <i className="ri-arrow-right-line"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
