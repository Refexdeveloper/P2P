import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { PM_BTN_PRIMARY, PM_BTN_SECONDARY, PM_PAGE_BG } from '../../../constants/pmTheme';
import { poApi, rfqApi, taskApi, PostRfqPendingItem } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import FinancialInsightsDashboard from '../../dashboard/page';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

const softWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;

const softCard =
  'relative overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]';

const KPI_THEMES = [
  { value: '#F59E0B', iconBg: '#FEF3C7', wash: 'rgba(245, 158, 11, 0.14)' },
  { value: '#EF4444', iconBg: '#FEE2E2', wash: 'rgba(239, 68, 68, 0.12)' },
  { value: '#1E88E5', iconBg: '#E3F2FD', wash: 'rgba(30, 136, 229, 0.14)' },
  { value: '#43A047', iconBg: '#E8F5E9', wash: 'rgba(67, 160, 71, 0.14)' },
] as const;

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

type PoRow = {
  id: number;
  poNumber: string;
  vendorName?: string;
  grandTotal?: number;
  status?: string;
  prTitle?: string;
  createdAt?: string;
};

export default function ScmManagerDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [pendingPos, setPendingPos] = useState<PoRow[]>([]);
  const [approvedPos, setApprovedPos] = useState(0);
  const [rejectedPos, setRejectedPos] = useState(0);
  const [rfqPending, setRfqPending] = useState<PostRfqPendingItem[]>([]);
  const [taskCount, setTaskCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, allRes, rfqRes, taskRes] = await Promise.all([
        poApi.listPending().catch(() => ({ data: [] as unknown[] })),
        poApi.list().catch(() => ({ data: [] as unknown[] })),
        rfqApi.listPostApprovalPending().catch(() => ({ data: [] as PostRfqPendingItem[] })),
        taskApi.list().catch(() => ({ data: [] as unknown[] })),
      ]);

      const isPendingSign = (status?: string) => {
        const s = String(status || '').toLowerCase();
        return (
          s === 'pending scm manager sign' ||
          s === 'pending approval' ||
          s === 'pending_approval'
        );
      };
      const isRejectedLike = (status?: string) => {
        const s = String(status || '').toLowerCase();
        return s === 'po rejected' || s === 'rejected';
      };
      const isApprovedLike = (status?: string) => {
        const s = String(status || '');
        if (!s || isPendingSign(s) || isRejectedLike(s)) return false;
        const lower = s.toLowerCase();
        if (lower === 'draft' || lower === 'cancelled' || lower === 'imported') return false;
        return true;
      };

      const pendingFromApi = (pendingRes.data as PoRow[]) || [];
      const allPos = (allRes.data as PoRow[]) || [];
      const pending =
        pendingFromApi.length > 0
          ? pendingFromApi
          : allPos.filter((p) => isPendingSign(p.status));
      const approved = allPos.filter((p) => isApprovedLike(p.status));
      const rejected = allPos.filter((p) => isRejectedLike(p.status));

      setPendingPos(pending);
      setApprovedPos(approved.length);
      setRejectedPos(rejected.length);
      setRfqPending(rfqRes.data || []);
      const tasks = (taskRes.data as Array<{ status?: string }>) || [];
      setTaskCount(
        tasks.filter((t) => {
          const s = String(t.status || '').toLowerCase();
          return !s || s === 'pending_approval' || s === 'pending';
        }).length
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingValue = pendingPos.reduce((s, p) => s + (Number(p.grandTotal) || 0), 0);
  const rfqEntryCount = rfqPending.length;
  const needsAction = rfqEntryCount > 0 || taskCount > 0 || pendingPos.length > 0;

  const kpiCards = [
    {
      label: 'PO Pending Approval',
      value: pendingPos.length,
      sub: pendingValue ? formatCurrency(pendingValue) : 'Awaiting your sign-off',
      icon: 'ri-checkbox-circle-line',
      to: '/scm/po-approval',
      theme: KPI_THEMES[0],
      highlight: pendingPos.length > 0,
    },
    {
      label: 'RFQ Entry Pending',
      value: rfqEntryCount,
      sub: rfqEntryCount
        ? `${rfqEntryCount} vendor / post-RFQ awaiting you`
        : 'No RFQ entry pending',
      icon: 'ri-file-list-line',
      to: '/rfq-approval',
      theme: KPI_THEMES[1],
      highlight: rfqEntryCount > 0,
    },
    {
      label: 'My Tasks Pending',
      value: taskCount,
      sub: taskCount
        ? `${taskCount} open workflow task${taskCount === 1 ? '' : 's'}`
        : 'No tasks pending',
      icon: 'ri-task-line',
      to: '/tasks',
      theme: KPI_THEMES[2],
      highlight: taskCount > 0,
    },
    {
      label: 'PO Approved',
      value: approvedPos,
      sub: 'Signed / sent / buyer verify',
      icon: 'ri-check-double-line',
      to: '/scm/po-approval',
      theme: KPI_THEMES[3],
      highlight: false,
    },
  ];

  if (showDetailedView) {
    return (
      <DashboardLayout>
        <FinancialInsightsDashboard
          embedded
          onBack={() => setShowDetailedView(false)}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-full font-sans text-[#0F172A]" style={{ background: PM_PAGE_BG }}>
        <div className="p-2 pb-6 sm:p-4 lg:p-6">
          <header className="mb-4 border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-1 pb-3 pt-1 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.12)] backdrop-blur-md sm:mb-5 sm:px-0 sm:pb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
              <div className="min-w-0 shrink text-center lg:text-left">
                <h1 className="text-base font-semibold leading-snug tracking-tight text-slate-800 sm:text-2xl md:text-3xl">
                  {greetingForNow()},{' '}
                  <span className="font-semibold text-slate-900">
                    {user?.name || 'SCM Manager'}
                  </span>
                </h1>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500 lg:text-sm">
                  SCM Manager Dashboard — PO sign-off, RFQ Entry &amp; My Tasks
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
                <button type="button" onClick={() => load()} className={PM_BTN_SECONDARY}>
                  <i className="ri-refresh-line"></i>
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setShowDetailedView(true)}
                  className={PM_BTN_PRIMARY}
                >
                  <i className="ri-bar-chart-box-line"></i>
                  Detailed view
                </button>
              </div>
            </div>
          </header>

          {loading ? (
            <p className="mb-6 text-sm text-slate-500">Loading dashboard…</p>
          ) : null}

          {needsAction && (
            <div
              className={`${softCard} mb-5 border border-[#BBDEFB]/80 bg-gradient-to-r from-white to-[#E3F2FD]/50`}
            >
              <div className="pointer-events-none absolute inset-0" style={softWash} />
              <div className="relative z-[1] flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1E88E5] px-2.5 py-1 text-xs font-bold text-white">
                  Action needed
                </span>
                {pendingPos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate('/scm/po-approval')}
                    className="cursor-pointer text-sm font-semibold text-[#1565C0] hover:underline"
                  >
                    PO pending: {pendingPos.length}
                  </button>
                )}
                {rfqEntryCount > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate('/rfq-approval')}
                    className="cursor-pointer text-sm font-semibold text-[#1565C0] hover:underline"
                  >
                    RFQ Entry pending: {rfqEntryCount}
                  </button>
                )}
                {taskCount > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate('/tasks')}
                    className="cursor-pointer text-sm font-semibold text-[#1565C0] hover:underline"
                  >
                    My Tasks pending: {taskCount}
                  </button>
                )}
              </div>
            </div>
          )}

          <section className="mb-6">
            <div className="mb-1.5 px-0.5 sm:mb-3">
              <h2 className="text-xs font-bold tracking-wide text-slate-700 sm:text-base">
                Work Insights
              </h2>
            </div>
            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
              {kpiCards.map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => navigate(card.to)}
                  className={`group relative box-border flex h-full min-h-[128px] w-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-[box-shadow,border-color] duration-200 hover:border-[#90CAF9] hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)] sm:min-h-[140px] sm:rounded-[18px] sm:p-5 ${
                    card.highlight ? 'border-[#90CAF9]' : 'border-transparent'
                  }`}
                >
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: `radial-gradient(120% 90% at 100% 0%, ${card.theme.wash} 0%, rgba(255,255,255,0) 55%)`,
                    }}
                  />
                  <div className="relative z-[1] flex flex-1 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px]">
                        {card.label}
                      </p>
                      <p
                        className="mt-2 text-3xl font-bold tabular-nums leading-none tracking-tight sm:mt-3 sm:text-[2.15rem]"
                        style={{ color: card.theme.value }}
                      >
                        {card.value}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">{card.sub}</p>
                    </div>
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11"
                      style={{ backgroundColor: card.theme.iconBg, color: card.theme.value }}
                    >
                      <i className={`${card.icon} text-lg sm:text-xl`} aria-hidden />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className={softCard}>
              <div className="pointer-events-none absolute inset-0" style={softWash} />
              <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/40 px-4 py-4 sm:px-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#F59E0B]">
                    <i className="ri-checkbox-circle-line text-lg"></i>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#2C3E50] sm:text-base">PO Approvals</h2>
                    <p className="text-xs text-slate-500">Sign &amp; approve purchase orders</p>
                  </div>
                </div>
                <Link
                  to="/scm/po-approval"
                  className="text-xs font-semibold text-[#1E88E5] transition-colors hover:text-[#1565C0]"
                >
                  Open queue →
                </Link>
              </div>
              <div className="relative z-[1] max-h-[420px] space-y-2 overflow-y-auto p-3">
                {pendingPos.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-slate-400">
                    No POs pending your approval
                  </p>
                ) : (
                  pendingPos.map((po) => (
                    <button
                      key={po.id || po.poNumber}
                      type="button"
                      onClick={() => navigate('/scm/po-approval')}
                      className="relative flex w-full cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-2xl border border-transparent bg-white px-3.5 py-3 text-left shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] transition-[border-color] hover:border-[#90CAF9] sm:rounded-[18px]"
                    >
                      <div className="pointer-events-none absolute inset-0" style={softWash} />
                      <div className="relative z-[1] min-w-0">
                        <p className="truncate text-sm font-bold text-[#1E88E5]">{po.poNumber}</p>
                        <p className="truncate text-xs text-slate-500">
                          {po.vendorName || '—'} · {po.prTitle || 'PO'}
                        </p>
                      </div>
                      <p className="relative z-[1] shrink-0 text-sm font-bold tabular-nums text-[#2C3E50]">
                        {formatCurrency(Number(po.grandTotal) || 0)}
                      </p>
                    </button>
                  ))
                )}
              </div>
              {pendingPos.length > 0 && (
                <div className="relative z-[1] flex items-center justify-between border-t border-slate-100/80 px-4 py-2.5 text-xs text-slate-600 sm:px-5">
                  <span>
                    {pendingPos.length} pending PO{pendingPos.length !== 1 ? 's' : ''}
                  </span>
                  <Link
                    to="/scm/po-approval"
                    className="font-semibold text-[#1E88E5] hover:text-[#1565C0]"
                  >
                    View all →
                  </Link>
                </div>
              )}
              {rejectedPos > 0 && (
                <div className="relative z-[1] border-t border-rose-100 bg-rose-50/70 px-4 py-3 text-xs text-rose-700 sm:px-5">
                  {rejectedPos} rejected PO{rejectedPos !== 1 ? 's' : ''} in history
                </div>
              )}
            </div>

            <div
              className={`${softCard} ${
                rfqEntryCount > 0 ? 'ring-1 ring-[#90CAF9]' : ''
              }`}
            >
              <div className="pointer-events-none absolute inset-0" style={softWash} />
              <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/40 px-4 py-4 sm:px-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#EF4444]">
                    <i className="ri-file-list-line text-lg"></i>
                  </div>
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-[#2C3E50] sm:text-base">
                      RFQ Entry
                      {rfqEntryCount > 0 && (
                        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#1E88E5] px-1.5 text-[11px] font-bold text-white">
                          {rfqEntryCount}
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-500">
                      SCM Manager vendor / post-RFQ decisions
                    </p>
                  </div>
                </div>
                <Link
                  to="/rfq-approval"
                  className="text-xs font-semibold text-[#1E88E5] transition-colors hover:text-[#1565C0]"
                >
                  Open queue →
                </Link>
              </div>
              <div className="relative z-[1] max-h-[420px] space-y-2 overflow-y-auto p-3">
                {rfqPending.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-slate-400">No RFQ entry pending</p>
                ) : (
                  rfqPending.map((item) => (
                    <button
                      key={item.prId}
                      type="button"
                      onClick={() => navigate(`/rfq-approval/${item.prId}`)}
                      className="relative flex w-full cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-2xl border border-transparent bg-white px-3.5 py-3 text-left shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] transition-[border-color] hover:border-[#90CAF9] sm:rounded-[18px]"
                    >
                      <div className="pointer-events-none absolute inset-0" style={softWash} />
                      <div className="relative z-[1] min-w-0">
                        <p className="truncate text-sm font-bold text-[#1E88E5]">
                          {item.prNumber || `PR #${item.prId}`}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {item.title || item.stageLabel || 'RFQ entry'}
                        </p>
                      </div>
                      <i className="relative z-[1] ri-arrow-right-s-line text-lg text-slate-400"></i>
                    </button>
                  ))
                )}
              </div>
              {rfqPending.length > 0 && (
                <div className="relative z-[1] flex items-center justify-between border-t border-slate-100/80 px-4 py-2.5 text-xs text-slate-600 sm:px-5">
                  <span>
                    {rfqPending.length} RFQ entr{rfqPending.length !== 1 ? 'ies' : 'y'} pending
                  </span>
                  <Link
                    to="/rfq-approval"
                    className="font-semibold text-[#1E88E5] hover:text-[#1565C0]"
                  >
                    View all →
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div
            className={`${softCard} mb-5 ${taskCount > 0 ? 'ring-1 ring-[#90CAF9]' : ''}`}
          >
            <div className="pointer-events-none absolute inset-0" style={softWash} />
            <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/40 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E3F2FD] text-[#1E88E5]">
                  <i className="ri-task-line text-lg"></i>
                </div>
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-[#2C3E50] sm:text-base">
                    My Tasks
                    {taskCount > 0 && (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#1E88E5] px-1.5 text-[11px] font-bold text-white">
                        {taskCount}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500">Workflow tasks pending your action</p>
                </div>
              </div>
              <Link
                to="/tasks"
                className="text-xs font-semibold text-[#1E88E5] transition-colors hover:text-[#1565C0]"
              >
                Open My Tasks →
              </Link>
            </div>
            <div className="relative z-[1] px-5 py-8 text-center">
              {taskCount === 0 ? (
                <p className="text-sm text-slate-400">No tasks pending</p>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/tasks')}
                  className={PM_BTN_PRIMARY}
                >
                  <i className="ri-task-line"></i>
                  {taskCount} task{taskCount === 1 ? '' : 's'} pending — open My Tasks
                </button>
              )}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1E88E5] to-[#1565C0] p-5 shadow-[0_14px_32px_-14px_rgba(21,101,192,0.45)] sm:rounded-[18px]">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background:
                  'radial-gradient(90% 120% at 100% 0%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 55%)',
              }}
            />
            <div className="relative z-[1] flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm text-sky-100">Quick actions</p>
                <p className="mt-0.5 text-lg font-bold text-white">Jump to your queues</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/scm/po-approval"
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#1565C0] transition-colors hover:bg-sky-50"
                >
                  PO Approval
                </Link>
                <Link
                  to="/rfq-approval"
                  className="rounded-xl border border-white/35 bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/25"
                >
                  RFQ Entry
                </Link>
                <Link
                  to="/tasks"
                  className="rounded-xl border border-white/35 bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/25"
                >
                  My Tasks
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
