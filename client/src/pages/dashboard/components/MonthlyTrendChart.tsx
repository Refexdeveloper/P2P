import { useMemo, useState } from 'react';

type Series = { key: string; label: string; color: string };
type TrendPoint = Record<string, string | number>;

const formatCurrency = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
};

const WIDTH = 480;
const HEIGHT = 160;
const PAD_LEFT = 48;
const PAD_RIGHT = 16;
const PAD_TOP = 12;
const PAD_BOTTOM = 28;

export default function MonthlyTrendChart({
  trend,
  series,
}: {
  trend: TrendPoint[];
  series: Series[];
}) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    month: string;
    values: Record<string, number>;
  } | null>(null);

  const lines = useMemo(() => {
    if (series.length) return series;
    return [{ key: 'total', label: 'Total', color: '#14B8A6' }];
  }, [series]);

  const points = trend.length
    ? trend
    : [{ month: '—', ym: '', total: 0 }];

  const allValues = points.flatMap((d) => lines.map((l) => Number(d[l.key] || 0)));
  const maxVal = Math.max(...allValues, 1);
  const minVal = 0;

  const chartW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const chartH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xStep = points.length > 1 ? chartW / (points.length - 1) : chartW;

  const getX = (i: number) => PAD_LEFT + i * xStep;
  const getY = (val: number) =>
    PAD_TOP + chartH - ((val - minVal) / (maxVal - minVal || 1)) * chartH;

  const buildPath = (key: string) =>
    points
      .map(
        (d, i) =>
          `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(Number(d[key] || 0)).toFixed(1)}`
      )
      .join(' ');

  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];
  const year = new Date().getFullYear();

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-800">Monthly PO Amount Trend</h3>
        <div className="flex items-center gap-3 flex-wrap">
          {lines.map((l) => (
            <div key={l.key} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }}></div>
              <span className="text-xs text-gray-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {!trend.length ? (
        <p className="text-sm text-gray-500 py-8 text-center">No monthly PO trend yet.</p>
      ) : (
        <div className="relative w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            style={{ minWidth: 320 }}
            onMouseLeave={() => setTooltip(null)}
          >
            {yTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={PAD_LEFT}
                  y1={getY(tick)}
                  x2={WIDTH - PAD_RIGHT}
                  y2={getY(tick)}
                  stroke="#F3F4F6"
                  strokeWidth="1"
                />
                <text
                  x={PAD_LEFT - 4}
                  y={getY(tick) + 4}
                  textAnchor="end"
                  fontSize="8"
                  fill="#9CA3AF"
                >
                  {tick === 0 ? '0' : formatCurrency(tick)}
                </text>
              </g>
            ))}

            {points.map((d, i) => (
              <text
                key={i}
                x={getX(i)}
                y={HEIGHT - 6}
                textAnchor="middle"
                fontSize="9"
                fill="#6B7280"
              >
                {String(d.month)}
              </text>
            ))}

            {lines.map((l) => (
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

            {points.map((d, i) => (
              <g key={i}>
                <rect
                  x={getX(i) - xStep / 2}
                  y={PAD_TOP}
                  width={xStep}
                  height={chartH}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => {
                    const values: Record<string, number> = {};
                    lines.forEach((l) => {
                      values[l.key] = Number(d[l.key] || 0);
                    });
                    setTooltip({
                      x: getX(i),
                      y: PAD_TOP,
                      month: String(d.month),
                      values,
                    });
                  }}
                />
                {lines.map((l) => (
                  <circle
                    key={l.key}
                    cx={getX(i)}
                    cy={getY(Number(d[l.key] || 0))}
                    r="3"
                    fill={l.color}
                    stroke="white"
                    strokeWidth="1.5"
                  />
                ))}
              </g>
            ))}

            {tooltip &&
              (() => {
                const bx = tooltip.x + 8;
                const by = tooltip.y;
                const bw = 120;
                const bh = 18 + lines.length * 12;
                const adjustedBx = bx + bw > WIDTH ? tooltip.x - bw - 8 : bx;
                return (
                  <g>
                    <rect
                      x={adjustedBx}
                      y={by}
                      width={bw}
                      height={bh}
                      rx="4"
                      fill="white"
                      stroke="#E5E7EB"
                      strokeWidth="1"
                    />
                    <text
                      x={adjustedBx + 8}
                      y={by + 14}
                      fontSize="9"
                      fontWeight="600"
                      fill="#374151"
                    >
                      {tooltip.month} {year}
                    </text>
                    {lines.map((l, li) => (
                      <g key={l.key}>
                        <circle
                          cx={adjustedBx + 12}
                          cy={by + 24 + li * 12}
                          r="3"
                          fill={l.color}
                        />
                        <text
                          x={adjustedBx + 20}
                          y={by + 28 + li * 12}
                          fontSize="8"
                          fill="#6B7280"
                        >
                          {l.label}:
                        </text>
                        <text
                          x={adjustedBx + bw - 6}
                          y={by + 28 + li * 12}
                          fontSize="8"
                          fontWeight="600"
                          fill="#374151"
                          textAnchor="end"
                        >
                          {formatCurrency(tooltip.values[l.key] || 0)}
                        </text>
                      </g>
                    ))}
                  </g>
                );
              })()}
          </svg>
        </div>
      )}
    </div>
  );
}
