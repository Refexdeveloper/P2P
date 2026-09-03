import { CARD, daysUntil, formatCompactInr, formatFullInr } from '../cfoFormat';

export type PaymentRow = {
  id: string;
  vendor: string;
  dueDate: string;
  amount: number;
};

export default function UpcomingPaymentsCard({
  rows,
  onClick,
}: {
  rows: PaymentRow[];
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
      <h3 className="text-[15px] font-semibold text-slate-900 mb-4">Upcoming Payments</h3>
      <div className="flex-1 space-y-3">
        {list.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No upcoming payments.</p>
        ) : (
          list.map((row) => {
            const days = daysUntil(row.dueDate);
            const dueLabel =
              days == null ? row.dueDate || 'Date pending' : days < 0 ? `${Math.abs(days)}d overdue` : `Due in ${days} days`;
            return (
              <div key={row.id} className="flex items-start gap-2.5 rounded-lg hover:bg-slate-50 px-1 py-1 -mx-1">
                <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <i className="ri-calendar-check-line text-sm"></i>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-slate-900 truncate">{row.vendor}</p>
                  <p className={`text-[11px] ${days != null && days < 0 ? 'text-rose-500' : 'text-slate-400'}`}>{dueLabel}</p>
                </div>
                <p className="text-[12px] font-semibold text-slate-900 shrink-0" title={formatFullInr(row.amount)}>
                  {formatCompactInr(row.amount)}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
