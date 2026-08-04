import { useState } from 'react';
import type { TechEvalRFQ, TechEvalVendor, TechEvalRound } from '../../../../mocks/tech-eval-data';
import VendorScoringModal from './VendorScoringModal';

interface Props {
  rfq: TechEvalRFQ;
  onClose: () => void;
  onUpdate: (rfqId: string, vendorId: string, roundIndex: number, data: Partial<TechEvalRound>) => void;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const roundBadgeColors = [
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
];

const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-500';
};

const getScoreBg = (score: number) => {
  if (score >= 80) return 'bg-emerald-100 text-emerald-700';
  if (score >= 60) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-600';
};

export default function RFQEvalDetailPanel({ rfq, onClose, onUpdate }: Props) {
  const [scoringTarget, setScoringTarget] = useState<{ vendor: TechEvalVendor; roundIndex: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'scoring' | 'comparison'>('scoring');

  const allEvaluated = rfq.vendors.every(v => v.rounds[v.rounds.length - 1]?.status === 'evaluated');

  const handleSave = (vendorId: string, roundIndex: number, data: Partial<TechEvalRound>) => {
    onUpdate(rfq.id, vendorId, roundIndex, data);
  };

  // Build comparison data from latest evaluated rounds
  const comparisonData = rfq.vendors
    .map(v => {
      const latestEval = [...v.rounds].reverse().find(r => r.status === 'evaluated');
      return latestEval ? { vendor: v, round: latestEval } : null;
    })
    .filter(Boolean) as { vendor: TechEvalVendor; round: TechEvalRound }[];

  const bestOverall = comparisonData.length
    ? comparisonData.reduce((a, b) => b.round.overallScore > a.round.overallScore ? b : a, comparisonData[0])
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-teal-50 to-white">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs font-bold">{rfq.rfqRef}</span>
              <span className="px-2 py-0.5 text-xs text-gray-500">{rfq.prRef}</span>
              <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{rfq.department}</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900">{rfq.prTitle}</h2>
            <p className="text-sm text-gray-500">SCM Buyer: {rfq.scmBuyer} · Due: {rfq.dueDate} · {rfq.totalVendors} vendors</p>
          </div>
          <div className="flex items-center gap-3">
            {allEvaluated && (
              <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1.5">
                <i className="ri-checkbox-circle-fill"></i>
                All Vendors Evaluated
              </span>
            )}
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer">
              <i className="ri-close-line text-xl text-gray-500"></i>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-gray-200 flex gap-1 pt-3">
          {(['scoring', 'comparison'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === tab ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab === 'scoring' ? (
                <><i className="ri-star-line mr-1.5"></i>Vendor Scoring</>
              ) : (
                <><i className="ri-bar-chart-grouped-line mr-1.5"></i>Score Comparison</>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'scoring' && (
            <div className="space-y-4">
              {rfq.vendors.map(vendor => {
                const latestRoundIdx = vendor.rounds.length - 1;
                const latestRound = vendor.rounds[latestRoundIdx];
                const isEvaluated = latestRound?.status === 'evaluated';

                return (
                  <div key={vendor.id} className={`border rounded-xl overflow-hidden ${isEvaluated ? 'border-emerald-200' : 'border-gray-200'}`}>
                    {/* Vendor Header */}
                    <div className={`px-5 py-3.5 flex items-center justify-between ${isEvaluated ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 flex items-center justify-center rounded-full ${isEvaluated ? 'bg-emerald-100' : 'bg-gray-200'}`}>
                          <i className={`${isEvaluated ? 'ri-checkbox-circle-fill text-emerald-600' : 'ri-time-line text-gray-500'} text-base`}></i>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">{vendor.vendorName}</span>
                            {vendor.source === 'vendor-portal' && (
                              <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs font-semibold flex items-center gap-1">
                                <i className="ri-global-line text-xs"></i>Portal
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {vendor.rounds.map((r, i) => (
                              <span key={i} className={`px-2 py-0.5 rounded-full text-xs font-bold ${roundBadgeColors[i % roundBadgeColors.length]}`}>
                                Q{i + 1}: {formatCurrency(r.quotedPrice)}
                              </span>
                            ))}
                            <span className="text-xs text-gray-500">· {vendor.leadTime}d lead · {vendor.paymentTerms}</span>
                            {!vendor.compliance && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-semibold">Non-Compliant</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isEvaluated && (
                          <div className="flex items-center gap-3 text-sm">
                            <div className="text-center">
                              <p className="text-xs text-gray-500">Tech</p>
                              <p className={`font-bold ${getScoreColor(latestRound.technicalScore)}`}>{latestRound.technicalScore}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-500">Comm</p>
                              <p className={`font-bold ${getScoreColor(latestRound.commercialScore)}`}>{latestRound.commercialScore}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-500">Overall</p>
                              <p className={`text-lg font-bold ${getScoreColor(latestRound.overallScore)}`}>{latestRound.overallScore}</p>
                            </div>
                          </div>
                        )}
                        <button
                          onClick={() => setScoringTarget({ vendor, roundIndex: latestRoundIdx })}
                          className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                            isEvaluated
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : 'bg-teal-600 text-white hover:bg-teal-700'
                          }`}
                        >
                          <i className={isEvaluated ? 'ri-edit-line' : 'ri-star-line'}></i>
                          {isEvaluated ? 'Edit Score' : 'Score Now'}
                        </button>
                      </div>
                    </div>

                    {/* Round history if multiple rounds */}
                    {vendor.rounds.length > 1 && (
                      <div className="px-5 py-3 bg-white border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">All Rounds</p>
                        <div className="flex gap-3 flex-wrap">
                          {vendor.rounds.map((r, i) => (
                            <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                              r.status === 'evaluated' ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'
                            }`}>
                              <span className={`px-1.5 py-0.5 rounded font-bold ${roundBadgeColors[i % roundBadgeColors.length]}`}>Q{i + 1}</span>
                              <span className="font-semibold text-gray-800">{formatCurrency(r.quotedPrice)}</span>
                              {r.status === 'evaluated' ? (
                                <span className={`font-bold ${getScoreColor(r.overallScore)}`}>{r.overallScore}/100</span>
                              ) : (
                                <span className="text-gray-400">Pending</span>
                              )}
                              {i < vendor.rounds.length - 1 && (
                                <button
                                  onClick={() => setScoringTarget({ vendor, roundIndex: i })}
                                  className="text-teal-600 hover:text-teal-800 cursor-pointer"
                                  title="Score this round"
                                >
                                  <i className="ri-edit-line"></i>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Eval remarks if done */}
                    {isEvaluated && latestRound.remarks && (
                      <div className="px-5 py-3 bg-white border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">
                          <i className="ri-chat-3-line mr-1"></i>
                          Eval by <span className="font-semibold">{latestRound.evalBy}</span> on {latestRound.evalDate}
                        </p>
                        <p className="text-sm text-gray-700 italic">&ldquo;{latestRound.remarks}&rdquo;</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'comparison' && (
            <div>
              {comparisonData.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <i className="ri-bar-chart-grouped-line text-4xl mb-3 block"></i>
                  <p className="text-sm">No vendors evaluated yet. Score vendors in the Scoring tab first.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Best vendor callout */}
                  {bestOverall && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-center gap-4">
                      <div className="w-10 h-10 flex items-center justify-center bg-emerald-100 rounded-full">
                        <i className="ri-trophy-line text-emerald-600 text-xl"></i>
                      </div>
                      <div>
                        <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Highest Overall Score</p>
                        <p className="text-base font-bold text-gray-900">{bestOverall.vendor.vendorName}</p>
                        <p className="text-sm text-emerald-700">Overall: <span className="font-bold">{bestOverall.round.overallScore}/100</span> · Tech: {bestOverall.round.technicalScore} · Comm: {bestOverall.round.commercialScore}</p>
                      </div>
                    </div>
                  )}

                  {/* Comparison table */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vendor</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Quoted Price</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Tech Score</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Comm Score</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Overall</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Score Bar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {comparisonData
                          .sort((a, b) => b.round.overallScore - a.round.overallScore)
                          .map(({ vendor, round }, idx) => (
                            <tr key={vendor.id} className={idx === 0 ? 'bg-emerald-50' : 'hover:bg-gray-50'}>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-2">
                                  {idx === 0 && <i className="ri-trophy-fill text-amber-500 text-sm"></i>}
                                  <span className="font-semibold text-gray-900">{vendor.vendorName}</span>
                                  {vendor.source === 'vendor-portal' && (
                                    <span className="px-1.5 py-0.5 bg-teal-100 text-teal-600 rounded text-xs">Portal</span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">Q{vendor.currentRound} · {vendor.leadTime}d</p>
                              </td>
                              <td className="px-4 py-3.5 text-right font-semibold text-gray-900">{formatCurrency(round.quotedPrice)}</td>
                              <td className="px-4 py-3.5 text-right">
                                <span className={`font-bold ${getScoreColor(round.technicalScore)}`}>{round.technicalScore}</span>
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                <span className={`font-bold ${getScoreColor(round.commercialScore)}`}>{round.commercialScore}</span>
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                <span className={`px-2.5 py-1 rounded-full text-sm font-bold ${getScoreBg(round.overallScore)}`}>
                                  {round.overallScore}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 min-w-[140px]">
                                <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
                                  <div
                                    className={`h-3 rounded-full transition-all ${
                                      round.overallScore >= 80 ? 'bg-emerald-500' :
                                      round.overallScore >= 60 ? 'bg-amber-500' : 'bg-red-400'
                                    }`}
                                    style={{ width: `${round.overallScore}%` }}
                                  ></div>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
          <p className="text-sm text-gray-500">
            {rfq.evaluatedVendors}/{rfq.totalVendors} vendors evaluated
            {allEvaluated && <span className="ml-2 text-emerald-600 font-semibold">· Ready to submit back to SCM Buyer</span>}
          </p>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-medium text-sm cursor-pointer whitespace-nowrap">
              Close
            </button>
            {allEvaluated && (
              <button className="px-6 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-medium text-sm cursor-pointer whitespace-nowrap flex items-center gap-2">
                <i className="ri-send-plane-line"></i>
                Submit Evaluation to SCM
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scoring Modal */}
      {scoringTarget && (
        <VendorScoringModal
          vendor={scoringTarget.vendor}
          rfqRef={rfq.rfqRef}
          roundIndex={scoringTarget.roundIndex}
          onSave={handleSave}
          onClose={() => setScoringTarget(null)}
        />
      )}
    </div>
  );
}
