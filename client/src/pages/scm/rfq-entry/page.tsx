import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import RfqListExpandedRow from '../../../components/feature/RfqListExpandedRow';
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
  const [expandedPrId, setExpandedPrId] = useState<number | null>(null);

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
          Purchase requests ready for vendor quotation — expand a row for PR details, line items, and approval history
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
                  <th className="px-3 py-3 w-10"></th>
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
                {entryList.map((item) => {
                  const open = expandedPrId === item.prId;
                  const isOwn = item.vendorSelection === 'own';
                  return (
                    <Fragment key={item.prId}>
                      <tr className="border-b hover:bg-gray-50">
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => setExpandedPrId(open ? null : item.prId)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 cursor-pointer"
                            aria-expanded={open}
                            title={open ? 'Collapse details' : 'Expand full details'}
                          >
                            <i className={`ri-arrow-${open ? 'down' : 'right'}-s-line text-lg`}></i>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-teal-600">{item.prNumber}</td>
                        <td className="px-4 py-3 text-sm">{item.title}</td>
                        <td className="px-4 py-3 text-sm">{item.department}</td>
                        <td className="px-4 py-3 text-sm">{item.requester}</td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                              isOwn
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-teal-50 text-teal-700 border border-teal-200'
                            }`}
                          >
                            {isOwn ? 'Own vendor' : 'SCM vendor'}
                          </span>
                          {item.status && isOwn && (
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
                            {isOwn ? 'SCM Final' : 'Open RFQ'}
                          </Link>
                        </td>
                      </tr>
                      {open && (
                        <RfqListExpandedRow
                          prId={item.prId}
                          colSpan={9}
                          statusLabel={isOwn ? 'SCM Final RFQ' : item.status || 'RFQ Entry'}
                          actionSlot={
                            <Link
                              to={`/scm/rfq-entry/${item.prId}`}
                              className="px-3 py-1.5 bg-teal-600 text-white rounded-md text-xs font-semibold"
                            >
                              {isOwn ? 'SCM Final' : 'Open RFQ'}
                            </Link>
                          }
                        />
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
