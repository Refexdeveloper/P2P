import { Fragment, useState } from 'react';
import { formatCompactInr } from '../cfoFormat';

type DepartmentRow = {
  departmentName: string;
  totalPOCount: number;
  totalPOAmount: number;
  approvedAmount: number;
  pendingAmount: number;
};

type Entity = {
  entityId?: number | null;
  entityName: string;
  code: string;
  totalPOCount: number;
  totalPOAmount: number;
  approvedAmount: number;
  pendingAmount: number;
  color: string;
  departments?: DepartmentRow[];
};

const formatCurrency = formatCompactInr;

export default function EntityPOSummaryTable({
  entities,
  activeDepartment = '',
  onDepartmentSelect,
}: {
  entities: Entity[];
  activeDepartment?: string;
  onDepartmentSelect?: (departmentName: string, entity: Entity) => void;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
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

      <div className="overflow-x-auto bg-[#F8FAFC]/70 px-2 pb-3 pt-1 sm:px-3 sm:pb-4">
        <table className="w-full min-w-0 border-separate border-spacing-x-0 border-spacing-y-3 text-sm">
          <thead>
            <tr>
              {[
                ['Entity Name', 'left'],
                ['Total PO Count', 'right'],
                ['Total PO Amount', 'right'],
                ['Approved Amount', 'right'],
                ['Pending Amount', 'right'],
              ].map(([h, align]) => (
                <th
                  key={h}
                  className={`whitespace-nowrap px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 ${
                    align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!entities.length ? (
              <tr>
                <td
                  colSpan={5}
                  className="rounded-2xl border border-transparent bg-white px-5 py-16 text-center shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]"
                >
                  <div className="flex flex-col items-center gap-2">
                    <i className="ri-folder-search-line text-4xl text-slate-200" />
                    <p className="text-sm text-slate-400">No purchase orders found for active entities.</p>
                  </div>
                </td>
              </tr>
            ) : (
              entities.map((entity) => {
                const rowKey = `${entity.entityId || 0}-${entity.code}-${entity.entityName}`;
                const open = expandedKey === rowKey;
                const departments = entity.departments || [];
                const edge = open
                  ? 'border-[#90CAF9]'
                  : 'border-transparent group-hover:border-[#90CAF9]';
                const shadow = 'shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]';
                return (
                  <Fragment key={rowKey}>
                  <tr
                    className="group cursor-pointer"
                    onClick={() => setExpandedKey(open ? null : rowKey)}
                  >
                    <td className={`rounded-l-2xl border border-r-0 bg-white px-3 py-4 transition-[border-color] sm:rounded-l-[18px] sm:py-5 ${edge} ${shadow}`}>
                      <div className="flex items-center gap-2.5">
                        <i
                          className={`ri-arrow-${open ? 'down' : 'right'}-s-line text-base text-slate-400`}
                          aria-hidden
                        />
                        <div
                          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: entity.color }}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#2C3E50]">{entity.entityName}</p>
                          <p className="text-xs text-slate-400">{entity.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-right transition-[border-color] sm:py-5 ${edge}`}>
                      <span className="text-sm font-semibold tabular-nums text-[#2C3E50]">{entity.totalPOCount}</span>
                    </td>
                    <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-right transition-[border-color] sm:py-5 ${edge}`}>
                      <span className="text-sm font-bold tabular-nums text-[#2C3E50]">{formatCurrency(entity.totalPOAmount)}</span>
                    </td>
                    <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-right transition-[border-color] sm:py-5 ${edge}`}>
                      <span className="text-sm font-semibold tabular-nums text-[#22C55E]">{formatCurrency(entity.approvedAmount)}</span>
                    </td>
                    <td className={`rounded-r-2xl whitespace-nowrap border border-l-0 bg-white px-3 py-4 text-right transition-[border-color] sm:rounded-r-[18px] sm:py-5 ${edge} ${shadow}`}>
                      <span className="text-sm font-semibold tabular-nums text-[#F97316]">{formatCurrency(entity.pendingAmount)}</span>
                    </td>
                  </tr>
                  {open ? (
                    <tr key={`${rowKey}-departments`}>
                      <td colSpan={5} className="rounded-2xl bg-[#F5F7FA] px-3 py-3 sm:px-4">
                        <div className="overflow-hidden rounded-xl border border-white bg-white">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-100">
                                {['Department Name', 'PO Count', 'Total PO Amount', 'Approved Amount', 'Pending Amount'].map(
                                  (label, index) => (
                                    <th
                                      key={label}
                                      className={`px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-black ${
                                        index === 0 ? 'text-left' : 'text-right'
                                      }`}
                                    >
                                      {label}
                                    </th>
                                  )
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {departments.length ? (
                                departments.map((dept) => {
                                  const selected =
                                    activeDepartment.trim().toLowerCase() === dept.departmentName.trim().toLowerCase();
                                  return (
                                  <tr
                                    key={dept.departmentName}
                                    className={`border-b border-slate-50 last:border-0 ${
                                      onDepartmentSelect ? 'cursor-pointer hover:bg-[#E3F2FD]/60' : ''
                                    } ${selected ? 'bg-[#E3F2FD]' : ''}`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onDepartmentSelect?.(dept.departmentName, entity);
                                    }}
                                  >
                                    <td className="px-3 py-2.5 font-semibold text-[#172B4D]">{dept.departmentName}</td>
                                    <td className="px-3 py-2.5 text-right tabular-nums text-[#2C3E50]">{dept.totalPOCount}</td>
                                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#2C3E50]">
                                      {formatCurrency(dept.totalPOAmount)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#22C55E]">
                                      {formatCurrency(dept.approvedAmount)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#F97316]">
                                      {formatCurrency(dept.pendingAmount)}
                                    </td>
                                  </tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td colSpan={5} className="px-3 py-4 text-sm text-slate-500">
                                    No department is linked to these purchase orders.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                );
              })
            )}
            {entities.length > 0 && (
              <tr>
                <td className="rounded-l-2xl border border-r-0 border-[#BBDEFB] bg-[#E3F2FD]/50 px-3 py-3 text-sm font-semibold text-slate-700 sm:rounded-l-[18px]">
                  Total
                </td>
                <td className="whitespace-nowrap border border-x-0 border-[#BBDEFB] bg-[#E3F2FD]/50 px-3 py-3 text-right text-sm font-bold tabular-nums text-[#2C3E50]">
                  {entities.reduce((s, e) => s + e.totalPOCount, 0)}
                </td>
                <td className="whitespace-nowrap border border-x-0 border-[#BBDEFB] bg-[#E3F2FD]/50 px-3 py-3 text-right text-sm font-bold tabular-nums text-[#2C3E50]">
                  {formatCurrency(entities.reduce((s, e) => s + e.totalPOAmount, 0))}
                </td>
                <td className="whitespace-nowrap border border-x-0 border-[#BBDEFB] bg-[#E3F2FD]/50 px-3 py-3 text-right text-sm font-bold tabular-nums text-[#22C55E]">
                  {formatCurrency(entities.reduce((s, e) => s + e.approvedAmount, 0))}
                </td>
                <td className="rounded-r-2xl whitespace-nowrap border border-l-0 border-[#BBDEFB] bg-[#E3F2FD]/50 px-3 py-3 text-right text-sm font-bold tabular-nums text-[#F97316] sm:rounded-r-[18px]">
                  {formatCurrency(entities.reduce((s, e) => s + e.pendingAmount, 0))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
