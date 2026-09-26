import { Link } from 'react-router-dom';
import { formatCompactInr } from '../cfoFormat';

type Entity = {
  entityId?: number | null;
  entityName: string;
  code: string;
  totalPOCount: number;
  totalPOAmount: number;
  approvedAmount: number;
  pendingAmount: number;
  color: string;
};

const formatCurrency = formatCompactInr;

function entityDetailPath(entity: Entity) {
  const params = new URLSearchParams();
  if (entity.entityId) params.set('entityId', String(entity.entityId));
  if (entity.entityName) params.set('name', entity.entityName);
  const qs = params.toString();
  return qs ? `/dashboard/entity?${qs}` : null;
}

export default function EntityPOSummaryTable({ entities }: { entities: Entity[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/40 px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E88E5]/10 text-[#1E88E5]">
            <i className="ri-building-4-line text-lg" aria-hidden />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 sm:text-base">Entity-wise PO Summary</h3>
            <p className="text-[11px] text-slate-500 sm:text-xs">
              {entities.length} entit{entities.length === 1 ? 'y' : 'ies'}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] whitespace-nowrap">
                Entity Name
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] whitespace-nowrap">
                Total PO Count
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] whitespace-nowrap">
                Total PO Amount
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] whitespace-nowrap">
                Approved Amount
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] whitespace-nowrap">
                Pending Amount
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#7F8C8D] whitespace-nowrap">
                Utilization
              </th>
            </tr>
          </thead>
          <tbody>
            {!entities.length ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <i className="ri-folder-search-line text-4xl text-slate-200" />
                    <p className="text-sm text-slate-400">No purchase orders found for active entities.</p>
                  </div>
                </td>
              </tr>
            ) : (
              entities.map((entity) => {
                const utilPct =
                  entity.totalPOAmount > 0
                    ? Math.round((entity.approvedAmount / entity.totalPOAmount) * 100)
                    : 0;
                const href = entityDetailPath(entity);
                return (
                  <tr
                    key={`${entity.code}-${entity.entityName}`}
                    className={`border-b border-slate-100 transition-colors ${
                      href
                        ? 'cursor-pointer hover:bg-gradient-to-r hover:from-blue-50/40 hover:to-transparent'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: entity.color }}
                        />
                        <div className="min-w-0">
                          {href ? (
                            <Link
                              to={href}
                              className="block whitespace-nowrap text-sm font-semibold text-[#2C3E50] transition-colors hover:text-[#1E88E5]"
                              title={`View POs for ${entity.entityName}`}
                            >
                              {entity.entityName}
                            </Link>
                          ) : (
                            <p className="whitespace-nowrap text-sm font-semibold text-[#2C3E50]">{entity.entityName}</p>
                          )}
                          <p className="text-xs text-[#7F8C8D]">{entity.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {href ? (
                        <Link to={href} className="text-sm font-semibold text-[#2C3E50] hover:text-[#1E88E5]">
                          {entity.totalPOCount}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-[#2C3E50]">{entity.totalPOCount}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-bold text-[#2C3E50]">{formatCurrency(entity.totalPOAmount)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-[#22C55E]">{formatCurrency(entity.approvedAmount)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-semibold text-[#F97316]">{formatCurrency(entity.pendingAmount)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex min-w-[100px] items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{ width: `${utilPct}%`, backgroundColor: entity.color }}
                          />
                        </div>
                        <span className="whitespace-nowrap text-xs font-bold text-[#7F8C8D]">{utilPct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {entities.length > 0 && (
            <tfoot className="border-t border-slate-200 bg-slate-50/80">
              <tr>
                <td className="px-5 py-3 text-sm font-semibold text-slate-700">Total</td>
                <td className="px-5 py-3 text-right text-sm font-bold text-[#2C3E50]">
                  {entities.reduce((s, e) => s + e.totalPOCount, 0)}
                </td>
                <td className="px-5 py-3 text-right text-sm font-bold text-[#2C3E50]">
                  {formatCurrency(entities.reduce((s, e) => s + e.totalPOAmount, 0))}
                </td>
                <td className="px-5 py-3 text-right text-sm font-bold text-[#22C55E]">
                  {formatCurrency(entities.reduce((s, e) => s + e.approvedAmount, 0))}
                </td>
                <td className="px-5 py-3 text-right text-sm font-bold text-[#F97316]">
                  {formatCurrency(entities.reduce((s, e) => s + e.pendingAmount, 0))}
                </td>
                <td className="px-5 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
