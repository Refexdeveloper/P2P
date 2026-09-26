import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/feature/DashboardLayout';
import StatusBadge from '../../components/base/StatusBadge';
import PriorityBadge from '../../components/base/PriorityBadge';
import ApprovalModal from './components/ApprovalModal';
import TaskDetailDrawer from './components/TaskDetailDrawer';
import TaskStats, { type TaskStatCard, type TaskStatFilter } from './components/TaskStats';
import { taskApi, prApi, poApi, cloudSubscriptionApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { getUserDesignation } from '../../utils/roleDisplay';
import { formatDisplayDate } from '../../utils/formatDate';
import { formatMoney, normalizeCurrency } from '../../constants/currency';
import TasksMobileFilters from './components/TasksMobileFilters';
import PeriodPicker from '../dashboard/components/PeriodPicker';

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const STAGE_LABELS: Record<string, string> = {
  SUBMITTED: 'PR Submitted',
  HOD_REVIEW: 'L1 Manager Review',
  PR_MANAGER_REVIEW: 'L2 Manager Review',
  CFO_REVIEW: 'Mugesh Approval',
  RFQ_MANAGER_REVIEW: 'L1 Vendor Final',
  RFQ_L2_REVIEW: 'L2 Manager Review',
  RFQ_CFO_REVIEW: 'Mugesh Approval',
  RFQ_SCM_BUYER_SELECTION: 'SCM RFQ',
  BUSINESS_REVIEW: 'SCM Manager Review',
  SCM_PO_CREATE: 'Create PO',
  PO_CREATED: 'PO Created',
  SASS_INVOICE_UPLOAD: 'Mugesh Invoice Upload',
};

function formatApproverStage(pr: Record<string, unknown>, task: { status: string; currentApprover: string }) {
  const ui = String(pr.statusUI || pr.statusFrontend || '').trim();
  const stageRaw = String(pr.currentStage || '').trim();
  const stageNice = STAGE_LABELS[stageRaw] || (stageRaw ? stageRaw.replace(/_/g, ' ') : '');
  if (task.status === 'pending_approval') {
    if (ui && !/^completed$/i.test(ui)) return ui;
    if (stageNice && !/^completed$/i.test(stageNice)) return stageNice;
    return 'Awaiting your approval';
  }
  if (ui) return ui;
  if (stageNice) return stageNice;
  return task.currentApprover && task.currentApprover !== 'Completed' ? task.currentApprover : '—';
}

interface TaskItem {
  id: string;
  prId: number;
  prNumber: string;
  title: string;
  requester: string;
  department: string;
  entityName: string;
  entityCode: string;
  totalAmount: number;
  currency?: string;
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
  statusUI?: string;
  poId?: number;
  isPoSign?: boolean;
  isPoRevise?: boolean;
  vendorSelection?: 'own' | 'scm';
  askBusinessApproval?: boolean;
  requireInvoiceUpload?: boolean;
  purchaseType?: string;
  purchaseTypeLabel?: string;
  isSass?: boolean;
  isSassInvoiceUpload?: boolean;
  isSubscriptionRenewal?: boolean;
  renewalId?: number;
  invoiceId?: number;
}

function isSassTask(task: { isSass?: boolean; purchaseType?: string }) {
  if (task.isSass) return true;
  const t = String(task.purchaseType || '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return (
    t === 'sass' ||
    t === 'saas' ||
    t === 'cloud_subscription' ||
    t === 'online_purchase' ||
    t === 'op'
  );
}

function SassBadge({ label = 'Cloud Subscription' }: { label?: string }) {
  return (
    <span className="px-1.5 py-0.5 bg-teal-100 text-teal-800 text-[10px] font-bold rounded tracking-wide flex-shrink-0">
      {label}
    </span>
  );
}

export default function TasksPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandled = useRef(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionUpdates, setActionUpdates] = useState<Record<string, string>>({});
  const loadTasks = useCallback(async () => {
    try {
      const res = await taskApi.list();
      const mapped = (res.data as Array<Record<string, unknown>>).map((t) => {
        const rawStatus = String(t.status || 'pending_approval');
        const status =
          rawStatus === 'approved' ||
          rawStatus === 'rejected' ||
          rawStatus === 'returned' ||
          rawStatus === 'pending_approval'
            ? rawStatus
            : 'pending_approval';
        return {
          id: String(t.id),
          prId: Number(t.prId),
          prNumber: String(t.prNumber),
          title: String(t.title),
          requester: String(t.requester),
          department: String(t.department || ''),
          entityName: String(t.entityName || ''),
          entityCode: String(t.entityCode || ''),
          totalAmount: Number(t.totalAmount),
          currency: normalizeCurrency(String(t.currency || 'INR')),
          priority: String(t.priority),
          status,
          submittedDate: String(t.submittedDate || ''),
          dueDate: String(t.dueDate || ''),
          slaRemaining: Number(t.slaRemaining) || 0,
          isOverdue: Boolean(t.isOverdue),
          currentApprover: status === 'pending_approval' ? 'Awaiting your approval' : '—',
          lineItems: Number(t.lineItems) || 0,
          requestType: String(t.requestType || 'Opex'),
          requesterAvatar: String(t.requesterAvatar || 'R'),
          requesterRole: String(t.requesterRole || 'Requester'),
          isPostRfq: Boolean(t.isPostRfq),
          actionPath: t.actionPath ? String(t.actionPath) : undefined,
          statusUI: t.statusUI ? String(t.statusUI) : undefined,
          poId: t.poId ? Number(t.poId) : undefined,
          isPoSign: Boolean(t.isPoSign),
          isPoRevise: Boolean(t.isPoRevise),
          vendorSelection: t.vendorSelection === 'own' ? 'own' : 'scm',
          askBusinessApproval: Boolean(t.askBusinessApproval),
          requireInvoiceUpload: Boolean(t.requireInvoiceUpload),
          purchaseType: t.purchaseType ? String(t.purchaseType) : 'purchase_order',
          purchaseTypeLabel: t.purchaseTypeLabel ? String(t.purchaseTypeLabel) : undefined,
          isSass: Boolean(t.isSass),
          isSassInvoiceUpload: Boolean(t.isSassInvoiceUpload),
          isSubscriptionRenewal: Boolean(t.isSubscriptionRenewal),
          renewalId: t.renewalId != null ? Number(t.renewalId) : undefined,
          invoiceId: t.invoiceId != null ? Number(t.invoiceId) : undefined,
        };
      });
      setTasks(mapped);
      setActionUpdates({});
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Persist email deep-link so Approve/Reject/Send Back still open after SSO redirect
  useEffect(() => {
    const prId = searchParams.get('prId');
    const action = searchParams.get('action');
    if (!prId || !action) return;
    try {
      sessionStorage.setItem(
        'p2p_tasks_deep_link',
        JSON.stringify({ prId, action, savedAt: Date.now() })
      );
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  useEffect(() => {
    if (loading || deepLinkHandled.current) return;

    let prId = searchParams.get('prId');
    let rawAction = searchParams.get('action');
    if (!prId || !rawAction) {
      try {
        const raw = sessionStorage.getItem('p2p_tasks_deep_link');
        if (raw) {
          const parsed = JSON.parse(raw) as { prId?: string; action?: string; savedAt?: number };
          const age = Date.now() - Number(parsed.savedAt || 0);
          if (age < 15 * 60 * 1000) {
            prId = prId || parsed.prId || null;
            rawAction = rawAction || parsed.action || null;
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (!prId) return;

    const task = tasks.find((t) => t.prId === Number(prId));
    if (!task || task.status !== 'pending_approval') return;

    // Emails may send action=rework for L2 send-back; treat as return modal
    const action =
      !rawAction || rawAction === 'approve'
        ? 'approve'
        : rawAction === 'rework'
          ? 'return'
          : rawAction;

    if (!['approve', 'reject', 'return'].includes(action)) return;

    try {
      sessionStorage.removeItem('p2p_tasks_deep_link');
    } catch {
      /* ignore */
    }

    if (task.isPostRfq) {
      deepLinkHandled.current = true;
      navigate(`/rfq-approval/${task.prId}?action=${action}&from=tasks`);
      setSearchParams({}, { replace: true });
      return;
    }

    deepLinkHandled.current = true;
    setSelectedTask(task.id);
    setModalState({
      isOpen: true,
      type: action as 'approve' | 'reject' | 'return',
      taskId: task.id,
      prNumber: task.prNumber,
      prTitle: task.title,
      amount: task.totalAmount,
      currency: task.currency || 'INR',
      askBusinessApproval: Boolean(task.askBusinessApproval),
      requireInvoiceUpload: Boolean(
        action === 'approve' && (task.requireInvoiceUpload || task.isSassInvoiceUpload)
      ),
    });
    setSearchParams({}, { replace: true });
  }, [loading, tasks, searchParams, setSearchParams, navigate]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<string>('pending_approval');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [drawerDetail, setDrawerDetail] = useState<{
    id: string;
    prNumber: string;
    title: string;
    requester: string;
    requesterRole: string;
    requesterAvatar: string;
    department: string;
    entityName: string;
    entityCode: string;
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
    vendorSelection?: 'own' | 'scm';
  purchaseType?: string;
  isSass?: boolean;
  requireInvoiceUpload?: boolean;
  isSassInvoiceUpload?: boolean;
  billingLocation?: string;
    billingGstNo?: string;
    billingAddress?: string;
    placeOfDelivery?: string;
    deliveryPoc?: string;
    lineItems: Array<{
      itemName?: string;
      description: string;
      qty: number;
      unit: string;
      unitCost: number;
      total: number;
    }>;
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
    prId?: number;
  } | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'approve' | 'reject' | 'return';
    taskId: string;
    prNumber: string;
    prTitle: string;
    amount: number;
    currency?: string;
    askBusinessApproval?: boolean;
    requireInvoiceUpload?: boolean;
  }>({
    isOpen: false,
    type: 'approve',
    taskId: '',
    prNumber: '',
    prTitle: '',
    amount: 0,
    currency: 'INR',
    askBusinessApproval: false,
    requireInvoiceUpload: false,
  });

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 6000);
  };

  const openPostRfqPage = (task: TaskItem, action?: 'approve' | 'reject' | 'return') => {
    // Buyer Create PO queue → go straight to Create PO
    if (
      user?.role === 'SCM Buyer' &&
      (task.statusUI === 'Pending SCM PO' || task.actionPath?.includes('/rfq-approval/')) &&
      (!action || action === 'approve')
    ) {
      navigate(`/scm/create-po?prId=${task.prId}&from=tasks`);
      return;
    }
    const base = task.actionPath || `/rfq-approval/${task.prId}`;
    const params = new URLSearchParams();
    params.set('from', 'tasks');
    if (action) params.set('action', action);
    navigate(`${base}?${params.toString()}`);
  };

  const openTaskDetail = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Post-RFQ Manager task → vendor comparison page (not PR drawer)
    if (task.isPostRfq || task.actionPath?.includes('/rfq-approval/')) {
      openPostRfqPage(task);
      return;
    }
    if (task.isPoSign || task.actionPath?.includes('/scm/po-approval')) {
      const params = new URLSearchParams();
      params.set('from', 'tasks');
      if (task.poId) params.set('poId', String(task.poId));
      navigate(`/scm/po-approval?${params.toString()}`);
      return;
    }
    if (task.isPoRevise || task.actionPath?.includes('/scm/create-po')) {
      navigate(task.actionPath || `/scm/create-po?poId=${task.poId || ''}&from=tasks`);
      return;
    }
    if (task.actionPath?.includes('/scm/buyer-final-verify')) {
      navigate(`${task.actionPath}?from=tasks`);
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
      entityName: task.entityName,
      entityCode: task.entityCode,
      requestType: task.requestType,
      category: '—',
      priority: task.priority,
      status: task.status,
      totalAmount: task.totalAmount,
      currency: normalizeCurrency(task.currency),
      submittedDate: task.submittedDate,
      requiredDate: '',
      currentApprover: task.currentApprover,
      justification: 'Loading…',
      vendorSelection: task.vendorSelection === 'own' ? 'own' : 'scm',
      purchaseType: task.purchaseType,
      isSass: isSassTask(task),
      requireInvoiceUpload: Boolean(task.requireInvoiceUpload),
      isSassInvoiceUpload: Boolean(task.isSassInvoiceUpload),
      billingLocation: '',
      billingGstNo: '',
      billingAddress: '',
      placeOfDelivery: '',
      deliveryPoc: '',
      lineItems: [],
      approvalHistory: [],
      slaHours: 48,
      slaRemaining: task.slaRemaining,
      isOverdue: task.isOverdue,
      prId: task.prId,
    });

    try {
      const res = await prApi.get(task.prId);
      const pr = res.data as Record<string, unknown>;
      const lineItems = ((pr.lineItems as Array<Record<string, unknown>>) || []).map((li) => {
        const qty = Number(li.quantity ?? li.qty);
        const unitRaw = String(li.unit || '').trim();
        const description = String(li.description || li.item || '');
        const itemName = String(li.itemName || li.item_name || li.item || description || '');
        return {
          itemName,
          description,
          qty: Number.isFinite(qty) && qty > 0 ? qty : 0,
          unit: !unitRaw || /^\d+(\.\d+)?$/.test(unitRaw) ? 'Nos' : unitRaw,
          unitCost: Number(li.unitCost || li.unitPrice || 0),
          total: Number(li.total || 0),
        };
      });
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
      const vendorSelection =
        pr.vendorSelection === 'own' || task.vendorSelection === 'own' ? 'own' : 'scm';

      const purchaseType = String(pr.purchaseType || task.purchaseType || 'purchase_order');
      const isSass =
        isSassTask(task) ||
        ['sass', 'saas', 'cloud_subscription'].includes(
          purchaseType.toLowerCase().replace(/[\s-]+/g, '_')
        );

      setDrawerDetail({
        id: task.id,
        prNumber: String(pr.prNumber || task.prNumber),
        title: String(pr.title || task.title),
        requester: String(pr.requester || task.requester),
        requesterRole: task.requesterRole,
        requesterAvatar: task.requesterAvatar,
        department: String(pr.department || task.department),
        entityName: String(pr.entityName || task.entityName || ''),
        entityCode: String(pr.entityCode || task.entityCode || ''),
        requestType: String(pr.requestType || task.requestType),
        category: firstCategory,
        priority: String(pr.priorityLower || pr.priority || task.priority).toLowerCase(),
        status: task.status === 'pending_approval' ? 'pending_approval' : task.status,
        totalAmount: Number(pr.totalAmount ?? task.totalAmount),
        currency: normalizeCurrency(
          String(pr.currency || task.currency || 'INR')
        ),
        submittedDate: String(pr.submittedDate || task.submittedDate),
        requiredDate: String(pr.requiredDate || ''),
        currentApprover: formatApproverStage(pr, task),
        justification: String(pr.justification || 'No justification provided.'),
        vendorSelection,
        purchaseType,
        isSass,
        requireInvoiceUpload: Boolean(task.requireInvoiceUpload),
        isSassInvoiceUpload: Boolean(task.isSassInvoiceUpload),
        billingLocation: String(pr.billingLocation || ''),
        billingGstNo: String(pr.billingGstNo || ''),
        billingAddress: String(pr.billingAddress || ''),
        placeOfDelivery: String(pr.placeOfDelivery || ''),
        deliveryPoc: String(pr.deliveryPoc || ''),
        lineItems,
        approvalHistory,
        slaHours: 48,
        slaRemaining: task.slaRemaining,
        isOverdue: task.isOverdue,
        prId: task.prId,
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
    if (task.isPoRevise) {
      navigate(task.actionPath || `/scm/create-po?poId=${task.poId || ''}&from=tasks`);
      return;
    }
    if (task.isPoSign && type === 'approve') {
      const params = new URLSearchParams();
      params.set('from', 'tasks');
      if (task.poId) params.set('poId', String(task.poId));
      navigate(`/scm/po-approval?${params.toString()}`);
      return;
    }
    setModalState({
      isOpen: true,
      type,
      taskId,
      prNumber: task.prNumber,
      prTitle: task.title,
      amount: task.totalAmount,
      currency: task.currency || 'INR',
      askBusinessApproval: Boolean(task.askBusinessApproval),
      requireInvoiceUpload: Boolean(
        type === 'approve' && (task.requireInvoiceUpload || task.isSassInvoiceUpload)
      ),
    });
  };

  const handleConfirm = async (
    remarks: string,
    returnTo?: string,
    goToBusinessApproval?: boolean,
    invoice?: {
      fileName: string;
      fileData: string;
      invoiceDate?: string;
      invoiceNumber?: string;
    }
  ) => {
    const { taskId, type, prNumber } = modalState;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new Error('Task not found — refresh My Tasks and try again');
    }
    const action = type === 'approve' ? 'approve' : type === 'return' ? 'return' : 'reject';
    try {
      if (task.isPoSign && task.poId) {
        if (type === 'return') {
          await poApi.sendBack(task.poId, remarks);
        } else if (type === 'reject') {
          await poApi.reject(task.poId, remarks);
        } else {
          throw new Error('PO sign approval must be done from the PO Approval page');
        }
      } else if (task.isSassInvoiceUpload && type === 'approve') {
        if (!invoice?.fileName || !invoice?.fileData) {
          throw new Error('Invoice file is required');
        }
        await prApi.submitSassInvoice(task.prId, {
          invoiceNumber: String(invoice.invoiceNumber || '').trim() || `CS-${task.prId}`,
          fileName: invoice.fileName,
          fileData: invoice.fileData,
          invoiceDate: invoice.invoiceDate,
          remarks,
        });
      } else if (task.isSubscriptionRenewal && task.renewalId) {
        if (type === 'return') {
          throw new Error('Send-back is not available for subscription renewals — approve or reject');
        }
        await cloudSubscriptionApi.approveRenewal(
          task.renewalId,
          type === 'approve' ? 'approve' : 'reject',
          remarks
        );
      } else {
        await prApi.approve(task.prId, action, remarks, {
          ...(type === 'return' && returnTo ? { returnTo } : {}),
          ...(typeof goToBusinessApproval === 'boolean' ? { goToBusinessApproval } : {}),
          ...(invoice ? { invoice } : {}),
        });
      }
      setActionUpdates((prev) => ({
        ...prev,
        [taskId]: type === 'approve' ? 'approved' : type === 'return' ? 'returned' : 'rejected',
      }));
      showToast(
        type === 'approve'
          ? task.isSassInvoiceUpload
            ? `${prNumber} invoice uploaded successfully`
            : `${prNumber} has been approved successfully`
          : type === 'return'
          ? task.isPoSign
            ? `${prNumber} sent back to SCM Buyer for revision`
            : `${prNumber} has been sent back for rework`
          : `${prNumber} has been rejected`,
        type === 'reject' ? 'error' : 'success'
      );
      setModalState((prev) => ({ ...prev, isOpen: false }));
      setSelectedTask(null);
      setDrawerDetail(null);
      if (type === 'approve') setFilter('approved');
      else if (type === 'reject') setFilter('rejected');
      else setFilter('returned');
      await loadTasks();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      showToast(message, 'error');
      throw err instanceof Error ? err : new Error(message);
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
          t.department.toLowerCase().includes(q) ||
          t.entityName.toLowerCase().includes(q) ||
          t.entityCode.toLowerCase().includes(q)
      );
    }

    if (filter === 'overdue') {
      result = result.filter((t) => t.isOverdue && t.status === 'pending_approval');
    } else if (filter !== 'all') {
      result = result.filter((t) => t.status === filter);
    }

    if (priorityFilter !== 'all') {
      result = result.filter((t) => t.priority === priorityFilter);
    }

    if (dateFrom || dateTo) {
      const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
      const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
      result = result.filter((t) => {
        const ts = new Date(t.submittedDate).getTime();
        if (Number.isNaN(ts)) return false;
        if (fromTs != null && ts < fromTs) return false;
        if (toTs != null && ts > toTs) return false;
        return true;
      });
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
      const aCompleted =
        a.status === 'approved' || a.status === 'rejected' || a.status === 'returned';
      const bCompleted =
        b.status === 'approved' || b.status === 'rejected' || b.status === 'returned';
      if (aCompleted && !bCompleted) return 1;
      if (!aCompleted && bCompleted) return -1;
      return 0;
    });

    return result;
  }, [processedTasks, searchTerm, filter, priorityFilter, sortBy, dateFrom, dateTo]);

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
    return { pending, approved, rejected, overdue };
  }, [processedTasks]);

  const formatDate = (dateStr: string) => formatDisplayDate(dateStr);

  const formatAmount = (amount: number, currency?: string) =>
    formatMoney(amount, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getSlaInfo = (task: typeof processedTasks[0]) => {
    if (task.status !== 'pending_approval') return null;
    if (task.isOverdue) return { label: 'Overdue', cls: 'text-red-600 bg-red-50' };
    if (task.slaRemaining <= 8)
      return { label: `${task.slaRemaining}h left`, cls: 'text-red-600 bg-red-50' };
    if (task.slaRemaining <= 24)
      return { label: `${task.slaRemaining}h left`, cls: 'text-sky-700 bg-sky-50' };
    return {
      label: `${Math.ceil(task.slaRemaining / 24)}d left`,
      cls: 'text-emerald-600 bg-emerald-50',
    };
  };

  const widgetCards: TaskStatCard[] = [
    {
      title: 'Pending Approval',
      filter: 'pending_approval',
      value: stats.pending,
      icon: 'ri-time-line',
    },
    {
      title: 'Approved',
      filter: 'approved',
      value: stats.approved,
      icon: 'ri-check-double-line',
    },
    {
      title: 'Rejected',
      filter: 'rejected',
      value: stats.rejected,
      icon: 'ri-close-circle-line',
    },
    {
      title: 'Overdue SLA',
      filter: 'overdue',
      value: stats.overdue,
      icon: 'ri-alarm-warning-line',
    },
  ];

  const roleLabel = getUserDesignation(user) || user?.role || 'Approver';

  const selectCardFilter = (next: TaskStatFilter) => {
    setFilter(next);
    requestAnimationFrame(() => {
      document.getElementById('tasks-pr-table')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const renderRowActions = (task: TaskItem, isPending: boolean, compact = false) => (
    <div
      className={`flex items-center ${compact ? 'gap-1.5 flex-wrap justify-end' : 'gap-1.5'}`}
      onClick={(e) => e.stopPropagation()}
    >
      {(task.isPostRfq || task.actionPath?.includes('/rfq-approval/')) && (
        <button
          onClick={() => openPostRfqPage(task)}
          className="cursor-pointer rounded-xl bg-[#EEF2FF] p-2 text-[#2563EB] transition-colors hover:bg-[#DBEAFE]"
          title="Vendor Comparison"
        >
          <i className="ri-table-line"></i>
        </button>
      )}
      <button
        onClick={() => openTaskDetail(task.id)}
        className="cursor-pointer rounded-xl bg-[#DBEAFE] p-2 text-[#2563EB] transition-colors hover:bg-[#BFDBFE]"
        title={
          task.isPostRfq || task.actionPath?.includes('/rfq-approval/')
            ? 'Open Vendor Comparison'
            : 'View Details'
        }
      >
        <i className="ri-eye-line"></i>
      </button>
      {isPending && task.isPoRevise && (
        <button
          onClick={() => openModal(task.id, 'approve')}
          className="cursor-pointer rounded-xl bg-[#FFEDD5] p-2 text-[#F97316] transition-colors hover:bg-orange-100"
          title="Revise PO"
        >
          <i className="ri-edit-line"></i>
        </button>
      )}
      {isPending && !task.isPoRevise && (
        <>
          <button
            onClick={() => openModal(task.id, 'approve')}
            className={`cursor-pointer rounded-xl p-2 transition-colors ${
              task.isSassInvoiceUpload || task.requireInvoiceUpload
                ? 'bg-teal-50 text-teal-600 hover:bg-teal-100'
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }`}
            title={
              task.isSassInvoiceUpload || task.requireInvoiceUpload
                ? 'Upload Invoice'
                : task.isPostRfq || task.actionPath?.includes('/rfq-approval/')
                  ? 'Approve (Vendor Comparison)'
                  : task.isPoSign
                    ? 'Sign & Approve'
                    : task.actionPath?.includes('/scm/buyer-final-verify')
                      ? 'Verify'
                      : 'Approve'
            }
          >
            <i
              className={
                task.isSassInvoiceUpload || task.requireInvoiceUpload
                  ? 'ri-file-upload-line'
                  : task.isPoSign
                    ? 'ri-quill-pen-line'
                    : 'ri-check-line'
              }
            ></i>
          </button>
          {!task.actionPath?.includes('/scm/buyer-final-verify') &&
            !task.isSassInvoiceUpload &&
            !task.isSubscriptionRenewal && (
            <>
              <button
                onClick={() => openModal(task.id, 'return')}
                className="cursor-pointer rounded-xl bg-[#FFEDD5] p-2 text-[#F97316] transition-colors hover:bg-orange-100"
                title={task.isPoSign ? 'Send Back to Buyer' : 'Send Back'}
              >
                <i className="ri-arrow-go-back-line"></i>
              </button>
              <button
                onClick={() => openModal(task.id, 'reject')}
                className="cursor-pointer rounded-xl bg-[#FFE4E6] p-2 text-[#F43F5E] transition-colors hover:bg-rose-100"
                title="Reject"
              >
                <i className="ri-close-line"></i>
              </button>
            </>
          )}
        </>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div
        className="min-h-full font-sans text-[#0F172A]"
        style={{ background: 'linear-gradient(180deg, #edf1ff 0%, #f6f8ff 45%, #f2ecff 100%)' }}
      >
      <div className="p-2 pb-6 sm:p-4 lg:p-6">
      <header className="mb-4 border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-1 pb-3 pt-1 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.12)] backdrop-blur-md sm:mb-5 sm:px-0 sm:pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="min-w-0 shrink text-center lg:text-left">
            <h1 className="text-base font-semibold leading-snug tracking-tight text-slate-800 sm:text-2xl md:text-3xl">
              {greetingForNow()}, <span className="font-semibold text-slate-900">{user?.name || 'User'}</span>
            </h1>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500 lg:text-sm">
              Logged in as <span className="text-slate-600">{roleLabel}</span>
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-center lg:w-auto lg:justify-end">
            <div className="min-w-[168px] sm:w-[200px]">
              <PeriodPicker
                dateFrom={dateFrom}
                dateTo={dateTo}
                fullWidth
                onChange={({ dateFrom: from, dateTo: to }) => {
                  setDateFrom(from);
                  setDateTo(to);
                }}
              />
            </div>
          </div>
        </div>
      </header>

      <section className="mb-6">
        <div className="mb-1.5 px-0.5 sm:mb-3">
          <h2 className="text-xs font-bold tracking-wide text-slate-700 sm:text-base">Task Insights</h2>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="min-h-[128px] animate-pulse rounded-2xl border border-slate-200/88 bg-white sm:min-h-[140px]"
              />
            ))}
          </div>
        ) : (
          <TaskStats
            cards={widgetCards}
            selectedFilter={filter}
            onSelect={selectCardFilter}
          />
        )}
      </section>

      <div
        id="tasks-pr-table"
        className="relative scroll-mt-24 overflow-hidden rounded-2xl border border-transparent bg-[#F8FAFC]/90 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 100% 0%, rgba(37, 99, 235, 0.10) 0%, rgba(248,250,252,0) 55%)',
          }}
        />

        {/* Desktop (≥992px) inline filters */}
        <div className="relative z-[1] hidden border-b border-slate-100/80 min-[992px]:block">
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 sm:py-5 xl:flex-row xl:items-end xl:justify-between xl:gap-5">
            <div className="flex shrink-0 items-center gap-3 xl:pb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#2563EB] sm:h-11 sm:w-11">
                <i className="ri-task-line text-lg sm:text-xl" aria-hidden />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px]">
                  Approvals
                </p>
                <h2 className="mt-0.5 text-sm font-semibold text-slate-800 sm:text-base">
                  Purchase Request Approvals
                </h2>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3 xl:justify-end xl:gap-4">
              <div className="relative shrink-0">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type="text"
                  placeholder="Search PR..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-11 w-48 rounded-2xl border border-transparent bg-white pl-10 pr-4 text-sm shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] outline-none focus:border-[#93C5FD] focus:ring-2 focus:ring-[#2563EB]/15"
                />
              </div>
              <div className="chip-scroll-fade min-w-0 max-w-full flex-1 xl:flex-none xl:max-w-[min(100%,28rem)]">
                <div className="chip-scroll py-0.5">
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'pending_approval', label: 'Pending' },
                    { key: 'approved', label: 'Approved' },
                    { key: 'rejected', label: 'Rejected' },
                    { key: 'returned', label: 'Returned' },
                    { key: 'overdue', label: 'Overdue' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setFilter(tab.key)}
                      className={`h-11 cursor-pointer whitespace-nowrap rounded-2xl px-3.5 text-xs font-semibold transition-all duration-200 ${
                        filter === tab.key
                          ? 'bg-[#2563EB] text-white shadow-[0_8px_24px_-12px_rgba(37,99,235,0.35)]'
                          : 'border border-transparent bg-white text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.08)] hover:border-[#93C5FD]/60'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 pb-4 sm:gap-3 sm:px-5">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-11 min-w-[140px] cursor-pointer rounded-2xl border border-transparent bg-white px-3 text-sm shadow-[0_8px_24px_-12px_rgba(15,23,42,0.08)] outline-none focus:border-[#93C5FD] focus:ring-2 focus:ring-[#2563EB]/15"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-11 min-w-[180px] cursor-pointer rounded-2xl border border-transparent bg-white px-3 text-sm shadow-[0_8px_24px_-12px_rgba(15,23,42,0.08)] outline-none focus:border-[#93C5FD] focus:ring-2 focus:ring-[#2563EB]/15"
            >
              <option value="sla">Sort: SLA Urgency</option>
              <option value="amount_high">Sort: Amount (High to Low)</option>
              <option value="amount_low">Sort: Amount (Low to High)</option>
              <option value="priority">Sort: Priority</option>
              <option value="date">Sort: Newest First</option>
            </select>

            {(searchTerm || priorityFilter !== 'all' || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setPriorityFilter('all');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="inline-flex h-11 cursor-pointer items-center gap-1 whitespace-nowrap rounded-2xl px-3 text-sm text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
              >
                <i className="ri-filter-off-line"></i> Clear Filters
              </button>
            )}

            <span className="ml-auto self-center whitespace-nowrap text-sm text-slate-500">
              Showing{' '}
              <strong className="text-slate-800">{filteredTasks.length}</strong>{' '}
              request{filteredTasks.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Phone / tablet — Filters bottom sheet */}
        <div className="relative z-[1] border-b border-slate-100/80 px-4 pb-2 pt-4 min-[992px]:hidden">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#2563EB]">
              <i className="ri-task-line text-lg" aria-hidden />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Approvals
              </p>
              <h2 className="text-base font-semibold text-slate-800">Purchase Request Approvals</h2>
            </div>
          </div>
          <TasksMobileFilters
            value={{
              search: searchTerm,
              status: filter,
              priority: priorityFilter,
              sortBy,
              dateFrom,
              dateTo,
            }}
            onApply={(next) => {
              setSearchTerm(next.search);
              setFilter(next.status);
              setPriorityFilter(next.priority);
              setSortBy(next.sortBy);
              setDateFrom(next.dateFrom);
              setDateTo(next.dateTo);
            }}
          />
          <p className="mt-2 text-sm text-slate-500">
            Showing <strong className="text-slate-800">{filteredTasks.length}</strong>{' '}
            request{filteredTasks.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Mobile — soft spaced cards */}
        <div className="relative z-[1] space-y-3 p-3 sm:space-y-4 sm:p-4 min-[992px]:hidden">
          {filteredTasks.map((task) => {
            const slaInfo = getSlaInfo(task);
            const isPending = task.status === 'pending_approval';
            const sass = isSassTask(task);
            return (
              <div
                key={task.id}
                role="button"
                tabIndex={0}
                onClick={() => openTaskDetail(task.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openTaskDetail(task.id);
                  }
                }}
                className={`cursor-pointer overflow-hidden rounded-2xl border border-transparent bg-white p-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-[box-shadow,border-color] duration-200 hover:border-[#93C5FD] hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)] sm:rounded-[18px] sm:p-5 ${
                  task.isOverdue && isPending
                    ? 'ring-1 ring-red-200'
                    : sass
                      ? 'ring-1 ring-teal-200'
                      : ''
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-[#2563EB]">{task.prNumber}</p>
                      {sass && (
                        <SassBadge
                          label={
                            String(task.purchaseType || '')
                              .toLowerCase()
                              .replace(/[\s-]+/g, '_')
                              .includes('online')
                              ? 'Online Purchase'
                              : 'Cloud Subscription'
                          }
                        />
                      )}
                      {(task.isPostRfq || task.actionPath?.includes('/rfq-approval/')) && (
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                          Post-RFQ
                        </span>
                      )}
                    </div>
                    {sass && (
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-teal-700">
                        Cloud Subscription request
                      </p>
                    )}
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#2C3E50]">{task.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {task.lineItems} item{task.lineItems !== 1 ? 's' : ''} · {task.requestType}
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-sm font-bold tabular-nums text-[#2C3E50]">
                    {formatAmount(task.totalAmount, task.currency)}
                  </p>
                </div>

                <div className="mb-3 flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isPending
                        ? 'bg-sky-100 text-sky-800'
                        : task.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {task.requesterAvatar}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#2C3E50]">{task.requester}</p>
                    <p className="truncate text-xs text-slate-500">
                      {task.entityName || '—'}
                      {task.entityCode ? ` (${task.entityCode})` : ''}
                      {' · '}
                      {task.department || '—'}
                      {' · '}
                      {formatDate(task.submittedDate)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={task.priority} size="sm" />
                    <StatusBadge status={task.status} size="sm" />
                    {slaInfo ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${slaInfo.cls}`}
                      >
                        {task.isOverdue && <i className="ri-alarm-warning-line text-xs"></i>}
                        {slaInfo.label}
                      </span>
                    ) : null}
                  </div>
                  {renderRowActions(task, isPending, true)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop table — soft card rows (matches requester) */}
        <div className="relative z-[1] hidden overflow-x-auto px-3 pb-3 pt-1 min-[992px]:block sm:px-4 sm:pb-4">
          <table className="w-full min-w-[1200px] border-separate border-spacing-x-0 border-spacing-y-3">
            <thead>
              <tr>
                {[
                  'PR Number',
                  'Title',
                  'Requester',
                  'Entity',
                  'Department',
                  'Amount',
                  'Priority',
                  'Status',
                  'SLA',
                  'Date',
                  'Actions',
                ].map((label) => (
                  <th
                    key={label}
                    className={`pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px] ${
                      label === 'PR Number' || label === 'Actions' ? 'px-5' : 'px-3'
                    } ${label === 'Amount' || label === 'Actions' ? 'text-right' : 'text-left'}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const slaInfo = getSlaInfo(task);
                const isPending = task.status === 'pending_approval';
                const sass = isSassTask(task);
                const rowOverdue = Boolean(task.isOverdue && isPending);
                const cellBase =
                  'border-transparent bg-white py-4 transition-[border-color] group-hover:border-[#93C5FD] sm:py-5';
                const ringHint = rowOverdue
                  ? 'group-hover:border-red-200'
                  : sass
                    ? 'group-hover:border-teal-200'
                    : 'group-hover:border-[#93C5FD]';

                return (
                  <tr
                    key={task.id}
                    onClick={() => openTaskDetail(task.id)}
                    className="group cursor-pointer"
                  >
                    <td
                      className={`whitespace-nowrap rounded-l-2xl border border-r-0 pl-5 pr-3 text-sm font-bold text-[#2563EB] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-[box-shadow,border-color] group-hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)] sm:rounded-l-[18px] ${cellBase} ${ringHint}`}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate" title={task.prNumber}>
                          {task.prNumber}
                        </span>
                        {sass && (
                          <SassBadge
                            label={
                              String(task.purchaseType || '')
                                .toLowerCase()
                                .replace(/[\s-]+/g, '_')
                                .includes('online')
                                ? 'Online Purchase'
                                : 'Cloud Subscription'
                            }
                          />
                        )}
                      </div>
                    </td>
                    <td className={`max-w-[200px] border border-x-0 px-3 text-sm text-[#2C3E50] ${cellBase} ${ringHint}`}>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="truncate font-semibold" title={task.title}>
                            {task.title}
                          </p>
                          {(task.isPostRfq || task.actionPath?.includes('/rfq-approval/')) && (
                            <span className="flex-shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                              Post-RFQ
                            </span>
                          )}
                        </div>
                        {sass && (
                          <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wide text-teal-700">
                            Cloud Subscription request
                          </p>
                        )}
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {task.lineItems} item{task.lineItems !== 1 ? 's' : ''} · {task.requestType}
                        </p>
                      </div>
                    </td>
                    <td className={`max-w-[140px] border border-x-0 px-3 text-sm text-[#2C3E50] ${cellBase} ${ringHint}`}>
                      <div className="min-w-0">
                        <p className="truncate font-medium" title={task.requester}>
                          {task.requester}
                        </p>
                        <p className="truncate text-xs text-slate-500">{task.requesterRole}</p>
                      </div>
                    </td>
                    <td className={`max-w-[120px] border border-x-0 px-3 text-sm text-[#2C3E50] ${cellBase} ${ringHint}`}>
                      <p className="truncate font-medium" title={task.entityName || undefined}>
                        {task.entityName || '—'}
                      </p>
                      {task.entityCode ? (
                        <p className="truncate text-xs text-slate-500">{task.entityCode}</p>
                      ) : null}
                    </td>
                    <td className={`whitespace-nowrap border border-x-0 px-3 text-sm text-[#2C3E50] ${cellBase} ${ringHint}`}>
                      {task.department || '—'}
                    </td>
                    <td
                      className={`whitespace-nowrap border border-x-0 px-3 text-right text-sm font-bold tabular-nums text-[#2C3E50] ${cellBase} ${ringHint}`}
                    >
                      {formatAmount(task.totalAmount, task.currency)}
                    </td>
                    <td className={`whitespace-nowrap border border-x-0 px-3 ${cellBase} ${ringHint}`}>
                      <PriorityBadge priority={task.priority} size="sm" />
                    </td>
                    <td className={`max-w-[140px] border border-x-0 px-3 ${cellBase} ${ringHint}`}>
                      <div className="max-w-full overflow-hidden">
                        <StatusBadge status={task.status} size="sm" />
                      </div>
                    </td>
                    <td className={`whitespace-nowrap border border-x-0 px-3 text-sm ${cellBase} ${ringHint}`}>
                      {slaInfo ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${slaInfo.cls}`}
                        >
                          {task.isOverdue && <i className="ri-alarm-warning-line text-xs"></i>}
                          {slaInfo.label}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td
                      className={`whitespace-nowrap border border-x-0 px-3 text-sm text-slate-500 ${cellBase} ${ringHint}`}
                    >
                      {formatDate(task.submittedDate)}
                    </td>
                    <td
                      className={`whitespace-nowrap rounded-r-2xl border border-l-0 py-4 pl-3 pr-5 sm:rounded-r-[18px] sm:py-5 ${cellBase} ${ringHint}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-0.5">
                        {renderRowActions(task, isPending)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="relative z-[1] p-8 text-center text-sm text-slate-500">Loading your tasks...</div>
        )}

        {!loading && filteredTasks.length === 0 && (
          <div className="relative z-[1] p-12 text-center sm:p-14">
            <i className="ri-file-list-3-line mb-4 block text-5xl text-slate-200"></i>
            <p className="text-sm text-slate-500">
              {filter === 'approved'
                ? 'No approved items yet'
                : filter === 'rejected'
                  ? 'No rejected items'
                  : filter === 'returned'
                    ? 'No sent-back items'
                    : filter === 'overdue'
                      ? 'No overdue tasks'
                      : 'No pending tasks for your approval'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {filter === 'approved'
                ? 'PRs you approve as User Approval or L2 Manager show here'
                : 'PRs appear here after the previous approver completes their step'}
            </p>
            {(searchTerm || priorityFilter !== 'all' || filter !== 'all' || dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setPriorityFilter('all');
                  setFilter('all');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="mt-3 cursor-pointer whitespace-nowrap rounded-xl bg-[#EEF4FF] px-4 py-2 text-sm font-medium text-[#2563EB] transition-colors hover:bg-[#DBEAFE]"
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
          canAct={
            (processedTasks.find((t) => t.id === selectedTask)?.status || drawerDetail.status) ===
            'pending_approval'
          }
          onClose={() => {
            setSelectedTask(null);
            setDrawerDetail(null);
          }}
          onApprove={(id) => openModal(id, 'approve')}
          onReject={(id) => openModal(id, 'reject')}
          onReturn={(id) => openModal(id, 'return')}
        />
      )}

      {/* Approval/Rejection Modal */}
      <ApprovalModal
        isOpen={modalState.isOpen}
        type={modalState.type}
        prNumber={modalState.prNumber}
        prTitle={modalState.prTitle}
        amount={modalState.amount}
        currency={modalState.currency || 'INR'}
        prId={
          tasks.find((t) => t.id === modalState.taskId)?.isPoSign
            ? undefined
            : tasks.find((t) => t.id === modalState.taskId)?.prId
        }
        askBusinessApproval={Boolean(
          modalState.askBusinessApproval ||
            tasks.find((t) => t.id === modalState.taskId)?.askBusinessApproval
        )}
        requireInvoiceUpload={Boolean(
          modalState.requireInvoiceUpload ||
            (modalState.type === 'approve' &&
              tasks.find((t) => t.id === modalState.taskId)?.requireInvoiceUpload)
        )}
        useAdminTargets={Boolean(
          user?.isSuperAdmin ||
            user?.role === 'Super Admin' ||
            user?.role === 'SCM Manager' ||
            user?.role === 'SCM Buyer'
        )}
        onConfirm={handleConfirm}
        onClose={() =>
          setModalState((prev) => ({ ...prev, isOpen: false }))
        }
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[90] animate-slide-up">
          <div
            className={`flex max-w-md items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${
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
            <span className="break-words">{toastMessage.text}</span>
          </div>
        </div>
      )}
      </div>
      </div>
    </DashboardLayout>
  );
}
