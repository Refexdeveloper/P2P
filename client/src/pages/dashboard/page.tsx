import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/feature/DashboardLayout';
import KPIWidgets from './components/KPIWidgets';
import EntityPieChart from './components/EntityPieChart';
import MonthlyTrendChart from './components/MonthlyTrendChart';
import TopEntitiesBarChart from './components/TopEntitiesBarChart';
import EntityPOSummaryTable from './components/EntityPOSummaryTable';
import RecentPOTable from './components/RecentPOTable';
import TopVendorsTable from './components/TopVendorsTable';
import { poApi } from '../../services/api';

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

export default function Dashboard() {
  const [data, setData] = useState<Insights>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await poApi.cfoInsights();
        if (!cancelled) setData(res.data || EMPTY);
      } catch (err) {
        if (!cancelled) {
          setData(EMPTY);
          setError(err instanceof Error ? err.message : 'Failed to load CFO insights');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const periodLabel = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">CFO Financial Insights</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Entity-wise procurement &amp; PO financial overview
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-white border border-gray-100 rounded-lg px-3 py-2">
            <i className="ri-calendar-line text-gray-400"></i>
            <span>{periodLabel}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {loading && <p className="mb-4 text-sm text-gray-500">Loading live PO insights…</p>}

      <KPIWidgets kpis={data.kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-1">
          <EntityPieChart entities={data.entityWisePOSummary} />
        </div>
        <div className="lg:col-span-1">
          <TopEntitiesBarChart entities={data.entityWisePOSummary} />
        </div>
        <div className="lg:col-span-1">
          <MonthlyTrendChart trend={data.monthlyPOTrend} series={data.monthlySeries} />
        </div>
      </div>

      <div className="mb-5">
        <EntityPOSummaryTable entities={data.entityWisePOSummary} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <RecentPOTable orders={data.recentPurchaseOrders} />
        <TopVendorsTable vendors={data.topVendorsByPOAmount} />
      </div>
    </DashboardLayout>
  );
}
