import { useState } from 'react';
import { CARD } from '../cfoFormat';

type Slice = { key: string; label: string; value: number; color: string };

export default function PoStatusCard({
  slices,
  centerLabel,
  formatValue,
  onViewAll,
}: {
  slices: Slice[];
  centerLabel?: string;
  formatValue?: (n: number) => string;
  onViewAll?: () => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const fmt = formatValue || ((n: number) => String(n));

  let cumulative = 0;
  const segments = slices.map((item) => {
    const percent = total > 0 ? (item.value / total) * 100 : 0;
    const start = cumulative;
    cumulative += percent;
    return { ...item, percent, start };
  });

  return (
    <div className={`${CARD} p-5 h-full flex flex-col`}>
      <h3 className="text-[15px] font-semibold text-slate-900 mb-3">PO Status Overview</h3>
      {!total ? (
        <p className="text-sm text-slate-500 py-8 text-center">No PO status data yet.</p>
      ) : (
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-[120px] h-[120px] shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              {segments.map((segment) => {
                const startAngle = (segment.start / 100) * 360;
                const sweep = (segment.percent / 100) * 360;
                const endAngle = startAngle + sweep;
                const largeArcFlag = segment.percent > 50 ? 1 : 0;
                const r = 36;
                const startX = 50 + r * Math.cos((startAngle * Math.PI) / 180);
                const startY = 50 + r * Math.sin((startAngle * Math.PI) / 180);
                const endX = 50 + r * Math.cos((endAngle * Math.PI) / 180);
                const endY = 50 + r * Math.sin((endAngle * Math.PI) / 180);
                if (segment.percent <= 0) return null;
                return (
                  <path
                    key={segment.key}
                    d={`M ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY}`}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={hovered === segment.key ? 13 : 11}
                    className="cursor-pointer"
                    onMouseEnter={() => setHovered(segment.key)}
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-xl font-bold text-slate-900 leading-none">{centerLabel || total}</p>
                <p className="text-[10px] text-slate-400 mt-1">Total</p>
              </div>
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            {segments.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-2 text-[12px]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 truncate">{item.label}</span>
                </div>
                <span className="text-slate-900 font-semibold whitespace-nowrap">
                  {fmt(item.value)} ({item.percent.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {onViewAll ? (
        <button
          type="button"
          onClick={onViewAll}
          className="mt-3 w-full pt-3 border-t border-[#EEF0F5] text-[12px] font-medium text-indigo-500 hover:text-indigo-600 text-center"
        >
          View All POs
        </button>
      ) : null}
    </div>
  );
}
