import { useMemo, useState } from 'react';
import { formatCompactInr, formatFullInr } from '../cfoFormat';

type TrendPoint = { month: string; total: number };
type EntitySlice = { entityName: string; totalPOAmount: number; color?: string };
type VendorBar = { vendorName: string; totalPOAmount: number; poCount: number };

const PALETTE = ['#2563EB', '#06B6D4', '#10B981', '#8B5CF6', '#F97316', '#F43F5E'];

const softCard =
  'relative overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]';

const softWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutArc(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

export default function BuyerInsightCharts({
  trend,
  entities,
  vendors,
  approvedAmount,
  pendingAmount,
}: {
  trend: TrendPoint[];
  entities: EntitySlice[];
  vendors: VendorBar[];
  approvedAmount: number;
  pendingAmount: number;
}) {
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);
  const [hoverSlice, setHoverSlice] = useState<number | null>(null);

  const months = useMemo(() => {
    const rows = trend.map((p) => ({ month: String(p.month || ''), total: Number(p.total || 0) }));
    return rows.length ? rows : [{ month: '—', total: 0 }];
  }, [trend]);

  const maxMonth = Math.max(...months.map((m) => m.total), 1);
  const chartW = 640;
  const chartH = 220;
  const padL = 48;
  const padR = 16;
  const padT = 18;
  const padB = 28;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const step = months.length > 1 ? innerW / (months.length - 1) : innerW;
  const xAt = (i: number) => padL + i * step;
  const yAt = (v: number) => padT + innerH - (v / maxMonth) * innerH;
  const line = months.map((m, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(m.total).toFixed(1)}`).join(' ');
  const area = `${line} L ${xAt(months.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${xAt(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  const slices = useMemo(() => {
    const top = entities
      .filter((e) => Number(e.totalPOAmount) > 0)
      .slice(0, 6)
      .map((e, i) => ({
        name: e.entityName,
        amount: Number(e.totalPOAmount),
        color: e.color || PALETTE[i % PALETTE.length],
      }));
    const total = top.reduce((s, e) => s + e.amount, 0) || 1;
    let cursor = 0;
    return top.map((e) => {
      const sweep = (e.amount / total) * 360;
      const start = cursor;
      cursor += sweep;
      return { ...e, start, end: cursor, pct: (e.amount / total) * 100 };
    });
  }, [entities]);
  const sliceTotal = slices.reduce((s, e) => s + e.amount, 0);

  const vendorRows = vendors.slice(0, 6);
  const maxVendor = Math.max(...vendorRows.map((v) => Number(v.totalPOAmount) || 0), 1);

  const mixTotal = Math.max(approvedAmount + pendingAmount, 1);
  const approvedPct = (approvedAmount / mixTotal) * 100;

  return (
    <section className="mb-5">
      <div className="mb-3 px-0.5">
        <h2 className="text-xs font-bold tracking-wide text-slate-700 sm:text-base">Spend charts</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <article className={`${softCard} xl:col-span-3`}>
          <div className="pointer-events-none absolute inset-0" style={softWash} />
          <div className="relative z-[1] p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#2C3E50] sm:text-base">Monthly PO trend</h3>
                <p className="text-xs text-slate-500">Purchase order value by month</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E3F2FD] px-2.5 py-1 text-[11px] font-semibold text-[#1E88E5]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1E88E5]" />
                Total
              </span>
            </div>
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="h-[220px] w-full" onMouseLeave={() => setHoverMonth(null)}>
              <defs>
                <linearGradient id="buyerTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1E88E5" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#1E88E5" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="buyerTrendStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#1565C0" />
                  <stop offset="55%" stopColor="#1E88E5" />
                  <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
              {[0, 0.5, 1].map((t) => {
                const y = yAt(maxMonth * t);
                return (
                  <g key={t}>
                    <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#E2E8F0" strokeDasharray="4 4" />
                    <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="11" fill="#94A3B8">
                      {t === 0 ? '0' : formatCompactInr(maxMonth * t)}
                    </text>
                  </g>
                );
              })}
              <path d={area} fill="url(#buyerTrendFill)" />
              <path d={line} fill="none" stroke="url(#buyerTrendStroke)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
              {months.map((m, i) => (
                <g key={`${m.month}-${i}`}>
                  <text x={xAt(i)} y={chartH - 8} textAnchor="middle" fontSize="11" fill="#64748B">
                    {m.month}
                  </text>
                  <circle
                    cx={xAt(i)}
                    cy={yAt(m.total)}
                    r={hoverMonth === i ? 6 : 4}
                    fill="#fff"
                    stroke="#1E88E5"
                    strokeWidth="2.5"
                  />
                  <rect
                    x={xAt(i) - step / 2}
                    y={padT}
                    width={Math.max(step, 24)}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHoverMonth(i)}
                  />
                </g>
              ))}
              {hoverMonth != null ? (
                <g>
                  <rect
                    x={Math.min(xAt(hoverMonth) + 10, chartW - 150)}
                    y={padT}
                    width="138"
                    height="42"
                    rx="10"
                    fill="#0F172A"
                  />
                  <text x={Math.min(xAt(hoverMonth) + 22, chartW - 138)} y={padT + 17} fontSize="11" fill="#CBD5E1">
                    {months[hoverMonth].month}
                  </text>
                  <text x={Math.min(xAt(hoverMonth) + 22, chartW - 138)} y={padT + 33} fontSize="13" fontWeight="700" fill="#fff">
                    {formatCompactInr(months[hoverMonth].total)}
                  </text>
                </g>
              ) : null}
            </svg>
          </div>
        </article>

        <article className={`${softCard} xl:col-span-2`}>
          <div className="pointer-events-none absolute inset-0" style={softWash} />
          <div className="relative z-[1] flex h-full flex-col p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[#2C3E50] sm:text-base">Entity spend</h3>
            <p className="mb-3 text-xs text-slate-500">Share of purchase order value</p>
            {slices.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">No entity spend yet.</p>
            ) : (
              <div className="flex flex-1 flex-col items-center gap-4 sm:flex-row">
                <svg viewBox="0 0 120 120" className="h-40 w-40 shrink-0" onMouseLeave={() => setHoverSlice(null)}>
                  <circle cx="60" cy="60" r="42" fill="none" stroke="#E8EEF7" strokeWidth="14" />
                  {slices.map((s, i) => (
                    <path
                      key={s.name}
                      d={donutArc(60, 60, 42, s.start, Math.max(s.end - 1.2, s.start))}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={hoverSlice === i ? 16 : 14}
                      strokeLinecap="round"
                      onMouseEnter={() => setHoverSlice(i)}
                    />
                  ))}
                  <text x="60" y="56" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0F172A">
                    {formatCompactInr(sliceTotal)}
                  </text>
                  <text x="60" y="70" textAnchor="middle" fontSize="8" fill="#94A3B8">
                    Total
                  </text>
                </svg>
                <ul className="w-full min-w-0 space-y-2">
                  {slices.map((s, i) => (
                    <li
                      key={s.name}
                      className={`flex items-center justify-between gap-2 rounded-xl px-2 py-1 ${hoverSlice === i ? 'bg-[#E3F2FD]/70' : ''}`}
                      onMouseEnter={() => setHoverSlice(i)}
                      onMouseLeave={() => setHoverSlice(null)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="truncate text-xs font-medium text-slate-600" title={s.name}>
                          {s.name}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs font-bold tabular-nums text-[#2C3E50]" title={formatFullInr(s.amount)}>
                          {formatCompactInr(s.amount)}
                        </span>
                        <span className="text-[10px] text-slate-400">{s.pct.toFixed(1)}%</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </article>

        <article className={`${softCard} xl:col-span-3`}>
          <div className="pointer-events-none absolute inset-0" style={softWash} />
          <div className="relative z-[1] p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[#2C3E50] sm:text-base">Top vendors</h3>
            <p className="mb-4 text-xs text-slate-500">Highest purchase order value</p>
            {vendorRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No vendor spend yet.</p>
            ) : (
              <ul className="space-y-3">
                {vendorRows.map((v, i) => {
                  const amount = Number(v.totalPOAmount) || 0;
                  const width = Math.max(6, (amount / maxVendor) * 100);
                  const color = PALETTE[i % PALETTE.length];
                  return (
                    <li key={`${v.vendorName}-${i}`}>
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span className="truncate text-xs font-semibold text-slate-700" title={v.vendorName}>
                          {v.vendorName}
                        </span>
                        <span className="shrink-0 text-xs font-bold tabular-nums text-[#2C3E50]" title={formatFullInr(amount)}>
                          {formatCompactInr(amount)}
                          <span className="ml-1 font-medium text-slate-400">{v.poCount} PO</span>
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[#E8EEF7]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${width}%`,
                            background: `linear-gradient(90deg, ${color} 0%, ${color}cc 100%)`,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </article>

        <article className={`${softCard} xl:col-span-2`}>
          <div className="pointer-events-none absolute inset-0" style={softWash} />
          <div className="relative z-[1] flex h-full flex-col p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[#2C3E50] sm:text-base">Approved vs pending</h3>
            <p className="mb-4 text-xs text-slate-500">Value split for the selected period</p>
            <div className="mb-4 h-4 overflow-hidden rounded-full bg-[#FFE4E6]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#10B981] to-[#34D399]"
                style={{ width: `${approvedPct}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#D1FAE5]/70 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Approved</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-emerald-700" title={formatFullInr(approvedAmount)}>
                  {formatCompactInr(approvedAmount)}
                </p>
                <p className="text-[11px] text-emerald-700/80">{approvedPct.toFixed(1)}%</p>
              </div>
              <div className="rounded-2xl bg-[#FFE4E6]/80 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-600">Pending</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-rose-600" title={formatFullInr(pendingAmount)}>
                  {formatCompactInr(pendingAmount)}
                </p>
                <p className="text-[11px] text-rose-600/80">{(100 - approvedPct).toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
