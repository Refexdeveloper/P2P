import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { poApi, rfqApi, taskApi, PostRfqPendingItem } from '../../../services/api';

type DashTask = {
  id: string;
  kind: 'create_po' | 'buyer_verify' | 'vendor_acceptance';
  prId?: number;
  poId?: number;
  number: string;
  title: string;
  path: string;
};

function isPendingStatus(status: string) {
  const s = String(status || '').toLowerCase();
  return s === 'pending_approval' || s === 'pending' || s.includes('pending');
}

function isCreatePoTask(t: Record<string, unknown>) {
  const path = String(t.actionPath || '').toLowerCase();
  const ui = String(t.statusUI || '').toLowerCase();
  return (
    Boolean(t.isPoRevise) ||
    path.includes('/scm/create-po') ||
    ui.includes('pending scm po') ||
    ui.includes('ready for po') ||
    ui.includes('revise po')
  );
}

function isBuyerVerifyTask(t: Record<string, unknown>) {
  const path = String(t.actionPath || '').toLowerCase();
  const ui = String(t.statusUI || '').toLowerCase();
  return path.includes('/scm/buyer-final-verify') || ui.includes('buyer verify') || ui.includes('final verify');
}

export default function SCMPurchaseRequestsPage() {
  const navigate = useNavigate();
  const [rfqPending, setRfqPending] = useState<PostRfqPendingItem[]>([]);
  const [createPoTasks, setCreatePoTasks] = useState<DashTask[]>([]);
  const [verifyTasks, setVerifyTasks] = useState<DashTask[]>([]);
  const [acceptanceTasks, setAcceptanceTasks] = useState<DashTask[]>([]);

  const loadQueues = useCallback(async () => {
    try {
      const [rfqRes, taskRes, readyRes, verifyRes, acceptRes] = await Promise.all([
        rfqApi.listPostApprovalPending().catch(() => ({ data: [] as PostRfqPendingItem[] })),
        taskApi.list().catch(() => ({ data: [] as unknown[] })),
        poApi.listTrack({ page: 1, limit: 100, status: 'ready' }).catch(() => ({ data: [] })),
        poApi.listPendingBuyerVerify().catch(() => ({ data: [] as unknown[] })),
        poApi.listVendorAcceptance().catch(() => ({ data: [] as unknown[] })),
      ]);
      setRfqPending(rfqRes.data || []);

      const createMap = new Map<string, DashTask>();
      const verifyMap = new Map<string, DashTask>();

      ((taskRes.data as Array<Record<string, unknown>>) || []).forEach((t) => {
        if (!isPendingStatus(String(t.status || t.statusUI || ''))) return;
        if (isBuyerVerifyTask(t)) {
          const poId = Number(t.poId || t.taskId) || 0;
          verifyMap.set(`verify-${poId || t.id}`, {
            id: `verify-${poId || t.id}`,
            kind: 'buyer_verify',
            prId: Number(t.prId) || undefined,
            poId: poId || undefined,
            number: String(t.prNumber || t.poNumber || 'PO'),
            title: String(t.title || 'Buyer Final Verify'),
            path: '/scm/buyer-final-verify',
          });
          return;
        }
        if (isCreatePoTask(t)) {
          const prId = Number(t.prId) || 0;
          const poId = Number(t.poId) || 0;
          const path = poId
            ? `/scm/create-po?poId=${poId}&from=dashboard`
            : prId
              ? `/scm/create-po?prId=${prId}&from=dashboard`
              : '/scm/create-po';
          createMap.set(`create-${poId || prId || t.id}`, {
            id: `create-${poId || prId || t.id}`,
            kind: 'create_po',
            prId: prId || undefined,
            poId: poId || undefined,
            number: String(t.prNumber || t.poNumber || 'PR'),
            title: String(t.title || 'Create PO'),
            path,
          });
        }
      });

      ((readyRes.data as Array<Record<string, unknown>>) || []).forEach((r) => {
        const prId = Number(r.prId) || 0;
        if (!prId) return;
        const key = `create-${prId}`;
        if (createMap.has(key)) return;
        createMap.set(key, {
          id: key,
          kind: 'create_po',
          prId,
          number: String(r.prNumber || `PR #${prId}`),
          title: String(r.title || 'Ready for PO'),
          path: `/scm/create-po?prId=${prId}&from=dashboard`,
        });
      });

      ((verifyRes.data as Array<Record<string, unknown>>) || []).forEach((p) => {
        const poId = Number(p.id) || 0;
        if (!poId) return;
        const key = `verify-${poId}`;
        if (verifyMap.has(key)) return;
        verifyMap.set(key, {
          id: key,
          kind: 'buyer_verify',
          poId,
          prId: Number(p.prId) || undefined,
          number: String(p.poNumber || `PO #${poId}`),
          title: String(p.prTitle || p.title || p.vendorName || 'Buyer Final Verify'),
          path: '/scm/buyer-final-verify',
        });
      });

      const acceptRows = ((acceptRes.data as Array<Record<string, unknown>>) || [])
        .filter((p) => String(p.vendorAcceptanceStatus || 'pending').toLowerCase() === 'pending')
        .map((p) => {
          const poId = Number(p.id) || 0;
          return {
            id: `accept-${poId}`,
            kind: 'vendor_acceptance' as const,
            poId,
            prId: Number(p.prId) || undefined,
            number: String(p.poNumber || `PO #${poId}`),
            title: String(p.vendorName || p.prTitle || p.title || 'Vendor Acceptance'),
            path: '/scm/vendor-po-acceptance',
          };
        })
        .filter((t) => t.poId);

      setCreatePoTasks([...createMap.values()]);
      setVerifyTasks([...verifyMap.values()]);
      setAcceptanceTasks(acceptRows);
    } catch {
      setRfqPending([]);
      setCreatePoTasks([]);
      setVerifyTasks([]);
      setAcceptanceTasks([]);
    }
  }, []);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  const rfqPendingCount = rfqPending.filter((i) => i.approvalState === 'pending').length;
  const rfqPendingOnly = rfqPending.filter((i) => i.approvalState === 'pending');

  return (
    <DashboardLayout>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SCM Buyer Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Pending RFQ, Create PO, Buyer Final Verify, and Vendor Acceptance
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/rfq-approval')}
            className="px-4 py-2.5 border border-teal-300 text-teal-800 rounded-lg text-sm font-semibold hover:bg-teal-50 flex items-center gap-2"
          >
            <i className="ri-bar-chart-box-line"></i>
            RFQ Approval
          </button>
          <button
            type="button"
            onClick={() => navigate('/scm/create-po')}
            className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 flex items-center gap-2"
          >
            <i className="ri-shopping-cart-2-line"></i>
            Create PO
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {[
          {
            label: 'Pending RFQ Approval',
            value: rfqPendingCount,
            sub: 'Waiting for SCM Manager',
            icon: 'ri-time-line',
            to: '/rfq-approval',
            border: 'border-amber-100',
            text: 'text-amber-700',
            iconBg: 'bg-amber-100',
          },
          {
            label: 'Create PO',
            value: createPoTasks.length,
            sub: 'Pending Create PO tasks',
            icon: 'ri-shopping-cart-2-line',
            to: '/scm/create-po',
            border: 'border-teal-100',
            text: 'text-teal-700',
            iconBg: 'bg-teal-100',
          },
          {
            label: 'Buyer Final Verify',
            value: verifyTasks.length,
            sub: 'Pending final verify only',
            icon: 'ri-shield-check-line',
            to: '/scm/buyer-final-verify',
            border: 'border-indigo-100',
            text: 'text-indigo-700',
            iconBg: 'bg-indigo-100',
          },
          {
            label: 'Vendor Acceptance',
            value: acceptanceTasks.length,
            sub: 'Pending vendor acceptance only',
            icon: 'ri-handshake-line',
            to: '/scm/vendor-po-acceptance',
            border: 'border-violet-100',
            text: 'text-violet-700',
            iconBg: 'bg-violet-100',
          },
        ].map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => navigate(card.to)}
            className={`text-left bg-white rounded-xl border ${card.border} p-5 hover:shadow-md transition-shadow cursor-pointer`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                <p className={`text-xs mt-1 ${card.text}`}>{card.sub}</p>
              </div>
              <div className={`w-11 h-11 ${card.iconBg} rounded-xl flex items-center justify-center shrink-0`}>
                <i className={`${card.icon} text-xl ${card.text}`}></i>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Pending RFQ Approvals</h2>
              <p className="text-xs text-gray-500">Waiting for SCM Manager</p>
            </div>
            <Link to="/rfq-approval" className="text-xs font-semibold text-teal-700 hover:text-teal-900">
              Open queue →
            </Link>
          </div>
          <div className="divide-y divide-gray-50 max-h-[360px] overflow-y-auto">
            {rfqPendingOnly.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No pending RFQ approvals</p>
            ) : (
              rfqPendingOnly.map((item) => (
                <button
                  key={item.prId}
                  type="button"
                  onClick={() => navigate(`/rfq-approval/${item.prId}?from=rfq-approval`)}
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
                  <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    Pending
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Create PO</h2>
              <p className="text-xs text-gray-500">Pending Create PO tasks only</p>
            </div>
            <Link to="/scm/create-po" className="text-xs font-semibold text-teal-700 hover:text-teal-900">
              Open queue →
            </Link>
          </div>
          <div className="divide-y divide-gray-50 max-h-[360px] overflow-y-auto">
            {createPoTasks.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No pending Create PO tasks</p>
            ) : (
              createPoTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => navigate(task.path)}
                  className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-teal-700 truncate">{task.number}</p>
                    <p className="text-xs text-gray-500 truncate">{task.title}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
                    Create PO
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Buyer Final Verify</h2>
              <p className="text-xs text-gray-500">Pending final verify only</p>
            </div>
            <Link to="/scm/buyer-final-verify" className="text-xs font-semibold text-indigo-700 hover:text-indigo-900">
              Open queue →
            </Link>
          </div>
          <div className="divide-y divide-gray-50 max-h-[360px] overflow-y-auto">
            {verifyTasks.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No pending final verify tasks</p>
            ) : (
              verifyTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => navigate(task.path)}
                  className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-indigo-700 truncate">{task.number}</p>
                    <p className="text-xs text-gray-500 truncate">{task.title}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    Final Verify
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-violet-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Vendor Acceptance</h2>
              <p className="text-xs text-gray-500">Pending vendor acceptance only</p>
            </div>
            <Link to="/scm/vendor-po-acceptance" className="text-xs font-semibold text-violet-700 hover:text-violet-900">
              Open queue →
            </Link>
          </div>
          <div className="divide-y divide-gray-50 max-h-[360px] overflow-y-auto">
            {acceptanceTasks.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No pending vendor acceptance</p>
            ) : (
              acceptanceTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => navigate(task.path)}
                  className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-violet-700 truncate">{task.number}</p>
                    <p className="text-xs text-gray-500 truncate">{task.title}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                    Acceptance
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
