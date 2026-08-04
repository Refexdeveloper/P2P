import React from 'react';

interface StatsCardsProps {
  stats: {
    totalPRs: number;
    pendingApproval: number;
    approvedThisMonth: number;
    rejected: number;
    overdueCount: number;
    totalSpend: number;
  };
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      <div className="bg-white rounded-lg p-5 border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <i className="ri-file-list-3-line text-xl text-blue-600"></i>
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900">{stats.totalPRs}</div>
        <div className="text-sm text-gray-600 mt-1">Total PRs</div>
      </div>

      <div className="bg-white rounded-lg p-5 border border-orange-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <i className="ri-time-line text-xl text-orange-600"></i>
          </div>
          {stats.pendingApproval > 0 && (
            <span className="bg-orange-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
              {stats.pendingApproval}
            </span>
          )}
        </div>
        <div className="text-2xl font-bold text-orange-600">{stats.pendingApproval}</div>
        <div className="text-sm text-gray-600 mt-1">Pending Approval</div>
      </div>

      <div className="bg-white rounded-lg p-5 border border-green-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <i className="ri-checkbox-circle-line text-xl text-green-600"></i>
          </div>
        </div>
        <div className="text-2xl font-bold text-green-600">{stats.approvedThisMonth}</div>
        <div className="text-sm text-gray-600 mt-1">Approved This Month</div>
      </div>

      <div className="bg-white rounded-lg p-5 border border-red-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <i className="ri-close-circle-line text-xl text-red-600"></i>
          </div>
        </div>
        <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
        <div className="text-sm text-gray-600 mt-1">Rejected</div>
      </div>

      <div className="bg-white rounded-lg p-5 border border-purple-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <i className="ri-alarm-warning-line text-xl text-purple-600"></i>
          </div>
          {stats.overdueCount > 0 && (
            <span className="bg-purple-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
              {stats.overdueCount}
            </span>
          )}
        </div>
        <div className="text-2xl font-bold text-purple-600">{stats.overdueCount}</div>
        <div className="text-sm text-gray-600 mt-1">Overdue / SLA Breach</div>
      </div>

      <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg p-5 text-white hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <i className="ri-money-rupee-circle-line text-xl text-white"></i>
          </div>
        </div>
        <div className="text-2xl font-bold">₹{(stats.totalSpend / 100000).toFixed(1)}L</div>
        <div className="text-sm text-teal-50 mt-1">Total Spend Value</div>
      </div>
    </div>
  );
};

export default StatsCards;