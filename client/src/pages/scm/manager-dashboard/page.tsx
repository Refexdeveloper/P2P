import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { poApi, rfqApi, taskApi, PostRfqPendingItem } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

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
      const isApprovedLike = (status?: string) => {
        const s = String(status || '');
        return (
          s === 'PO Approved' ||
          s === 'Sent to Vendor' ||
          s === 'Pending Vendor Acceptance' ||
          s === 'Vendor Accepted' ||
          s === 'Partially Accepted' ||
          s === 'SCM Manager Signed — Buyer Verify' ||
          s === 'Pending Buyer Verify'
        );
      };

      const pendingFromApi = (pendingRes.data as PoRow[]) || [];
      const allPos = (allRes.data as PoRow[]) || [];
      const pending =
        pendingFromApi.length > 0
          ? pendingFromApi
          : allPos.filter((p) => isPendingSign(p.status));
      const approved = allPos.filter((p) => isApprovedLike(p.status));
      const rejected = allPos.filter((p) => p.status === 'PO Rejected');

      setPendingPos(pending);
      setApprovedPos(approved.length);
      setRejectedPos(rejected.length);
      setRfqPending(rfqRes.data || []);
      setTaskCount((taskRes.data as unknown[])?.length || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingValue = pendingPos.reduce((s, p) => s + (Number(p.grandTotal) || 0), 0);

  const cards = [
    {
      label: 'PO Pending Approval',
      value: pendingPos.length,
      sub: pendingValue ? formatCurrency(pendingValue) : 'Awaiting your sign-off',
      icon: 'ri-checkbox-circle-line',
      color: 'amber',
      to: '/scm/po-approval',
    },
    {
      label: 'RFQ Approvals',
      value: rfqPending.length,
      sub: 'Vendor / post-RFQ queue',
      icon: 'ri-bar-chart-box-line',
      color: 'teal',
      to: '/rfq-approval',
    },
    {
      label: 'PO Approved',
      value: approvedPos,
      sub: 'Signed / sent / buyer verify',
      icon: 'ri-check-double-line',
      color: 'emerald',
      to: '/scm/po-approval',
    },
    {
      label: 'My Tasks',
      value: taskCount,
      sub: 'Open workflow tasks',
      icon: 'ri-task-line',
      color: 'slate',
      to: '/tasks',
    },
  ] as const;

  const colorMap: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-100',
      iconBg: 'bg-amber-100',
    },
    teal: {
      bg: 'bg-teal-50',
      text: 'text-teal-700',
      border: 'border-teal-100',
      iconBg: 'bg-teal-100',
    },
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-100',
      iconBg: 'bg-emerald-100',
    },
    slate: {
      bg: 'bg-slate-50',
      text: 'text-slate-700',
      border: 'border-slate-100',
      iconBg: 'bg-slate-100',
    },
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SCM Manager Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome{user?.name ? `, ${user.name}` : ''} — review PO sign-offs and RFQ approvals
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
        >
          <i className="ri-refresh-line mr-1"></i>
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 mb-6">Loading dashboard…</p>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {cards.map((card) => {
          const c = colorMap[card.color];
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => navigate(card.to)}
              className={`text-left bg-white rounded-xl border ${c.border} p-5 hover:shadow-md transition-shadow cursor-pointer`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900">{card.value}</p>
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
          <div className="divide-y divide-gray-50">
            {pendingPos.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No POs pending your approval</p>
            ) : (
              pendingPos.slice(0, 5).map((po) => (
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
          {rejectedPos > 0 && (
            <div className="px-5 py-3 bg-red-50 border-t border-red-100 text-xs text-red-700">
              {rejectedPos} rejected PO{rejectedPos !== 1 ? 's' : ''} in history
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">RFQ Approvals</h2>
              <p className="text-xs text-gray-500">Vendor selection &amp; post-RFQ decisions</p>
            </div>
            <Link to="/rfq-approval" className="text-xs font-semibold text-teal-700 hover:text-teal-900">
              Open queue →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {rfqPending.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No RFQ approvals waiting</p>
            ) : (
              rfqPending.slice(0, 5).map((item) => (
                <button
                  key={item.prId}
                  type="button"
                  onClick={() => navigate(`/rfq-approval/${item.prId}`)}
                  className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-teal-700 truncate">
                      {item.prNumber || `PR #${item.prId}`}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {item.title || item.stageLabel || 'RFQ approval'}
                    </p>
                  </div>
                  <i className="ri-arrow-right-s-line text-gray-400 text-lg"></i>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-teal-100 text-sm">Quick actions</p>
          <p className="text-white text-lg font-bold mt-0.5">Jump to your approval queues</p>
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
            RFQ Approval
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
