import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { poApi, rfqApi, PostRfqPendingItem, ScmRfqEntryItem } from '../../../services/api';
import { finalizeGoPo, rfqEntryPath } from '../../../utils/scmGoPo';
import { PM_BTN_PRIMARY, PM_BTN_SECONDARY, PM_PAGE_BG } from '../../../constants/pmTheme';
import { useAuth } from '../../../contexts/AuthContext';

type DashTask = {
  id: string;
  kind: 'create_po' | 'buyer_verify' | 'vendor_acceptance';
  prId?: number;
  poId?: number;
  number: string;
  title: string;
  path: string;
};

const softWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;

const softCard =
  'relative overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]';

const KPI_THEMES = [
  { value: '#F59E0B', iconBg: '#FEF3C7', wash: 'rgba(245, 158, 11, 0.14)' },
  { value: '#1E88E5', iconBg: '#E3F2FD', wash: 'rgba(30, 136, 229, 0.14)' },
  { value: '#6366F1', iconBg: '#E0E7FF', wash: 'rgba(99, 102, 241, 0.14)' },
  { value: '#8B5CF6', iconBg: '#EDE9FE', wash: 'rgba(139, 92, 246, 0.14)' },
] as const;

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
      icon: 'ri-bar-chart-box-line',
      to: '/rfq-approval',
      theme: KPI_THEMES[0],
    },
    {
      label: 'Create PO',
      value: createPoTasks.length,
      sub: 'Pending Create PO tasks',
      icon: 'ri-shopping-cart-2-line',
      to: '/scm/create-po',
      theme: KPI_THEMES[1],
    },
    {
      label: 'Approved PO verification',
      value: verifyTasks.length,
      sub: 'Pending verification only',
      icon: 'ri-shield-check-line',
      to: '/scm/buyer-final-verify',
      theme: KPI_THEMES[2],
    },
    {
      label: 'Vendor Acceptance',
      value: acceptanceTasks.length,
      sub: 'Pending vendor acceptance only',
      icon: 'ri-handshake-line',
      to: '/scm/vendor-po-acceptance',
      theme: KPI_THEMES[3],
    },
  ];

  const queuePanels: Array<{
    title: string;
    subtitle: string;
    to: string;
    empty: string;
    tasks: DashTask[];
    badge: string;
  }> = [
    {
      title: 'Create PO',
      subtitle: 'Pending Create PO tasks only',
      to: '/scm/create-po',
      empty: 'No pending Create PO tasks',
      tasks: createPoTasks,
      badge: 'Create PO',
    },
    {
      title: 'Approved PO verification',
      subtitle: 'Pending verification only',
      to: '/scm/buyer-final-verify',
      empty: 'No pending final verify tasks',
      tasks: verifyTasks,
      badge: 'Verify',
    },
    {
      title: 'Vendor Acceptance',
      subtitle: 'Pending vendor acceptance only',
      to: '/scm/vendor-po-acceptance',
      empty: 'No pending vendor acceptance',
      tasks: acceptanceTasks,
      badge: 'Acceptance',
    },
  ];

  return (
    <DashboardLayout>
      <div className="min-h-full font-sans text-[#0F172A]" style={{ background: PM_PAGE_BG }}>
        <div className="p-2 pb-6 sm:p-4 lg:p-6">
          <header className="mb-4 border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-1 pb-3 pt-1 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.12)] backdrop-blur-md sm:mb-5 sm:px-0 sm:pb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
              <div className="min-w-0 shrink text-center lg:text-left">
                <h1 className="text-base font-semibold leading-snug tracking-tight text-slate-800 sm:text-2xl md:text-3xl">
                  {greetingForNow()},{' '}
                  <span className="font-semibold text-slate-900">{user?.name || 'Buyer'}</span>
                </h1>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500 lg:text-sm">
                  SCM Buyer Dashboard — RFQ Approval, Create PO, Verify & Vendor Acceptance
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={() => navigate('/rfq-approval')}
                  className={PM_BTN_SECONDARY}
                >
                  <i className="ri-bar-chart-box-line"></i>
                  RFQ Approval
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/scm/create-po')}
                  className={PM_BTN_PRIMARY}
                >
                  <i className="ri-shopping-cart-2-line"></i>
                  Create PO
                </button>
              </div>
            </div>
          </header>

          <section className="mb-6">
            <div className="mb-1.5 px-0.5 sm:mb-3">
              <h2 className="text-xs font-bold tracking-wide text-slate-700 sm:text-base">Work Insights</h2>
            </div>
            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
              {kpiCards.map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => navigate(card.to)}
                  className="group relative box-border flex h-full min-h-[128px] w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-transparent bg-white p-4 text-left shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-[box-shadow,border-color] duration-200 hover:border-[#90CAF9] hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)] sm:min-h-[140px] sm:rounded-[18px] sm:p-5"
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

          {goPoError && (
            <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              {goPoError}
            </div>
          )}

          {/* RFQ Approval table */}
          <div className={`${softCard} mb-5`}>
            <div className="pointer-events-none absolute inset-0" style={softWash} />
            <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/40 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E3F2FD] text-[#1E88E5]">
                  <i className="ri-bar-chart-box-line text-lg"></i>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#2C3E50] sm:text-base">RFQ Approval</h2>
                  <p className="text-xs text-slate-500">
                    Go PO finalizes RFQ. Own vendor goes to Create PO; SCM vendor waits for manager here.
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

            {rfqGoPo.length === 0 && rfqPendingOnly.length === 0 ? (
              <p className="relative z-[1] px-5 py-10 text-center text-sm text-slate-400">No RFQ approval tasks</p>
            ) : (
              <div className="relative z-[1] overflow-x-auto px-2 pb-3 pt-1 sm:px-3 sm:pb-4">
                <table className="w-full min-w-0 border-separate border-spacing-x-0 border-spacing-y-3 text-sm">
                  <thead>
                    <tr>
                      {['PR Number', 'Title', 'Vendor', 'Requester', 'Amount', 'Status', 'Actions'].map((h) => (
                        <th
                          key={h}
                          className={`whitespace-nowrap px-3 pb-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 ${
                            h === 'Actions' ? 'text-right' : ''
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rfqGoPo.map((item) => (
                      <tr key={`gopo-${item.prId}`} className="group">
                        <td className="whitespace-nowrap rounded-l-2xl border border-r-0 border-transparent bg-white px-3 py-4 text-sm font-bold text-[#1E88E5] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-[border-color] group-hover:border-[#90CAF9] sm:rounded-l-[18px] sm:py-5">
                          {item.prNumber}
                        </td>
                        <td className="max-w-[240px] truncate border border-x-0 border-transparent bg-white px-3 py-4 font-semibold text-[#2C3E50] transition-[border-color] group-hover:border-[#90CAF9] sm:py-5" title={item.title}>
                          {item.title}
                        </td>
                        <td className="max-w-[180px] truncate border border-x-0 border-transparent bg-white px-3 py-4 text-slate-600 transition-[border-color] group-hover:border-[#90CAF9] sm:py-5">
                          {item.recommendedVendor || '—'}
                        </td>
                        <td className="truncate border border-x-0 border-transparent bg-white px-3 py-4 text-slate-600 transition-[border-color] group-hover:border-[#90CAF9] sm:py-5">
                          {item.requester}
                        </td>
                        <td className="whitespace-nowrap border border-x-0 border-transparent bg-white px-3 py-4 font-bold tabular-nums text-[#2C3E50] transition-[border-color] group-hover:border-[#90CAF9] sm:py-5">
                          ₹{Number(item.totalAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="border border-x-0 border-transparent bg-white px-3 py-4 transition-[border-color] group-hover:border-[#90CAF9] sm:py-5">
                          <span className="inline-flex rounded-full bg-[#E3F2FD] px-2 py-0.5 text-[10px] font-semibold text-[#1E88E5]">
                            Ready for Go PO
                          </span>
                        </td>
                        <td className="whitespace-nowrap rounded-r-2xl border border-l-0 border-transparent bg-white px-3 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-[border-color] group-hover:border-[#90CAF9] sm:rounded-r-[18px] sm:py-5">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => navigate(rfqEntryPath(item.prId))}
                              className="cursor-pointer rounded-xl border border-transparent bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9]"
                            >
                              Open RFQ
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleGoPo(item)}
                              disabled={goPoPrId === item.prId}
                              className="cursor-pointer rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1565C0] disabled:opacity-50"
                            >
                              {goPoPrId === item.prId ? 'Go PO…' : 'Go PO'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rfqPendingOnly.map((item) => (
                      <tr key={`mgr-${item.prId}`} className="group">
                        <td className="whitespace-nowrap rounded-l-2xl border border-r-0 border-transparent bg-white px-3 py-4 text-sm font-bold text-[#1E88E5] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-[border-color] group-hover:border-[#90CAF9] sm:rounded-l-[18px] sm:py-5">
                          {item.prNumber || `PR #${item.prId}`}
                        </td>
                        <td className="max-w-[240px] truncate border border-x-0 border-transparent bg-white px-3 py-4 font-semibold text-[#2C3E50] transition-[border-color] group-hover:border-[#90CAF9] sm:py-5" title={item.title}>
                          {item.title}
                        </td>
                        <td className="max-w-[180px] truncate border border-x-0 border-transparent bg-white px-3 py-4 text-slate-600 transition-[border-color] group-hover:border-[#90CAF9] sm:py-5">
                          {item.recommendedVendor || '—'}
                        </td>
                        <td className="truncate border border-x-0 border-transparent bg-white px-3 py-4 text-slate-600 transition-[border-color] group-hover:border-[#90CAF9] sm:py-5">
                          {item.requester}
                        </td>
                        <td className="whitespace-nowrap border border-x-0 border-transparent bg-white px-3 py-4 font-bold tabular-nums text-[#2C3E50] transition-[border-color] group-hover:border-[#90CAF9] sm:py-5">
                          ₹{Number(item.totalAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="border border-x-0 border-transparent bg-white px-3 py-4 transition-[border-color] group-hover:border-[#90CAF9] sm:py-5">
                          <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Pending Manager
                          </span>
                        </td>
                        <td className="whitespace-nowrap rounded-r-2xl border border-l-0 border-transparent bg-white px-3 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-[border-color] group-hover:border-[#90CAF9] sm:rounded-r-[18px] sm:py-5">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => navigate(`/rfq-approval/${item.prId}?from=rfq-approval`)}
                              className="cursor-pointer rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1565C0]"
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
          </div>

          {/* Queue panels */}
          <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
            {queuePanels.map((panel) => (
              <div key={panel.title} className={softCard}>
                <div className="pointer-events-none absolute inset-0" style={softWash} />
                <div className="relative z-[1] flex items-center justify-between gap-3 border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/40 px-4 py-3.5 sm:px-5">
                  <div>
                    <h2 className="text-sm font-semibold text-[#2C3E50]">{panel.title}</h2>
                    <p className="text-xs text-slate-500">{panel.subtitle}</p>
                  </div>
                  <Link
                    to={panel.to}
                    className="shrink-0 text-xs font-semibold text-[#1E88E5] hover:text-[#1565C0]"
                  >
                    Open →
                  </Link>
                </div>
                <div className="relative z-[1] max-h-[360px] space-y-2 overflow-y-auto p-3">
                  {panel.tasks.length === 0 ? (
                    <p className="px-2 py-8 text-center text-sm text-slate-400">{panel.empty}</p>
                  ) : (
                    panel.tasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => navigate(task.path)}
                        className="relative flex w-full cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-2xl border border-transparent bg-white px-3.5 py-3 text-left shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] transition-[border-color] hover:border-[#90CAF9] sm:rounded-[18px]"
                      >
                        <div className="pointer-events-none absolute inset-0" style={softWash} />
                        <div className="relative z-[1] min-w-0">
                          <p className="truncate text-sm font-bold text-[#1E88E5]">{task.number}</p>
                          <p className="truncate text-xs text-slate-500">{task.title}</p>
                        </div>
                        <span className="relative z-[1] shrink-0 rounded-full bg-[#E3F2FD] px-2 py-0.5 text-[10px] font-semibold text-[#1E88E5]">
                          {panel.badge}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
