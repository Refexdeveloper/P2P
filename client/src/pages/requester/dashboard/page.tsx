import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import StatusBadge from '../../../components/base/StatusBadge';
import RequesterStatCards, { type RequesterStatCard } from './components/RequesterStatCards';
import { PM_BTN_PRIMARY, PM_BTN_SECONDARY } from '../../../constants/pmTheme';
import PeriodPicker from '../../dashboard/components/PeriodPicker';
import RequesterPrMobileFilters, {
  type PrStatusFilter,
} from './components/RequesterPrMobileFilters';
import { prApi, taskApi, RequesterPrListMeta } from '../../../services/api';
import { getRoleHomePath, useAuth } from '../../../contexts/AuthContext';
import { getUserDesignation } from '../../../utils/roleDisplay';
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
  statusUI?: string;
  statusRaw?: string;
  date: string;
  items: number;
  requestType: string;
  poId?: number | null;
  poNumber?: string;
  poDocumentAvailable?: boolean;
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

function isDraftRequesterPr(request: RequesterPR) {
  const raw = String(request.statusRaw || '').toUpperCase();
  const front = String(request.status || '').toLowerCase();
  return raw === 'DRAFT' || front === 'draft';
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
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
  purchaseType?: string;
  isSass?: boolean;
}

const PAGE_SIZE = 10;

export default function RequesterDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdminEditor = Boolean(user?.role && ADMIN_EDIT_ROLES.includes(user.role));
  const [filter, setFilter] = useState<PrStatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
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
    draft: 0,
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
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'Requester' && !user.isSuperAdmin) {
      navigate(getRoleHomePath(user.role, user.navigation, user.email), { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [filter, debouncedSearch, dateFrom, dateTo]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const listRes = await prApi.list({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: filter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
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
  }, [page, filter, debouncedSearch, dateFrom, dateTo]);

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

  const handleDeleteDraft = async (prId: number) => {
    const request = requesterPRs.find((r) => r.prId === prId);
    const label = request?.id || `PR-${prId}`;
    const ok = window.confirm(`Delete draft ${label}?\n\nThis permanently removes the draft. This cannot be undone.`);
    if (!ok) return;
    setDeletingId(prId);
    setError('');
    try {
      await prApi.deleteDraft(prId);
      if (selectedPrId === prId) closeDrawer();
      await loadList();
      await loadSideData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete draft');
    } finally {
      setDeletingId(null);
    }
  };

  const widgetCards: RequesterStatCard[] = [
    {
      title: 'Total Requests',
      value: Number(stats.myPRCount) || 0,
      icon: 'ri-file-list-3-line',
      filter: 'all',
    },
    {
      title: 'Pending Approval',
      value: Number(stats.pendingApprovals) || 0,
      icon: 'ri-time-line',
      filter: 'pending_approval',
    },
    {
      title: 'Approved',
      value: Number(stats.approved ?? stats.poIssued) || 0,
      icon: 'ri-checkbox-circle-line',
      filter: 'approved',
    },
    {
      title: 'Rejected',
      value: Number(stats.rejected) || 0,
      icon: 'ri-close-circle-line',
      filter: 'rejected',
    },
    {
      title: 'Draft',
      value: Number(stats.draft) || 0,
      icon: 'ri-draft-line',
      filter: 'draft',
    },
    {
      title: 'Open / In Progress',
      value: Number(stats.returnedForRework) || 0,
      icon: 'ri-briefcase-line',
      filter: 'returned',
    },
  ];

  const totalPages = meta.totalPages || 1;
  const roleLabel = getUserDesignation(user) || user?.role || 'Requester';

  const selectCardFilter = (next: PrStatusFilter) => {
    setFilter(next);
    setPage(1);
    requestAnimationFrame(() => {
      document.getElementById('requester-pr-table')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

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

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <section className="mb-6">
        <div className="mb-1.5 px-0.5 sm:mb-3">
          <h2 className="text-xs font-bold tracking-wide text-slate-700 sm:text-base">PR Insights</h2>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:grid-cols-3 xl:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="min-h-[128px] animate-pulse rounded-2xl border border-slate-200/88 bg-white sm:min-h-[140px]"
              />
            ))}
          </div>
        ) : (
          <RequesterStatCards
            cards={widgetCards}
            selectedFilter={filter}
            onSelect={selectCardFilter}
          />
        )}
      </section>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <Link to="/requester/create-pr?new=1" className={PM_BTN_PRIMARY}>
          <i className="ri-add-line text-lg"></i>
          <span>Create New PR</span>
        </Link>
        <Link to="/requester/track-pr" className={PM_BTN_SECONDARY}>
          <i className="ri-search-eye-line text-lg text-[#1E88E5]"></i>
          <span>Track My PRs &amp; SLA</span>
        </Link>
      </div>

      {requesterTasks.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl">
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-teal-50/40 px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F766E]/10 text-[#0F766E]">
                <i className="ri-task-line text-lg" aria-hidden />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-800 sm:text-base">My Tasks</h2>
                <p className="text-[11px] text-slate-500 sm:text-xs">Action items assigned to you</p>
              </div>
            </div>
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-[#0F766E]">
              {requesterTasks.length} pending
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {requesterTasks.map((task) => {
              const isSass =
                Boolean(task.isSass) ||
                ['sass', 'saas', 'cloud_subscription'].includes(
                  String(task.purchaseType || '')
                    .toLowerCase()
                    .replace(/[\s-]+/g, '_')
                );
              return (
                <div
                  key={task.id}
                  className={`flex flex-col gap-4 p-5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                    isSass
                      ? 'border-l-4 border-l-[#0F766E] bg-teal-50/80 hover:bg-teal-50'
                      : 'hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-transparent'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                        isSass ? 'bg-[#0F766E] text-white' : 'bg-[#1E88E5]/10 text-[#1E88E5]'
                      }`}
                    >
                      <i className="ri-file-edit-line text-lg"></i>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            isSass ? 'text-teal-800' : 'text-[#1E88E5]'
                          }`}
                        >
                          {task.label || 'RFQ Entry'}
                        </p>
                        {isSass && (
                          <span className="rounded bg-[#0F766E] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
                            CLOUD SUBSCRIPTION REQUEST
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-[#2C3E50]">{task.prNumber}</p>
                      <p className="mt-0.5 text-sm text-slate-600">{task.title}</p>
                      <p className="mt-1 text-xs text-[#7F8C8D]">
                        {task.department} · {task.requestType} · ₹
                        {Number(task.totalAmount || 0).toLocaleString('en-IN')}
                        {task.dueDate ? ` · Due ${task.dueDate}` : ''}
                      </p>
                    </div>
                  </div>
                  <Link
                    to={task.actionPath || `/requester/rfq-entry/${task.prId}`}
                    className={`${PM_BTN_PRIMARY} self-start sm:self-center`}
                  >
                    <i className="ri-arrow-right-line"></i>
                    {task.cta ||
                      (task.taskType === 'PR_APPROVAL' ? 'Review & Approve' : 'Start RFQ Entry')}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        id="requester-pr-table"
        className="relative scroll-mt-24 overflow-hidden rounded-2xl border border-transparent bg-[#F8FAFC]/90 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]"
      >
        {/* Soft pastel wash — same language as PR Insights cards */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(248,250,252,0) 55%)',
          }}
        />

        {/* Desktop (≥992px) — inline filter toolbar */}
        <div className="relative z-[1] hidden border-b border-slate-100/80 min-[992px]:block">
          <div className="flex flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E3F2FD] text-[#1E88E5] sm:h-11 sm:w-11">
                <i className="ri-file-list-3-line text-lg sm:text-xl" aria-hidden />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px]">
                  Purchase Requests
                </p>
                <h2 className="mt-0.5 text-sm font-semibold text-slate-800 sm:text-base">
                  Recent Purchase Requests
                </h2>
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2.5 sm:gap-3">
              <div className="relative shrink-0">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type="text"
                  placeholder="Search PR..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-11 w-44 rounded-2xl border border-transparent bg-white pl-10 pr-4 text-sm shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] outline-none focus:border-[#90CAF9] focus:ring-2 focus:ring-[#1E88E5]/15 sm:w-52"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {(['all', 'draft', 'pending_approval', 'approved', 'returned', 'rejected'] as const).map(
                  (f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={`h-11 cursor-pointer whitespace-nowrap rounded-2xl px-3.5 text-xs font-semibold transition-all duration-200 ${
                        filter === f
                          ? 'bg-[#1E88E5] text-white shadow-sm hover:bg-[#1565C0]'
                          : 'border border-slate-200 bg-white text-slate-700 hover:border-[#1E88E5]/40 hover:bg-[#E3F2FD]'
                      }`}
                    >
                      {f === 'all'
                        ? 'All'
                        : f === 'pending_approval'
                          ? 'Pending'
                          : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Phone / tablet — Filters bottom sheet */}
        <div className="relative z-[1]">
          <RequesterPrMobileFilters
            value={{
              search: searchTerm,
              status: filter,
              dateFrom,
              dateTo,
            }}
            onApply={(next) => {
              setSearchTerm(next.search);
              setFilter(next.status);
              setDateFrom(next.dateFrom);
              setDateTo(next.dateTo);
              setPage(1);
            }}
          />
        </div>

        <div className="relative z-[1]">
          {listLoading && (
            <div className="absolute inset-0 z-10 flex items-start justify-center bg-white/60 pt-8">
              <span className="rounded-full border border-transparent bg-white px-3 py-1.5 text-xs text-slate-500 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]">
                Loading…
              </span>
            </div>
          )}

          {/* Mobile — spaced soft cards (matches KPI card gaps) */}
          <div className="space-y-3 p-3 sm:space-y-4 sm:p-4 min-[992px]:hidden">
            {requesterPRs.map((request) => (
              <button
                key={request.id}
                type="button"
                onClick={() => openDrawer(request.prId)}
                className="relative w-full cursor-pointer overflow-hidden rounded-2xl border border-transparent bg-white p-4 text-left shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-[box-shadow,border-color] duration-200 hover:border-[#90CAF9] hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)] sm:rounded-[18px] sm:p-5"
              >
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
                  }}
                />
                <div className="relative z-[1]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        PR Number
                      </p>
                      <p className="mt-1.5 break-all text-sm font-bold text-[#1E88E5]">{request.id}</p>
                    </div>
                    <div className="shrink-0">
                      <StatusBadge status={request.statusUI || request.status} />
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      PR Title
                    </p>
                    <p className="mt-1.5 text-sm font-semibold leading-snug text-[#2C3E50]">
                      {request.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {request.items} items · {request.requestType}
                      {request.entityName ? ` · ${request.entityName}` : ''}
                    </p>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Amount
                      </p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-[#2C3E50]">
                        ₹{request.amount.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <p className="pb-0.5 text-xs text-slate-500">{request.date}</p>
                  </div>

                  <div
                    className="mt-4 flex flex-wrap items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="inline-flex items-center gap-1 rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white">
                      <i className="ri-eye-line"></i>
                      View
                    </span>
                    {request.poDocumentAvailable && request.poId ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/requester/po-document?poId=${request.poId}`)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0]"
                      >
                        <i className="ri-file-pdf-2-line"></i>
                        PO
                      </button>
                    ) : null}
                    {(canEditRequesterPr(request, isAdminEditor) ||
                      String(request.status || '').toLowerCase() === 'draft' ||
                      String(request.statusUI || '').toLowerCase().includes('return')) && (
                      <button
                        type="button"
                        onClick={() => navigate(`/requester/edit-pr/${request.prId}`)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0]"
                      >
                        <i
                          className={request.status === 'returned' ? 'ri-refresh-line' : 'ri-edit-line'}
                        ></i>
                        Edit
                      </button>
                    )}
                    {user?.role === 'Requester' && isDraftRequesterPr(request) && (
                      <button
                        type="button"
                        disabled={deletingId === request.prId}
                        onClick={() => void handleDeleteDraft(request.prId)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-transparent bg-[#FFE4E6] px-2.5 py-1.5 text-xs font-semibold text-[#F43F5E] disabled:opacity-50"
                      >
                        <i className="ri-delete-bin-line"></i>
                        {deletingId === request.prId ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Desktop table — sticky PR/Actions aligned with row height; shell mask blocks scroll bleed */}
          <div className="relative z-[1] hidden overflow-x-auto px-0 pb-3 pt-1 min-[992px]:block">
            <table className="w-max min-w-full border-separate border-spacing-x-0 border-spacing-y-3">
              <thead>
                <tr>
                  <th className="sticky left-0 z-30 whitespace-nowrap bg-[#F8FAFC] py-1 pl-5 pr-4 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px]">
                    PR Number
                  </th>
                  <th className="whitespace-nowrap px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px]">
                    PR Title
                  </th>
                  <th className="whitespace-nowrap px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px]">
                    Entity
                  </th>
                  <th className="whitespace-nowrap px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px]">
                    Department
                  </th>
                  <th className="whitespace-nowrap px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px]">
                    Amount
                  </th>
                  <th className="whitespace-nowrap px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px]">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px]">
                    Date
                  </th>
                  <th className="sticky right-0 z-30 whitespace-nowrap bg-[#F8FAFC] py-1 pl-3 pr-5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {requesterPRs.map((request) => (
                  <tr
                    key={request.id}
                    className="group cursor-pointer"
                    onClick={() => openDrawer(request.prId)}
                  >
                    {/* h-px + h-full stretches sticky card to match taller middle cells */}
                    <td className="relative sticky left-0 z-20 h-px bg-[#F8FAFC] p-0 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-3 before:-top-3 before:z-0 before:bg-[#F8FAFC]">
                      <div className="relative z-[1] flex h-full items-center whitespace-nowrap rounded-l-2xl border border-r-0 border-transparent bg-white py-4 pl-5 pr-4 text-sm font-bold text-[#1E88E5] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-[box-shadow,border-color] group-hover:border-[#90CAF9] group-hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)] sm:rounded-l-[18px] sm:py-5">
                        {request.id}
                      </div>
                    </td>
                    <td className="border border-x-0 border-transparent bg-white px-3 py-4 align-middle transition-[border-color] group-hover:border-[#90CAF9] sm:py-5">
                      <p className="whitespace-nowrap text-sm font-semibold text-[#2C3E50]">
                        {request.title}
                      </p>
                      <p className="mt-1 whitespace-nowrap text-xs text-slate-500">
                        {request.items} items · {request.requestType}
                      </p>
                    </td>
                    <td className="border border-x-0 border-transparent bg-white px-3 py-4 align-middle transition-[border-color] group-hover:border-[#90CAF9] sm:py-5">
                      {request.entityName ? (
                        <span className="whitespace-nowrap text-sm font-medium text-[#2C3E50]">
                          {request.entityName}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                      {request.entityCode ? (
                        <p className="mt-1 whitespace-nowrap text-xs text-slate-500">{request.entityCode}</p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap border border-x-0 border-transparent bg-white px-3 py-4 align-middle text-sm text-[#2C3E50] transition-[border-color] group-hover:border-[#90CAF9] sm:py-5">
                      {request.department || '—'}
                    </td>
                    <td className="whitespace-nowrap border border-x-0 border-transparent bg-white px-3 py-4 align-middle text-sm font-bold tabular-nums text-[#2C3E50] transition-[border-color] group-hover:border-[#90CAF9] sm:py-5">
                      ₹{request.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="whitespace-nowrap border border-x-0 border-transparent bg-white px-3 py-4 align-middle transition-[border-color] group-hover:border-[#90CAF9] sm:py-5">
                      <StatusBadge status={request.statusUI || request.status} size="sm" />
                    </td>
                    <td className="whitespace-nowrap border border-x-0 border-transparent bg-white px-3 py-4 align-middle text-sm text-slate-500 transition-[border-color] group-hover:border-[#90CAF9] sm:py-5">
                      {request.date}
                    </td>
                    <td
                      className="relative sticky right-0 z-20 h-px bg-[#F8FAFC] p-0 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-3 before:-top-3 before:z-0 before:bg-[#F8FAFC]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="relative z-[1] flex h-full items-center justify-end gap-1.5 whitespace-nowrap rounded-r-2xl border border-l-0 border-transparent bg-white py-4 pl-3 pr-5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-[box-shadow,border-color] group-hover:border-[#90CAF9] group-hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)] sm:rounded-r-[18px] sm:py-5">
                        <button
                          type="button"
                          onClick={() => openDrawer(request.prId)}
                          className="cursor-pointer rounded-xl bg-[#1E88E5] p-2 text-white transition-colors hover:bg-[#1565C0]"
                          title="View Details"
                        >
                          <i className="ri-eye-line"></i>
                        </button>
                        {request.poDocumentAvailable && request.poId ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/requester/po-document?poId=${request.poId}`)}
                            className="cursor-pointer rounded-xl bg-[#1E88E5] p-2 text-white transition-colors hover:bg-[#1565C0]"
                            title={`View PO ${request.poNumber || ''}`.trim()}
                          >
                            <i className="ri-file-pdf-2-line"></i>
                          </button>
                        ) : request.poId ? (
                          <span
                            className="whitespace-nowrap rounded-xl bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600"
                            title="PO document available after SCM Buyer final verification"
                          >
                            {request.statusUI || 'PO in progress'}
                          </span>
                        ) : null}
                        {(canEditRequesterPr(request, isAdminEditor) ||
                          String(request.status || '').toLowerCase() === 'draft' ||
                          String(request.statusUI || '').toLowerCase().includes('return')) && (
                          <button
                            type="button"
                            onClick={() => navigate(`/requester/edit-pr/${request.prId}`)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1565C0]"
                            title={request.status === 'returned' ? 'Edit & Resubmit' : 'Edit PR'}
                          >
                            <i
                              className={
                                request.status === 'returned' ? 'ri-refresh-line' : 'ri-edit-line'
                              }
                            ></i>
                            Edit
                          </button>
                        )}
                        {user?.role === 'Requester' && isDraftRequesterPr(request) && (
                          <button
                            type="button"
                            disabled={deletingId === request.prId}
                            onClick={() => void handleDeleteDraft(request.prId)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-[#FFE4E6] px-2.5 py-1.5 text-xs font-semibold text-[#F43F5E] disabled:opacity-50"
                            title="Delete draft"
                          >
                            <i className="ri-delete-bin-line"></i>
                            {deletingId === request.prId ? 'Deleting…' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {!loading && !listLoading && requesterPRs.length === 0 && (
          <div className="relative z-[1] p-12 text-center sm:p-14">
            <i className="ri-file-list-3-line mb-4 text-5xl text-slate-200"></i>
            <p className="text-sm text-slate-400">No purchase requests found</p>
          </div>
        )}

        {meta.total > 0 && (
          <div className="relative z-[1] flex flex-col gap-3 border-t border-slate-100/80 px-4 py-4 sm:flex-row sm:items-center sm:px-5 sm:py-5">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * meta.pageSize + 1}–{Math.min(page * meta.pageSize, meta.total)} of{' '}
              {meta.total}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1 || listLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="cursor-pointer rounded-xl border border-transparent bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9] disabled:opacity-40"
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
                    <span key={`e-${idx}`} className="px-2 text-xs text-slate-400">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      disabled={listLoading}
                      onClick={() => setPage(p as number)}
                      className={`flex h-8 min-w-[2rem] cursor-pointer items-center justify-center rounded-xl text-xs font-semibold transition-all ${
                        page === p
                          ? 'bg-[#1E88E5] text-white shadow-sm hover:bg-[#1565C0]'
                          : 'border border-transparent bg-white text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.08)] hover:border-[#90CAF9]'
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
                className="cursor-pointer rounded-xl border border-transparent bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9] disabled:opacity-40"
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
          onDeleteDraft={user?.role === 'Requester' ? handleDeleteDraft : undefined}
          deletingDraft={drawerPR ? deletingId === drawerPR.id : false}
        />
      )}
      </div>
      </div>
    </DashboardLayout>
  );
}
