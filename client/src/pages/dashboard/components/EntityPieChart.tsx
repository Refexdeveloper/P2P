import { useState } from 'react';
import { CARD, formatCompactInr, formatFullInr } from '../cfoFormat';

type Entity = {
  entityName: string;
  code: string;
  totalPOAmount: number;
  color: string;
};

export default function EntityPieChart({
  entities,
  onClick,
}: {
  entities: Entity[];
  onClick?: () => void;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const top = entities.slice(0, 4);
  const total = entities.reduce((sum, e) => sum + e.totalPOAmount, 0);
  const topSum = top.reduce((sum, e) => sum + e.totalPOAmount, 0);
  const others = Math.max(total - topSum, 0);
  const pieItems =
    others > 0 && entities.length > 4
      ? [...top, { entityName: 'Others', code: '', totalPOAmount: others, color: '#CBD5E1' }]
      : top;

  if (!top.length || total <= 0) {
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
        <h3 className="text-[15px] font-semibold text-slate-900">Entity-wise PO Distribution</h3>
        <p className="text-sm text-slate-500 py-10 text-center">No PO spend data yet.</p>
      </div>
    );
  }

  let cumulativePercent = 0;
  const segments = pieItems.map((item) => {
    const percent = (item.totalPOAmount / total) * 100;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    return { ...item, percent, startPercent };
  });

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
      <h3 className="text-[15px] font-semibold text-slate-900 mb-4">Entity-wise PO Distribution</h3>
      <div className="flex flex-col sm:flex-row items-center gap-5 flex-1">
        <div className="relative w-[168px] h-[168px] shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            {segments.map((segment, index) => {
              const startAngle = (segment.startPercent / 100) * 360;
              const sweep = (segment.percent / 100) * 360;
              const endAngle = startAngle + sweep;
              const largeArcFlag = segment.percent > 50 ? 1 : 0;
              const r = hoveredIndex === index ? 38 : 36;
              const startX = 50 + r * Math.cos((startAngle * Math.PI) / 180);
              const startY = 50 + r * Math.sin((startAngle * Math.PI) / 180);
              const endX = 50 + r * Math.cos((endAngle * Math.PI) / 180);
              const endY = 50 + r * Math.sin((endAngle * Math.PI) / 180);
              return (
                <path
                  key={segment.entityName}
                  d={`M ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY}`}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={hoveredIndex === index ? 14 : 12}
                  strokeLinecap="butt"
                  className="transition-all duration-200"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900 leading-none">{formatCompactInr(total)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Total</p>
            </div>
          </div>
        </div>
        <div className="flex-1 w-full min-w-0 space-y-3">
          {segments
            .filter((item) => item.entityName !== 'Others')
            .map((item, index) => (
              <div
                key={item.entityName}
                className={`flex items-start justify-between gap-2 rounded-lg px-1 py-0.5 ${
                  hoveredIndex === index ? 'bg-slate-50' : ''
                }`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-[12px] text-slate-600 leading-snug truncate" title={item.entityName}>
                    {item.entityName}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[12px] font-semibold text-slate-900" title={formatFullInr(item.totalPOAmount)}>
                    {formatCompactInr(item.totalPOAmount)}
                  </p>
                  <p className="text-[11px] text-slate-400">{item.percent.toFixed(1)}%</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
