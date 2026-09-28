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

      <div className="overflow-x-auto bg-[#F8FAFC]/70 px-2 pb-3 pt-1 sm:px-3 sm:pb-4">
        <table className="w-full min-w-0 border-separate border-spacing-x-0 border-spacing-y-3 text-sm">
          <thead>
            <tr>
              {['#', 'Vendor Name', 'Entity', 'Total PO Amount', 'PO Count', 'Share'].map((h) => (
                <th
                  key={h}
                  className={`whitespace-nowrap px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 ${
                    h === 'Total PO Amount' || h === 'PO Count' ? 'text-right' : 'text-left'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!vendors.length ? (
              <tr>
                <td
                  colSpan={6}
                  className="rounded-2xl border border-transparent bg-white px-5 py-16 text-center shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]"
                >
                  <div className="flex flex-col items-center gap-2">
                    <i className="ri-store-2-line text-4xl text-slate-200" />
                    <p className="text-sm text-slate-400">No vendor PO spend yet.</p>
                  </div>
                </td>
              </tr>
            ) : (
              vendors.map((vendor, index) => {
                const sharePct = Math.round((vendor.totalPOAmount / maxAmount) * 100);
                const edge = 'border-transparent group-hover:border-[#90CAF9]';
                const shadow = 'shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]';
                return (
                  <tr key={`${vendor.vendorName}-${index}`} className="group">
                    <td className={`whitespace-nowrap rounded-l-2xl border border-r-0 bg-white px-3 py-4 transition-[border-color] sm:rounded-l-[18px] sm:py-5 ${edge} ${shadow}`}>
                      <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                    </td>
                    <td className={`max-w-[240px] border border-x-0 bg-white px-3 py-4 transition-[border-color] sm:py-5 ${edge}`} title={vendor.vendorName}>
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#EDE9FE]">
                          <i className="ri-store-2-line text-xs text-[#8B5CF6]" />
                        </div>
                        <span className="truncate text-sm font-semibold text-[#2C3E50]">{vendor.vendorName}</span>
                      </div>
                    </td>
                    <td className={`max-w-[180px] border border-x-0 bg-white px-3 py-4 transition-[border-color] sm:py-5 ${edge}`} title={vendor.entity}>
                      <p className="truncate text-sm text-[#2C3E50]">{vendor.entity}</p>
                    </td>
                    <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-right transition-[border-color] sm:py-5 ${edge}`}>
                      <span className="text-sm font-bold tabular-nums text-[#2C3E50]">
                        {formatCurrency(vendor.totalPOAmount)}
                      </span>
                    </td>
                    <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-right transition-[border-color] sm:py-5 ${edge}`}>
                      <span className="text-sm font-semibold tabular-nums text-[#2C3E50]">{vendor.poCount}</span>
                    </td>
                    <td className={`min-w-[120px] rounded-r-2xl border border-l-0 bg-white px-3 py-4 transition-[border-color] sm:rounded-r-[18px] sm:py-5 ${edge} ${shadow}`}>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-[#8B5CF6] transition-all duration-500"
                            style={{ width: `${sharePct}%` }}
                          />
                        </div>
                        <span className="whitespace-nowrap text-xs font-bold text-slate-500">{sharePct}%</span>
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
