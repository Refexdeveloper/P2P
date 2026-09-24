import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import RfqListExpandedRow from '../../../components/feature/RfqListExpandedRow';
import { rfqApi, type ScmRfqEntryItem } from '../../../services/api';
import { finalizeGoPo, rfqEntryPath } from '../../../utils/scmGoPo';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

/** SCM RFQ pending list — detail uses the same UI as Requester RFQ Entry. */
export default function ScmRfqEntryListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prId = searchParams.get('prId');
  const taskId = searchParams.get('taskId');

  const [entryList, setEntryList] = useState<ScmRfqEntryItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [expandedPrId, setExpandedPrId] = useState<number | null>(null);
  const [goPoPrId, setGoPoPrId] = useState<number | null>(null);

  const handleGoPo = async (item: ScmRfqEntryItem) => {
    if (!item.canGoPo) {
      navigate(rfqEntryPath(item.prId));
      return;
    }
    setGoPoPrId(item.prId);
    setListError('');
    try {
      const result = await finalizeGoPo(item);
      navigate(result.nextPath);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Go PO failed');
    } finally {
      setGoPoPrId(null);
    }
  };

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
      <div className="p-5 sm:p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">RFQ Management</h1>
        <p className="text-sm text-gray-600 mb-4">
          Purchase requests ready for vendor quotation — expand a row for PR details, vendor comparison, and approval history
        </p>
        {listError && (
          <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{listError}</div>
        )}
        {listLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : entryList.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <i className="ri-file-list-line text-4xl text-gray-300"></i>
            <p className="text-gray-600 mt-3">No PRs pending RFQ entry</p>
            <p className="text-xs text-gray-500 mt-1">
              SCM vendor: after CFO. Own vendor: after HOD → L2 → CFO vendor approvals.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-2 py-2 w-9"></th>
                  {['PR Number', 'PR Date', 'Title', 'Department', 'Requester', 'Vendor Selection', 'Vendors', 'Amount', 'Action'].map(
                    (h) => (
                      <th key={h} className="px-2.5 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
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
                  const prDate = item.prDate || item.scmRfqEntryDate || '—';
                  return (
                    <Fragment key={item.prId}>
                      <tr className="border-b hover:bg-gray-50">
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => setExpandedPrId(open ? null : item.prId)}
                            className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 cursor-pointer"
                            aria-expanded={open}
                            title={open ? 'Collapse details' : 'Expand full details'}
                          >
                            <i className={`ri-arrow-${open ? 'down' : 'right'}-s-line text-base`}></i>
                          </button>
                        </td>
                        <td className="px-2.5 py-1.5 text-sm font-bold text-teal-600 whitespace-nowrap">{item.prNumber}</td>
                        <td className="px-2.5 py-1.5 text-sm text-gray-700 whitespace-nowrap tabular-nums" title="Date entered SCM RFQ Entry">
                          {prDate}
                        </td>
                        <td className="px-2.5 py-1.5 text-sm text-gray-900 max-w-[220px] truncate" title={item.title}>{item.title}</td>
                        <td className="px-2.5 py-1.5 text-sm text-gray-700 whitespace-nowrap">{item.department}</td>
                        <td className="px-2.5 py-1.5 text-sm text-gray-700 whitespace-nowrap">{item.requester}</td>
                        <td className="px-2.5 py-1.5 text-sm">
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              isOwn
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-teal-50 text-teal-700 border border-teal-200'
                            }`}
                          >
                            {isOwn ? 'Own vendor' : 'SCM vendor'}
                          </span>
                          {item.status && isOwn && (
                            <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">
                              {String(item.status).replace(/SCM Final RFQ/gi, 'SCM Verify')}
                            </p>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 text-sm text-center tabular-nums">{item.vendorCount}</td>
                        <td className="px-2.5 py-1.5 text-sm font-semibold whitespace-nowrap tabular-nums">{formatCurrency(item.totalAmount)}</td>
                        <td className="px-2.5 py-1.5">
                          <div className="flex items-center gap-1">
                            <Link
                              to={`/scm/rfq-entry/${item.prId}`}
                              className="px-2.5 py-1 border border-gray-300 text-gray-700 rounded-md text-xs font-semibold inline-block hover:bg-gray-50 whitespace-nowrap"
                            >
                              {isOwn ? 'SCM Verify' : 'Open RFQ'}
                            </Link>
                            <button
                              type="button"
                              onClick={() => void handleGoPo(item)}
                              disabled={goPoPrId === item.prId}
                              title={
                                item.canGoPo
                                  ? 'Finalize RFQ and send to Create PO'
                                  : 'Open RFQ, pick a vendor and quote, then Create PO'
                              }
                              className="px-2.5 py-1 bg-teal-600 text-white rounded-md text-xs font-semibold hover:bg-teal-700 disabled:opacity-50 whitespace-nowrap"
                            >
                              {goPoPrId === item.prId ? 'Create PO…' : 'Create PO'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <RfqListExpandedRow
                          prId={item.prId}
                          colSpan={10}
                          statusLabel={isOwn ? 'SCM Verify' : item.status || 'RFQ Entry'}
                          actionSlot={
                            <div className="flex items-center gap-1">
                              <Link
                                to={`/scm/rfq-entry/${item.prId}`}
                                className="px-2.5 py-1 border border-gray-300 text-gray-700 rounded-md text-xs font-semibold whitespace-nowrap"
                              >
                                {isOwn ? 'SCM Verify' : 'Open RFQ'}
                              </Link>
                              <button
                                type="button"
                                onClick={() => void handleGoPo(item)}
                                disabled={goPoPrId === item.prId}
                                className="px-2.5 py-1 bg-teal-600 text-white rounded-md text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
                              >
                                {goPoPrId === item.prId ? 'Create PO…' : 'Create PO'}
                              </button>
                            </div>
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
