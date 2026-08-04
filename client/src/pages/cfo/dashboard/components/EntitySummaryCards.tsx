interface Entity {
  id: string;
  name: string;
  code: string;
  color: string;
  allocatedBudget: number;
  utilizedBudget: number;
  utilizationPercentage: number;
  pendingPRsCount: number;
  approvedAmount: number;
}

interface EntitySummaryCardsProps {
  entity: Entity;
}

export default function EntitySummaryCards({ entity }: EntitySummaryCardsProps) {
  return (
    <div className="mb-8">
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        {/* Entity Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div 
              className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: entity.color }}
            >
              {entity.code}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{entity.name}</h2>
              <p className="text-sm text-gray-500">Business Entity Overview</p>
            </div>
          </div>
        </div>

        {/* Budget Utilization */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Budget Utilization</h3>
            <span className="text-2xl font-bold text-gray-900">{entity.utilizationPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div 
              className="h-4 rounded-full transition-all"
              style={{ 
                width: `${entity.utilizationPercentage}%`,
                backgroundColor: entity.color
              }}
            ></div>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div>
              <p className="text-xs text-gray-500">Utilized</p>
              <p className="text-lg font-bold text-gray-900">
                ₹{(entity.utilizedBudget / 10000000).toFixed(2)}Cr
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Allocated</p>
              <p className="text-lg font-bold text-gray-900">
                ₹{(entity.allocatedBudget / 10000000).toFixed(2)}Cr
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-6 pt-6 border-t border-gray-200">
          <div className="text-center">
            <div 
              className="w-12 h-12 rounded-lg mx-auto mb-3 flex items-center justify-center"
              style={{ backgroundColor: `${entity.color}20` }}
            >
              <i className="ri-file-list-3-line text-xl" style={{ color: entity.color }}></i>
            </div>
            <p className="text-2xl font-bold text-gray-900 mb-1">{entity.pendingPRsCount}</p>
            <p className="text-xs text-gray-500">Pending PRs</p>
          </div>
          <div className="text-center">
            <div 
              className="w-12 h-12 rounded-lg mx-auto mb-3 flex items-center justify-center"
              style={{ backgroundColor: `${entity.color}20` }}
            >
              <i className="ri-checkbox-circle-line text-xl" style={{ color: entity.color }}></i>
            </div>
            <p className="text-2xl font-bold text-gray-900 mb-1">
              ₹{(entity.approvedAmount / 10000000).toFixed(1)}Cr
            </p>
            <p className="text-xs text-gray-500">Approved Amount</p>
          </div>
          <div className="text-center">
            <div 
              className="w-12 h-12 rounded-lg mx-auto mb-3 flex items-center justify-center"
              style={{ backgroundColor: `${entity.color}20` }}
            >
              <i className="ri-wallet-3-line text-xl" style={{ color: entity.color }}></i>
            </div>
            <p className="text-2xl font-bold text-gray-900 mb-1">
              ₹{((entity.allocatedBudget - entity.utilizedBudget) / 10000000).toFixed(2)}Cr
            </p>
            <p className="text-xs text-gray-500">Available Budget</p>
          </div>
        </div>
      </div>
    </div>
  );
}