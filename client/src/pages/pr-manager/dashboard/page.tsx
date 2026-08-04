import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import StatsCards from './components/StatsCards';
import DepartmentBudget from './components/DepartmentBudget';
import PRTable from './components/PRTable';
import ActivityTimeline from './components/ActivityTimeline';
import SLAAlerts from './components/SLAAlerts';
import ApprovalModal from './components/ApprovalModal';
import { prApi } from '../../../services/api';
import { recentActivityData, slaAlertsData } from '../../../mocks/pr-manager-data';

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected' | 'overdue';

interface PRItem {
  id: string;
  prId?: number;
  title: string;
  requester: string;
  department: string;
  amount: number;
  priority: string;
  status: string;
  submittedDate: string;
  dueDate: string;
  isOverdue: boolean;
  justification: string;
  lineItems: Array<{
    item: string;
    category: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  approvalHistory: Array<{
    stage: string;
    user: string;
    role: string;
    date: string;
    status: string;
    remarks: string;
  }>;
}

const PRManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandled = useRef(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [prList, setPrList] = useState<PRItem[]>([]);
  const [stats, setStats] = useState({
    totalPRs: 0,
    pendingApproval: 0,
    approvedThisMonth: 0,
    rejected: 0,
    overdueCount: 0,
    totalSpend: 0,
  });
  const [departmentBudget, setDepartmentBudget] = useState<
    Array<{ department: string; allocated: number; utilized: number; percentage: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    pr: PRItem | null;
    action: 'approve' | 'reject' | 'rework';
  }>({
    isOpen: false,
    pr: null,
    action: 'approve',
  });

  const loadData = useCallback(async () => {
    try {
      const [listRes, statsRes] = await Promise.all([prApi.list(), prApi.managerStats()]);
      setPrList(listRes.data as PRItem[]);
      setStats(statsRes.data.stats as typeof stats);
      setDepartmentBudget(statsRes.data.departmentBudget as typeof departmentBudget);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (loading || deepLinkHandled.current) return;
    const prId = Number(searchParams.get('prId'));
    const action = searchParams.get('action');
    if (!prId || !action) return;

    const actionMap: Record<string, 'approve' | 'reject' | 'rework'> = {
      approve: 'approve',
      reject: 'reject',
      return: 'rework',
      rework: 'rework',
    };
    const modalAction = actionMap[action];
    if (!modalAction) return;

    const pr = prList.find((p) => p.prId === prId);
    if (!pr) return;
    if (pr.status === 'Pending RFQ Manager Approval' && pr.prId) {
      deepLinkHandled.current = true;
      navigate(`/rfq-approval/${pr.prId}?action=${action}`);
      setSearchParams({}, { replace: true });
      return;
    }
    if (pr.status !== 'Pending Approval') return;

    deepLinkHandled.current = true;
    setActiveFilter('pending');
    setModalState({ isOpen: true, pr, action: modalAction });
    setSearchParams({}, { replace: true });
  }, [loading, prList, searchParams, setSearchParams, navigate]);

  const filterPRs = () => {
    let filtered = prList;
    switch (activeFilter) {
      case 'pending':
        filtered = filtered.filter((pr) => pr.status === 'Pending Approval');
        break;
      case 'approved':
        filtered = filtered.filter((pr) => pr.status === 'Approved');
        break;
      case 'rejected':
        filtered = filtered.filter((pr) => pr.status === 'Rejected');
        break;
      case 'overdue':
        filtered = filtered.filter((pr) => pr.isOverdue);
        break;
    }
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (pr) =>
          pr.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          pr.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  };

  const handleApprove = (pr: PRItem) => setModalState({ isOpen: true, pr, action: 'approve' });
  const handleReject = (pr: PRItem) => setModalState({ isOpen: true, pr, action: 'reject' });
  const handleRework = (pr: PRItem) => setModalState({ isOpen: true, pr, action: 'rework' });

  const handleModalConfirm = async (remarks: string) => {
    if (!modalState.pr?.prId) {
      throw new Error('PR ID missing — refresh the page and try again');
    }
    const actionMap = { approve: 'approve' as const, reject: 'reject' as const, rework: 'return' as const };
    await prApi.approve(modalState.pr.prId, actionMap[modalState.action], remarks);
    await loadData();
  };

  const filteredPRs = filterPRs();

  return (
    <DashboardLayout>
      <div className="flex gap-6">
        <div className="flex-1">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">PR Manager Dashboard</h1>
            <p className="text-sm text-gray-600">Review and approve purchase requests from all departments</p>
          </div>

          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          {loading && <div className="mb-4 text-sm text-gray-500">Loading...</div>}

          <StatsCards stats={stats} />
          <DepartmentBudget data={departmentBudget} />

          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Recent PR Activity</h2>
            </div>

            <div className="flex items-center gap-4 mb-5">
              <div className="flex-1 relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  placeholder="Search by PR number or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mb-5 border-b border-gray-200">
              {(
                [
                  ['all', 'All PRs', prList.length],
                  ['pending', 'Pending Approval', prList.filter((p) => p.status === 'Pending Approval').length],
                  ['approved', 'Approved', prList.filter((p) => p.status === 'Approved').length],
                  ['rejected', 'Rejected', prList.filter((p) => p.status === 'Rejected').length],
                  ['overdue', 'Overdue', prList.filter((p) => p.isOverdue).length],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeFilter === key ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>

            <PRTable data={filteredPRs} onApprove={handleApprove} onReject={handleReject} onRework={handleRework} />
          </div>
        </div>

        <div className="w-80 space-y-6">
          <ActivityTimeline data={recentActivityData} />
          <SLAAlerts data={slaAlertsData} />
        </div>
      </div>

      {modalState.isOpen && (
        <ApprovalModal pr={modalState.pr} action={modalState.action} onClose={() => setModalState({ isOpen: false, pr: null, action: 'approve' })} onConfirm={handleModalConfirm} />
      )}
    </DashboardLayout>
  );
};

export default PRManagerDashboard;
