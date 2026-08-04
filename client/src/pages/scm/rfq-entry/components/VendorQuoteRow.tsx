import { useState } from 'react';
import type { VendorQuotation, QuoteRound } from '../types';

interface VendorQuoteRowProps {
  quotation: VendorQuotation;
  index: number;
  vendorOptions: string[];
  isRecommended: boolean;
  isBest: boolean;
  onUpdate: (id: string, field: keyof VendorQuotation | 'quoteField', value: unknown, roundIndex?: number, quoteField?: keyof QuoteRound) => void;
  onRemove: (id: string) => void;
  onSendBack: (id: string) => void;
  onToggleRecommend: (id: string) => void;
  onToggleHistory: (id: string) => void;
  onSaveManual?: (id: string) => void;
  onResendEmail?: (id: string) => void;
  saving?: boolean;
  canRemove: boolean;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const roundBadgeColors = ['bg-teal-100 text-teal-700', 'bg-amber-100 text-amber-700', 'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700'];

export default function VendorQuoteRow({
  quotation, index, vendorOptions, isRecommended, isBest,
  onUpdate, onRemove, onSendBack, onToggleRecommend, onToggleHistory,
  onSaveManual, onResendEmail, saving, canRemove,
}: VendorQuoteRowProps) {
  const currentRoundIdx = quotation.quotes.length - 1;
  const currentQ = quotation.quotes[currentRoundIdx];
  const prevQ = quotation.quotes.length > 1 ? quotation.quotes[currentRoundIdx - 1] : null;
  const isFromPortal = quotation.source === 'vendor-portal';
  const isSubmitted = quotation.rfqStatus === 'submitted';
  const isLockedPortalQuote = isSubmitted && Boolean(currentQ.vendorSubmitted);
  const canManualSave = !isSubmitted && Boolean(onSaveManual) && Boolean(quotation.invitationId);

  const updateCurrent = (field: keyof QuoteRound, value: unknown) => {
    onUpdate(quotation.id, 'quoteField', value, currentRoundIdx, field);
  };

  const calcOverall = (tech: number, comm: number) => Math.round(tech * 0.6 + comm * 0.4);

  const handleScoreChange = (field: 'technicalScore' | 'commercialScore', val: number) => {
    const newTech = field === 'technicalScore' ? val : currentQ.technicalScore;
    const newComm = field === 'commercialScore' ? val : currentQ.commercialScore;
    updateCurrent(field, val);
    updateCurrent('overallScore', calcOverall(newTech, newComm));
  };

  const handleFileChange = (file: File | null) => {
    updateCurrent('quotationFile', file);
    updateCurrent('quotationFileName', file ? file.name : '');
  };

  const priceDiff = prevQ && currentQ.quotedPrice && prevQ.quotedPrice
    ? ((currentQ.quotedPrice - prevQ.quotedPrice) / prevQ.quotedPrice) * 100
    : null;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      isRecommended ? 'border-teal-400 shadow-sm' : isBest ? 'border-emerald-300' : 'border-gray-200'
    }`}>
      {/* Vendor Header Bar */}
      <div className={`px-5 py-3 flex items-center justify-between ${
        isRecommended ? 'bg-teal-50' : isBest ? 'bg-emerald-50' : isFromPortal ? 'bg-blue-50/40' : 'bg-gray-50'
      }`}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 text-xs font-bold text-gray-600">{index + 1}</span>

          {/* Vendor Name Select */}
          <select
            value={quotation.vendorName}
            onChange={e => onUpdate(quotation.id, 'vendorName', e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-teal-500 focus:border-teal-500 cursor-pointer bg-white"
          >
            <option value="">Select Vendor</option>
            {vendorOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>

          {/* Vendor Portal badge */}
          {isFromPortal && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs font-semibold">
              <i className="ri-global-line text-xs"></i>
              Vendor Portal
            </span>
          )}

          {/* Round badges */}
          <div className="flex items-center gap-1">
            {quotation.quotes.map((q, i) => (
              <span
                key={i}
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${roundBadgeColors[i % roundBadgeColors.length]} ${
                  i === currentRoundIdx ? 'ring-2 ring-offset-1 ring-current' : 'opacity-60'
                }`}
              >
                Q{i + 1}
              </span>
            ))}
          </div>

          {/* Price delta badge */}
          {priceDiff !== null && (
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
              priceDiff < 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}>
              <i className={priceDiff < 0 ? 'ri-arrow-down-line' : 'ri-arrow-up-line'}></i>
              {Math.abs(priceDiff).toFixed(1)}% vs Q{currentRoundIdx}
            </span>
          )}

          {isRecommended && (
            <span className="px-2.5 py-0.5 bg-teal-600 text-white rounded-full text-xs font-bold flex items-center gap-1">
              <i className="ri-star-fill text-xs"></i> Recommended
            </span>
          )}
          {isBest && !isRecommended && (
            <span className="px-2.5 py-0.5 bg-emerald-500 text-white rounded-full text-xs font-semibold">Best Score</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onResendEmail && quotation.invitationId && (
            <button
              type="button"
              onClick={() => onResendEmail(quotation.id)}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 cursor-pointer flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            >
              <i className="ri-mail-send-line"></i>
              Resend RFQ Email
            </button>
          )}
          {/* View History toggle */}
          {quotation.quotes.length > 1 && (
            <button
              onClick={() => onToggleHistory(quotation.id)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-white cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <i className="ri-history-line"></i>
              {quotation.showHistory ? 'Hide' : 'View'} History ({quotation.quotes.length} rounds)
            </button>
          )}
          {/* Send Back — only if < 4 rounds */}
          {quotation.quotes.length < 4 && (
            <button
              onClick={() => onSendBack(quotation.id)}
              className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100 cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <i className="ri-send-backward"></i>
              Send Back for Q{quotation.quotes.length + 1}
            </button>
          )}
          {/* Remove */}
          {canRemove && (
            <button
              onClick={() => onRemove(quotation.id)}
              className="w-7 h-7 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg cursor-pointer"
            >
              <i className="ri-delete-bin-line text-sm"></i>
            </button>
          )}
        </div>
      </div>

      {/* Vendor Portal submitted info banner */}
      {isLockedPortalQuote && currentQ.vendorSubmitted && (
        <div className="px-5 py-2.5 bg-teal-50 border-b border-teal-100 flex items-center gap-2">
          <i className="ri-checkbox-circle-fill text-teal-600 text-sm"></i>
          <span className="text-xs text-teal-700 font-semibold">
            Vendor submitted this quotation via Vendor Portal
            {currentQ.vendorSubmittedDate && ` on ${currentQ.vendorSubmittedDate}`}
          </span>
          {currentQ.vendorNotes && (
            <span className="text-xs text-teal-600 ml-2 italic">&ldquo;{currentQ.vendorNotes}&rdquo;</span>
          )}
        </div>
      )}

      {/* Quote History Table */}
      {quotation.showHistory && quotation.quotes.length > 1 && (
        <div className="bg-white border-b border-gray-100 px-5 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quote Round History</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 rounded">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Round</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Quoted Price</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Lead Time</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Technical</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Commercial</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Overall</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Status</th>
                  {quotation.quotes.some(q => q.sentBackReason || (q.sentBackFields && q.sentBackFields.length > 0)) && (
                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Reason</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotation.quotes.map((q, i) => {
                  const prev = i > 0 ? quotation.quotes[i - 1] : null;
                  const diff = prev && q.quotedPrice && prev.quotedPrice
                    ? ((q.quotedPrice - prev.quotedPrice) / prev.quotedPrice) * 100
                    : null;
                  const isLast = i === quotation.quotes.length - 1;
                  return (
                    <tr key={i} className={isLast ? 'bg-teal-50' : 'bg-white'}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full font-bold ${roundBadgeColors[i % roundBadgeColors.length]}`}>
                            Q{i + 1}
                          </span>
                          {q.vendorSubmitted && (
                            <span className="px-1.5 py-0.5 bg-teal-100 text-teal-600 rounded text-xs flex items-center gap-0.5">
                              <i className="ri-global-line text-xs"></i>Portal
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-900">
                        {q.quotedPrice ? formatCurrency(q.quotedPrice) : '—'}
                        {diff !== null && (
                          <span className={`ml-1.5 ${diff < 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            ({diff < 0 ? '' : '+'}{diff.toFixed(1)}%)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{q.leadTime ? `${q.leadTime} days` : '—'}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {q.techEvalStatus === 'completed' ? (
                          <span className="text-emerald-600 font-bold">{q.technicalScore}</span>
                        ) : q.techEvalStatus === 'pending' || !q.technicalScore ? (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded text-xs">Pending Eval</span>
                        ) : q.technicalScore || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{q.commercialScore || '—'}</td>
                      <td className="px-3 py-2 font-bold text-teal-600">{q.overallScore || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full font-semibold ${
                          q.status === 'sent-back' ? 'bg-amber-100 text-amber-700' :
                          q.status === 'tech-evaluated' ? 'bg-emerald-100 text-emerald-700' :
                          q.status === 'pending-tech-eval' ? 'bg-violet-100 text-violet-700' :
                          isLast ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {q.status === 'sent-back' ? 'Sent Back' :
                           q.status === 'tech-evaluated' ? 'Tech Evaluated' :
                           q.status === 'pending-tech-eval' ? 'Pending Tech Eval' :
                           isLast ? 'Current' : 'Archived'}
                        </span>
                      </td>
                      {quotation.quotes.some(r => r.sentBackReason || (r.sentBackFields && r.sentBackFields.length > 0)) && (
                        <td className="px-3 py-2 text-gray-500 max-w-xs">
                          {q.sentBackFields && q.sentBackFields.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                              {q.sentBackFields.map((f, fi) => (
                                <span key={fi} className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded text-amber-700 text-xs">{f}</span>
                              ))}
                            </div>
                          )}
                          {q.sentBackReason && <span className="text-gray-500">{q.sentBackReason}</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Current Round Form */}
      <div className="p-5 bg-white">
        <div className="flex items-center gap-2 mb-4">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${roundBadgeColors[currentRoundIdx % roundBadgeColors.length]}`}>
            Round {currentRoundIdx + 1} — Active
          </span>
          {isLockedPortalQuote ? (
            <span className="text-xs text-teal-600 font-semibold flex items-center gap-1">
              <i className="ri-global-line"></i>
              Quote received from vendor email form
            </span>
          ) : (
            <span className="text-xs text-gray-500">Fill quotation manually or vendor submits via RFQ email link</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-4">
          {/* Quoted Price */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quoted Price (₹)</label>
            <input
              type="number"
              value={currentQ.quotedPrice || ''}
              onChange={e => updateCurrent('quotedPrice', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
              placeholder="0"
            />
          </div>

          {/* Lead Time */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Lead Time (Days)</label>
            <input
              type="number"
              value={currentQ.leadTime || ''}
              onChange={e => updateCurrent('leadTime', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
              placeholder="0"
            />
          </div>

          {/* Payment Terms */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payment Terms</label>
            <select
              value={currentQ.paymentTerms}
              onChange={e => updateCurrent('paymentTerms', e.target.value)}
              disabled={isLockedPortalQuote}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 cursor-pointer disabled:bg-gray-50"
            >
              <option value="Standard">Net 30 (Standard)</option>
              <option value="Deviated">Deviated</option>
              <option value="Net 45">Net 45</option>
              <option value="Net 60">Net 60</option>
              <option value="Advance 50%">Advance 50%</option>
            </select>
          </div>

          {/* Warranty */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Warranty</label>
            <input
              type="text"
              value={currentQ.warranty || ''}
              onChange={e => updateCurrent('warranty', e.target.value)}
              disabled={isLockedPortalQuote}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
              placeholder="e.g. 1 Year"
            />
          </div>

          {/* Delivery Terms */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Delivery Terms</label>
            <input
              type="text"
              value={currentQ.deliveryTerms || ''}
              onChange={e => updateCurrent('deliveryTerms', e.target.value)}
              disabled={isLockedPortalQuote}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
              placeholder="e.g. DDP, FOB"
            />
          </div>

          {/* Compliance */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Compliance</label>
            <button
              onClick={() => updateCurrent('compliance', !currentQ.compliance)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${
                currentQ.compliance
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-red-50 border-red-200 text-red-600'
              }`}
            >
              <i className={currentQ.compliance ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'}></i>
              {currentQ.compliance ? 'Compliant' : 'Non-Compliant'}
            </button>
          </div>

          {/* Commercial Score — always editable by SCM Buyer */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Commercial Score: <span className="text-teal-600 font-bold">{currentQ.commercialScore}</span>
            </label>
            <input
              type="range" min="0" max="100"
              value={currentQ.commercialScore}
              onChange={e => handleScoreChange('commercialScore', parseInt(e.target.value))}
              className="w-full cursor-pointer accent-teal-600"
            />
          </div>

          {/* Technical Score — read-only notice if from portal */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
              Technical Score
              {isLockedPortalQuote ? (
                <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-xs font-semibold">
                  <i className="ri-lock-line text-xs mr-0.5"></i>Tech Evaluator
                </span>
              ) : (
                <span className="text-teal-600 font-bold">{currentQ.technicalScore}</span>
              )}
            </label>
            {isFromPortal ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg">
                <i className="ri-star-line text-violet-500 text-sm"></i>
                <span className="text-xs text-violet-700 font-medium">
                  {currentQ.techEvalStatus === 'completed'
                    ? `Score: ${currentQ.technicalScore}/100 (by ${currentQ.techEvalBy})`
                    : 'Awaiting Technical Evaluator'}
                </span>
              </div>
            ) : (
              <input
                type="range" min="0" max="100"
                value={currentQ.technicalScore}
                onChange={e => handleScoreChange('technicalScore', parseInt(e.target.value))}
                className="w-full cursor-pointer accent-teal-600"
              />
            )}
          </div>

          {/* Overall Score */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Overall Score</label>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    isBest ? 'bg-emerald-500' : 'bg-teal-500'
                  }`}
                  style={{ width: `${currentQ.overallScore}%` }}
                ></div>
              </div>
              <span className={`text-base font-bold w-10 text-right ${isBest ? 'text-emerald-600' : 'text-teal-600'}`}>
                {currentQ.overallScore}
              </span>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quotation File</label>
            {isLockedPortalQuote && currentQ.quotationFileName ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg">
                <i className="ri-file-check-line text-teal-600 text-sm"></i>
                <span className="text-xs text-teal-700 font-medium truncate max-w-[120px]" title={currentQ.quotationFileName}>
                  {currentQ.quotationFileName}
                </span>
                <span className="text-xs text-teal-500 ml-auto whitespace-nowrap">Portal Upload</span>
              </div>
            ) : (
              <>
                <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-colors text-xs text-gray-500 whitespace-nowrap">
                  <i className="ri-upload-2-line text-teal-500"></i>
                  {currentQ.quotationFileName ? 'Change File' : 'Upload File'}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
                    className="hidden"
                    onChange={e => handleFileChange(e.target.files?.[0] || null)}
                  />
                </label>
                {currentQ.quotationFileName && (
                  <div className="flex items-center gap-1 mt-1.5 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-700">
                    <i className="ri-file-check-line flex-shrink-0"></i>
                    <span className="truncate max-w-[100px]" title={currentQ.quotationFileName}>{currentQ.quotationFileName}</span>
                    <button onClick={() => handleFileChange(null)} className="ml-auto flex-shrink-0 text-emerald-500 hover:text-red-500 cursor-pointer">
                      <i className="ri-close-line"></i>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Vendor Notes */}
        {!isLockedPortalQuote ? (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Vendor Notes / Comments</label>
            <textarea
              value={currentQ.vendorNotes || ''}
              onChange={e => updateCurrent('vendorNotes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-teal-500"
              placeholder="Additional comments from vendor or manual entry notes"
            />
          </div>
        ) : null}

        {/* Save manual quotation */}
        {canManualSave && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => onSaveManual!(quotation.id)}
              disabled={saving}
              className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              <i className="ri-save-line"></i>
              {saving ? 'Saving...' : 'Save Quotation & Notify Requester'}
            </button>
          </div>
        )}

        {/* Recommend */}
        <div className="mt-4 flex items-center justify-end">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div
              onClick={() => onToggleRecommend(quotation.id)}
              className={`w-11 h-6 rounded-full relative transition-colors ${isRecommended ? 'bg-teal-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isRecommended ? 'right-0.5' : 'left-0.5'}`}></span>
            </div>
            <span className={`text-sm font-medium ${isRecommended ? 'text-teal-700' : 'text-gray-500'}`}>
              {isRecommended ? 'Recommended Vendor' : 'Mark as Recommended'}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
