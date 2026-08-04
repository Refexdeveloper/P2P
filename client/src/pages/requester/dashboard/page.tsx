import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import StatusBadge from '../../../components/base/StatusBadge';
import { prApi, taskApi } from '../../../services/api';
import { getRoleHomePath, useAuth } from '../../../contexts/AuthContext';
import PRDetailDrawer, { PRDetail } from './components/PRDetailDrawer';

interface RequesterPR {
  id: string;
  prId: number;
  title: string;
  department: string;
  amount: number;
  status: string;
  date: string;
  items: number;
  requestType: string;
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
}

export default function RequesterDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'draft' | 'pending_approval' | 'approved' | 'returned'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [requesterPRs, setRequesterPRs] = useState<RequesterPR[]>([]);
  const [stats, setStats] = useState({
    myPRCount: 0,
    pendingApprovals: 0,
    returnedForRework: 0,
    poIssued: 0,
    rfqEntryPending: 0,
  });
  const [requesterTasks, setRequesterTasks] = useState<RequesterTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPrId, setSelectedPrId] = useState<number | null>(null);
  const [drawerPR, setDrawerPR] = useState<PRDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'Requester' && !user.isSuperAdmin) {
      navigate(getRoleHomePath(user.role, user.navigation), { replace: true });
    }
  }, [user, navigate]);

  const loadList = useCallback(async () => {
    const [listRes, statsRes, tasksRes] = await Promise.all([
      prApi.list(),
      prApi.requesterStats(),
      taskApi.listRequester(),
    ]);
    setRequesterPRs(listRes.data as RequesterPR[]);
    setStats(statsRes.data as typeof stats);
    setRequesterTasks(tasksRes.data as RequesterTask[]);
  }, []);

  useEffect(() => {
    if (!user || (user.role !== 'Requester' && !user.isSuperAdmin)) {
      setLoading(false);
      return;
    }
    loadList()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [loadList, user]);

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

  const filteredRequests = requesterPRs.filter((pr) => {
    const matchesFilter = filter === 'all' || pr.status === filter;
    const matchesSearch =
      pr.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pr.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const widgetCards = [
    { title: 'My PR Count', value: stats.myPRCount, icon: 'ri-file-list-3-line', textColor: 'text-gray-700', bgColor: 'bg-gray-100', sub: 'Total submitted' },
    { title: 'Pending Approvals', value: stats.pendingApprovals, icon: 'ri-time-line', textColor: 'text-amber-600', bgColor: 'bg-amber-50', sub: 'Awaiting action' },
    { title: 'SLA Breached', value: 0, icon: 'ri-alarm-warning-line', textColor: 'text-red-600', bgColor: 'bg-red-50', sub: 'PRs past 1-day SLA' },
    { title: 'Returned for Rework', value: stats.returnedForRework, icon: 'ri-arrow-go-back-line', textColor: 'text-orange-600', bgColor: 'bg-orange-50', sub: 'Needs resubmission' },
    { title: 'RFQ Entry Tasks', value: stats.rfqEntryPending, icon: 'ri-file-edit-line', textColor: 'text-teal-600', bgColor: 'bg-teal-50', sub: 'Own vendor — after HOD approval' },
    { title: 'PO Issued', value: stats.poIssued, icon: 'ri-checkbox-circle-line', textColor: 'text-emerald-600', bgColor: 'bg-emerald-50', sub: 'Fully processed' },
  ];

  return (
    <DashboardLayout>
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-emerald-600 text-white text-sm font-medium rounded-lg shadow-lg flex items-center gap-2">
          <i className="ri-check-line"></i>
          {toast}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}
      {loading && <div className="mb-4 text-sm text-gray-500">Loading purchase requests...</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        {widgetCards.map((card, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
              </div>
              <div className={`w-10 h-10 ${card.bgColor} rounded-lg flex items-center justify-center`}>
                <i className={`${card.icon} text-xl ${card.textColor}`}></i>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-6">
        <Link to="/requester/create-pr" className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center space-x-2 whitespace-nowrap cursor-pointer">
          <i className="ri-add-line text-lg"></i>
          <span>Create New PR</span>
        </Link>
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
              <p className="text-xs text-gray-500 mt-0.5">Action items after HOD approval</p>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">{task.label}</span>
                      <span className="text-xs text-gray-500">{task.prNumber}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mt-1">{task.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {task.department} · {task.requestType} · ₹{task.totalAmount.toLocaleString('en-IN')}
                      {task.dueDate ? ` · Due ${task.dueDate}` : ''}
                    </p>
                  </div>
                </div>
                <Link
                  to={task.actionPath}
                  className="px-5 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 whitespace-nowrap self-start sm:self-center"
                >
                  <i className="ri-arrow-right-line"></i>
                  Start RFQ Entry
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
                {(['all', 'draft', 'pending_approval', 'approved', 'returned'] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {f === 'all' ? 'All' : f === 'pending_approval' ? 'Pending' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">PR Number</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Title</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Department</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Amount</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRequests.map((request) => (
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
                      {request.status === 'returned' && (
                        <button
                          onClick={() => openDrawer(request.prId)}
                          className="p-1.5 text-orange-600 hover:bg-orange-50 rounded transition-colors cursor-pointer"
                          title="Resubmit"
                        >
                          <i className="ri-refresh-line"></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filteredRequests.length === 0 && (
          <div className="p-12 text-center">
            <i className="ri-file-list-3-line text-5xl text-gray-300 mb-4"></i>
            <p className="text-gray-500 text-sm">No purchase requests found</p>
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
