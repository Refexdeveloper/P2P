import { CARD, formatCompactInr, formatFullInr } from '../cfoFormat';

type Entity = {
  entityName: string;
  totalPOCount: number;
  totalPOAmount: number;
  approvedAmount: number;
  color: string;
};

const BAR_COLORS = ['#6366F1', '#F97316', '#10B981', '#0EA5E9'];

export default function TopEntitiesBarChart({
  entities,
  onClick,
}: {
  entities: Entity[];
  onClick?: () => void;
}) {
  const top = entities.slice(0, 4);
  const total = entities.reduce((s, e) => s + e.totalPOAmount, 0) || 1;

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
      <h3 className="text-[15px] font-semibold text-slate-900 mb-5">Top Entities by Spend</h3>
      {!top.length ? (
        <p className="text-sm text-slate-500 py-10 text-center">No entity spend yet.</p>
      ) : (
        <div className="space-y-5 flex-1">
          {top.map((entity, i) => {
            const pct = (entity.totalPOAmount / total) * 100;
            return (
              <div key={entity.entityName}>
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="text-[12px] text-slate-700 font-medium truncate" title={entity.entityName}>
                    {entity.entityName}
                  </span>
                  <span
                    className="text-[12px] font-bold text-slate-900 whitespace-nowrap"
                    title={formatFullInr(entity.totalPOAmount)}
                  >
                    {formatCompactInr(entity.totalPOAmount)}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max(pct, 2)}%`,
                      backgroundColor: entity.color || BAR_COLORS[i % BAR_COLORS.length],
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{pct.toFixed(1)}% of total</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
