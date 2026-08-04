import { topVendorsByPOAmount } from '../../../mocks/cfo-dashboard-data';

const formatCurrency = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${value.toLocaleString()}`;
};

const entityColors: Record<string, string> = {
  'Entity A - Manufacturing': '#14B8A6',
  'Entity B - Services': '#F59E0B',
  'Entity C - Retail': '#10B981',
  'Holding Company': '#6366F1'
};

export default function TopVendorsTable() {
  const maxAmount = Math.max(...topVendorsByPOAmount.map(v => v.totalPOAmount));

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Top Vendors by PO Amount</h3>
        <span className="text-xs text-gray-400">Top {topVendorsByPOAmount.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">#</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Vendor Name</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Entity</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Total PO Amount</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">PO Count</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {topVendorsByPOAmount.map((vendor, index) => {
              const color = entityColors[vendor.entity] ?? '#9CA3AF';
              const sharePct = Math.round((vendor.totalPOAmount / maxAmount) * 100);
              return (
                <tr key={index} className="hover:bg-gray-50 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <i className="ri-store-2-line text-xs text-gray-500"></i>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{vendor.vendorName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
                      style={{ backgroundColor: `${color}18`, color }}
                    >
                      {vendor.entity}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(vendor.totalPOAmount)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <span className="text-sm font-semibold text-gray-700">{vendor.poCount}</span>
                  </td>
                  <td className="px-5 py-3.5 min-w-[100px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${sharePct}%`, backgroundColor: color }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{sharePct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
