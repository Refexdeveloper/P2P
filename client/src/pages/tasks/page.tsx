
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/feature/DashboardLayout';
import StatusBadge from '../../components/base/StatusBadge';
import PriorityBadge from '../../components/base/PriorityBadge';
import ApprovalModal from './components/ApprovalModal';
import TaskDetailDrawer from './components/TaskDetailDrawer';
import { taskApi, prApi } from '../../services/api';

interface TaskItem {
  id: string;
  prId: number;
  prNumber: string;
  title: string;
  requester: string;
  department: string;
  totalAmount: number;
  priority: string;
  status: string;
  submittedDate: string;
  dueDate: string;
  slaRemaining: number;
  isOverdue: boolean;
  currentApprover: string;
  lineItems: number;
  requestType: string;
  requesterAvatar: string;
  requesterRole: string;
  isPostRfq?: boolean;
  actionPath?: string;
}

export default function TasksPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandled = useRef(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const loadTasks = useCallback(async () => {
    try {
      const res = await taskApi.list();
      const mapped = (res.data as Array<Record<string, unknown>>).map((t) => ({
        id: String(t.id),
        prId: Number(t.prId),
        prNumber: String(t.prNumber),
        title: String(t.title),
        requester: String(t.requester),
        department: String(t.department),
        totalAmount: Number(t.totalAmount),
        priority: String(t.priority),
        status: 'pending_approval',
        submittedDate: String(t.submittedDate || ''),
        dueDate: String(t.dueDate || ''),
        slaRemaining: Number(t.slaRemaining) || 24,
        isOverdue: Boolean(t.isOverdue),
        currentApprover: 'You',
        lineItems: Number(t.lineItems) || 0,
        requestType: String(t.requestType || 'Opex'),
        requesterAvatar: String(t.requesterAvatar || 'R'),
        requesterRole: String(t.requesterRole || 'Requester'),
        isPostRfq: Boolean(t.isPostRfq),
        actionPath: t.actionPath ? String(t.actionPath) : undefined,
      }));
      setTasks(mapped);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (loading || deepLinkHandled.current) return;
    const prId = searchParams.get('prId');
    const action = searchParams.get('action');
    if (!prId || !action) return;
    if (!['approve', 'reject', 'return'].includes(action)) return;

    const task = tasks.find((t) => t.prId === Number(prId));
    if (!task || task.status !== 'pending_approval') return;

    if (task.isPostRfq) {
      deepLinkHandled.current = true;
      navigate(`/rfq-approval/${task.prId}?action=${action}`);
      setSearchParams({}, { replace: true });
      return;
    }

    deepLinkHandled.current = true;
    setModalState({
      isOpen: true,
      type: action as 'approve' | 'reject' | 'return',
      taskId: task.id,
      prNumber: task.prNumber,
      prTitle: task.title,
      amount: task.totalAmount,
    });
    setSearchParams({}, { replace: true });
  }, [loading, tasks, searchParams, setSearchParams, navigate]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [actionUpdates, setActionUpdates] = useState<Record<string, string>>({});
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [drawerDetail, setDrawerDetail] = useState<{
    id: string;
    prNumber: string;
    title: string;
    requester: string;
    requesterRole: string;
    requesterAvatar: string;
    department: string;
    requestType: string;
    category: string;
    priority: string;
    status: string;
    totalAmount: number;
    currency: string;
    submittedDate: string;
    requiredDate: string;
    currentApprover: string;
    justification: string;
    lineItems: Array<{ description: string; qty: number; unit: string; unitCost: number; total: number }>;
    approvalHistory: Array<{
      step: string;
      approver: string;
      role: string;
      date: string;
      status: string;
      remarks: string;
    }>;
    slaHours: number;
    slaRemaining: number;
    isOverdue: boolean;
  } | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'approve' | 'reject' | 'return';
    taskId: string;
    prNumber: string;
    prTitle: string;
    amount: number;
  }>({
    isOpen: false,
    type: 'approve',
    taskId: '',
    prNumber: '',
    prTitle: '',
    amount: 0,
  });

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const openPostRfqPage = (task: TaskItem, action?: 'approve' | 'reject' | 'return') => {
    // Buyer Create PO queue → go straight to Create PO
    if (
      user?.role === 'SCM Buyer' &&
      (task.statusUI === 'Pending SCM PO' || task.actionPath?.includes('/rfq-approval/')) &&
      (!action || action === 'approve')
    ) {
      navigate(`/scm/create-po?prId=${task.prId}`);
      return;
    }
    const base = task.actionPath || `/rfq-approval/${task.prId}`;
    const url = action ? `${base}?action=${action}` : base;
    navigate(url);
  };

  const openTaskDetail = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Post-RFQ Manager task → vendor comparison page (not PR drawer)
    if (task.isPostRfq || task.actionPath?.includes('/rfq-approval/')) {
      openPostRfqPage(task);
      return;
    }

    setSelectedTask(taskId);
    setDrawerLoading(true);
    setDrawerDetail({
      id: task.id,
      prNumber: task.prNumber,
      title: task.title,
      requester: task.requester,
      requesterRole: task.requesterRole,
      requesterAvatar: task.requesterAvatar,
      department: task.department,
      requestType: task.requestType,
      category: '—',
      priority: task.priority,
      status: task.status,
      totalAmount: task.totalAmount,
      currency: 'INR',
      submittedDate: task.submittedDate,
      requiredDate: '',
      currentApprover: task.currentApprover,
      justification: 'Loading…',
      lineItems: [],
      approvalHistory: [],
      slaHours: 48,
      slaRemaining: task.slaRemaining,
      isOverdue: task.isOverdue,
    });

    try {
      const res = await prApi.get(task.prId);
      const pr = res.data as Record<string, unknown>;
      const lineItems = ((pr.lineItems as Array<Record<string, unknown>>) || []).map((li) => ({
        description: String(li.description || li.item || ''),
        qty: Number(li.quantity || li.qty || 0),
        unit: String(li.unit || 'Unit'),
        unitCost: Number(li.unitCost || li.unitPrice || 0),
        total: Number(li.total || 0),
      }));
      const approvalHistory = ((pr.approvalHistory as Array<Record<string, unknown>>) || []).map((h) => ({
        step: String(h.stage || h.step || 'Step'),
        approver: String(h.user || h.approver || 'System'),
        role: String(h.role || ''),
        date: String(h.date || h.timestamp || ''),
        status: String(h.status || h.action || ''),
        remarks: String(h.remarks || ''),
      }));
      const firstCategory = lineItems.length
        ? String(((pr.lineItems as Array<Record<string, unknown>>)[0]?.category) || 'General')
        : 'General';

      setDrawerDetail({
        id: task.id,
        prNumber: String(pr.prNumber || task.prNumber),
        title: String(pr.title || task.title),
        requester: String(pr.requester || task.requester),
        requesterRole: task.requesterRole,
        requesterAvatar: task.requesterAvatar,
        department: String(pr.department || task.department),
        requestType: String(pr.requestType || task.requestType),
        category: firstCategory,
        priority: String(pr.priorityLower || pr.priority || task.priority).toLowerCase(),
        status: task.status,
        totalAmount: Number(pr.totalAmount ?? task.totalAmount),
        currency: 'INR',
        submittedDate: String(pr.submittedDate || task.submittedDate),
        requiredDate: String(pr.requiredDate || ''),
        currentApprover: String(pr.currentStage || task.currentApprover),
        justification: String(pr.justification || 'No justification provided.'),
        lineItems,
        approvalHistory,
        slaHours: 48,
        slaRemaining: task.slaRemaining,
        isOverdue: task.isOverdue,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load PR details', 'error');
      setSelectedTask(null);
      setDrawerDetail(null);
    } finally {
      setDrawerLoading(false);
    }
  };

  const openModal = (taskId: string, type: 'approve' | 'reject' | 'return') => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    // Post-RFQ: go to vendor comparison page, then open approval popup there
    if (task.isPostRfq || task.actionPath?.includes('/rfq-approval/')) {
      openPostRfqPage(task, type);
      return;
    }
    setModalState({
      isOpen: true,
      type,
      taskId,
      prNumber: task.prNumber,
      prTitle: task.title,
      amount: task.totalAmount,
    });
  };

  const handleConfirm = async (remarks: string) => {
    const { taskId, type, prNumber } = modalState;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const action = type === 'approve' ? 'approve' : type === 'return' ? 'return' : 'reject';
    try {
      await prApi.approve(task.prId, action, remarks);
      setActionUpdates((prev) => ({
        ...prev,
        [taskId]: type === 'approve' ? 'approved' : type === 'return' ? 'returned' : 'rejected',
      }));
      showToast(
        type === 'approve'
          ? `${prNumber} has been approved successfully`
          : type === 'return'
          ? `${prNumber} has been sent back for rework`
          : `${prNumber} has been rejected`,
        type === 'reject' ? 'error' : 'success'
      );
      setModalState((prev) => ({ ...prev, isOpen: false }));
      setSelectedTask(null);
      setDrawerDetail(null);
      await loadTasks();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', 'error');
    }
  };

  const processedTasks = useMemo(() => {
    return tasks.map((t) => ({
      ...t,
      status: actionUpdates[t.id] || t.status,
    }));
  }, [tasks, actionUpdates]);

  const filteredTasks = useMemo(() => {
    let result = [...processedTasks];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          t.prNumber.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.requester.toLowerCase().includes(q) ||
          t.department.toLowerCase().includes(q)
      );
    }

    if (filter !== 'all') {
      result = result.filter((t) => t.status === filter);
    }

    if (priorityFilter !== 'all') {
      result = result.filter((t) => t.priority === priorityFilter);
    }

    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

    switch (sortBy) {
      case 'sla':
        result.sort((a, b) => {
          if (a.isOverdue && !b.isOverdue) return -1;
          if (!a.isOverdue && b.isOverdue) return 1;
          return a.slaRemaining - b.slaRemaining;
        });
        break;
      case 'amount_high':
        result.sort((a, b) => b.totalAmount - a.totalAmount);
        break;
      case 'amount_low':
        result.sort((a, b) => a.totalAmount - b.totalAmount);
        break;
      case 'priority':
        result.sort(
          (a, b) =>
            (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
        );
        break;
      case 'date':
        result.sort(
          (a, b) =>
            new Date(b.submittedDate).getTime() -
            new Date(a.submittedDate).getTime()
        );
        break;
    }

    // Push completed tasks to the bottom
    result.sort((a, b) => {
      const aCompleted = a.status === 'approved' || a.status === 'rejected';
      const bCompleted = b.status === 'approved' || b.status === 'rejected';
      if (aCompleted && !bCompleted) return 1;
      if (!aCompleted && bCompleted) return -1;
      return 0;
    });

    return result;
  }, [processedTasks, searchTerm, filter, priorityFilter, sortBy]);

  const stats = useMemo(() => {
    const pending = processedTasks.filter(
      (t) => t.status === 'pending_approval'
    ).length;
    const approved = processedTasks.filter((t) => t.status === 'approved')
      .length;
    const rejected = processedTasks.filter((t) => t.status === 'rejected')
      .length;
    const overdue = processedTasks.filter(
      (t) => t.isOverdue && t.status === 'pending_approval'
    ).length;
    const totalValue = processedTasks
      .filter((t) => t.status === 'pending_approval')
      .reduce((sum, t) => sum + t.totalAmount, 0);
    return { pending, approved, rejected, overdue, totalValue };
  }, [processedTasks]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getSlaInfo = (task: typeof processedTasks[0]) => {
    if (task.status !== 'pending_approval') return null;
    if (task.isOverdue) return { label: 'Overdue', cls: 'text-red-600 bg-red-50' };
    if (task.slaRemaining <= 8)
      return { label: `${task.slaRemaining}h left`, cls: 'text-red-600 bg-red-50' };
    if (task.slaRemaining <= 24)
      return { label: `${task.slaRemaining}h left`, cls: 'text-amber-600 bg-amber-50' };
    return {
      label: `${Math.ceil(task.slaRemaining / 24)}d left`,
      cls: 'text-emerald-600 bg-emerald-50',
    };
  };

  const widgetCards = [
    {
      title: 'Pending Approval',
      value: stats.pending,
      icon: 'ri-time-line',
      textColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      title: 'Approved',
      value: stats.approved,
      icon: 'ri-check-double-line',
      textColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Rejected',
      value: stats.rejected,
      icon: 'ri-close-circle-line',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      title: 'Overdue SLA',
      value: stats.overdue,
      icon: 'ri-alarm-warning-line',
      textColor: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ];

  return (
    <DashboardLayout>
      {/* Widget Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {widgetCards.map((card, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
              </div>
              <div className={`w-12 h-12 ${card.bgColor} rounded-lg flex items-center justify-center`}>
                <i className={`${card.icon} text-2xl ${card.textColor}`}></i>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pending Value Banner */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center">
            <i className="ri-money-dollar-circle-line text-xl text-slate-600"></i>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Pending Value</p>
            <p className="text-xl font-bold text-gray-900">
              ${stats.totalValue.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2 whitespace-nowrap cursor-pointer">
            <i className="ri-download-2-line text-base"></i>
            <span>Export</span>
          </button>
          <button className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2 whitespace-nowrap cursor-pointer">
            <i className="ri-refresh-line text-base"></i>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Purchase Request Approvals
            </h2>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  placeholder="Search PR..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent w-full sm:w-64"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'pending_approval', label: 'Pending' },
                  { key: 'approved', label: 'Approved' },
                  { key: 'rejected', label: 'Rejected' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      filter === tab.key
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Secondary Filters */}
          <div className="flex items-center gap-3 mt-4">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white cursor-pointer"
            >
              <option value="sla">Sort: SLA Urgency</option>
              <option value="amount_high">Sort: Amount (High to Low)</option>
              <option value="amount_low">Sort: Amount (Low to High)</option>
              <option value="priority">Sort: Priority</option>
              <option value="date">Sort: Newest First</option>
            </select>

            {(searchTerm || priorityFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setPriorityFilter('all');
                }}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
              >
                <i className="ri-filter-off-line"></i> Clear Filters
              </button>
            )}

            <span className="ml-auto text-sm text-gray-500">
              Showing{' '}
              <strong className="text-gray-900">{filteredTasks.length}</strong>{' '}
              request{filteredTasks.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  'PR Number',
                  'Title',
                  'Requester',
                  'Department',
                  'Amount',
                  'Priority',
                  'Status',
                  'SLA',
                  'Date',
                  'Actions',
                ].map((head) => (
                  <th
                    key={head}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTasks.map((task) => {
                const slaInfo = getSlaInfo(task);
                const isPending = task.status === 'pending_approval';

                return (
                  <tr
                    key={task.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      task.isOverdue && isPending ? 'bg-red-50/40' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {task.prNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{task.title}</p>
                          {(task.isPostRfq || task.actionPath?.includes('/rfq-approval/')) && (
                            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-semibold rounded">
                              Post-RFQ
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-xs mt-1">
                          {task.lineItems} item{task.lineItems !== 1 ? 's' : ''} &middot; {task.requestType}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            isPending
                              ? 'bg-amber-100 text-amber-700'
                              : task.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {task.requesterAvatar}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {task.requester}
                          </p>
                          <p className="text-xs text-gray-500">
                            {task.requesterRole}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {task.department}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      ${task.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <PriorityBadge priority={task.priority} size="sm" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={task.status} size="sm" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {slaInfo ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${slaInfo.cls}`}
                        >
                          {task.isOverdue && (
                            <i className="ri-alarm-warning-line text-xs"></i>
                          )}
                          {slaInfo.label}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatDate(task.submittedDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-1">
                        {(task.isPostRfq || task.actionPath?.includes('/rfq-approval/')) && (
                          <button
                            onClick={() => openPostRfqPage(task)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                            title="Vendor Comparison"
                          >
                            <i className="ri-table-line"></i>
                          </button>
                        )}
                        <button
                          onClick={() => openTaskDetail(task.id)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                          title={
                            task.isPostRfq || task.actionPath?.includes('/rfq-approval/')
                              ? 'Open Vendor Comparison'
                              : 'View Details'
                          }
                        >
                          <i className="ri-eye-line"></i>
                        </button>
                        {isPending && (
                          <>
                            <button
                              onClick={() => openModal(task.id, 'approve')}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                              title={
                                task.isPostRfq || task.actionPath?.includes('/rfq-approval/')
                                  ? 'Approve (Vendor Comparison)'
                                  : 'Approve'
                              }
                            >
                              <i className="ri-check-line"></i>
                            </button>
                            <button
                              onClick={() => openModal(task.id, 'return')}
                              className="p-1.5 text-orange-600 hover:bg-orange-50 rounded transition-colors cursor-pointer"
                              title="Send Back"
                            >
                              <i className="ri-arrow-go-back-line"></i>
                            </button>
                            <button
                              onClick={() => openModal(task.id, 'reject')}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                              title="Reject"
                            >
                              <i className="ri-close-line"></i>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="p-8 text-center text-sm text-gray-500">Loading your tasks...</div>
        )}

        {!loading && filteredTasks.length === 0 && (
          <div className="p-12 text-center">
            <i className="ri-file-list-3-line text-5xl text-gray-300 mb-4 block"></i>
            <p className="text-gray-500 text-sm">No pending tasks for your approval</p>
            <p className="text-gray-400 text-xs mt-1">PRs appear here after the previous approver completes their step</p>
            {(searchTerm || priorityFilter !== 'all' || filter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setPriorityFilter('all');
                  setFilter('all');
                }}
                className="mt-3 px-4 py-2 text-sm font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedTask && drawerDetail && (
        <TaskDetailDrawer
          task={drawerDetail}
          loading={drawerLoading}
          onClose={() => {
            setSelectedTask(null);
            setDrawerDetail(null);
          }}
          onApprove={(id) => openModal(id, 'approve')}
          onReject={(id) => openModal(id, 'reject')}
        />
      )}

      {/* Approval/Rejection Modal */}
      <ApprovalModal
        isOpen={modalState.isOpen}
        type={modalState.type}
        prNumber={modalState.prNumber}
        prTitle={modalState.prTitle}
        amount={modalState.amount}
        onConfirm={handleConfirm}
        onClose={() =>
          setModalState((prev) => ({ ...prev, isOpen: false }))
        }
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div
            className={`px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium ${
              toastMessage.type === 'success'
                ? 'bg-emerald-700 text-white'
                : 'bg-red-700 text-white'
            }`}
          >
            <i
              className={
                toastMessage.type === 'success'
                  ? 'ri-check-double-line'
                  : 'ri-close-circle-line'
              }
            ></i>
            {toastMessage.text}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
