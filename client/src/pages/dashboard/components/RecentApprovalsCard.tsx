import { CARD, formatCompactInr, formatFullInr } from '../cfoFormat';

export type ApprovalRow = {
  id: string;
  title: string;
  entity: string;
  amount: number;
  timestamp: string;
  type: string;
};

function iconFor(type: string) {
  const t = type.toLowerCase();
  if (t.includes('reject')) return { icon: 'ri-close-circle-fill', cls: 'text-rose-500 bg-rose-50' };
  if (t.includes('pending') || t.includes('wait')) return { icon: 'ri-time-fill', cls: 'text-orange-500 bg-orange-50' };
  if (t.includes('invoice')) return { icon: 'ri-checkbox-circle-fill', cls: 'text-rose-500 bg-rose-50' };
  return { icon: 'ri-checkbox-circle-fill', cls: 'text-emerald-500 bg-emerald-50' };
}

export default function RecentApprovalsCard({
  rows,
  onClick,
}: {
  rows: ApprovalRow[];
  onClick?: () => void;
}) {
  const list = rows.slice(0, 3);
  return (
    <div
      className={`${CARD} p-5 h-full flex flex-col ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <h3 className="text-[15px] font-semibold text-slate-900 mb-4">Recent Approvals</h3>
      <div className="flex-1 space-y-3">
        {list.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No recent approvals yet.</p>
        ) : (
          list.map((row) => {
            const vis = iconFor(row.type);
            return (
              <div key={row.id} className="flex items-start gap-2.5 rounded-lg hover:bg-slate-50 px-1 py-1 -mx-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${vis.cls}`}>
                  <i className={`${vis.icon} text-sm`}></i>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-slate-900 truncate">
                    {row.type} {row.title}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{row.entity}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[12px] font-semibold text-slate-900" title={formatFullInr(row.amount)}>
                    {formatCompactInr(row.amount)}
                  </p>
                  <p className="text-[10px] text-slate-400">{row.timestamp}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
