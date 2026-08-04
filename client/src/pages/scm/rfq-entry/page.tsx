import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { rfqApi, type ScmRfqEntryItem } from '../../../services/api';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

/** SCM RFQ pending list — detail uses the same UI as Requester RFQ Entry. */
export default function ScmRfqEntryListPage() {
  const [searchParams] = useSearchParams();
  const prId = searchParams.get('prId');
  const taskId = searchParams.get('taskId');

  const [entryList, setEntryList] = useState<ScmRfqEntryItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');

  const loadEntryList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await rfqApi.listScmEntryPending();
      setEntryList(res.data);
      setListError('');
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to load RFQ list');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (prId) return;
    loadEntryList();
  }, [prId, loadEntryList]);

  // Legacy ?prId= links → same detail page as requester
  if (prId) {
    const qs = taskId ? `?taskId=${encodeURIComponent(taskId)}` : '';
    return <Navigate to={`/scm/rfq-entry/${prId}${qs}`} replace />;
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">RFQ Entry</h1>
        <p className="text-sm text-gray-600 mb-6">
          Purchase requests ready for vendor quotation — same invite, fields, mail, and manual entry as Requester RFQ
        </p>
        {listError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{listError}</div>
        )}
        {listLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : entryList.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <i className="ri-file-list-line text-4xl text-gray-300"></i>
            <p className="text-gray-600 mt-3">No PRs pending RFQ entry</p>
            <p className="text-xs text-gray-500 mt-1">
              SCM vendor: after CFO. Own vendor: after HOD → L2 → CFO vendor approvals.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['PR Number', 'Title', 'Department', 'Requester', 'Vendor Selection', 'Vendors', 'Amount', 'Action'].map(
                    (h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {entryList.map((item) => (
                  <tr key={item.prId} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-bold text-teal-600">{item.prNumber}</td>
                    <td className="px-4 py-3 text-sm">{item.title}</td>
                    <td className="px-4 py-3 text-sm">{item.department}</td>
                    <td className="px-4 py-3 text-sm">{item.requester}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          item.vendorSelection === 'own'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-teal-50 text-teal-700 border border-teal-200'
                        }`}
                      >
                        {item.vendorSelection === 'own' ? 'Own vendor' : 'SCM vendor'}
                      </span>
                      {item.status && item.vendorSelection === 'own' && (
                        <p className="text-[10px] text-gray-500 mt-1">{item.status}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{item.vendorCount}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{formatCurrency(item.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/scm/rfq-entry/${item.prId}`}
                        className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold inline-block"
                      >
                        {item.vendorSelection === 'own' ? 'SCM Final' : 'Open RFQ'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
