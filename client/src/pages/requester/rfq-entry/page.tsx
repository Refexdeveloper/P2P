import { Fragment, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import RfqListExpandedRow from '../../../components/feature/RfqListExpandedRow';
import { taskApi } from '../../../services/api';

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
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">RFQ Entry Tasks</h1>
        <p className="text-sm text-gray-500 mt-1">
          Select a PR to invite vendors and collect quotations — expand a row for full PR details
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Pending RFQ Tasks</h2>
          <span className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-semibold rounded-full">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="ri-file-edit-line text-2xl text-gray-400"></i>
            </div>
            <p className="text-sm font-medium text-gray-700">No RFQ entry tasks</p>
            <p className="text-xs text-gray-500 mt-1">Tasks appear here after L1 Manager approves your purchase request</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 w-10"></th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">PR Number</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Title</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Department</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Due</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tasks.map((task) => {
                  const open = expandedPrId === task.prId;
                  return (
                    <Fragment key={task.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-4">
                          <button
                            type="button"
                            onClick={() => setExpandedPrId(open ? null : task.prId)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 cursor-pointer"
                            aria-expanded={open}
                            title={open ? 'Collapse details' : 'Expand full details'}
                          >
                            <i className={`ri-arrow-${open ? 'down' : 'right'}-s-line text-lg`}></i>
                          </button>
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-teal-700">{task.prNumber}</td>
                        <td className="px-5 py-4 text-sm text-gray-900">{task.title}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{task.department}</td>
                        <td className="px-5 py-4 text-sm font-medium text-gray-900">{formatCurrency(task.totalAmount)}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{task.requestType}</td>
                        <td className="px-5 py-4 text-sm text-gray-500">{task.dueDate || '—'}</td>
                        <td className="px-5 py-4 text-right">
                          <Link
                            to={`/requester/rfq-entry/${task.prId}?taskId=${task.taskId}`}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
                          >
                            <i className="ri-pencil-line"></i>
                            Open RFQ Entry
                          </Link>
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
                              className="px-3 py-1.5 bg-teal-600 text-white rounded-md text-xs font-semibold"
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
        )}
      </div>
    </DashboardLayout>
  );
}
