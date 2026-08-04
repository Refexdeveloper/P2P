import { useState } from 'react';
import type { TechEvalVendor, TechEvalRound } from '../../../../mocks/tech-eval-data';

interface Props {
  vendor: TechEvalVendor;
  rfqRef: string;
  roundIndex: number;
  onSave: (vendorId: string, roundIndex: number, data: Partial<TechEvalRound>) => void;
  onClose: () => void;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const criteria = [
  { key: 'technicalCompliance', label: 'Technical Compliance', icon: 'ri-shield-check-line', desc: 'Does the product/service meet all technical specifications?' },
  { key: 'qualityStandards', label: 'Quality Standards', icon: 'ri-medal-line', desc: 'Quality certifications, ISO standards, product quality' },
  { key: 'deliveryCapability', label: 'Delivery Capability', icon: 'ri-truck-line', desc: 'Ability to deliver on time, logistics, capacity' },
  { key: 'afterSalesSupport', label: 'After-Sales Support', icon: 'ri-customer-service-2-line', desc: 'Warranty, AMC, service response time' },
  { key: 'certifications', label: 'Certifications & Compliance', icon: 'ri-award-line', desc: 'Industry certifications, regulatory compliance' },
  { key: 'siteVisitScore', label: 'Site Visit / Demo Score', icon: 'ri-building-line', desc: 'Score from physical site visit or product demo (optional)' },
] as const;

type CriteriaKey = typeof criteria[number]['key'];

export default function VendorScoringModal({ vendor, rfqRef, roundIndex, onSave, onClose }: Props) {
  const round = vendor.rounds[roundIndex];
  const [scores, setScores] = useState<Record<CriteriaKey, number>>({
    technicalCompliance: round.technicalCompliance || 0,
    qualityStandards: round.qualityStandards || 0,
    deliveryCapability: round.deliveryCapability || 0,
    afterSalesSupport: round.afterSalesSupport || 0,
    certifications: round.certifications || 0,
    siteVisitScore: round.siteVisitScore || 0,
  });
  const [commercialScore, setCommercialScore] = useState(round.commercialScore || 0);
  const [remarks, setRemarks] = useState(round.remarks || '');

  const techScore = Math.round(
    (scores.technicalCompliance * 0.25 +
      scores.qualityStandards * 0.20 +
      scores.deliveryCapability * 0.20 +
      scores.afterSalesSupport * 0.15 +
      scores.certifications * 0.15 +
      scores.siteVisitScore * 0.05)
  );
  const overallScore = Math.round(techScore * 0.6 + commercialScore * 0.4);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-500';
  };

  const getBarColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-red-400';
  };

  const handleSave = () => {
    onSave(vendor.id, roundIndex, {
      ...scores,
      technicalScore: techScore,
      commercialScore,
      overallScore,
      remarks,
      status: 'evaluated',
      evalBy: 'Rajesh Kumar',
      evalDate: new Date().toISOString().split('T')[0],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-teal-50 to-white">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs font-bold">{rfqRef}</span>
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">Round {round.round}</span>
              {vendor.source === 'vendor-portal' && (
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold flex items-center gap-1">
                  <i className="ri-global-line text-xs"></i> Vendor Portal
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-gray-900">{vendor.vendorName}</h2>
            <p className="text-sm text-gray-500">Technical Evaluation — Quoted: <span className="font-semibold text-teal-600">{formatCurrency(round.quotedPrice)}</span> · Lead Time: {vendor.leadTime} days</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-xl text-gray-500"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quotation file reference */}
          {vendor.quotationFileName && (
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="w-9 h-9 flex items-center justify-center bg-red-100 rounded-lg">
                <i className="ri-file-pdf-line text-red-600 text-lg"></i>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{vendor.quotationFileName}</p>
                <p className="text-xs text-gray-500">Vendor submitted quotation document</p>
              </div>
              <button className="px-3 py-1.5 text-xs font-medium text-teal-700 border border-teal-300 rounded-lg hover:bg-teal-50 cursor-pointer whitespace-nowrap">
                <i className="ri-eye-line mr-1"></i>View
              </button>
            </div>
          )}

          {/* Scoring Criteria */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <i className="ri-star-line text-teal-600"></i>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Technical Scoring Criteria</h3>
              <span className="text-xs text-gray-400">(Weighted auto-calculation)</span>
            </div>
            <div className="space-y-4">
              {criteria.map(c => (
                <div key={c.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 flex items-center justify-center">
                        <i className={`${c.icon} text-teal-600 text-sm`}></i>
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-gray-800">{c.label}</span>
                        <p className="text-xs text-gray-400">{c.desc}</p>
                      </div>
                    </div>
                    <span className={`text-lg font-bold w-12 text-right ${getScoreColor(scores[c.key])}`}>
                      {scores[c.key]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min="0" max="100"
                      value={scores[c.key]}
                      onChange={e => setScores(prev => ({ ...prev, [c.key]: parseInt(e.target.value) }))}
                      className="flex-1 cursor-pointer accent-teal-600"
                    />
                    <input
                      type="number" min="0" max="100"
                      value={scores[c.key]}
                      onChange={e => setScores(prev => ({ ...prev, [c.key]: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))}
                      className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div className="mt-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-1.5 rounded-full transition-all ${getBarColor(scores[c.key])}`} style={{ width: `${scores[c.key]}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Commercial Score */}
          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center gap-2 mb-3">
              <i className="ri-line-chart-line text-teal-600"></i>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Commercial Score</h3>
              <span className="text-xs text-gray-400">(Entered by SCM Buyer / override here)</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range" min="0" max="100"
                value={commercialScore}
                onChange={e => setCommercialScore(parseInt(e.target.value))}
                className="flex-1 cursor-pointer accent-teal-600"
              />
              <input
                type="number" min="0" max="100"
                value={commercialScore}
                onChange={e => setCommercialScore(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-teal-500"
              />
              <span className={`text-lg font-bold w-12 text-right ${getScoreColor(commercialScore)}`}>{commercialScore}</span>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <i className="ri-chat-3-line mr-1 text-teal-600"></i>
              Technical Evaluation Remarks
            </label>
            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Add detailed technical evaluation notes, observations, and recommendations..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-1">{remarks.length}/500</p>
          </div>
        </div>

        {/* Score Summary Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-0.5">Technical Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(techScore)}`}>{techScore}</p>
                <p className="text-xs text-gray-400">60% weight</p>
              </div>
              <div className="text-gray-300 text-xl">+</div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-0.5">Commercial Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(commercialScore)}`}>{commercialScore}</p>
                <p className="text-xs text-gray-400">40% weight</p>
              </div>
              <div className="text-gray-300 text-xl">=</div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-0.5">Overall Score</p>
                <p className={`text-3xl font-bold ${getScoreColor(overallScore)}`}>{overallScore}</p>
                <p className="text-xs text-gray-400">/ 100</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-medium text-sm cursor-pointer whitespace-nowrap">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={remarks.trim() === ''}
                className="px-6 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-medium text-sm cursor-pointer whitespace-nowrap flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-save-line"></i>
                Save Evaluation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
