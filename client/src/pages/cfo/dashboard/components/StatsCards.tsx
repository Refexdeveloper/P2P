interface StatsCardsProps {
  stats: {
    totalPendingApprovals: number;
    highValuePRs: number;
    approvedThisMonth: number;
    totalSpendAllEntities: number;
    rejectedThisMonth: number;
  };
}

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
      <div className="bg-white rounded-lg p-5 border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <i className="ri-file-list-3-line text-xl text-gray-600"></i>
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900">{stats.totalPendingApprovals}</div>
        <div className="text-sm text-gray-600 mt-1">Total Pending</div>
      </div>

      <div className="bg-white rounded-lg p-5 border border-red-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <i className="ri-vip-crown-line text-xl text-red-600"></i>
          </div>
          {stats.highValuePRs > 0 && (
            <span className="bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
              {stats.highValuePRs}
            </span>
          )}
        </div>
        <div className="text-2xl font-bold text-red-600">{stats.highValuePRs}</div>
        <div className="text-sm text-gray-600 mt-1">High Value PRs</div>
        <div className="text-xs text-gray-400 mt-0.5">Above ₹50L</div>
      </div>

      <div className="bg-white rounded-lg p-5 border border-teal-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
            <i className="ri-checkbox-circle-line text-xl text-teal-600"></i>
          </div>
        </div>
        <div className="text-2xl font-bold text-teal-600">{stats.approvedThisMonth}</div>
        <div className="text-sm text-gray-600 mt-1">Approved This Month</div>
      </div>

      <div className="bg-white rounded-lg p-5 border border-red-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <i className="ri-close-circle-line text-xl text-red-600"></i>
          </div>
        </div>
        <div className="text-2xl font-bold text-red-600">{stats.rejectedThisMonth}</div>
        <div className="text-sm text-gray-600 mt-1">Rejected</div>
      </div>

      <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg p-5 text-white hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <i className="ri-money-rupee-circle-line text-xl text-white"></i>
          </div>
        </div>
        <div className="text-2xl font-bold">₹{(stats.totalSpendAllEntities / 10000000).toFixed(2)}Cr</div>
        <div className="text-sm text-teal-50 mt-1">Total Spend</div>
        <div className="text-xs text-teal-100 mt-0.5">All Entities</div>
      </div>
    </div>
  );
}
