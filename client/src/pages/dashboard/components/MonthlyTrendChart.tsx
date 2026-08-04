import { useState } from 'react';
import { monthlyPOTrend } from '../../../mocks/cfo-dashboard-data';

const formatCurrency = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${value.toLocaleString()}`;
};

const LINES = [
  { key: 'entityA', label: 'Entity A', color: '#14B8A6' },
  { key: 'entityB', label: 'Entity B', color: '#F59E0B' },
  { key: 'entityC', label: 'Entity C', color: '#10B981' },
  { key: 'holding', label: 'Holding', color: '#6366F1' }
];

const WIDTH = 480;
const HEIGHT = 160;
const PAD_LEFT = 48;
const PAD_RIGHT = 16;
const PAD_TOP = 12;
const PAD_BOTTOM = 28;

export default function MonthlyTrendChart() {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; month: string; values: Record<string, number> } | null>(null);

  const allValues = monthlyPOTrend.flatMap(d => LINES.map(l => (d as Record<string, number>)[l.key]));
  const maxVal = Math.max(...allValues);
  const minVal = 0;

  const chartW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const chartH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xStep = chartW / (monthlyPOTrend.length - 1);

  const getX = (i: number) => PAD_LEFT + i * xStep;
  const getY = (val: number) => PAD_TOP + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;

  const buildPath = (key: string) =>
    monthlyPOTrend
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY((d as Record<string, number>)[key]).toFixed(1)}`)
      .join(' ');

  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-800">Monthly PO Amount Trend</h3>
        <div className="flex items-center gap-3">
          {LINES.map(l => (
            <div key={l.key} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }}></div>
              <span className="text-xs text-gray-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          style={{ minWidth: 320 }}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Y grid lines */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={PAD_LEFT} y1={getY(tick)}
                x2={WIDTH - PAD_RIGHT} y2={getY(tick)}
                stroke="#F3F4F6" strokeWidth="1"
              />
              <text x={PAD_LEFT - 4} y={getY(tick) + 4} textAnchor="end" fontSize="8" fill="#9CA3AF">
                {tick === 0 ? '0' : formatCurrency(tick)}
              </text>
            </g>
          ))}

          {/* X axis labels */}
          {monthlyPOTrend.map((d, i) => (
            <text key={i} x={getX(i)} y={HEIGHT - 6} textAnchor="middle" fontSize="9" fill="#6B7280">
              {d.month}
            </text>
          ))}

          {/* Lines */}
          {LINES.map(l => (
            <path
              key={l.key}
              d={buildPath(l.key)}
              fill="none"
              stroke={l.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* Dots + hover areas */}
          {monthlyPOTrend.map((d, i) => (
            <g key={i}>
              <rect
                x={getX(i) - xStep / 2}
                y={PAD_TOP}
                width={xStep}
                height={chartH}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = (e.target as SVGRectElement).closest('svg')!.getBoundingClientRect();
                  setTooltip({
                    x: getX(i),
                    y: PAD_TOP,
                    month: d.month,
                    values: { entityA: d.entityA, entityB: d.entityB, entityC: d.entityC, holding: d.holding }
                  });
                }}
              />
              {LINES.map(l => (
                <circle
                  key={l.key}
                  cx={getX(i)}
                  cy={getY((d as Record<string, number>)[l.key])}
                  r="3"
                  fill={l.color}
                  stroke="white"
                  strokeWidth="1.5"
                />
              ))}
            </g>
          ))}

          {/* Tooltip */}
          {tooltip && (() => {
            const bx = tooltip.x + 8;
            const by = tooltip.y;
            const bw = 110;
            const bh = 72;
            const adjustedBx = bx + bw > WIDTH ? tooltip.x - bw - 8 : bx;
            return (
              <g>
                <rect x={adjustedBx} y={by} width={bw} height={bh} rx="4" fill="white" stroke="#E5E7EB" strokeWidth="1" filter="url(#shadow)" />
                <text x={adjustedBx + 8} y={by + 14} fontSize="9" fontWeight="600" fill="#374151">{tooltip.month} 2024</text>
                {LINES.map((l, li) => (
                  <g key={l.key}>
                    <circle cx={adjustedBx + 12} cy={by + 24 + li * 12} r="3" fill={l.color} />
                    <text x={adjustedBx + 20} y={by + 28 + li * 12} fontSize="8" fill="#6B7280">{l.label}:</text>
                    <text x={adjustedBx + bw - 6} y={by + 28 + li * 12} fontSize="8" fontWeight="600" fill="#374151" textAnchor="end">
                      {formatCurrency(tooltip.values[l.key])}
                    </text>
                  </g>
                ))}
              </g>
            );
          })()}

          <defs>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1" />
            </filter>
          </defs>
        </svg>
      </div>
    </div>
  );
}
