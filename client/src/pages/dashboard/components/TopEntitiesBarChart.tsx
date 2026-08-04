import { entityWisePOSummary } from '../../../mocks/cfo-dashboard-data';

const formatCurrency = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${value.toLocaleString()}`;
};

const maxAmount = Math.max(...entityWisePOSummary.map(e => e.totalPOAmount));

export default function TopEntitiesBarChart() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-5">Top Entities by Spend</h3>
      <div className="space-y-4">
        {entityWisePOSummary.map((entity, index) => {
          const widthPct = (entity.totalPOAmount / maxAmount) * 100;
          return (
            <div key={index}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-700 font-medium truncate max-w-[160px]">{entity.entityName}</span>
                <span className="text-xs font-bold text-gray-900 ml-2 whitespace-nowrap">{formatCurrency(entity.totalPOAmount)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className="h-2.5 rounded-full transition-all duration-700"
                  style={{ width: `${widthPct}%`, backgroundColor: entity.color }}
                ></div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-400">{entity.totalPOCount} POs</span>
                <span className="text-xs text-gray-400">
                  Approved: {formatCurrency(entity.approvedAmount)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
