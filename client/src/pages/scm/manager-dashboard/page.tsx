import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { poApi, rfqApi, taskApi, PostRfqPendingItem } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import FinancialInsightsDashboard from '../../dashboard/page';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

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

  const cards = [
    {
      label: 'PO Pending Approval',
      value: pendingPos.length,
      sub: pendingValue ? formatCurrency(pendingValue) : 'Awaiting your sign-off',
      icon: 'ri-checkbox-circle-line',
      color: 'amber',
      to: '/scm/po-approval',
      highlight: pendingPos.length > 0,
    },
    {
      label: 'RFQ Entry Pending',
      value: rfqEntryCount,
      sub: rfqEntryCount
        ? `${rfqEntryCount} vendor / post-RFQ awaiting you`
        : 'No RFQ entry pending',
      icon: 'ri-file-list-line',
      color: 'rose',
      to: '/rfq-approval',
      highlight: rfqEntryCount > 0,
    },
    {
      label: 'My Tasks Pending',
      value: taskCount,
      sub: taskCount ? `${taskCount} open workflow task${taskCount === 1 ? '' : 's'}` : 'No tasks pending',
      icon: 'ri-task-line',
      color: 'rose',
      to: '/tasks',
      highlight: taskCount > 0,
    },
    {
      label: 'PO Approved',
      value: approvedPos,
      sub: 'Signed / sent / buyer verify',
      icon: 'ri-check-double-line',
      color: 'emerald',
      to: '/scm/po-approval',
      highlight: false,
    },
  ] as const;

  const colorMap: Record<string, { bg: string; text: string; border: string; iconBg: string; ring: string }> = {
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-100',
      iconBg: 'bg-amber-100',
      ring: 'ring-amber-200',
    },
    teal: {
      bg: 'bg-teal-50',
      text: 'text-teal-700',
      border: 'border-teal-100',
      iconBg: 'bg-teal-100',
      ring: 'ring-teal-200',
    },
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-100',
      iconBg: 'bg-emerald-100',
      ring: 'ring-emerald-200',
    },
    rose: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      iconBg: 'bg-rose-100',
      ring: 'ring-rose-300',
    },
  };

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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SCM Manager Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome{user?.name ? `, ${user.name}` : ''} — PO sign-off, RFQ Entry &amp; My Tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDetailedView(true)}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm inline-flex items-center gap-1.5"
          >
            <i className="ri-bar-chart-box-line"></i>
            Detailed view
          </button>
          <button
            type="button"
            onClick={() => load()}
            className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
          >
            <i className="ri-refresh-line mr-1"></i>
            Refresh
          </button>
        </div>
      </div>

      {loading ? <p className="text-sm text-gray-500 mb-6">Loading dashboard…</p> : null}

      {(rfqEntryCount > 0 || taskCount > 0) && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-xs font-bold">
            Action needed
          </span>
          {rfqEntryCount > 0 && (
            <button
              type="button"
              onClick={() => navigate('/rfq-approval')}
              className="text-sm font-semibold text-rose-800 hover:underline cursor-pointer"
            >
              RFQ Entry pending: {rfqEntryCount}
            </button>
          )}
          {taskCount > 0 && (
            <button
              type="button"
              onClick={() => navigate('/tasks')}
              className="text-sm font-semibold text-rose-800 hover:underline cursor-pointer"
            >
              My Tasks pending: {taskCount}
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {cards.map((card) => {
          const c = colorMap[card.color];
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => navigate(card.to)}
              className={`text-left bg-white rounded-xl border p-5 hover:shadow-md transition-shadow cursor-pointer ${
                card.highlight ? `${c.border} ring-2 ${c.ring} ${c.bg}` : `${c.border}`
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-2">
                    {card.label}
                    {card.highlight && (
                      <span className="inline-flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold">
                        {card.value}
                      </span>
                    )}
                  </p>
                  <p className={`text-3xl font-bold ${card.highlight ? c.text : 'text-gray-900'}`}>
                    {card.value}
                  </p>
                  <p className={`text-xs mt-1 ${c.text}`}>{card.sub}</p>
                </div>
                <div className={`w-11 h-11 ${c.iconBg} rounded-xl flex items-center justify-center shrink-0`}>
                  <i className={`${card.icon} text-xl ${c.text}`}></i>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">PO Approvals</h2>
              <p className="text-xs text-gray-500">Sign &amp; approve purchase orders</p>
            </div>
            <Link
              to="/scm/po-approval"
              className="text-xs font-semibold text-teal-700 hover:text-teal-900"
            >
              Open queue →
            </Link>
          </div>
          <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
            {pendingPos.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No POs pending your approval</p>
            ) : (
              pendingPos.map((po) => (
                <button
                  key={po.id || po.poNumber}
                  type="button"
                  onClick={() => navigate('/scm/po-approval')}
                  className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-teal-700 truncate">{po.poNumber}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {po.vendorName || '—'} · {po.prTitle || 'PO'}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 whitespace-nowrap">
                    {formatCurrency(Number(po.grandTotal) || 0)}
                  </p>
                </button>
              ))
            )}
          </div>
          {pendingPos.length > 0 && (
            <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-600 flex items-center justify-between">
              <span>
                {pendingPos.length} pending PO{pendingPos.length !== 1 ? 's' : ''}
              </span>
              <Link to="/scm/po-approval" className="font-semibold text-teal-700 hover:text-teal-900">
                View all →
              </Link>
            </div>
          )}
          {rejectedPos > 0 && (
            <div className="px-5 py-3 bg-red-50 border-t border-red-100 text-xs text-red-700">
              {rejectedPos} rejected PO{rejectedPos !== 1 ? 's' : ''} in history
            </div>
          )}
        </div>

        <div
          className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
            rfqEntryCount > 0 ? 'border-rose-200 ring-1 ring-rose-100' : 'border-gray-200'
          }`}
        >
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                RFQ Entry
                {rfqEntryCount > 0 && (
                  <span className="inline-flex min-w-[20px] h-5 px-1.5 items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-bold">
                    {rfqEntryCount}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500">SCM Manager vendor / post-RFQ decisions</p>
            </div>
            <Link to="/rfq-approval" className="text-xs font-semibold text-teal-700 hover:text-teal-900">
              Open queue →
            </Link>
          </div>
          <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
            {rfqPending.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No RFQ entry pending</p>
            ) : (
              rfqPending.map((item) => (
                <button
                  key={item.prId}
                  type="button"
                  onClick={() => navigate(`/rfq-approval/${item.prId}`)}
                  className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-rose-50/60 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-teal-700 truncate">
                      {item.prNumber || `PR #${item.prId}`}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {item.title || item.stageLabel || 'RFQ entry'}
                    </p>
                  </div>
                  <i className="ri-arrow-right-s-line text-gray-400 text-lg"></i>
                </button>
              ))
            )}
          </div>
          {rfqPending.length > 0 && (
            <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-600 flex items-center justify-between">
              <span>
                {rfqPending.length} RFQ entr{rfqPending.length !== 1 ? 'ies' : 'y'} pending
              </span>
              <Link to="/rfq-approval" className="font-semibold text-teal-700 hover:text-teal-900">
                View all →
              </Link>
            </div>
          )}
        </div>
      </div>

      <div
        className={`bg-white rounded-xl border shadow-sm overflow-hidden mb-6 ${
          taskCount > 0 ? 'border-rose-200 ring-1 ring-rose-100' : 'border-gray-200'
        }`}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              My Tasks
              {taskCount > 0 && (
                <span className="inline-flex min-w-[20px] h-5 px-1.5 items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-bold">
                  {taskCount}
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-500">Workflow tasks pending your action</p>
          </div>
          <Link to="/tasks" className="text-xs font-semibold text-teal-700 hover:text-teal-900">
            Open My Tasks →
          </Link>
        </div>
        <div className="px-5 py-6 text-center">
          {taskCount === 0 ? (
            <p className="text-sm text-gray-400">No tasks pending</p>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/tasks')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 cursor-pointer"
            >
              <i className="ri-task-line"></i>
              {taskCount} task{taskCount === 1 ? '' : 's'} pending — open My Tasks
            </button>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-teal-100 text-sm">Quick actions</p>
          <p className="text-white text-lg font-bold mt-0.5">Jump to your queues</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/scm/po-approval"
            className="px-4 py-2 bg-white text-teal-800 rounded-lg text-sm font-semibold hover:bg-teal-50"
          >
            PO Approval
          </Link>
          <Link
            to="/rfq-approval"
            className="px-4 py-2 bg-teal-500/30 text-white border border-white/30 rounded-lg text-sm font-semibold hover:bg-teal-500/50"
          >
            RFQ Entry
          </Link>
          <Link
            to="/tasks"
            className="px-4 py-2 bg-white/15 text-white border border-white/30 rounded-lg text-sm font-semibold hover:bg-white/25"
          >
            My Tasks
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
