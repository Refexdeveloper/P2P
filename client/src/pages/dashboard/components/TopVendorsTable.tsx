import { formatCompactInr } from '../cfoFormat';

type Vendor = {
  vendorName: string;
  entity: string;
  totalPOAmount: number;
  poCount: number;
};

const formatCurrency = formatCompactInr;

export default function TopVendorsTable({ vendors }: { vendors: Vendor[] }) {
  const maxAmount = Math.max(...vendors.map((v) => v.totalPOAmount), 1);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-violet-50/40 px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8B5CF6]/10 text-[#8B5CF6]">
            <i className="ri-store-2-line text-lg" aria-hidden />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 sm:text-base">Top Vendors by PO Amount</h3>
            <p className="text-[11px] text-slate-500 sm:text-xs">Top {vendors.length}</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] whitespace-nowrap">
                #
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] whitespace-nowrap">
                Vendor Name
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] whitespace-nowrap">
                Entity
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] whitespace-nowrap">
                Total PO Amount
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] whitespace-nowrap">
                PO Count
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] whitespace-nowrap">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {!vendors.length ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <i className="ri-store-2-line text-4xl text-slate-200" />
                    <p className="text-sm text-slate-400">No vendor PO spend yet.</p>
                  </div>
                </td>
              </tr>
            ) : (
              vendors.map((vendor, index) => {
                const sharePct = Math.round((vendor.totalPOAmount / maxAmount) * 100);
                return (
                  <tr
                    key={`${vendor.vendorName}-${index}`}
                    className="border-b border-slate-100 transition-colors hover:bg-gradient-to-r hover:from-violet-50/30 hover:to-transparent"
                  >
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span className="text-xs font-bold text-[#7F8C8D]">#{index + 1}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-100 to-indigo-100">
                          <i className="ri-store-2-line text-xs text-[#8B5CF6]" />
                        </div>
                        <span className="text-sm font-medium text-[#2C3E50]">{vendor.vendorName}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span className="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-[#1E88E5]">
                        {vendor.entity}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      <span className="text-sm font-bold text-[#2C3E50]">
                        {formatCurrency(vendor.totalPOAmount)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-[#2C3E50]">{vendor.poCount}</span>
                    </td>
                    <td className="min-w-[100px] px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-[#8B5CF6] transition-all duration-500"
                            style={{ width: `${sharePct}%` }}
                          />
                        </div>
                        <span className="whitespace-nowrap text-xs font-bold text-[#7F8C8D]">{sharePct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
