import { CARD, formatCompactInr } from '../cfoFormat';

type Entity = {
  entityName: string;
  code: string;
  totalPOCount: number;
  totalPOAmount: number;
  approvedAmount: number;
  pendingAmount: number;
  color: string;
};

const formatCurrency = formatCompactInr;

export default function EntityPOSummaryTable({ entities }: { entities: Entity[] }) {
  return (
      <div className={`${CARD} overflow-hidden`}>
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">Entity-wise PO Summary</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Entity Name
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Total PO Count
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Total PO Amount
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Approved Amount
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Pending Amount
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Utilization
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!entities.length ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500">
                  No purchase orders found for active entities.
                </td>
              </tr>
            ) : (
              entities.map((entity) => {
                const utilPct =
                  entity.totalPOAmount > 0
                    ? Math.round((entity.approvedAmount / entity.totalPOAmount) * 100)
                    : 0;
                return (
                  <tr key={`${entity.code}-${entity.entityName}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: entity.color }}
                        ></div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                            {entity.entityName}
                          </p>
                          <p className="text-xs text-gray-400">{entity.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-gray-900">{entity.totalPOCount}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(entity.totalPOAmount)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-green-600">
                        {formatCurrency(entity.approvedAmount)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-orange-500">
                        {formatCurrency(entity.pendingAmount)}
                      </span>
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
              })
            )}
          </tbody>
          {entities.length > 0 && (
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td className="px-5 py-3 text-sm font-semibold text-gray-700">Total</td>
                <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">
                  {entities.reduce((s, e) => s + e.totalPOCount, 0)}
                </td>
                <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">
                  {formatCurrency(entities.reduce((s, e) => s + e.totalPOAmount, 0))}
                </td>
                <td className="px-5 py-3 text-right text-sm font-bold text-green-600">
                  {formatCurrency(entities.reduce((s, e) => s + e.approvedAmount, 0))}
                </td>
                <td className="px-5 py-3 text-right text-sm font-bold text-orange-500">
                  {formatCurrency(entities.reduce((s, e) => s + e.pendingAmount, 0))}
                </td>
                <td className="px-5 py-3"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
