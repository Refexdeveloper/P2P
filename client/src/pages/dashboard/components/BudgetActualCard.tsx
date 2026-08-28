import { CARD, formatCompactInr, formatFullInr } from '../cfoFormat';

export default function BudgetActualCard({
  utilized,
  budget,
}: {
  utilized: number;
  budget: number;
}) {
  const remaining = Math.max(budget - utilized, 0);
  const pct = budget > 0 ? Math.min((utilized / budget) * 100, 100) : 0;
  const r = 54;
  const circ = Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className={`${CARD} p-5 h-full flex flex-col`}>
      <h3 className="text-[15px] font-semibold text-slate-900 mb-3">Budget vs Actual</h3>
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-[140px] h-[88px] shrink-0">
          <svg viewBox="0 0 140 88" className="w-full h-full">
            <path
              d="M 16 80 A 54 54 0 0 1 124 80"
              fill="none"
              stroke="#EEF0F5"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M 16 80 A 54 54 0 0 1 124 80"
              fill="none"
              stroke="#6366F1"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-end justify-center pb-1">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900 leading-none">{pct.toFixed(1)}%</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Utilized</p>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2.5">
          <div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
              Total Budget
            </p>
            <p className="text-sm font-semibold text-slate-900" title={formatFullInr(budget)}>
              {formatCompactInr(budget)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              Utilized Amount
            </p>
            <p className="text-sm font-semibold text-slate-900" title={formatFullInr(utilized)}>
              {formatCompactInr(utilized)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Remaining
            </p>
            <p className="text-sm font-semibold text-slate-900" title={formatFullInr(remaining)}>
              {formatCompactInr(remaining)}
            </p>
          </div>
        </div>
      </div>
      <p className="mt-3 pt-3 border-t border-[#EEF0F5] text-[12px] text-slate-400">
        {pct.toFixed(1)}% of budget utilized
      </p>
    </div>
  );
}
