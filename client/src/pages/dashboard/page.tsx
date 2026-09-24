import { useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '../../components/feature/DashboardLayout';
import KPIWidgets from './components/KPIWidgets';
import EntityPOSummaryTable from './components/EntityPOSummaryTable';
import RecentPOTable from './components/RecentPOTable';
import TopVendorsTable from './components/TopVendorsTable';
import DashboardFilters, { DashboardFiltersValue, EMPTY_DASHBOARD_FILTERS } from './components/DashboardFilters';
import { useAuth } from '../../contexts/AuthContext';
import { masterApi, poApi } from '../../services/api';
import { getUserDesignation } from '../../utils/roleDisplay';
import { parseLooseDate } from './cfoFormat';

type Insights = Awaited<ReturnType<typeof poApi.cfoInsights>>['data'];

const EMPTY: Insights = {
  kpis: {
    totalPOAmount: 0,
    entityWiseSpend: 0,
    approvedPOAmount: 0,
    pendingPOAmount: 0,
    totalVendorPayments: 0,
    budgetUtilization: 0,
    totalPOCount: 0,
    entityCount: 0,
  },
  entityWisePOSummary: [],
  monthlyPOTrend: [],
  monthlySeries: [],
  recentPurchaseOrders: [],
  topVendorsByPOAmount: [],
};

const CUSTOMIZE_KEY = 'cfo-insights-hidden-sections';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function inDateRange(value: string, from: string, to: string) {
  if (!from && !to) return true;
  const d = parseLooseDate(value);
  if (!d) return true;
  const t = d.getTime();
  if (from && t < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && t > new Date(`${to}T23:59:59`).getTime()) return false;
  return true;
}

function exportCsv(filename: string, lines: string[]) {
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function readHidden(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CUSTOMIZE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard({
  embedded = false,
  onBack,
}: {
  embedded?: boolean;
  onBack?: () => void;
} = {}) {
  const { user } = useAuth();
  const [data, setData] = useState<Insights>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DashboardFiltersValue>(EMPTY_DASHBOARD_FILTERS);
  const [resetValue, setResetValue] = useState<DashboardFiltersValue>(EMPTY_DASHBOARD_FILTERS);
  const [entities, setEntities] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [showTables, setShowTables] = useState(true);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [hidden, setHidden] = useState<Record<string, boolean>>(readHidden);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const customizeRef = useRef<HTMLDivElement>(null);
  const lockedEntityId = user?.entityId ? String(user.entityId) : null;

  useEffect(() => {
    if (!lockedEntityId) return;
    const apply = (prev: DashboardFiltersValue) => ({ ...prev, entityId: lockedEntityId });
    setFilters(apply);
    setResetValue(apply);
  }, [lockedEntityId]);

  const load = async (filterOverride?: Partial<DashboardFiltersValue>) => {
    const active = { ...filters, ...filterOverride };
      setLoading(true);
      setError(null);
      try {
      const [insightsRes, masterEnt, masterDept, masterCat] = await Promise.all([
        poApi.cfoInsights({
          department: active.department || undefined,
          category: active.category || undefined,
          dateFrom: active.dateFrom || undefined,
          dateTo: active.dateTo || undefined,
        }),
        masterApi.listEntities({ status: 'active', pageSize: 500 }).catch(() => ({ data: [] as Array<{ id: number; name: string }> })),
        masterApi.listDepartments({ status: 'active' }).catch(() => ({ data: [] as Array<{ name: string }> })),
        masterApi.listCategories({ status: 'active' }).catch(() => ({ data: [] as Array<{ name: string }> })),
      ]);
      const next = insightsRes.data || EMPTY;
      setData(next);
      setEntities(
        (masterEnt.data || []).map((e) => ({ id: String(e.id), name: String(e.name || '') })).filter((e) => e.name)
      );
      setDepartments([...new Set((masterDept.data || []).map((d) => String(d.name || '').trim()).filter(Boolean))]);
      setCategories([...new Set((masterCat.data || []).map((c) => String(c.name || '').trim()).filter(Boolean))]);
      setUpdatedAt(new Date());
      } catch (err) {
          setData(EMPTY);
          setError(err instanceof Error ? err.message : 'Failed to load CFO insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.department, filters.category, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    localStorage.setItem(CUSTOMIZE_KEY, JSON.stringify(hidden));
  }, [hidden]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!customizeRef.current?.contains(e.target as Node)) setCustomizeOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selectedEntityName = useMemo(() => {
    if (!filters.entityId) return '';
  return (
      entities.find((e) => e.id === filters.entityId)?.name ||
      data.entityWisePOSummary.find((e) => String(e.entityId || '') === filters.entityId)?.entityName ||
      ''
    );
  }, [filters.entityId, entities, data.entityWisePOSummary]);

  const filteredEntities = useMemo(() => {
    let list = data.entityWisePOSummary;
    if (filters.entityId || selectedEntityName) {
      list = list.filter(
        (e) =>
          String(e.entityId || '') === filters.entityId ||
          e.entityName === selectedEntityName ||
          e.code === selectedEntityName
      );
    }
    if (filters.vendor) {
      const names = new Set(
        data.topVendorsByPOAmount.filter((v) => v.vendorName === filters.vendor).map((v) => v.entity)
      );
      if (names.size) list = list.filter((e) => names.has(e.entityName));
    }
    const min = Number(filters.amountMin);
    const max = Number(filters.amountMax);
    if (Number.isFinite(min) && filters.amountMin !== '') list = list.filter((e) => e.totalPOAmount >= min);
    if (Number.isFinite(max) && filters.amountMax !== '') list = list.filter((e) => e.totalPOAmount <= max);
    return list;
  }, [data.entityWisePOSummary, data.topVendorsByPOAmount, selectedEntityName, filters]);

  const filteredOrders = useMemo(() => {
    return data.recentPurchaseOrders.filter((po) => {
      if (selectedEntityName && po.entity !== selectedEntityName) return false;
      if (filters.department && (po as { department?: string }).department && (po as { department?: string }).department !== filters.department) {
        return false;
      }
      if (filters.vendor && po.vendorName !== filters.vendor) return false;
      if (filters.poStatus && po.status !== filters.poStatus) return false;
      if (!inDateRange(po.poDate, filters.dateFrom, filters.dateTo)) return false;
      const min = Number(filters.amountMin);
      const max = Number(filters.amountMax);
      if (Number.isFinite(min) && filters.amountMin !== '' && po.poAmount < min) return false;
      if (Number.isFinite(max) && filters.amountMax !== '' && po.poAmount > max) return false;
      return true;
    });
  }, [data.recentPurchaseOrders, selectedEntityName, filters]);

  const filteredVendors = useMemo(() => {
    return data.topVendorsByPOAmount.filter((v) => {
      if (selectedEntityName && v.entity !== selectedEntityName) return false;
      if (filters.vendor && v.vendorName !== filters.vendor) return false;
      return true;
    });
  }, [data.topVendorsByPOAmount, selectedEntityName, filters.vendor]);

  const filteredTrend = useMemo(() => {
    if (!filters.dateFrom && !filters.dateTo) return data.monthlyPOTrend;
    return data.monthlyPOTrend.filter((p) => {
      const ym = String(p.ym || '');
      if (!ym) return true;
      return inDateRange(`${ym}-01`, filters.dateFrom, filters.dateTo);
    });
  }, [data.monthlyPOTrend, filters.dateFrom, filters.dateTo]);

  const kpis = useMemo(() => {
    const entityTotal = filteredEntities.reduce((s, e) => s + e.totalPOAmount, 0);
    const entityApproved = filteredEntities.reduce((s, e) => s + e.approvedAmount, 0);
    const entityPending = filteredEntities.reduce((s, e) => s + e.pendingAmount, 0);
    const narrowed =
      Boolean(filters.entityId || filters.vendor || filters.amountMin || filters.amountMax || filters.department || filters.category);

    let totalPOAmount = narrowed ? entityTotal : data.kpis.totalPOAmount;
    let approvedPOAmount = narrowed ? entityApproved : data.kpis.approvedPOAmount;
    let pendingPOAmount = narrowed ? entityPending : data.kpis.pendingPOAmount;

    // Date range is applied server-side; avoid re-scaling KPIs from monthly buckets
    // (day/week filters cannot be inferred from month-level trend points).

    if (filters.vendor && filteredVendors.length) {
      const vendorTotal = filteredVendors.reduce((s, v) => s + v.totalPOAmount, 0);
      totalPOAmount = vendorTotal;
    }

    return {
      ...data.kpis,
      totalPOAmount,
      entityWiseSpend: totalPOAmount,
      approvedPOAmount,
      pendingPOAmount,
      budgetUtilization: totalPOAmount > 0 ? Math.round((approvedPOAmount / totalPOAmount) * 1000) / 10 : 0,
      entityCount: filteredEntities.length,
    };
  }, [data.kpis, filteredEntities, filteredVendors, filters]);

  const trendTotals = filteredTrend.map((p) => Number(p.total || 0));
  const previousTotal = trendTotals.length >= 2 ? trendTotals[trendTotals.length - 2] : 0;
  const previousMonthLabel = filteredTrend.length >= 2
    ? String(filteredTrend[filteredTrend.length - 2].month || 'prior month')
    : 'prior month';

  const handleExport = () => {
    const lines = [
      'Section,Metric,Value',
      `KPI,Total PO Amount,${kpis.totalPOAmount}`,
      `KPI,Approved PO Amount,${kpis.approvedPOAmount}`,
      `KPI,Pending PO Amount,${kpis.pendingPOAmount}`,
      `KPI,Vendor Payments,${kpis.totalVendorPayments}`,
      `KPI,Budget Utilization,${kpis.budgetUtilization}`,
      ...filteredEntities.map((e) => `Entity,${e.entityName.replace(/,/g, ' ')},${e.totalPOAmount}`),
    ];
    exportCsv(`cfo-dashboard-${todayIso()}.csv`, lines);
  };

  const updatedLabel = updatedAt
    ? `Last updated: ${updatedAt.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : '';

  const visible = (key: string) => !hidden[key];
  const companyOptions = useMemo(() => {
    const base = entities.length
      ? entities
      : data.entityWisePOSummary.map((e) => ({ id: String(e.entityId || e.entityName), name: e.entityName }));
    if (lockedEntityId) {
      const match = base.find((e) => e.id === lockedEntityId);
      if (match) return [match];
      if (user?.entityName) return [{ id: lockedEntityId, name: user.entityName }];
    }
    return base;
  }, [entities, data.entityWisePOSummary, lockedEntityId, user?.entityName]);

  const content = (
      <div className={`${embedded ? '' : '-m-3 sm:-m-4 lg:-m-6'} min-h-full bg-[#F3F6FB] px-4 sm:px-6 lg:px-7 py-6 font-sans`} style={{ background: 'linear-gradient(165deg, #EEF4FF 0%, #F3F6FB 42%, #F3F6FB 100%)' }}>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            {embedded && onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
              >
                <i className="ri-arrow-left-line"></i>
                Back to SCM Manager Dashboard
              </button>
            ) : null}
            <h1 className="text-[28px] font-bold text-slate-900 tracking-tight leading-none">
              {greetingForNow()}, {user?.name || 'User'}
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              {getUserDesignation(user)
                ? `Financial Insights · ${getUserDesignation(user)}`
                : 'Financial Insights'}
            </p>
          </div>
          <div className="flex items-center gap-2 relative" ref={customizeRef}>
            <button
              type="button"
              onClick={handleExport}
              className="h-10 px-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 bg-white border border-[#E6E8F0] rounded-xl hover:bg-indigo-50 transition-colors"
            >
              <i className="ri-download-2-line"></i>
              Export
            </button>
            <button
              type="button"
              onClick={() => setCustomizeOpen((v) => !v)}
              className="h-10 px-4 inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#6366F1] hover:bg-indigo-600 rounded-xl shadow-[0_4px_12px_rgba(99,102,241,0.35)] transition-colors"
            >
              <i className="ri-settings-3-line"></i>
              Customize
            </button>
            {customizeOpen ? (
              <div className="absolute right-0 top-12 z-20 w-56 bg-white border border-[#EEF0F5] rounded-xl shadow-lg p-3">
                <p className="text-[11px] font-semibold text-slate-500 uppercase mb-2">Show sections</p>
                {[
                  ['kpi', 'KPI cards'],
                  ['tables', 'Detail tables'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 py-1 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={key === 'tables' ? showTables || visible('tables') : visible(key)}
                      onChange={() => {
                        if (key === 'tables') {
                          const next = !(showTables || visible('tables'));
                          setShowTables(next);
                          setHidden((prev) => ({ ...prev, tables: !next }));
                          return;
                        }
                        setHidden((prev) => ({ ...prev, [key]: !prev[key] }));
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <DashboardFilters
          value={filters}
          resetValue={resetValue}
          entities={companyOptions}
          departments={departments}
          categories={categories}
          vendors={[...new Set(data.topVendorsByPOAmount.map((v) => v.vendorName))]}
          onChange={setFilters}
          lockEntity={Boolean(lockedEntityId)}
          lockedEntityLabel={user?.entityName || user?.entityCode || undefined}
        />

      {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {loading && <p className="mb-4 text-sm text-slate-500">Loading live PO insights…</p>}

        {visible('kpi') ? (
          <KPIWidgets
            kpis={kpis}
            previousTotal={previousTotal}
            previousMonthLabel={previousMonthLabel}
          />
        ) : null}

        {showTables || visible('tables') ? (
          <>
            <div id="cfo-detail-tables" className="mb-4">
              <EntityPOSummaryTable entities={filteredEntities} />
        </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <RecentPOTable orders={filteredOrders} />
              <TopVendorsTable vendors={filteredVendors} />
        </div>
          </>
        ) : null}

        <div className="flex items-center justify-center gap-2 text-[12px] text-slate-400 pt-2 pb-4">
          <button type="button" onClick={() => void load()} className="hover:text-indigo-600" title="Refresh">
            <i className="ri-refresh-line"></i>
          </button>
          <span>{updatedLabel}</span>
        </div>
      </div>
  );

  if (embedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
