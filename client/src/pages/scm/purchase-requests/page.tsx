import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { poApi, rfqApi, PostRfqPendingItem, ScmRfqEntryItem } from '../../../services/api';
import { finalizeGoPo, rfqEntryPath } from '../../../utils/scmGoPo';
import { useAuth } from '../../../contexts/AuthContext';
import FinancialInsightsDashboard from '../../dashboard/page';
import '../../../styles/dashboard-fx.css';
import AnimatedKpiCard, { type KpiVariant } from '../../../components/feature/AnimatedKpiCard';

type DashTask = {
  id: string;
  kind: 'create_po' | 'buyer_verify' | 'vendor_acceptance';
  prId?: number;
  poId?: number;
  number: string;
  title: string;
  path: string;
};

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function SCMPurchaseRequestsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rfqPending, setRfqPending] = useState<PostRfqPendingItem[]>([]);
  const [rfqGoPo, setRfqGoPo] = useState<ScmRfqEntryItem[]>([]);
  const [createPoTasks, setCreatePoTasks] = useState<DashTask[]>([]);
  const [verifyTasks, setVerifyTasks] = useState<DashTask[]>([]);
  const [acceptanceTasks, setAcceptanceTasks] = useState<DashTask[]>([]);
  const [goPoPrId, setGoPoPrId] = useState<number | null>(null);
  const [goPoError, setGoPoError] = useState('');
  const [showDetailedView, setShowDetailedView] = useState(false);

  const loadQueues = useCallback(async () => {
    try {
      const [rfqRes, entryRes, readyRes, verifyRes, acceptRes] = await Promise.all([
        rfqApi.listPostApprovalPending().catch(() => ({ data: [] as PostRfqPendingItem[] })),
        rfqApi.listScmEntryPending().catch(() => ({ data: [] as ScmRfqEntryItem[] })),
        poApi.listTrack({ page: 1, limit: 50, status: 'ready' }).catch(() => ({ data: [] })),
        poApi.listPendingBuyerVerify().catch(() => ({ data: [] as unknown[] })),
        poApi.listVendorAcceptance().catch(() => ({ data: [] as unknown[] })),
      ]);
      setRfqPending(rfqRes.data || []);
      setRfqGoPo(entryRes.data || []);

      const createMap = new Map<string, DashTask>();
      const verifyMap = new Map<string, DashTask>();

      ((readyRes.data as Array<Record<string, unknown>>) || []).forEach((r) => {
        const prId = Number(r.prId) || 0;
        if (!prId) return;
        const key = `create-${prId}`;
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
        verifyMap.set(key, {
          id: key,
          kind: 'buyer_verify',
          poId,
          prId: Number(p.prId) || undefined,
          number: String(p.poNumber || `PO #${poId}`),
          title: String(p.prTitle || p.title || p.vendorName || 'Approved PO verification'),
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
      setRfqGoPo([]);
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
  const rfqCardCount = rfqGoPo.length + rfqPendingCount;

  const handleGoPo = async (item: ScmRfqEntryItem) => {
    if (!item.canGoPo) {
      navigate(rfqEntryPath(item.prId));
      return;
    }
    setGoPoPrId(item.prId);
    setGoPoError('');
    try {
      const result = await finalizeGoPo(item);
      if (result.isOwn) {
        navigate(result.nextPath);
        return;
      }
      await loadQueues();
    } catch (err) {
      setGoPoError(err instanceof Error ? err.message : 'Go PO failed');
    } finally {
      setGoPoPrId(null);
    }
  };

  const kpiCards = [
    {
      label: 'RFQ Approval',
      value: rfqCardCount,
      sub: rfqGoPo.length ? `${rfqGoPo.length} ready for Go PO` : 'Waiting for SCM Manager',
      icon: 'ri-file-list-3-line',
      to: '/rfq-approval',
      variant: 'all' as KpiVariant,
    },
    {
      label: 'Create PO',
      value: createPoTasks.length,
      sub: 'Pending Create PO tasks',
      icon: 'ri-shopping-cart-2-line',
      to: '/scm/create-po',
      variant: 'ready' as KpiVariant,
    },
    {
      label: 'Approved PO verification',
      value: verifyTasks.length,
      sub: 'Pending verification only',
      icon: 'ri-shield-check-line',
      to: '/scm/buyer-final-verify',
      variant: 'approved' as KpiVariant,
    },
    {
      label: 'Vendor Acceptance',
      value: acceptanceTasks.length,
      sub: 'Pending vendor acceptance only',
      icon: 'ri-team-line',
      to: '/scm/vendor-po-acceptance',
      variant: 'pending_approval' as KpiVariant,
    },
  ];
  const kpiTotal = kpiCards.reduce((sum, c) => sum + (Number(c.value) || 0), 0);

  const queuePanels: Array<{
    title: string;
    subtitle: string;
    to: string;
    empty: string;
    tasks: DashTask[];
    badge: string;
    tone: string;
    icon: string;
    art: string;
  }> = [
    {
      title: 'Create PO',
      subtitle: 'Pending Create PO tasks only',
      to: '/scm/create-po',
      empty: 'No pending Create PO tasks',
      tasks: createPoTasks,
      badge: 'Create PO',
      tone: 'green',
      icon: 'ri-shopping-cart-2-line',
      art: 'ri-file-list-3-line',
    },
    {
      title: 'Approved PO verification',
      subtitle: 'Pending verification only',
      to: '/scm/buyer-final-verify',
      empty: 'No pending final verify tasks',
      tasks: verifyTasks,
      badge: 'Verify',
      tone: 'orange',
      icon: 'ri-shield-check-line',
      art: 'ri-clipboard-line',
    },
    {
      title: 'Vendor Acceptance',
      subtitle: 'Pending vendor acceptance only',
      to: '/scm/vendor-po-acceptance',
      empty: 'No pending vendor acceptance',
      tasks: acceptanceTasks,
      badge: 'Acceptance',
      tone: 'violet',
      icon: 'ri-team-line',
      art: 'ri-shake-hands-line',
    },
  ];

  if (showDetailedView) {
    return (
      <DashboardLayout>
        <FinancialInsightsDashboard
          embedded
          showCharts
          backLabel="Back to SCM Buyer Dashboard"
          onBack={() => setShowDetailedView(false)}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="tasks-fx sbr-fx min-h-full font-sans text-[#0F172A]">
        <section className="tfx-hero">
          <div className="tfx-bubbles" aria-hidden="true">
            <i /><i /><i /><i /><i /><i /><i />
          </div>
          <div className="tfx-hero-content">
            <div className="tfx-hi">
              {greetingForNow()}, <span className="tfx-wave">👋</span>
            </div>
            <h1>
              <span className="tfx-shimmer">{user?.name || 'Buyer'}</span>
            </h1>
            <p>
              Manage RFQs, create POs, verify and track vendor acceptance
              <span className="tfx-role-inline"> · SCM Buyer</span>
            </p>
          </div>
        </section>

        <section className="tfx-kpis mb-4">
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
                live={card.value > 0}
                fallbackIcon={card.icon}
                toastText={`Opening ${card.label}`}
                onClick={() => navigate(card.to)}
              />
            ))}
          </div>
        </section>

        <div className="p-2 pb-4 pt-0 sm:p-3 sm:pt-0 lg:p-6 lg:pt-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button type="button" onClick={() => setShowDetailedView(true)} className="tfx-btn primary">
              <i className="ri-bar-chart-box-line text-lg"></i>
              <span>Detailed view</span>
            </button>
            <button type="button" onClick={() => navigate('/rfq-approval')} className="tfx-btn secondary">
              <i className="ri-file-list-3-line text-lg"></i>
              <span>RFQ Approval</span>
            </button>
            <button type="button" onClick={() => navigate('/scm/create-po')} className="tfx-btn secondary">
              <i className="ri-shopping-cart-2-line text-lg"></i>
              <span>Create PO</span>
            </button>
          </div>

          {goPoError && (
            <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              {goPoError}
            </div>
          )}

          {/* RFQ Approval — same panel + row-card table as the requester dashboard */}
          <section className="tfx-panel relative mb-5 overflow-hidden rounded-2xl border border-white/70 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div className="flex items-center gap-3.5 pb-1">
                <div className="tfx-panel-ic flex h-12 w-12 items-center justify-center rounded-xl">
                  <i className="ri-file-list-3-line text-lg sm:text-xl" aria-hidden />
                </div>
                <div>
                  <h2 className="tfx-panel-title text-lg font-semibold text-slate-900">RFQ Approval</h2>
                  <p className="mt-1.5 text-sm text-slate-500">
                    Go PO finalizes RFQ. Own vendor goes to Create PO; SCM vendor waits for manager here.
                  </p>
                </div>
              </div>
              <Link to="/rfq-approval" className="tfx-btn secondary sm">
                Open queue <i className="ri-arrow-right-line" aria-hidden />
              </Link>
            </div>

            {rfqGoPo.length === 0 && rfqPendingOnly.length === 0 ? (
              <div className="px-5 pb-10 pt-4 text-center text-sm text-slate-400">
                <i className="ri-file-list-3-line mb-2 block text-4xl text-[#c5e6eb]" aria-hidden />
                No RFQ approval tasks
              </div>
            ) : (
              <div className="overflow-x-auto px-4 pb-4 pt-1">
                <table className="rfx-table w-full min-w-[920px] table-fixed border-separate border-spacing-x-0 border-spacing-y-2.5">
                  <colgroup>
                    <col className="w-[19%]" />
                    <col className="w-[24%]" />
                    <col className="w-[15%]" />
                    <col className="w-[12%]" />
                    <col className="w-[11%]" />
                    <col className="w-[19%]" />
                  </colgroup>
                  <thead>
                    <tr>
                      {['PR Number', 'Title', 'Vendor', 'Requester', 'Amount', 'Actions'].map((h) => (
                        <th
                          key={h}
                          className={`tfx-th px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 first:pl-5 last:pr-5 ${
                            h === 'Amount' || h === 'Actions' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rfqGoPo.map((item, rowIndex) => (
                      <tr key={`gopo-${item.prId}`} className="rfx-row tone-teal" style={{ '--r': rowIndex } as CSSProperties}>
                        <td className="pl-5 pr-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="rfx-ticon">
                              <i className="ri-file-text-line" aria-hidden />
                            </span>
                            <div className="min-w-0">
                              <p className="rfx-prno truncate">{item.prNumber}</p>
                              <span className="mt-1 inline-flex rounded-md bg-[#e6f6f8] px-1.5 text-[11px] font-semibold text-[#0f6b7a]">
                                Ready for Go PO
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3" title={item.title}>
                          <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                        </td>
                        <td className="truncate px-3 text-sm text-slate-600">{item.recommendedVendor || '—'}</td>
                        <td className="truncate px-3 text-sm text-slate-600">{item.requester}</td>
                        <td className="px-3 text-right text-sm font-bold tabular-nums text-slate-900">
                          ₹{Number(item.totalAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="pl-3 pr-5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button type="button" onClick={() => navigate(rfqEntryPath(item.prId))} className="rfx-act" title="Open RFQ">
                              <i className="ri-eye-line" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleGoPo(item)}
                              disabled={goPoPrId === item.prId}
                              className="tfx-btn primary sm"
                            >
                              {goPoPrId === item.prId ? 'Go PO…' : 'Go PO'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rfqPendingOnly.map((item, rowIndex) => (
                      <tr
                        key={`mgr-${item.prId}`}
                        className="rfx-row tone-orange"
                        style={{ '--r': rfqGoPo.length + rowIndex } as CSSProperties}
                      >
                        <td className="pl-5 pr-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="rfx-ticon">
                              <i className="ri-file-text-line" aria-hidden />
                            </span>
                            <div className="min-w-0">
                              <p className="rfx-prno truncate">{item.prNumber || `PR #${item.prId}`}</p>
                              <span className="mt-1 inline-flex rounded-md bg-amber-50 px-1.5 text-[11px] font-semibold text-amber-700">
                                Pending Manager
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3" title={item.title}>
                          <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                        </td>
                        <td className="truncate px-3 text-sm text-slate-600">{item.recommendedVendor || '—'}</td>
                        <td className="truncate px-3 text-sm text-slate-600">{item.requester}</td>
                        <td className="px-3 text-right text-sm font-bold tabular-nums text-slate-900">
                          ₹{Number(item.totalAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="pl-3 pr-5">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => navigate(`/rfq-approval/${item.prId}?from=rfq-approval`)}
                              className="tfx-btn primary sm"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Queue panels — same panel language as the requester "My Tasks" list */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
            {queuePanels.map((panel) => (
              <section key={panel.title} className="tfx-panel relative overflow-hidden rounded-2xl border border-white/70 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="tfx-panel-ic flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                      <i className={`${panel.icon} text-lg`} aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h2 className="tfx-panel-title truncate text-base font-semibold text-slate-900">{panel.title}</h2>
                      <p className="mt-1.5 truncate text-xs text-slate-500">{panel.subtitle}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#e6f6f8] px-2.5 py-1 text-xs font-semibold text-[#0f6b7a]">
                    {panel.tasks.length}
                  </span>
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  {panel.tasks.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-slate-400">
                      <i className="ri-checkbox-circle-line mb-2 block text-3xl text-[#c5e6eb]" aria-hidden />
                      {panel.empty}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {panel.tasks.map((task, rowIndex) => (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => navigate(task.path)}
                          style={{ '--r': rowIndex } as CSSProperties}
                          className="tfx-list-row flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gradient-to-r hover:from-[#e6f6f8]/60 hover:to-transparent"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e6f6f8] text-[#0f6b7a]">
                              <i className="ri-file-edit-line" aria-hidden />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#0f6b7a]">{task.number}</p>
                              <p className="truncate text-xs text-slate-500">{task.title}</p>
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full bg-[#e6f6f8] px-2 py-0.5 text-[11px] font-semibold text-[#0f6b7a]">
                            {panel.badge}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Link to={panel.to} className="flex items-center justify-center gap-1.5 border-t border-slate-100 py-2.5 text-xs font-semibold text-[#0f6b7a] hover:bg-[#f3fafc]">
                  Open {panel.title} <i className="ri-arrow-right-line" aria-hidden />
                </Link>
              </section>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
