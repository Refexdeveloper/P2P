import { useMemo, useState } from 'react';
import { CARD, formatCompactInr } from '../cfoFormat';

type Series = { key: string; label: string; color: string };
type TrendPoint = Record<string, string | number>;

const WIDTH = 520;
const HEIGHT = 200;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

export default function MonthlyTrendChart({
  trend,
  onViewAnalytics,
}: {
  trend: TrendPoint[];
  series?: Series[];
  onViewAnalytics?: () => void;
}) {
  const [tooltip, setTooltip] = useState<{ x: number; month: string; total: number; approved: number; pending: number } | null>(
    null
  );

  const points = useMemo(() => {
    if (!trend.length) return [{ month: '—', total: 0, approved: 0, pending: 0 }];
    const maxTotal = Math.max(...trend.map((d) => Number(d.total || 0)), 1);
    return trend.map((d) => {
      const total = Number(d.total || 0);
      // Split current mix across months using this month's total only (no invented backend fields).
      // Approved/pending monthly series are not returned by the insights API; show total as the primary line
      // and keep approved/pending as visual guides scaled from the current snapshot ratio stored on each point if present.
      const approved = Number(d.approved ?? d.approvedAmount ?? 0);
      const pending = Number(d.pending ?? d.pendingAmount ?? 0);
      return {
        month: String(d.month || ''),
        total,
        approved: approved > 0 ? approved : total * (maxTotal > 0 ? 0 : 0),
        pending: pending > 0 ? pending : 0,
      };
    });
  }, [trend]);

  const hasSplit = points.some((p) => p.approved > 0 || p.pending > 0);
  const lines = hasSplit
    ? [
        { key: 'total' as const, label: 'Total PO', color: '#6366F1' },
        { key: 'approved' as const, label: 'Approved', color: '#10B981' },
        { key: 'pending' as const, label: 'Pending', color: '#F97316' },
      ]
    : [{ key: 'total' as const, label: 'Total PO', color: '#6366F1' }];

  const maxVal = Math.max(...points.flatMap((p) => lines.map((l) => Number(p[l.key] || 0))), 1);
  const chartW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const chartH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xStep = points.length > 1 ? chartW / (points.length - 1) : chartW;
  const getX = (i: number) => PAD_LEFT + i * xStep;
  const getY = (val: number) => PAD_TOP + chartH - (val / maxVal) * chartH;
  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];

  return (
    <div className={`${CARD} p-5 h-full flex flex-col`}>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="text-[15px] font-semibold text-slate-900">Monthly PO Amount Trend</h3>
        <div className="flex items-center gap-3">
          {lines.map((l) => (
            <div key={l.key} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
              <span className="text-[11px] text-slate-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
      {!trend.length ? (
        <p className="text-sm text-slate-500 py-10 text-center">No monthly PO trend yet.</p>
      ) : (
        <div className="relative flex-1 min-h-[180px]">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-full" onMouseLeave={() => setTooltip(null)}>
            {yTicks.map((tick, i) => (
              <g key={i}>
                <line x1={PAD_LEFT} y1={getY(tick)} x2={WIDTH - PAD_RIGHT} y2={getY(tick)} stroke="#EEF0F5" />
                <text x={PAD_LEFT - 6} y={getY(tick) + 3} textAnchor="end" fontSize="9" fill="#94A3B8">
                  {tick === 0 ? '0' : formatCompactInr(tick)}
                </text>
              </g>
            ))}
            {points.map((d, i) => (
              <text key={d.month} x={getX(i)} y={HEIGHT - 8} textAnchor="middle" fontSize="10" fill="#64748B">
                {d.month}
              </text>
            ))}
            {lines.map((l) => {
              const pts = points.map((d, i) => ({ x: getX(i), y: getY(Number(d[l.key] || 0)) }));
              const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
              return (
                <path
                  key={l.key}
                  d={path}
                  fill="none"
                  stroke={l.color}
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              );
            })}
            {points.map((d, i) => (
              <g key={i}>
                <rect
                  x={getX(i) - xStep / 2}
                  y={PAD_TOP}
                  width={xStep}
                  height={chartH}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() =>
                    setTooltip({
                      x: getX(i),
                      month: d.month,
                      total: d.total,
                      approved: d.approved,
                      pending: d.pending,
                    })
                  }
                />
                {lines.map((l) => (
                  <circle
                    key={l.key}
                    cx={getX(i)}
                    cy={getY(Number(d[l.key] || 0))}
                    r="3.5"
                    fill={l.color}
                    stroke="white"
                    strokeWidth="1.5"
                  />
                ))}
              </g>
            ))}
            {tooltip ? (
              <g>
                {(() => {
                  const bw = 128;
                  const bh = hasSplit ? 58 : 36;
                  const bx = tooltip.x + 10 + bw > WIDTH ? tooltip.x - bw - 10 : tooltip.x + 10;
                  return (
                    <>
                      <rect x={bx} y={PAD_TOP} width={bw} height={bh} rx="8" fill="white" stroke="#EEF0F5" />
                      <text x={bx + 10} y={PAD_TOP + 16} fontSize="10" fontWeight="600" fill="#0F172A">
                        {tooltip.month}
                      </text>
                      <text x={bx + 10} y={PAD_TOP + 30} fontSize="10" fill="#6366F1">
                        Total {formatCompactInr(tooltip.total)}
                      </text>
                      {hasSplit ? (
                        <>
                          <text x={bx + 10} y={PAD_TOP + 42} fontSize="10" fill="#10B981">
                            Approved {formatCompactInr(tooltip.approved)}
                          </text>
                          <text x={bx + 10} y={PAD_TOP + 54} fontSize="10" fill="#F97316">
                            Pending {formatCompactInr(tooltip.pending)}
                          </text>
                        </>
                      ) : null}
                    </>
                  );
                })()}
              </g>
            ) : null}
          </svg>
        </div>
      )}
      {onViewAnalytics ? (
        <button
          type="button"
          onClick={onViewAnalytics}
          className="mt-3 w-full pt-3 border-t border-[#EEF0F5] text-[12px] font-medium text-indigo-500 hover:text-indigo-600 text-center"
        >
          View Analytics
        </button>
      ) : null}
    </div>
  );
}
