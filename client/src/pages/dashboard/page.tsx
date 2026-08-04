import DashboardLayout from '../../components/feature/DashboardLayout';
import KPIWidgets from './components/KPIWidgets';
import EntityPieChart from './components/EntityPieChart';
import MonthlyTrendChart from './components/MonthlyTrendChart';
import TopEntitiesBarChart from './components/TopEntitiesBarChart';
import EntityPOSummaryTable from './components/EntityPOSummaryTable';
import RecentPOTable from './components/RecentPOTable';
import TopVendorsTable from './components/TopVendorsTable';

export default function Dashboard() {
  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">CFO Financial Insights</h2>
            <p className="text-sm text-gray-500 mt-0.5">Entity-wise procurement & PO financial overview</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-white border border-gray-100 rounded-lg px-3 py-2">
            <i className="ri-calendar-line text-gray-400"></i>
            <span>FY 2024 — Jan 2024</span>
          </div>
        </div>
      </div>

      {/* KPI Widgets */}
      <KPIWidgets />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-1">
          <EntityPieChart />
        </div>
        <div className="lg:col-span-1">
          <TopEntitiesBarChart />
        </div>
        <div className="lg:col-span-1">
          <MonthlyTrendChart />
        </div>
      </div>

      {/* Entity-wise PO Summary Table */}
      <div className="mb-5">
        <EntityPOSummaryTable />
      </div>

      {/* Recent POs + Top Vendors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <RecentPOTable />
        <TopVendorsTable />
      </div>
    </DashboardLayout>
  );
}
