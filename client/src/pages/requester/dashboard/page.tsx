import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import StatusBadge from '../../../components/base/StatusBadge';
import { prApi, taskApi, RequesterPrListMeta } from '../../../services/api';
import { getRoleHomePath, useAuth } from '../../../contexts/AuthContext';
import PRDetailDrawer, { PRDetail } from './components/PRDetailDrawer';

interface RequesterPR {
  id: string;
  prId: number;
  title: string;
  department: string;
  entityName?: string;
  entityCode?: string;
  amount: number;
  status: string;
  statusRaw?: string;
  date: string;
  items: number;
  requestType: string;
}

const ADMIN_EDIT_ROLES = [
  'Super Admin',
  'SCM Manager',
  'SCM Buyer',
  'HOD Approver',
  'PR Manager',
  'CFO',
];

const REQUESTER_EDITABLE_STATUSES = new Set([
  'DRAFT',
  'RETURNED',
  'PENDING_HOD_APPROVAL',
  'PENDING_PR_MANAGER_APPROVAL',
  'PENDING_CFO_APPROVAL',
]);

function canEditRequesterPr(request: RequesterPR, isAdminEditor: boolean) {
  if (isAdminEditor) return true;
  const raw = String(request.statusRaw || '').toUpperCase();
  const front = String(request.status || '').toLowerCase();
  return REQUESTER_EDITABLE_STATUSES.has(raw) || front === 'draft' || front === 'returned';
}

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
  cta?: string;
}

const PAGE_SIZE = 10;

export default function RequesterDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdminEditor = Boolean(user?.role && ADMIN_EDIT_ROLES.includes(user.role));
  const [filter, setFilter] = useState<'all' | 'draft' | 'pending_approval' | 'approved' | 'returned' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<RequesterPrListMeta>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [requesterPRs, setRequesterPRs] = useState<RequesterPR[]>([]);
  const [stats, setStats] = useState({
    myPRCount: 0,
    pendingApprovals: 0,
    approved: 0,
    rejected: 0,
    overdueSla: 0,
    returnedForRework: 0,
    poIssued: 0,
    rfqEntryPending: 0,
  });
  const [requesterTasks, setRequesterTasks] = useState<RequesterTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPrId, setSelectedPrId] = useState<number | null>(null);
  const [drawerPR, setDrawerPR] = useState<PRDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'Requester' && !user.isSuperAdmin) {
      navigate(getRoleHomePath(user.role, user.navigation), { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [filter, debouncedSearch]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const listRes = await prApi.list({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: filter,
        scope: 'requester',
      });
      setRequesterPRs(listRes.data as RequesterPR[]);
      if (listRes.meta) setMeta(listRes.meta);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchase requests');
      setRequesterPRs([]);
    } finally {
      setListLoading(false);
      setLoading(false);
    }
  }, [page, filter, debouncedSearch]);

  const loadSideData = useCallback(async () => {
    const [statsRes, tasksRes] = await Promise.all([prApi.requesterStats(), taskApi.listRequester()]);
    setStats(statsRes.data as typeof stats);
    setRequesterTasks(tasksRes.data as RequesterTask[]);
  }, []);

  useEffect(() => {
    if (!user || (user.role !== 'Requester' && !user.isSuperAdmin)) {
      setLoading(false);
      return;
    }
    loadList();
  }, [loadList, user]);

  useEffect(() => {
    if (!user || (user.role !== 'Requester' && !user.isSuperAdmin)) return;
    loadSideData().catch((err) => setError(err.message));
  }, [loadSideData, user]);

  const openDrawer = async (prId: number) => {
    setSelectedPrId(prId);
    setDrawerLoading(true);
    setDrawerPR(null);
    try {
      const res = await prApi.get(prId);
      setDrawerPR(res.data as PRDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PR details');
      setSelectedPrId(null);
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeDrawer = () => {
    setSelectedPrId(null);
    setDrawerPR(null);
  };

  const widgetCards = [
    {
      title: 'Pending Approval',
      value: stats.pendingApprovals,
      icon: 'ri-time-line',
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-50',
      filter: 'pending_approval' as const,
    },
    {
      title: 'Approved',
      value: stats.approved ?? stats.poIssued ?? 0,
      icon: 'ri-checkbox-multiple-line',
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-50',
      filter: 'approved' as const,
    },
    {
      title: 'Rejected',
      value: stats.rejected ?? 0,
      icon: 'ri-close-circle-line',
      iconColor: 'text-red-500',
      iconBg: 'bg-red-50',
      filter: 'rejected' as const,
    },
    {
      title: 'Overdue SLA',
      value: stats.overdueSla ?? 0,
      icon: 'ri-alarm-warning-line',
      iconColor: 'text-orange-500',
      iconBg: 'bg-orange-50',
      filter: 'pending_approval' as const,
    },
  ];

  const totalPages = meta.totalPages || 1;

  return (
    <DashboardLayout>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}
      {loading && <div className="mb-4 text-sm text-gray-500">Loading purchase requests...</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {widgetCards.map((card) => (
          <button
            key={card.title}
            type="button"
            onClick={() => {
              setFilter(card.filter);
              setPage(1);
            }}
            className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 text-left hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-500 font-medium truncate">{card.title}</p>
                <p className="text-2xl sm:text-[1.75rem] font-bold text-slate-900 mt-1.5 leading-none tracking-tight">
                  {card.value}
                </p>
              </div>
              <div className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center shrink-0`}>
                <i className={`${card.icon} text-xl ${card.iconColor}`}></i>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-3 mb-6">
        <Link to="/requester/create-pr" className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center space-x-2 whitespace-nowrap cursor-pointer">
          <i className="ri-add-line text-lg"></i>
          <span>Create New PR</span>
        </Link>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('p2p-open-pr-chat'))}
          className="px-5 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors flex items-center space-x-2 whitespace-nowrap cursor-pointer"
        >
          <i className="ri-robot-2-line text-lg"></i>
          <span>Create PR with AI</span>
        </button>
        <Link to="/requester/track-pr" className="px-5 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors flex items-center space-x-2 whitespace-nowrap cursor-pointer">
          <i className="ri-search-eye-line text-lg"></i>
          <span>Track My PRs &amp; SLA</span>
        </Link>
      </div>

      {requesterTasks.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">My Tasks</h2>
              <p className="text-xs text-gray-500 mt-0.5">Action items assigned to you</p>
            </div>
            <span className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-semibold rounded-full">
              {requesterTasks.length} pending
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {requesterTasks.map((task) => (
              <div key={task.id} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="ri-file-edit-line text-teal-600 text-lg"></i>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">{task.label || 'RFQ Entry'}</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">{task.prNumber}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{task.title}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {task.department} · {task.requestType} · ₹{Number(task.totalAmount || 0).toLocaleString('en-IN')}
                      {task.dueDate ? ` · Due ${task.dueDate}` : ''}
                    </p>
                  </div>
                </div>
                <Link
                  to={task.actionPath || `/requester/rfq-entry/${task.prId}`}
                  className="px-5 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 whitespace-nowrap self-start sm:self-center"
                >
                  <i className="ri-arrow-right-line"></i>
                  {task.cta || (task.taskType === 'PR_APPROVAL' ? 'Review & Approve' : 'Start RFQ Entry')}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-5 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <h2 className="text-base font-semibold text-gray-900">Recent Purchase Requests</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input type="text" placeholder="Search PR..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 w-full sm:w-56" />
              </div>
              <div className="flex gap-1.5">
                {(['all', 'draft', 'pending_approval', 'approved', 'returned', 'rejected'] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {f === 'all' ? 'All' : f === 'pending_approval' ? 'Pending' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto relative">
          {listLoading && (
            <div className="absolute inset-0 bg-white/50 z-10 flex items-start justify-center pt-8">
              <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">Loading…</span>
            </div>
          )}
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">PR Number</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">PR Title</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Entity</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Department</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Amount</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requesterPRs.map((request) => (
                <tr
                  key={request.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => openDrawer(request.prId)}
                >
                  <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{request.id}</td>
                  <td className="px-5 py-4 text-sm text-gray-900">
                    <div>
                      <p className="font-medium">{request.title}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{request.items} items · {request.requestType}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">
                    <div>
                      <p className="font-medium">{request.entityName || '—'}</p>
                      {request.entityCode ? (
                        <p className="text-gray-400 text-xs mt-0.5">{request.entityCode}</p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-700">{request.department}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">₹{request.amount.toLocaleString('en-IN')}</td>
                  <td className="px-5 py-4 whitespace-nowrap"><StatusBadge status={request.status} /></td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-700">{request.date}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openDrawer(request.prId)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                        title="View Details"
                      >
                        <i className="ri-eye-line"></i>
                      </button>
                      {(canEditRequesterPr(request, isAdminEditor) ||
                        String(request.status || '').toLowerCase() === 'draft') && (
                        <button
                          onClick={() => navigate(`/requester/edit-pr/${request.prId}`)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                          title={request.status === 'returned' ? 'Edit & Resubmit' : 'Edit PR'}
                        >
                          <i className={request.status === 'returned' ? 'ri-refresh-line' : 'ri-edit-line'}></i>
                          Edit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && !listLoading && requesterPRs.length === 0 && (
          <div className="p-12 text-center">
            <i className="ri-file-list-3-line text-5xl text-gray-300 mb-4"></i>
            <p className="text-gray-500 text-sm">No purchase requests found</p>
          </div>
        )}

        {meta.total > 0 && (
          <div className="px-5 py-4 border-t border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * meta.pageSize + 1}–{Math.min(page * meta.pageSize, meta.total)} of {meta.total}
            </p>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                disabled={page <= 1 || listLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                    acc.push('…');
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '…' ? (
                    <span key={`e-${idx}`} className="px-2 text-xs text-gray-400">…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      disabled={listLoading}
                      onClick={() => setPage(p as number)}
                      className={`min-w-[2rem] px-2 py-1.5 text-xs font-medium rounded-lg cursor-pointer ${
                        page === p ? 'bg-gray-900 text-white' : 'border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                type="button"
                disabled={page >= totalPages || listLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {(selectedPrId !== null) && (
        <PRDetailDrawer
          pr={drawerPR}
          loading={drawerLoading}
          onClose={closeDrawer}
        />
      )}
    </DashboardLayout>
  );
}
