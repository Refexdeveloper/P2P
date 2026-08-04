import { entityWisePOSummary } from '../../../mocks/cfo-dashboard-data';

const formatCurrency = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${value.toLocaleString()}`;
};

export default function EntityPOSummaryTable() {
  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">Entity-wise PO Summary</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Entity Name</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Total PO Count</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Total PO Amount</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Approved Amount</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Pending Amount</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Utilization</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {entityWisePOSummary.map((entity, index) => {
              const utilPct = Math.round((entity.approvedAmount / entity.totalPOAmount) * 100);
              return (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entity.color }}></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 whitespace-nowrap">{entity.entityName}</p>
                        <p className="text-xs text-gray-400">{entity.code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm font-semibold text-gray-900">{entity.totalPOCount}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(entity.totalPOAmount)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm font-semibold text-green-600">{formatCurrency(entity.approvedAmount)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm font-semibold text-orange-500">{formatCurrency(entity.pendingAmount)}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${utilPct}%`, backgroundColor: entity.color }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">{utilPct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td className="px-5 py-3 text-sm font-semibold text-gray-700">Total</td>
              <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">
                {entityWisePOSummary.reduce((s, e) => s + e.totalPOCount, 0)}
              </td>
              <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">
                {formatCurrency(entityWisePOSummary.reduce((s, e) => s + e.totalPOAmount, 0))}
              </td>
              <td className="px-5 py-3 text-right text-sm font-bold text-green-600">
                {formatCurrency(entityWisePOSummary.reduce((s, e) => s + e.approvedAmount, 0))}
              </td>
              <td className="px-5 py-3 text-right text-sm font-bold text-orange-500">
                {formatCurrency(entityWisePOSummary.reduce((s, e) => s + e.pendingAmount, 0))}
              </td>
              <td className="px-5 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
