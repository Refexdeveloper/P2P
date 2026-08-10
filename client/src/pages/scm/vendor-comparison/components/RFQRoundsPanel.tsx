import { useState } from 'react';
import type { Vendor, QuoteRoundDetail } from '../../../../mocks/vendor-comparison-data';

interface RFQRoundsPanelProps {
  vendors: Vendor[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const RoundStatusBadge = ({ status }: { status: QuoteRoundDetail['status'] }) => {
  const map: Record<string, { label: string; cls: string; icon: string }> = {
    'sent-back': { label: 'Sent Back', cls: 'bg-red-50 text-red-600 border border-red-200', icon: 'ri-arrow-go-back-line' },
    'active': { label: 'Active', cls: 'bg-amber-50 text-amber-600 border border-amber-200', icon: 'ri-time-line' },
    'tech-evaluated': { label: 'Tech Evaluated', cls: 'bg-violet-50 text-violet-600 border border-violet-200', icon: 'ri-shield-check-line' },
    'final': { label: 'Final', cls: 'bg-emerald-50 text-emerald-600 border border-emerald-200', icon: 'ri-check-double-line' },
  };
  const s = map[status] || map['active'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${s.cls}`}>
      <i className={s.icon}></i>{s.label}
    </span>
  );
};

const SourceBadge = ({ source }: { source: QuoteRoundDetail['submittedBy'] }) => (
  source === 'vendor-portal'
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-teal-50 text-teal-600 border border-teal-200 whitespace-nowrap">
        <i className="ri-global-line text-xs"></i> Vendor Portal
      </span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200 whitespace-nowrap">
        <i className="ri-edit-line text-xs"></i> Manual
      </span>
);

function VendorRoundsCard({ vendor }: { vendor: Vendor }) {
  const [activeRound, setActiveRound] = useState<number>(
    vendor.quoteRounds ? vendor.quoteRounds.length : 1
  );
  const rounds = vendor.quoteRounds || [];
  const currentRound = rounds.find(r => r.round === activeRound);
  const finalRound = rounds[rounds.length - 1];

  const priceChange = (round: QuoteRoundDetail, idx: number) => {
    if (idx === 0) return null;
    const prev = rounds[idx - 1];
    const diff = round.quotedPrice - prev.quotedPrice;
    const pct = ((diff / prev.quotedPrice) * 100).toFixed(1);
    return { diff, pct, down: diff < 0 };
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Vendor Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="ri-store-2-line text-teal-600"></i>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{vendor.name}</p>
            <p className="text-xs text-gray-500">{rounds.length} negotiation round{rounds.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {finalRound && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Final Quote</p>
              <p className="text-sm font-bold text-teal-700">{formatCurrency(finalRound.quotedPrice)}</p>
            </div>
          )}
          <RoundStatusBadge status={finalRound?.status || 'active'} />
        </div>
      </div>

      {/* Round Tabs */}
      <div className="flex items-center gap-1 px-5 pt-4 pb-0 border-b border-gray-100">
        {rounds.map((r, idx) => {
          const change = priceChange(r, idx);
          return (
            <button
              key={r.round}
              onClick={() => setActiveRound(r.round)}
              className={`relative flex flex-col items-center px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeRound === r.round
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  activeRound === r.round ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>{r.round}</span>
                Round {r.round}
              </span>
              {change && (
                <span className={`text-xs mt-0.5 font-semibold ${change.down ? 'text-emerald-600' : 'text-red-500'}`}>
                  {change.down ? '▼' : '▲'} {Math.abs(Number(change.pct))}%
                </span>
              )}
              {r.status === 'sent-back' && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-400 rounded-full"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Round Detail */}
      {currentRound && (
        <div className="p-5">
          {/* Meta row */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <SourceBadge source={currentRound.submittedBy} />
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <i className="ri-calendar-line"></i>{currentRound.submittedDate}
            </span>
            <RoundStatusBadge status={currentRound.status} />
          </div>

          {/* Key metrics grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-teal-50 border border-teal-100 rounded-lg p-3">
              <p className="text-xs text-teal-600 mb-1 flex items-center gap-1">
                <i className="ri-money-rupee-circle-line"></i> Quoted Price
              </p>
              <p className="text-base font-bold text-gray-900">{formatCurrency(currentRound.quotedPrice)}</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <i className="ri-time-line"></i> Lead Time
              </p>
              <p className="text-base font-bold text-gray-900">{currentRound.leadTime} days</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <i className="ri-bank-card-line"></i> Payment Terms
              </p>
              <p className="text-sm font-semibold text-gray-900">{currentRound.paymentTerms}</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <i className="ri-shield-check-line"></i> Compliance
              </p>
              <p className={`text-sm font-semibold ${currentRound.compliance === 'Compliant' ? 'text-emerald-600' : 'text-amber-600'}`}>
                {currentRound.compliance}
              </p>
            </div>
          </div>

          {/* Scores */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Technical Score', value: currentRound.technicalScore, color: 'bg-violet-500' },
              { label: 'Commercial Score', value: currentRound.commercialScore, color: 'bg-teal-500' },
              { label: 'Overall Score', value: currentRound.overallScore, color: 'bg-emerald-500' },
            ].map((score) => (
              <div key={score.label} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500">{score.label}</p>
                  <p className="text-sm font-bold text-gray-900">{score.value}/100</p>
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${score.color} rounded-full transition-all`}
                    style={{ width: `${score.value}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          {/* Vendor Notes */}
          {currentRound.vendorNotes && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-3">
              <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                <i className="ri-chat-quote-line"></i> Vendor Notes
              </p>
              <p className="text-xs text-gray-700">{currentRound.vendorNotes}</p>
            </div>
          )}

          {/* Sent Back Reason */}
          {currentRound.status === 'sent-back' && currentRound.sentBackReason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
              <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1">
                <i className="ri-arrow-go-back-line"></i> Sent Back Reason
              </p>
              <p className="text-xs text-gray-700">{currentRound.sentBackReason}</p>
            </div>
          )}

          {/* Tech Eval Info */}
          {currentRound.status === 'tech-evaluated' && currentRound.techEvalBy && (
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 mb-3">
              <p className="text-xs font-semibold text-violet-700 mb-1 flex items-center gap-1">
                <i className="ri-shield-check-line"></i> Technical Evaluation Completed
              </p>
              <p className="text-xs text-gray-700">
                Evaluated by <span className="font-semibold">{currentRound.techEvalBy}</span>
                {currentRound.techEvalDate && <> on <span className="font-semibold">{currentRound.techEvalDate}</span></>}
              </p>
            </div>
          )}

          {/* Quotation File */}
          {currentRound.quotationFile && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ri-file-pdf-2-line text-red-500"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{currentRound.quotationFile}</p>
                <p className="text-xs text-gray-400">Round {currentRound.round} Quotation</p>
              </div>
              <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-teal-600 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-download-line"></i> Download
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RFQRoundsPanel({ vendors }: RFQRoundsPanelProps) {
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const vendorsWithRounds = vendors.filter(v => v.quoteRounds && v.quoteRounds.length > 0);

  // Price trend across rounds for all vendors
  const maxRounds = Math.max(...vendorsWithRounds.map(v => v.quoteRounds?.length || 0));

  return (
    <div>
      {/* Summary Banner */}
      <div className="bg-gradient-to-r from-teal-50 to-violet-50 border border-teal-100 rounded-xl p-4 mb-5 flex items-center gap-4">
        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <i className="ri-refresh-line text-teal-600 text-lg"></i>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900">RFQ Negotiation Rounds</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {vendorsWithRounds.length} vendors · Up to {maxRounds} negotiation rounds · All quotes submitted via Vendor Portal
          </p>
        </div>
        <div className="flex items-center gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500">Total Rounds</p>
            <p className="text-lg font-bold text-teal-700">{vendorsWithRounds.reduce((s, v) => s + (v.quoteRounds?.length || 0), 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Sent Back</p>
            <p className="text-lg font-bold text-red-600">
              {vendorsWithRounds.reduce((s, v) => s + (v.quoteRounds?.filter(r => r.status === 'sent-back').length || 0), 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Tech Evaluated</p>
            <p className="text-lg font-bold text-violet-600">
              {vendorsWithRounds.reduce((s, v) => s + (v.quoteRounds?.filter(r => r.status === 'tech-evaluated').length || 0), 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Price Trend Table — price + file per quotation round */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <i className="ri-line-chart-line text-teal-600"></i>
          <p className="text-sm font-semibold text-gray-900">Price Negotiation Trend</p>
          <span className="text-xs text-gray-400 ml-1">— how prices changed across rounds</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[200px]">Vendor</th>
                {Array.from({ length: maxRounds }, (_, i) => (
                  <th key={i} className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[160px]">
                    Quotation Round {i + 1}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[120px]">Savings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vendorsWithRounds.map((vendor) => {
                const rounds = vendor.quoteRounds || [];
                const firstPrice = rounds[0]?.quotedPrice || 0;
                const lastRound = rounds[rounds.length - 1];
                const lastPrice = lastRound?.quotedPrice || 0;
                const savings = firstPrice - lastPrice;
                const savingsPct = firstPrice > 0 ? ((savings / firstPrice) * 100).toFixed(1) : '0';
                return (
                  <tr key={vendor.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 align-top">
                      <p className="text-sm font-semibold text-gray-900">{vendor.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{rounds.length} round{rounds.length !== 1 ? 's' : ''}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Last quotation: {lastPrice ? formatCurrency(lastPrice) : '—'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]" title={lastRound?.quotationFile || undefined}>
                        Last file: {lastRound?.quotationFile || '—'}
                      </p>
                    </td>
                    {Array.from({ length: maxRounds }, (_, i) => {
                      const round = rounds[i];
                      const prevRound = rounds[i - 1];
                      const isLast = i === rounds.length - 1;
                      if (!round) {
                        return (
                          <td key={i} className="px-4 py-4 text-center text-gray-300 text-sm align-top">
                            —
                          </td>
                        );
                      }
                      const change = prevRound ? round.quotedPrice - prevRound.quotedPrice : 0;
                      const changePct = prevRound && prevRound.quotedPrice
                        ? ((change / prevRound.quotedPrice) * 100).toFixed(1)
                        : null;
                      return (
                        <td key={i} className={`px-4 py-4 text-center align-top ${isLast ? 'bg-teal-50/60' : ''}`}>
                          <div className="inline-flex flex-col items-center gap-1.5 min-w-[120px]">
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Price</p>
                              <p className={`text-sm font-bold ${isLast ? 'text-teal-700' : 'text-gray-900'}`}>
                                {formatCurrency(round.quotedPrice)}
                              </p>
                              {changePct !== null && (
                                <p className={`text-xs font-semibold mt-0.5 ${change < 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {change < 0 ? '▼' : '▲'} {Math.abs(Number(changePct))}%
                                </p>
                              )}
                            </div>
                            <div className="w-full pt-1.5 border-t border-gray-100">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">File</p>
                              {round.quotationFile ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-100 max-w-[150px]">
                                  <i className="ri-file-pdf-2-line text-red-500 text-sm flex-shrink-0"></i>
                                  <span className="text-xs font-medium text-gray-700 truncate" title={round.quotationFile}>
                                    {round.quotationFile}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </div>
                            <div className="mt-0.5">
                              <RoundStatusBadge status={round.status} />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-4 text-center align-top">
                      {savings > 0 ? (
                        <div>
                          <p className="text-sm font-bold text-emerald-600">{formatCurrency(savings)}</p>
                          <p className="text-xs text-emerald-500 font-semibold">{savingsPct}% saved</p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">No change</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Vendor Round Cards */}
      <div className="space-y-4">
        {vendorsWithRounds.map((vendor) => (
          <VendorRoundsCard key={vendor.id} vendor={vendor} />
        ))}
      </div>
    </div>
  );
}
