import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import RfqListExpandedRow from '../../../components/feature/RfqListExpandedRow';
import { rfqApi, type ScmRfqEntryItem } from '../../../services/api';
import { finalizeGoPo, rfqEntryPath } from '../../../utils/scmGoPo';
import { PM_PAGE_BG } from '../../../constants/pmTheme';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const softWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;

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
      <div className="min-h-full" style={{ background: PM_PAGE_BG }}>
        <div>
          <div className="mb-5">
            <h1 className="text-xl font-bold text-[#2C3E50]">RFQ Management</h1>
            <p className="mt-1 text-sm text-slate-500">
              Purchase requests ready for vendor quotation — expand a row for PR details, vendor comparison, and approval history
            </p>
          </div>

          {listError && (
            <div className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              {listError}
            </div>
          )}

          {listLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : entryList.length === 0 ? (
            <div className="relative overflow-hidden rounded-2xl border border-transparent bg-white px-6 py-12 text-center shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
              <div className="pointer-events-none absolute inset-0" style={softWash} />
              <div className="relative z-[1]">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E3F2FD] text-[#1E88E5]">
                  <i className="ri-file-list-line text-2xl"></i>
                </div>
                <p className="font-medium text-slate-700">No PRs pending RFQ entry</p>
                <p className="mt-1 text-xs text-slate-500">
                  SCM vendor: after CFO. Own vendor: after HOD → L2 → CFO vendor approvals.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-2xl border border-transparent bg-[#F8FAFC]/90 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
              <div className="pointer-events-none absolute inset-0" style={softWash} />

              <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/40 px-4 py-4 sm:px-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E3F2FD] text-[#1E88E5]">
                    <i className="ri-store-2-line text-lg"></i>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Purchase Requests
                    </p>
                    <h2 className="text-sm font-semibold text-[#2C3E50] sm:text-base">Pending RFQ Entry</h2>
                  </div>
                </div>
                <span className="rounded-full bg-[#E3F2FD] px-3 py-1 text-xs font-semibold text-[#1E88E5]">
                  {entryList.length} PR{entryList.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Mobile soft cards */}
              <div className="relative z-[1] space-y-3 p-3 sm:space-y-4 sm:p-4 md:hidden">
                {entryList.map((item) => {
                  const open = expandedPrId === item.prId;
                  const isOwn = item.vendorSelection === 'own';
                  const prDate = item.prDate || item.scmRfqEntryDate || '—';
                  return (
                    <div key={item.prId} className="space-y-2">
                      <div
                        className={`relative overflow-hidden rounded-2xl border border-transparent bg-white p-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-[border-color,box-shadow] sm:rounded-[18px] ${
                          open ? 'border-[#90CAF9] shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)]' : 'hover:border-[#90CAF9]'
                        }`}
                      >
                        <div className="pointer-events-none absolute inset-0" style={softWash} />
                        <div className="relative z-[1]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#1E88E5]">{item.prNumber}</p>
                              <p className="mt-1 text-sm font-semibold text-[#2C3E50]">{item.title}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {item.department} · {item.requester} · {prDate}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setExpandedPrId(open ? null : item.prId)}
                              className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors ${
                                open
                                  ? 'bg-[#1E88E5] text-white'
                                  : 'border border-transparent bg-white text-slate-500 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9] hover:text-[#1E88E5]'
                              }`}
                              aria-expanded={open}
                            >
                              <i className={`ri-arrow-${open ? 'down' : 'right'}-s-line text-lg`}></i>
                            </button>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                isOwn ? 'bg-amber-50 text-amber-700' : 'bg-[#E3F2FD] text-[#1E88E5]'
                              }`}
                            >
                              {isOwn ? 'Own vendor' : 'SCM vendor'}
                            </span>
                            <span className="text-xs text-slate-500">{item.vendorCount} vendors</span>
                            <span className="text-sm font-bold tabular-nums text-[#2C3E50]">
                              {formatCurrency(item.totalAmount)}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Link
                              to={`/scm/rfq-entry/${item.prId}`}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-transparent bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9]"
                            >
                              {isOwn ? 'SCM Verify' : 'Open RFQ'}
                            </Link>
                            <button
                              type="button"
                              onClick={() => void handleGoPo(item)}
                              disabled={goPoPrId === item.prId}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-[#1E88E5] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1565C0] disabled:opacity-50"
                            >
                              {goPoPrId === item.prId ? 'Create PO…' : 'Create PO'}
                            </button>
                          </div>
                        </div>
                      </div>
                      {open && (
                        <div className="overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
                          <table className="w-full">
                            <tbody>
                              <RfqListExpandedRow
                                prId={item.prId}
                                colSpan={1}
                                statusLabel={isOwn ? 'SCM Verify' : item.status || 'RFQ Entry'}
                                actionSlot={
                                  <div className="flex items-center gap-1.5">
                                    <Link
                                      to={`/scm/rfq-entry/${item.prId}`}
                                      className="rounded-xl border border-transparent bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9]"
                                    >
                                      {isOwn ? 'SCM Verify' : 'Open RFQ'}
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={() => void handleGoPo(item)}
                                      disabled={goPoPrId === item.prId}
                                      className="rounded-xl bg-[#1E88E5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0] disabled:opacity-50"
                                    >
                                      {goPoPrId === item.prId ? 'Create PO…' : 'Create PO'}
                                    </button>
                                  </div>
                                }
                              />
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop soft card table — scroll only when columns overflow */}
              <div className="relative z-[1] hidden overflow-x-auto overscroll-x-contain px-2 pb-3 pt-1 md:block sm:px-3 sm:pb-4">
                <table className="w-full min-w-0 border-separate border-spacing-x-0 border-spacing-y-3 text-sm">
                  <thead>
                    <tr>
                      <th className="w-10 px-2 pb-1"></th>
                      {[
                        'PR Number',
                        'PR Date',
                        'Title',
                        'Department',
                        'Requester',
                        'Vendor Selection',
                        'Vendors',
                        'Amount',
                        'Action',
                      ].map((h) => (
                        <th
                          key={h}
                          className={`whitespace-nowrap px-3 pb-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 ${
                            h === 'Action' ? 'text-right' : ''
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entryList.map((item) => {
                      const open = expandedPrId === item.prId;
                      const isOwn = item.vendorSelection === 'own';
                      const prDate = item.prDate || item.scmRfqEntryDate || '—';
                      const rowBorder = open
                        ? 'border-[#90CAF9]'
                        : 'border-transparent group-hover:border-[#90CAF9]';
                      const rowShadow = open
                        ? 'shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)]'
                        : 'shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] group-hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.16)]';
                      return (
                        <Fragment key={item.prId}>
                          <tr className="group">
                            <td
                              className={`rounded-l-2xl border border-r-0 bg-white px-2 py-4 transition-[border-color,box-shadow] sm:rounded-l-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}
                            >
                              <button
                                type="button"
                                onClick={() => setExpandedPrId(open ? null : item.prId)}
                                className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl transition-colors ${
                                  open
                                    ? 'bg-[#1E88E5] text-white'
                                    : 'bg-[#E3F2FD] text-[#1E88E5] hover:bg-[#BBDEFB]'
                                }`}
                                aria-expanded={open}
                                title={open ? 'Collapse details' : 'Expand full details'}
                              >
                                <i className={`ri-arrow-${open ? 'down' : 'right'}-s-line text-base`}></i>
                              </button>
                            </td>
                            <td
                              className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-sm font-bold text-[#1E88E5] transition-[border-color] sm:py-5 ${rowBorder}`}
                            >
                              {item.prNumber}
                            </td>
                            <td
                              className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 tabular-nums text-slate-600 transition-[border-color] sm:py-5 ${rowBorder}`}
                              title="Date entered SCM RFQ Entry"
                            >
                              {prDate}
                            </td>
                            <td
                              className={`min-w-0 max-w-[200px] border border-x-0 bg-white px-3 py-4 font-semibold text-[#2C3E50] transition-[border-color] sm:py-5 ${rowBorder}`}
                              title={item.title}
                            >
                              <p className="truncate">{item.title}</p>
                            </td>
                            <td
                              className={`min-w-0 max-w-[120px] truncate border border-x-0 bg-white px-3 py-4 text-[#2C3E50] transition-[border-color] sm:py-5 ${rowBorder}`}
                              title={item.department}
                            >
                              {item.department}
                            </td>
                            <td
                              className={`min-w-0 max-w-[120px] truncate border border-x-0 bg-white px-3 py-4 text-[#2C3E50] transition-[border-color] sm:py-5 ${rowBorder}`}
                              title={item.requester}
                            >
                              {item.requester}
                            </td>
                            <td
                              className={`border border-x-0 bg-white px-3 py-4 transition-[border-color] sm:py-5 ${rowBorder}`}
                            >
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  isOwn ? 'bg-amber-50 text-amber-700' : 'bg-[#E3F2FD] text-[#1E88E5]'
                                }`}
                              >
                                {isOwn ? 'Own vendor' : 'SCM vendor'}
                              </span>
                              {item.status && isOwn && (
                                <p className="mt-0.5 text-[10px] leading-tight text-slate-500">
                                  {String(item.status).replace(/SCM Final RFQ/gi, 'SCM Verify')}
                                </p>
                              )}
                            </td>
                            <td
                              className={`border border-x-0 bg-white px-3 py-4 text-center tabular-nums text-[#2C3E50] transition-[border-color] sm:py-5 ${rowBorder}`}
                            >
                              {item.vendorCount}
                            </td>
                            <td
                              className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 font-bold tabular-nums text-[#2C3E50] transition-[border-color] sm:py-5 ${rowBorder}`}
                            >
                              {formatCurrency(item.totalAmount)}
                            </td>
                            <td
                              className={`whitespace-nowrap rounded-r-2xl border border-l-0 bg-white px-3 py-4 transition-[border-color,box-shadow] sm:rounded-r-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}
                            >
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <Link
                                  to={`/scm/rfq-entry/${item.prId}`}
                                  className="inline-flex cursor-pointer items-center rounded-xl border border-transparent bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] transition-colors hover:border-[#90CAF9]"
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
                                  className="inline-flex cursor-pointer items-center rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1565C0] disabled:opacity-50"
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
                                <div className="flex items-center gap-1.5">
                                  <Link
                                    to={`/scm/rfq-entry/${item.prId}`}
                                    className="rounded-xl border border-transparent bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9]"
                                  >
                                    {isOwn ? 'SCM Verify' : 'Open RFQ'}
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => void handleGoPo(item)}
                                    disabled={goPoPrId === item.prId}
                                    className="rounded-xl bg-[#1E88E5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0] disabled:opacity-50"
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
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
