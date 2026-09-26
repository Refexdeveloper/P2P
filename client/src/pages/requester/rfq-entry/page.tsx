import { Fragment, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import RfqListExpandedRow from '../../../components/feature/RfqListExpandedRow';
import { taskApi } from '../../../services/api';
import { PM_PAGE_BG } from '../../../constants/pmTheme';

interface RequesterTask {
  id: string;
  taskId: number;
  prId: number;
  taskType: string;
  prNumber: string;
  title: string;
  department: string;
  totalAmount: number;
  requestType: string;
  dueDate: string;
  label: string;
  actionPath: string;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

const softWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;

export default function RequesterRfqTaskListPage() {
  const [tasks, setTasks] = useState<RequesterTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedPrId, setExpandedPrId] = useState<number | null>(null);

  const loadTasks = useCallback(async () => {
    const res = await taskApi.listRequester();
    const rfqTasks = (res.data as RequesterTask[]).filter((t) => t.taskType === 'RFQ_ENTRY');
    setTasks(rfqTasks);
  }, []);

  useEffect(() => {
    loadTasks()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [loadTasks]);

  return (
    <DashboardLayout>
      <div className="min-h-full" style={{ background: PM_PAGE_BG }}>
        <div className="p-5 sm:p-6">
          <div className="mb-5">
            <h1 className="text-xl font-bold text-[#2C3E50]">Vendor quotes to collect</h1>
            <p className="mt-1 text-sm text-slate-500">
              Open a purchase request, add vendors, get their prices, then pick one.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="relative overflow-hidden rounded-2xl border border-transparent bg-[#F8FAFC]/90 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
            <div className="pointer-events-none absolute inset-0" style={softWash} />

            <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/40 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E3F2FD] text-[#1E88E5]">
                  <i className="ri-file-edit-line text-lg"></i>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">RFQ Entry</p>
                  <h2 className="text-sm font-semibold text-[#2C3E50] sm:text-base">Pending RFQ Tasks</h2>
                </div>
              </div>
              <span className="rounded-full bg-[#E3F2FD] px-3 py-1 text-xs font-semibold text-[#1E88E5]">
                {tasks.length} task{tasks.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div className="relative z-[1] p-8 text-center text-sm text-slate-500">Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="relative z-[1] px-6 py-12 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E3F2FD] text-[#1E88E5]">
                  <i className="ri-file-edit-line text-2xl"></i>
                </div>
                <p className="text-sm font-medium text-slate-700">No RFQ entry tasks</p>
                <p className="mt-1 text-xs text-slate-500">
                  Tasks appear here after L1 Manager approves your purchase request
                </p>
              </div>
            ) : (
              <>
                {/* Mobile */}
                <div className="relative z-[1] space-y-3 p-3 sm:space-y-4 sm:p-4 md:hidden">
                  {tasks.map((task) => {
                    const open = expandedPrId === task.prId;
                    return (
                      <div key={task.id} className="space-y-2">
                        <div
                          className={`relative overflow-hidden rounded-2xl border border-transparent bg-white p-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px] ${
                            open ? 'border-[#90CAF9]' : 'hover:border-[#90CAF9]'
                          }`}
                        >
                          <div className="pointer-events-none absolute inset-0" style={softWash} />
                          <div className="relative z-[1]">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-[#1E88E5]">{task.prNumber}</p>
                                <p className="mt-1 text-sm font-semibold text-[#2C3E50]">{task.title}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {task.department} · {task.requestType} · Due {task.dueDate || '—'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setExpandedPrId(open ? null : task.prId)}
                                className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl ${
                                  open ? 'bg-[#1E88E5] text-white' : 'bg-[#E3F2FD] text-[#1E88E5]'
                                }`}
                              >
                                <i className={`ri-arrow-${open ? 'down' : 'right'}-s-line text-lg`}></i>
                              </button>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <p className="text-sm font-bold tabular-nums text-[#2C3E50]">
                                {formatCurrency(task.totalAmount)}
                              </p>
                              <Link
                                to={`/requester/rfq-entry/${task.prId}?taskId=${task.taskId}`}
                                className="inline-flex items-center gap-1 rounded-xl bg-[#1E88E5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0]"
                              >
                                <i className="ri-pencil-line"></i>
                                Open RFQ
                              </Link>
                            </div>
                          </div>
                        </div>
                        {open && (
                          <div className="overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
                            <table className="w-full">
                              <tbody>
                                <RfqListExpandedRow
                                  prId={task.prId}
                                  colSpan={1}
                                  statusLabel="RFQ Entry"
                                  actionSlot={
                                    <Link
                                      to={`/requester/rfq-entry/${task.prId}?taskId=${task.taskId}`}
                                      className="rounded-xl bg-[#1E88E5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0]"
                                    >
                                      Open RFQ Entry
                                    </Link>
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

                {/* Desktop */}
                <div className="relative z-[1] hidden overflow-x-auto overscroll-x-contain px-2 pb-3 pt-1 md:block sm:px-3 sm:pb-4">
                  <table className="w-full min-w-0 border-separate border-spacing-x-0 border-spacing-y-3 text-sm">
                    <thead>
                      <tr>
                        <th className="w-10 px-2 pb-1"></th>
                        {['PR Number', 'Title', 'Department', 'Amount', 'Type', 'Due', 'Action'].map((h) => (
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
                      {tasks.map((task) => {
                        const open = expandedPrId === task.prId;
                        const rowBorder = open
                          ? 'border-[#90CAF9]'
                          : 'border-transparent group-hover:border-[#90CAF9]';
                        const rowShadow = open
                          ? 'shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)]'
                          : 'shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] group-hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.16)]';
                        return (
                          <Fragment key={task.id}>
                            <tr className="group">
                              <td
                                className={`rounded-l-2xl border border-r-0 bg-white px-2 py-4 sm:rounded-l-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setExpandedPrId(open ? null : task.prId)}
                                  className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl ${
                                    open ? 'bg-[#1E88E5] text-white' : 'bg-[#E3F2FD] text-[#1E88E5]'
                                  }`}
                                  aria-expanded={open}
                                >
                                  <i className={`ri-arrow-${open ? 'down' : 'right'}-s-line text-base`}></i>
                                </button>
                              </td>
                              <td
                                className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 font-bold text-[#1E88E5] sm:py-5 ${rowBorder}`}
                              >
                                {task.prNumber}
                              </td>
                              <td
                                className={`border border-x-0 bg-white px-3 py-4 font-semibold text-[#2C3E50] sm:py-5 ${rowBorder}`}
                              >
                                {task.title}
                              </td>
                              <td
                                className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-[#2C3E50] sm:py-5 ${rowBorder}`}
                              >
                                {task.department}
                              </td>
                              <td
                                className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 font-bold tabular-nums text-[#2C3E50] sm:py-5 ${rowBorder}`}
                              >
                                {formatCurrency(task.totalAmount)}
                              </td>
                              <td
                                className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-slate-600 sm:py-5 ${rowBorder}`}
                              >
                                {task.requestType}
                              </td>
                              <td
                                className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-slate-500 sm:py-5 ${rowBorder}`}
                              >
                                {task.dueDate || '—'}
                              </td>
                              <td
                                className={`rounded-r-2xl border border-l-0 bg-white px-3 py-4 sm:rounded-r-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}
                              >
                                <div className="flex justify-end">
                                  <Link
                                    to={`/requester/rfq-entry/${task.prId}?taskId=${task.taskId}`}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E88E5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0]"
                                  >
                                    <i className="ri-pencil-line"></i>
                                    Open RFQ Entry
                                  </Link>
                                </div>
                              </td>
                            </tr>
                            {open && (
                              <RfqListExpandedRow
                                prId={task.prId}
                                colSpan={8}
                                statusLabel="RFQ Entry"
                                actionSlot={
                                  <Link
                                    to={`/requester/rfq-entry/${task.prId}?taskId=${task.taskId}`}
                                    className="rounded-xl bg-[#1E88E5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0]"
                                  >
                                    Open RFQ Entry
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
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
