import type { VendorQuotation } from '../types';

interface Props {
  quotations: VendorQuotation[];
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const roundColors = [
  { bg: 'bg-teal-100', text: 'text-teal-700', ring: 'ring-teal-400' },
  { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-400' },
  { bg: 'bg-violet-100', text: 'text-violet-700', ring: 'ring-violet-400' },
  { bg: 'bg-rose-100', text: 'text-rose-700', ring: 'ring-rose-400' },
];

export default function QuoteComparisonSummary({ quotations }: Props) {
  // Only vendors who have at least Q1 with a price
  const vendorsWithData = quotations.filter(
    q => q.vendorName && q.quotes.length >= 1 && q.quotes[0].quotedPrice > 0,
  );

  if (vendorsWithData.length === 0) return null;

  // Compute per-vendor stats across all rounds
  const vendorStats = vendorsWithData.map(q => {
    const q1Price = q.quotes[0].quotedPrice;
    const latestPrice = q.quotes[q.quotes.length - 1].quotedPrice;
    const latestRound = q.quotes.length;
    const totalReduction = q1Price - latestPrice;
    const reductionPct = q1Price > 0 ? ((totalReduction / q1Price) * 100) : 0;

    // Round-by-round deltas
    const roundDeltas = q.quotes.map((round, i) => {
      if (i === 0) return null;
      const prev = q.quotes[i - 1];
      if (!prev.quotedPrice || !round.quotedPrice) return null;
      return ((round.quotedPrice - prev.quotedPrice) / prev.quotedPrice) * 100;
    });

    return {
      id: q.id,
      name: q.vendorName,
      rounds: q.quotes,
      latestRound,
      q1Price,
      latestPrice,
      totalReduction,
      reductionPct,
      roundDeltas,
    };
  });

  // Multi-round vendors (for special callout)
  const multiRound = vendorStats.filter(v => v.latestRound >= 2);
  const totalSavings = multiRound.reduce((acc, v) => acc + Math.max(0, v.totalReduction), 0);
  const avgReduction = multiRound.length
    ? multiRound.reduce((acc, v) => acc + v.reductionPct, 0) / multiRound.length
    : 0;
  const bestVendor = multiRound.length
    ? multiRound.reduce((a, b) => b.reductionPct > a.reductionPct ? b : a, multiRound[0])
    : null;
  const highestPrice = vendorStats.reduce((a, b) => b.latestPrice > a ? b.latestPrice : a, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex items-center justify-center bg-teal-50 rounded-lg">
            <i className="ri-bar-chart-grouped-line text-teal-600 text-lg"></i>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Quotation Comparison Summary</h2>
            <p className="text-xs text-gray-500 mt-0.5">Q1 vs latest round — price reduction analysis across all vendors</p>
          </div>
        </div>
        {multiRound.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
              {multiRound.length} multi-round vendor{multiRound.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Top KPI strip — only if there are multi-round vendors */}
      {multiRound.length > 0 && (
        <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
          <div className="px-6 py-4">
            <p className="text-xs text-gray-500 mb-1">Total Savings (Q1 → Latest)</p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalSavings)}</p>
            <p className="text-xs text-gray-400 mt-0.5">vs initial Q1 prices</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs text-gray-500 mb-1">Avg. Price Reduction</p>
            <p className={`text-xl font-bold ${avgReduction > 0 ? 'text-emerald-600' : avgReduction < 0 ? 'text-red-600' : 'text-gray-500'}`}>
              {avgReduction > 0 ? '-' : avgReduction < 0 ? '+' : ''}{Math.abs(avgReduction).toFixed(1)}%
            </p>
            <p className="text-xs text-gray-400 mt-0.5">across re-quoted vendors</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs text-gray-500 mb-1">Best Negotiation</p>
            {bestVendor ? (
              <>
                <p className="text-base font-bold text-gray-900 truncate">{bestVendor.name}</p>
                <span className="inline-flex items-center gap-1 mt-0.5 text-xs font-semibold text-emerald-600">
                  <i className="ri-arrow-down-line"></i>
                  {Math.abs(bestVendor.reductionPct).toFixed(1)}% reduction
                </span>
              </>
            ) : (
              <p className="text-base text-gray-400">—</p>
            )}
          </div>
          <div className="px-6 py-4">
            <p className="text-xs text-gray-500 mb-1">Vendors in Comparison</p>
            <p className="text-xl font-bold text-gray-900">{vendorsWithData.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">{multiRound.length} re-quoted</p>
          </div>
        </div>
      )}

      {/* Per-Vendor Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-44">Vendor</th>
              {/* Dynamic round columns — up to 4 */}
              {[1, 2, 3, 4].map(r => (
                <th key={r} className={`px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider ${roundColors[(r - 1) % roundColors.length].text}`}>
                  Q{r} Price
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Reduction (₹)</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Reduction %</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Progress Bar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {vendorStats.map((v) => {
              const isPositiveReduction = v.reductionPct > 0;
              const isNegative = v.reductionPct < 0;

              return (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  {/* Vendor Name */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 leading-tight">{v.name}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {v.rounds.map((_, i) => (
                        <span
                          key={i}
                          className={`px-1.5 py-0.5 rounded text-xs font-bold ${roundColors[i % roundColors.length].bg} ${roundColors[i % roundColors.length].text}`}
                        >
                          Q{i + 1}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Q1–Q4 price columns */}
                  {[0, 1, 2, 3].map(ri => {
                    const round = v.rounds[ri];
                    const delta = v.roundDeltas[ri];
                    if (!round) {
                      return <td key={ri} className="px-4 py-3.5 text-right text-gray-300 text-xs">—</td>;
                    }
                    return (
                      <td key={ri} className="px-4 py-3.5 text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {round.quotedPrice ? formatCurrency(round.quotedPrice) : '—'}
                        </span>
                        {delta !== null && (
                          <div className={`text-xs font-semibold mt-0.5 flex items-center justify-end gap-0.5 ${delta < 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            <i className={delta < 0 ? 'ri-arrow-down-line' : 'ri-arrow-up-line'}></i>
                            {Math.abs(delta).toFixed(1)}%
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {/* Reduction amount */}
                  <td className="px-4 py-3.5 text-right">
                    {v.latestRound >= 2 && v.totalReduction !== 0 ? (
                      <span className={`text-sm font-bold ${isPositiveReduction ? 'text-emerald-600' : isNegative ? 'text-red-600' : 'text-gray-500'}`}>
                        {isPositiveReduction ? '-' : '+'}{formatCurrency(Math.abs(v.totalReduction))}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>

                  {/* Reduction % pill */}
                  <td className="px-4 py-3.5 text-right">
                    {v.latestRound >= 2 && v.reductionPct !== 0 ? (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        isPositiveReduction ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        <i className={isPositiveReduction ? 'ri-arrow-down-line' : 'ri-arrow-up-line'}></i>
                        {Math.abs(v.reductionPct).toFixed(1)}%
                      </span>
                    ) : v.latestRound === 1 ? (
                      <span className="text-xs text-gray-400">Single round</span>
                    ) : (
                      <span className="text-xs text-gray-400">No change</span>
                    )}
                  </td>

                  {/* Visual bar */}
                  <td className="px-5 py-3.5 min-w-[160px]">
                    {v.latestRound >= 2 && v.q1Price > 0 && highestPrice > 0 ? (
                      <div className="space-y-1">
                        {/* Q1 bar */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-5">Q1</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="h-2.5 rounded-full bg-gray-400"
                              style={{ width: `${Math.min(100, (v.q1Price / highestPrice) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                        {/* Latest round bar */}
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold w-5 ${roundColors[(v.latestRound - 1) % roundColors.length].text}`}>
                            Q{v.latestRound}
                          </span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-2.5 rounded-full transition-all ${
                                isPositiveReduction ? 'bg-emerald-500' : isNegative ? 'bg-red-500' : 'bg-teal-400'
                              }`}
                              style={{ width: `${Math.min(100, (v.latestPrice / highestPrice) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="h-2.5 rounded-full bg-teal-400"
                            style={{ width: `${highestPrice > 0 ? Math.min(100, (v.q1Price / highestPrice) * 100) : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Summary footer — only when multi-round vendors exist */}
          {multiRound.length > 0 && (
            <tfoot>
              <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                <td className="px-5 py-3 text-xs font-bold text-emerald-800 uppercase tracking-wide">Total Savings</td>
                <td colSpan={4} className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right text-sm font-bold text-emerald-700">
                  {formatCurrency(totalSavings)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-200 text-emerald-800">
                    <i className="ri-arrow-down-line"></i>
                    {Math.abs(avgReduction).toFixed(1)}% avg
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-emerald-700">
                  <span className="font-semibold">{multiRound.length}</span> vendor{multiRound.length !== 1 ? 's' : ''} negotiated down
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* No multi-round hint */}
      {multiRound.length === 0 && vendorsWithData.length > 0 && (
        <div className="px-6 py-3 bg-amber-50 border-t border-amber-100 flex items-center gap-2">
          <i className="ri-lightbulb-line text-amber-500"></i>
          <p className="text-xs text-amber-700">
            Use <span className="font-semibold">"Send Back for Re-quote"</span> on any vendor to trigger Q2 — the comparison analysis will appear here automatically.
          </p>
        </div>
      )}
    </div>
  );
}
