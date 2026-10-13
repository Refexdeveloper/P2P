import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { poApi, rfqApi, taskApi, PostRfqPendingItem } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import FinancialInsightsDashboard from '../../dashboard/page';
import AnimatedKpiCard, { type KpiVariant } from '../../../components/feature/AnimatedKpiCard';
import '../../../styles/dashboard-fx.css';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

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
      variant: 'pending_approval' as KpiVariant,
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
      variant: 'returned' as KpiVariant,
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
      variant: 'all' as KpiVariant,
      highlight: taskCount > 0,
    },
    {
      label: 'PO Approved',
      value: approvedPos,
      sub: 'Signed / sent / buyer verify',
      icon: 'ri-check-double-line',
      to: '/scm/po-approval',
      variant: 'approved' as KpiVariant,
      highlight: false,
    },
  ];

  const kpiTotal = kpiCards.reduce((sum, c) => sum + (Number(c.value) || 0), 0);

  if (showDetailedView) {
    return (
      <DashboardLayout>
        <FinancialInsightsDashboard
          embedded
          backLabel="Back to SCM Manager Dashboard"
          onBack={() => setShowDetailedView(false)}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="tasks-fx min-h-full font-sans text-[#0F172A]">
        <section className="tfx-hero">
          <div className="tfx-bubbles" aria-hidden="true">
            <i /><i /><i /><i /><i /><i /><i />
          </div>
          <div className="tfx-hero-content">
            <div className="tfx-hi">
              {greetingForNow()}, <span className="tfx-wave">👋</span>
            </div>
            <h1>
              <span className="tfx-shimmer">{user?.name || 'SCM Manager'}</span>
            </h1>
            <p>
              PO sign-off, RFQ entry and your workflow tasks in one place
              <span className="tfx-role-inline"> · SCM Manager</span>
            </p>
          </div>
        </section>

        <section className="tfx-kpis mb-4">
          {loading ? (
            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="min-h-[170px] animate-pulse rounded-[18px] bg-white/90 shadow-[0_10px_30px_rgba(20,90,120,0.08)]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:grid-cols-4">
              {kpiCards.map((card, i) => (
                <AnimatedKpiCard
                  key={card.label}
                  title={card.label}
                  value={card.value}
                  variant={card.variant}
                  index={i}
                  total={kpiTotal}
                  subtitle={card.sub}
                  live={card.highlight}
                  selected={card.highlight}
                  fallbackIcon={card.icon}
                  toastText={`Opening ${card.label}`}
                  onClick={() => navigate(card.to)}
                />
              ))}
            </div>
          )}
        </section>

        <div className="p-2 pb-4 pt-0 sm:p-3 sm:pt-0 lg:p-6 lg:pt-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button type="button" onClick={() => setShowDetailedView(true)} className="tfx-btn primary">
              <i className="ri-bar-chart-box-line text-lg"></i>
              <span>Detailed view</span>
            </button>
            <button type="button" onClick={() => navigate('/scm/po-approval')} className="tfx-btn secondary">
              <i className="ri-checkbox-circle-line text-lg"></i>
              <span>PO Approval</span>
            </button>
            <button type="button" onClick={() => load()} className="tfx-btn secondary">
              <i className="ri-refresh-line text-lg"></i>
              <span>Refresh</span>
            </button>
          </div>

          {needsAction && (
            <div className="mgr-alert mb-5">
              <span className="mgr-alert-tag">
                <i className="tfx-live-dot" aria-hidden /> Action needed
              </span>
              {pendingPos.length > 0 && (
                <button type="button" onClick={() => navigate('/scm/po-approval')} className="mgr-alert-link">
                  PO pending <b>{pendingPos.length}</b>
                </button>
              )}
              {rfqEntryCount > 0 && (
                <button type="button" onClick={() => navigate('/rfq-approval')} className="mgr-alert-link">
                  RFQ Entry pending <b>{rfqEntryCount}</b>
                </button>
              )}
              {taskCount > 0 && (
                <button type="button" onClick={() => navigate('/tasks')} className="mgr-alert-link">
                  My Tasks pending <b>{taskCount}</b>
                </button>
              )}
            </div>
          )}

          <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* PO Approvals */}
            <section className="tfx-panel relative overflow-hidden rounded-2xl border border-white/70 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="tfx-panel-ic flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                    <i className="ri-checkbox-circle-line text-lg" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h2 className="tfx-panel-title text-base font-semibold text-slate-900 sm:text-lg">PO Approvals</h2>
                    <p className="mt-1.5 text-xs text-slate-500 sm:text-sm">Sign &amp; approve purchase orders</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#e6f6f8] px-3 py-1 text-xs font-semibold text-[#0f6b7a]">
                  {pendingPos.length} pending
                </span>
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                {pendingPos.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-slate-400">
                    <i className="ri-checkbox-circle-line mb-2 block text-3xl text-[#c5e6eb]" aria-hidden />
                    No POs pending your approval
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {pendingPos.map((po, rowIndex) => (
                      <button
                        key={po.id || po.poNumber}
                        type="button"
                        onClick={() => navigate('/scm/po-approval')}
                        style={{ '--r': rowIndex } as CSSProperties}
                        className="tfx-list-row flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gradient-to-r hover:from-[#e6f6f8]/60 hover:to-transparent"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e6f6f8] text-[#0f6b7a]">
                            <i className="ri-file-text-line" aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#0f6b7a]">{po.poNumber}</p>
                            <p className="truncate text-xs text-slate-500">
                              {po.vendorName || '—'} · {po.prTitle || 'PO'}
                            </p>
                          </div>
                        </div>
                        <p className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                          {formatCurrency(Number(po.grandTotal) || 0)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {rejectedPos > 0 && (
                <div className="border-t border-rose-100 bg-rose-50/70 px-4 py-2.5 text-xs font-medium text-rose-700">
                  <i className="ri-close-circle-line mr-1" aria-hidden />
                  {rejectedPos} rejected PO{rejectedPos !== 1 ? 's' : ''} in history
                </div>
              )}
              <Link to="/scm/po-approval" className="mgr-foot-link">
                Open PO Approval queue <i className="ri-arrow-right-line" aria-hidden />
              </Link>
            </section>

            {/* RFQ Entry */}
            <section className="tfx-panel relative overflow-hidden rounded-2xl border border-white/70 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="tfx-panel-ic flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                    <i className="ri-file-list-line text-lg" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h2 className="tfx-panel-title text-base font-semibold text-slate-900 sm:text-lg">RFQ Entry</h2>
                    <p className="mt-1.5 text-xs text-slate-500 sm:text-sm">SCM Manager vendor / post-RFQ decisions</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#e6f6f8] px-3 py-1 text-xs font-semibold text-[#0f6b7a]">
                  {rfqEntryCount} pending
                </span>
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                {rfqPending.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-slate-400">
                    <i className="ri-file-list-line mb-2 block text-3xl text-[#c5e6eb]" aria-hidden />
                    No RFQ entry pending
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {rfqPending.map((item, rowIndex) => (
                      <button
                        key={item.prId}
                        type="button"
                        onClick={() => navigate(`/rfq-approval/${item.prId}`)}
                        style={{ '--r': rowIndex } as CSSProperties}
                        className="tfx-list-row flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gradient-to-r hover:from-[#e6f6f8]/60 hover:to-transparent"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff3e3] text-[#f2761c]">
                            <i className="ri-file-edit-line" aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#0f6b7a]">
                              {item.prNumber || `PR #${item.prId}`}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {item.title || item.stageLabel || 'RFQ entry'}
                            </p>
                          </div>
                        </div>
                        <i className="ri-arrow-right-s-line text-lg text-slate-400" aria-hidden />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Link to="/rfq-approval" className="mgr-foot-link">
                Open RFQ Entry queue <i className="ri-arrow-right-line" aria-hidden />
              </Link>
            </section>
          </div>

          {/* My Tasks */}
          <section className="tfx-panel relative mb-5 overflow-hidden rounded-2xl border border-white/70 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="tfx-panel-ic flex h-11 w-11 items-center justify-center rounded-xl">
                  <i className="ri-task-line text-lg" aria-hidden />
                </div>
                <div>
                  <h2 className="tfx-panel-title text-base font-semibold text-slate-900 sm:text-lg">My Tasks</h2>
                  <p className="mt-1.5 text-xs text-slate-500 sm:text-sm">Workflow tasks pending your action</p>
                </div>
              </div>
              {taskCount === 0 ? (
                <span className="text-sm text-slate-400">No tasks pending</span>
              ) : (
                <button type="button" onClick={() => navigate('/tasks')} className="tfx-btn primary">
                  <i className="ri-task-line"></i>
                  {taskCount} task{taskCount === 1 ? '' : 's'} pending — open My Tasks
                </button>
              )}
            </div>
          </section>

          {/* Quick actions */}
          <section className="mgr-quick">
            <div className="tfx-bubbles" aria-hidden="true">
              <i /><i /><i /><i /><i />
            </div>
            <div className="relative z-[1]">
              <p className="text-sm text-white/75">Quick actions</p>
              <p className="mt-0.5 text-lg font-bold text-white">Jump to your queues</p>
            </div>
            <div className="relative z-[1] flex flex-wrap gap-2">
              <Link to="/scm/po-approval" className="mgr-quick-btn solid">
                <i className="ri-checkbox-circle-line" aria-hidden /> PO Approval
              </Link>
              <Link to="/rfq-approval" className="mgr-quick-btn">
                <i className="ri-file-list-line" aria-hidden /> RFQ Entry
              </Link>
              <Link to="/tasks" className="mgr-quick-btn">
                <i className="ri-task-line" aria-hidden /> My Tasks
              </Link>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
