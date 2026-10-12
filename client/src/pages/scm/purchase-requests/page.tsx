import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { poApi, rfqApi, PostRfqPendingItem, ScmRfqEntryItem } from '../../../services/api';
import { finalizeGoPo, rfqEntryPath } from '../../../utils/scmGoPo';
import { useAuth } from '../../../contexts/AuthContext';
import FinancialInsightsDashboard from '../../dashboard/page';
import '../../../styles/dashboard-fx.css';
import '../../../styles/scm-buyer.css';

type DashTask = {
  id: string;
  kind: 'create_po' | 'buyer_verify' | 'vendor_acceptance';
  prId?: number;
  poId?: number;
  number: string;
  title: string;
  path: string;
};

/** Colour family per card / panel (see styles/scm-buyer.css → .tone-*). */
const KPI_TONES = ['blue', 'green', 'orange', 'violet'] as const;

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
      tone: KPI_TONES[0],
    },
    {
      label: 'Create PO',
      value: createPoTasks.length,
      sub: 'Pending Create PO tasks',
      icon: 'ri-shopping-cart-2-line',
      to: '/scm/create-po',
      tone: KPI_TONES[1],
    },
    {
      label: 'Approved PO verification',
      value: verifyTasks.length,
      sub: 'Pending verification only',
      icon: 'ri-shield-check-line',
      to: '/scm/buyer-final-verify',
      tone: KPI_TONES[2],
    },
    {
      label: 'Vendor Acceptance',
      value: acceptanceTasks.length,
      sub: 'Pending vendor acceptance only',
      icon: 'ri-team-line',
      to: '/scm/vendor-po-acceptance',
      tone: KPI_TONES[3],
    },
  ];

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
      <div className="tasks-fx sb-fx min-h-full font-sans text-[#0F172A]">
        <section className="sb-hero">
          <div className="sb-art" aria-hidden="true" />
          <div className="tfx-bubbles" aria-hidden="true">
            <i /><i /><i /><i /><i /><i /><i />
          </div>
          <div className="sb-hero-text">
            <h1>
              {greetingForNow()},
              <br />
              <span className="sb-name">{user?.name || 'Buyer'}</span> <span className="tfx-wave">👋</span>
            </h1>
            <p>Manage RFQs, create POs, verify and track vendor acceptance all in one place.</p>
            <div className="sb-hero-actions">
              <button type="button" onClick={() => setShowDetailedView(true)} className="sb-chip">
                <i className="ri-bar-chart-box-line"></i>
                Detailed view
              </button>
              <button type="button" onClick={() => navigate('/rfq-approval')} className="sb-chip">
                <i className="ri-file-list-3-line"></i>
                RFQ Approval
              </button>
              <button type="button" onClick={() => navigate('/scm/create-po')} className="sb-chip">
                <i className="ri-shopping-cart-2-line"></i>
                Create PO
              </button>
            </div>
          </div>
        </section>

        <div className="sb-body">
          <section className="sb-kpis grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map((card, i) => (
              <button
                key={card.label}
                type="button"
                onClick={() => navigate(card.to)}
                className={`sb-kpi tone-${card.tone}`}
                style={{ '--i': i } as CSSProperties}
              >
                <span className="sb-kpi-ic">
                  <i className={card.icon} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="sb-kpi-label">{card.label}</p>
                  <p className="sb-kpi-num">{card.value}</p>
                  <p className="sb-kpi-sub">{card.sub}</p>
                </div>
                <span className="sb-arrow" aria-hidden>
                  <i className="ri-arrow-right-line" />
                </span>
              </button>
            ))}
          </section>

          {goPoError && (
            <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              {goPoError}
            </div>
          )}

          {/* RFQ Approval table */}
          <section className="sb-card sb-rfq mb-5">
            <div className="sb-card-head">
              <div className="flex items-center gap-3.5">
                <span className="sb-head-ic tone-blue">
                  <i className="ri-file-list-3-line" aria-hidden />
                </span>
                <div>
                  <h2>RFQ Approval</h2>
                  <p>Go PO finalizes RFQ. Own vendor goes to Create PO; SCM vendor waits for manager here.</p>
                </div>
              </div>
              <Link to="/rfq-approval" className="sb-open">
                Open queue <i className="ri-arrow-right-line" />
              </Link>
            </div>

            {rfqGoPo.length === 0 && rfqPendingOnly.length === 0 ? (
              <div className="sb-empty">
                <span className="sb-empty-ic">
                  <i className="ri-file-text-line" />
                </span>
                No RFQ approval tasks
              </div>
            ) : (
              <div className="overflow-x-auto px-4 pb-4">
                <table className="sb-table w-full text-sm">
                  <thead>
                    <tr>
                      {['PR Number', 'Title', 'Vendor', 'Requester', 'Amount', 'Status', 'Actions'].map((h) => (
                        <th key={h} className={h === 'Actions' ? 'text-right' : 'text-left'}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rfqGoPo.map((item, rowIndex) => (
                      <tr key={`gopo-${item.prId}`} className="sb-row" style={{ '--r': rowIndex } as CSSProperties}>
                        <td className="sb-prno whitespace-nowrap">{item.prNumber}</td>
                        <td className="max-w-[260px] truncate uppercase" title={item.title}>
                          {item.title}
                        </td>
                        <td className="max-w-[180px] truncate">{item.recommendedVendor || '—'}</td>
                        <td className="truncate">{item.requester}</td>
                        <td className="whitespace-nowrap font-bold tabular-nums text-slate-900">
                          ₹{Number(item.totalAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td>
                          <span className="sb-pill tone-blue">Ready for Go PO</span>
                        </td>
                        <td className="whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(rfqEntryPath(item.prId))}
                              className="sb-btn ghost"
                            >
                              Open RFQ
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleGoPo(item)}
                              disabled={goPoPrId === item.prId}
                              className="sb-btn solid"
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
                        className="sb-row"
                        style={{ '--r': rfqGoPo.length + rowIndex } as CSSProperties}
                      >
                        <td className="sb-prno whitespace-nowrap">{item.prNumber || `PR #${item.prId}`}</td>
                        <td className="max-w-[260px] truncate uppercase" title={item.title}>
                          {item.title}
                        </td>
                        <td className="max-w-[180px] truncate">{item.recommendedVendor || '—'}</td>
                        <td className="truncate">{item.requester}</td>
                        <td className="whitespace-nowrap font-bold tabular-nums text-slate-900">
                          ₹{Number(item.totalAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td>
                          <span className="sb-pill tone-amber">Pending Manager</span>
                        </td>
                        <td className="whitespace-nowrap">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => navigate(`/rfq-approval/${item.prId}?from=rfq-approval`)}
                              className="sb-btn solid"
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

          {/* Queue panels */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
            {queuePanels.map((panel, i) => (
              <section
                key={panel.title}
                className={`sb-card sb-queue tone-${panel.tone}`}
                style={{ '--i': i } as CSSProperties}
              >
                <div className="sb-card-head">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span className={`sb-head-ic tone-${panel.tone}`}>
                      <i className={panel.icon} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h2>{panel.title}</h2>
                      <p>{panel.subtitle}</p>
                    </div>
                  </div>
                  <Link to={panel.to} className="sb-arrow" aria-label={`Open ${panel.title}`}>
                    <i className="ri-arrow-right-line" />
                  </Link>
                </div>
                <div className="sb-queue-body">
                  <i className={`sb-queue-art ${panel.art}`} aria-hidden />
                  {panel.tasks.length === 0 ? (
                    <div className="sb-empty">
                      <span className="sb-empty-ic">
                        <i className="ri-file-text-line" />
                      </span>
                      {panel.empty}
                    </div>
                  ) : (
                    panel.tasks.map((task, rowIndex) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => navigate(task.path)}
                        className="sb-task"
                        style={{ '--r': rowIndex } as CSSProperties}
                      >
                        <div className="min-w-0">
                          <p className="sb-task-no truncate">{task.number}</p>
                          <p className="truncate text-xs text-slate-500">{task.title}</p>
                        </div>
                        <span className={`sb-pill tone-${panel.tone}`}>{panel.badge}</span>
                        <i className="ri-arrow-right-s-line text-lg text-slate-400" aria-hidden />
                      </button>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
