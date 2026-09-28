import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { poApi, prApi } from '../../../services/api';
import { formatCompactInr, formatFullInr } from '../cfoFormat';
import { PM_PAGE_BG } from '../../../constants/pmTheme';
import RecentPOTable from '../components/RecentPOTable';

type EntitySummary = {
  entityId: number | null;
  entityName: string;
  code: string;
  totalPOCount: number;
  totalPOAmount: number;
  approvedAmount: number;
  pendingAmount: number;
  color: string;
};

type OrderRow = {
  poId?: number | null;
  prId?: number | null;
  poNumber: string;
  entity: string;
  vendorName: string;
  poAmount: number;
  poDate: string;
  status: string;
};

export default function FinancialEntityDetailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const entityIdParam = searchParams.get('entityId') || '';
  const entityNameParam = searchParams.get('name') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<EntitySummary | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [insightsRes, dashRes] = await Promise.all([
          poApi.cfoInsights().catch(() => null),
          prApi.cfoDashboard().catch(() => null),
        ]);

        const entities = insightsRes?.data?.entityWisePOSummary || [];
        const match = entities.find((e) => {
          if (entityIdParam && String(e.entityId || '') === entityIdParam) return true;
          if (entityNameParam && e.entityName === entityNameParam) return true;
          return false;
        });

        const entityName = match?.entityName || entityNameParam;
        const entityId = match?.entityId != null ? String(match.entityId) : entityIdParam;

        const fromInsights = (insightsRes?.data?.recentPurchaseOrders || []).filter(
          (po) => po.entity === entityName
        );

        const fromDash = (dashRes?.data?.purchaseOrders || [])
          .filter((po) => {
            const name = String(po.entityName || '');
            const id = String(po.entity || '');
            if (entityId && id === entityId) return true;
            if (entityName && name === entityName) return true;
            return false;
          })
          .map((po) => ({
            poId: Number(po.poId) || null,
            prId: null,
            poNumber: String(po.poNumber || po.id || ''),
            entity: String(po.entityName || entityName || ''),
            vendorName: String(po.vendorName || '—'),
            poAmount: Number(po.amount || 0),
            poDate: String(po.poDate || ''),
            status: String(po.status || '—'),
          }));

        const byKey = new Map<string, OrderRow>();
        for (const po of [...fromDash, ...fromInsights]) {
          if (!po.poNumber) continue;
          byKey.set(po.poNumber, po);
        }
        const merged = [...byKey.values()].sort((a, b) => {
          const da = a.poDate || '';
          const db = b.poDate || '';
          return db.localeCompare(da);
        });

        if (!cancelled) {
          setSummary(
            match
              ? {
                  entityId: match.entityId,
                  entityName: match.entityName,
                  code: match.code,
                  totalPOCount: match.totalPOCount,
                  totalPOAmount: match.totalPOAmount,
                  approvedAmount: match.approvedAmount,
                  pendingAmount: match.pendingAmount,
                  color: match.color,
                }
              : entityName
                ? {
                    entityId: entityId ? Number(entityId) : null,
                    entityName,
                    code: '',
                    totalPOCount: merged.length,
                    totalPOAmount: merged.reduce((s, p) => s + p.poAmount, 0),
                    approvedAmount: 0,
                    pendingAmount: 0,
                    color: '#6366F1',
                  }
                : null
          );
          setOrders(merged);
          if (!entityName && !entityIdParam) {
            setError('Entity reference missing');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setSummary(null);
          setOrders([]);
          setError(err instanceof Error ? err.message : 'Failed to load entity POs');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [entityIdParam, entityNameParam]);

  const utilPct = useMemo(() => {
    if (!summary || summary.totalPOAmount <= 0) return 0;
    return Math.round((summary.approvedAmount / summary.totalPOAmount) * 100);
  }, [summary]);

  return (
    <DashboardLayout>
      <div className="min-h-full font-sans text-[#0F172A]" style={{ background: PM_PAGE_BG }}>
        <div className="p-2 pb-6 sm:p-4 lg:p-6">
          <header className="mb-4 border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-1 pb-3 pt-1 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.12)] backdrop-blur-md sm:mb-5 sm:px-0 sm:pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#1E88E5]"
              >
                <i className="ri-arrow-left-line" />
                Back to Financial Insights
              </button>
              {summary?.code ? (
                <span className="rounded-full bg-[#E3F2FD] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1E88E5]">
                  {summary.code}
                </span>
              ) : null}
            </div>
          </header>

          {loading ? (
            <div className="rounded-2xl border border-transparent bg-white px-6 py-16 text-center text-sm text-slate-500 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
              <i className="ri-loader-4-line mr-2 animate-spin text-lg text-[#1E88E5]" />
              Loading entity purchase orders…
            </div>
          ) : error && !summary ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-6 py-8 text-center text-sm text-rose-700">
              {error}
            </div>
          ) : (
            <>
              <div className="relative mb-5 overflow-hidden rounded-2xl border border-transparent bg-white p-5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
                  }}
                />
                <div className="relative z-[1] flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: summary?.color || '#1E88E5' }}
                    />
                    <div className="min-w-0">
                      <h1 className="truncate text-xl font-semibold tracking-tight text-slate-800 sm:text-2xl">
                        {summary?.entityName || 'Entity'}
                      </h1>
                      <p className="mt-1 text-sm text-slate-500">
                        Entity-wise purchase orders · click a PO to open full details
                      </p>
                    </div>
                  </div>
                  <Link to="/dashboard" className="text-sm font-semibold text-[#1E88E5] hover:text-[#1565C0]">
                    View all entities
                  </Link>
                </div>

                {summary ? (
                  <div className="relative z-[1] mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {(
                      [
                        {
                          label: 'PO Count',
                          value: String(summary.totalPOCount),
                          title: undefined as string | undefined,
                          color: '#1E88E5',
                          wash: 'rgba(30, 136, 229, 0.12)',
                        },
                        {
                          label: 'Total Amount',
                          value: formatCompactInr(summary.totalPOAmount),
                          title: formatFullInr(summary.totalPOAmount),
                          color: '#2C3E50',
                          wash: 'rgba(44, 62, 80, 0.08)',
                        },
                        {
                          label: 'Approved',
                          value: formatCompactInr(summary.approvedAmount),
                          title: formatFullInr(summary.approvedAmount),
                          color: '#43A047',
                          wash: 'rgba(67, 160, 71, 0.14)',
                        },
                        {
                          label: 'Pending',
                          value: formatCompactInr(summary.pendingAmount),
                          title: formatFullInr(summary.pendingAmount),
                          color: '#FB8C00',
                          wash: 'rgba(251, 140, 0, 0.14)',
                        },
                      ] as const
                    ).map((card) => (
                      <div
                        key={card.label}
                        title={card.title}
                        className="relative overflow-hidden rounded-2xl border border-transparent bg-white px-4 py-3 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] sm:rounded-[18px]"
                      >
                        <div
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background: `radial-gradient(120% 90% at 100% 0%, ${card.wash} 0%, rgba(255,255,255,0) 58%)`,
                          }}
                        />
                        <p className="relative z-[1] text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          {card.label}
                        </p>
                        <p
                          className="relative z-[1] mt-1 text-lg font-bold tabular-nums"
                          style={{ color: card.color }}
                        >
                          {card.value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {summary ? (
                  <div className="relative z-[1] mt-4 flex items-center gap-3">
                    <div className="h-2 max-w-xs flex-1 rounded-full bg-[#E3F2FD]">
                      <div
                        className="h-2 rounded-full bg-[#1E88E5]"
                        style={{ width: `${utilPct}%`, backgroundColor: summary.color }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-500">{utilPct}% utilization</span>
                  </div>
                ) : null}
              </div>

              <RecentPOTable orders={orders} />
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
