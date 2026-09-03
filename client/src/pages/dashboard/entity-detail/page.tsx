import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { poApi, prApi } from '../../../services/api';
import { CARD, formatCompactInr, formatFullInr } from '../cfoFormat';
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
      <div className="-m-3 sm:-m-4 lg:-m-6 min-h-full bg-[#F8F9FC] px-4 sm:px-6 lg:px-7 py-6 font-sans">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal-700 cursor-pointer"
          >
            <i className="ri-arrow-left-line" />
            Back to Financial Insights
          </button>
          {summary?.code ? (
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{summary.code}</span>
          ) : null}
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-16 text-center text-sm text-slate-500">
            <i className="ri-loader-4-line animate-spin text-lg text-teal-600 mr-2" />
            Loading entity purchase orders…
          </div>
        ) : error && !summary ? (
          <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-8 text-center text-sm text-red-700">
            {error}
          </div>
        ) : (
          <>
            <div className={`${CARD} p-5 mb-4`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className="mt-1.5 w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: summary?.color || '#6366F1' }}
                  />
                  <div className="min-w-0">
                    <h1 className="text-xl font-bold text-slate-900 truncate">
                      {summary?.entityName || 'Entity'}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      Entity-wise purchase orders · click a PO to open full details
                    </p>
                  </div>
                </div>
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-teal-700 hover:underline"
                >
                  View all entities
                </Link>
              </div>

              {summary ? (
                <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">PO Count</p>
                    <p className="text-lg font-bold text-slate-900 mt-1">{summary.totalPOCount}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total Amount</p>
                    <p className="text-lg font-bold text-slate-900 mt-1" title={formatFullInr(summary.totalPOAmount)}>
                      {formatCompactInr(summary.totalPOAmount)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600/80">Approved</p>
                    <p className="text-lg font-bold text-emerald-700 mt-1" title={formatFullInr(summary.approvedAmount)}>
                      {formatCompactInr(summary.approvedAmount)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-orange-50/70 border border-orange-100 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-500/80">Pending</p>
                    <p className="text-lg font-bold text-orange-600 mt-1" title={formatFullInr(summary.pendingAmount)}>
                      {formatCompactInr(summary.pendingAmount)}
                    </p>
                  </div>
                </div>
              ) : null}

              {summary ? (
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-xs">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${utilPct}%`, backgroundColor: summary.color }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 font-medium">{utilPct}% utilization</span>
                </div>
              ) : null}
            </div>

            <RecentPOTable orders={orders} />
            {!orders.length ? (
              <p className="text-center text-sm text-slate-500 mt-3">
                No purchase orders listed for this entity yet.
              </p>
            ) : null}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
