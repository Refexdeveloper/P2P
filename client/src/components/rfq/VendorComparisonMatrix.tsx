import type { VendorComparisonData } from '../../services/api';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

interface Props {
  data: VendorComparisonData;
  selectedVendorId?: number | null;
  onSelectVendor?: (id: number) => void;
  onPreviewFile?: (submissionId: number, vendorName: string, fileName: string) => void;
  /** Nested in expand panels — tighter layout, no duplicate PR header card chrome */
  compact?: boolean;
}

export default function VendorComparisonMatrix({
  data,
  selectedVendorId,
  onSelectVendor,
  onPreviewFile,
  compact = false,
}: Props) {
  const { pr, vendors, parameters, matrix, recommendedVendorId, showFullNegotiation } = data;
  const activeVendorId = selectedVendorId ?? recommendedVendorId;
  const recommendationJustification = String(data.recommendationJustification || '').trim();
  const totalRounds = Math.max(
    Number(data.totalRounds) || 0,
    ...vendors.map((v) => Math.max(Number(v.round) || 0, ...(v.rounds || []).map((r) => Number(r.round) || 0))),
    1
  );
  const maxRoundsCap = data.maxRounds != null ? Number(data.maxRounds) : null;
  const roundsLabel =
    maxRoundsCap != null && maxRoundsCap > 0
      ? `${totalRounds} of ${maxRoundsCap}`
      : String(totalRounds);

  const matrixTable = (
    <div className="overflow-x-auto max-w-full">
      <table className="w-full min-w-[720px] border-collapse table-fixed">
        <thead>
          <tr>
            <th className="text-left p-2.5 bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-500 uppercase w-44">
              Parameter
            </th>
            {vendors.map((vendor) => (
              <th
                key={vendor.id}
                className={`p-2.5 border border-gray-200 text-center align-top ${
                  vendor.isRecommended ? 'bg-emerald-50' : 'bg-gray-50'
                } ${activeVendorId === vendor.id ? 'ring-2 ring-teal-500 ring-inset' : ''}`}
              >
                {onSelectVendor && (
                  <label className="flex items-center justify-center gap-2 cursor-pointer mb-2">
                    <input
                      type="radio"
                      name="vendor-select"
                      checked={activeVendorId === vendor.id}
                      onChange={() => onSelectVendor(vendor.id)}
                      className="text-teal-600"
                    />
                    <span className="text-xs text-gray-500">Select</span>
                  </label>
                )}
                <div className="text-sm font-bold text-gray-900 break-words leading-snug">{vendor.name}</div>
                {vendor.isRecommended && (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                    <i className="ri-star-fill text-xs"></i> Recommended
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parameters.map((param) => {
            const row = matrix[param.id];
            return (
              <tr key={param.id}>
                <td className="p-2.5 border border-gray-200 bg-white align-top">
                  <div className="flex items-start gap-2 text-sm font-medium text-gray-700">
                    <i className={`${param.icon} text-gray-400 mt-0.5 flex-shrink-0`}></i>
                    <span className="break-words">{param.label}</span>
                  </div>
                </td>
                {vendors.map((vendor) => {
                  const cell = row?.values?.[vendor.id];
                  const isBest = row?.bestVendorId === vendor.id;
                  return (
                    <td
                      key={vendor.id}
                      className={`p-2.5 border border-gray-200 text-center text-sm break-words align-top ${
                        vendor.isRecommended ? 'bg-emerald-50/50' : ''
                      } ${isBest ? 'text-emerald-700 font-semibold' : 'text-gray-800'}`}
                    >
                      {cell?.display ?? '—'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr>
            <td className="p-2.5 border border-gray-200 bg-white">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <i className="ri-file-pdf-line text-gray-400"></i>
                Quotation File
              </div>
            </td>
            {vendors.map((vendor) => (
              <td
                key={vendor.id}
                className={`p-2.5 border border-gray-200 text-center text-sm ${
                  vendor.isRecommended ? 'bg-emerald-50/50' : ''
                }`}
              >
                {vendor.quotationFileName && vendor.latestSubmissionId && onPreviewFile ? (
                  <button
                    type="button"
                    onClick={() =>
                      onPreviewFile(vendor.latestSubmissionId!, vendor.name, vendor.quotationFileName!)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <i className="ri-eye-line"></i>
                    Preview
                  </button>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );

  const negotiationTrend =
    vendors.some((v) => v.rounds.length > 0) &&
    (() => {
      const vendorsWithRounds = vendors.filter((v) => v.rounds.length > 0);
      const maxRounds = Math.max(
        totalRounds,
        ...vendorsWithRounds.map((v) => v.rounds.length),
        1
      );
      return (
        <div className={compact ? 'bg-white border border-gray-200 rounded-xl overflow-hidden' : 'bg-white rounded-xl border border-gray-200 overflow-hidden'}>
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center gap-2 justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <i className="ri-line-chart-line text-teal-600"></i>
              <p className="text-sm font-semibold text-gray-900">
                {showFullNegotiation ? 'Price Negotiation Trend' : 'Vendor Quotation Files'}
              </p>
              {showFullNegotiation && (
                <span className="text-xs text-gray-400 ml-1">— how prices changed across rounds</span>
              )}
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-800">
              <i className="ri-refresh-line"></i>
              Total Rounds: {roundsLabel}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[200px]">
                    Vendor
                  </th>
                  {Array.from({ length: maxRounds }, (_, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[160px]"
                    >
                      Quotation Round {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendorsWithRounds.map((vendor) => {
                  const rounds = [...vendor.rounds].sort((a, b) => a.round - b.round);
                  const last = rounds[rounds.length - 1];
                  const lastPrice = Number(last?.values?.quotedPrice || 0);
                  return (
                    <tr key={vendor.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{vendor.name}</p>
                            {vendor.isRecommended && (
                              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                                <i className="ri-star-fill text-xs"></i> Recommended
                              </span>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              {rounds.length} round{rounds.length !== 1 ? 's' : ''}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Last quotation: {lastPrice ? formatCurrency(lastPrice) : '—'}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]" title={last?.quotationFileName || undefined}>
                              Last file: {last?.quotationFileName || '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      {Array.from({ length: maxRounds }, (_, i) => {
                        const round = rounds[i];
                        if (!round) {
                          return (
                            <td key={i} className="px-4 py-4 text-center text-gray-300 text-sm align-top">
                              —
                            </td>
                          );
                        }
                        const price = Number(round.values?.quotedPrice || 0);
                        const prev = rounds[i - 1];
                        const prevPrice = prev ? Number(prev.values?.quotedPrice || 0) : 0;
                        const change = prev && prevPrice ? price - prevPrice : 0;
                        const changePct = prev && prevPrice ? ((change / prevPrice) * 100).toFixed(1) : null;
                        const isLast = i === rounds.length - 1;
                        return (
                          <td key={i} className={`px-4 py-4 text-center align-top ${isLast ? 'bg-teal-50/60' : ''}`}>
                            <div className="inline-flex flex-col items-center gap-1.5 min-w-[120px]">
                              <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Price</p>
                                <p className={`text-sm font-bold ${isLast ? 'text-teal-700' : 'text-gray-900'}`}>
                                  {price ? formatCurrency(price) : '—'}
                                </p>
                                {changePct !== null && (
                                  <p className={`text-xs font-semibold mt-0.5 ${change < 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {change < 0 ? '▼' : '▲'} {Math.abs(Number(changePct))}%
                                  </p>
                                )}
                              </div>
                              <div className="w-full pt-1.5 border-t border-gray-100">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">File</p>
                                {round.quotationFileName ? (
                                  onPreviewFile ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onPreviewFile(round.submissionId, vendor.name, round.quotationFileName)
                                      }
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-100 hover:bg-red-100 max-w-[150px] cursor-pointer"
                                      title={round.quotationFileName}
                                    >
                                      <i className="ri-file-pdf-2-line text-red-500 text-sm flex-shrink-0"></i>
                                      <span className="text-xs font-medium text-teal-700 truncate">
                                        {round.quotationFileName}
                                      </span>
                                      <i className="ri-eye-line text-teal-600 text-xs flex-shrink-0"></i>
                                    </button>
                                  ) : (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-100 max-w-[150px]">
                                      <i className="ri-file-pdf-2-line text-red-500 text-sm flex-shrink-0"></i>
                                      <span className="text-xs font-medium text-gray-700 truncate" title={round.quotationFileName}>
                                        {round.quotationFileName}
                                      </span>
                                    </div>
                                  )
                                ) : (
                                  <span className="text-xs text-gray-300">—</span>
                                )}
                              </div>
                              {round.submittedAt && (
                                <p className="text-[10px] text-gray-400 mt-0.5">{round.submittedAt}</p>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    })();

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {(data.recommendedVendorName || recommendationJustification) && !compact && (
        <div className="rounded-xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-emerald-200 bg-emerald-100/70 flex flex-wrap items-center gap-2">
            <i className="ri-star-fill text-emerald-700"></i>
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-800">
              Recommendation Justification
            </span>
            {data.recommendedVendorName && (
              <span className="text-sm font-semibold text-emerald-950">
                — {data.recommendedVendorName}
              </span>
            )}
          </div>
          <div className="px-4 py-3">
            {recommendationJustification ? (
              <p className="text-sm text-emerald-950 leading-relaxed whitespace-pre-wrap">
                {recommendationJustification}
              </p>
            ) : (
              <p className="text-sm text-emerald-700/80 italic">
                No justification was provided with this recommendation.
              </p>
            )}
          </div>
        </div>
      )}

      {negotiationTrend}

      <div className={compact ? 'bg-white' : 'bg-white rounded-xl border border-gray-200 p-6'}>
        {!compact && (
          <div className="flex items-start gap-3 mb-6">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="ri-file-list-3-line text-teal-600 text-xl"></i>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900">Vendor Comparison</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-600">
                <span>
                  <strong>Entity:</strong>{' '}
                  {pr.entityName || '—'}
                  {pr.entityCode ? ` (${pr.entityCode})` : ''}
                </span>
                <span><strong>Department:</strong> {pr.department}</span>
                <span><strong>Request Type:</strong> {pr.requestType}</span>
                <span><strong>Estimated Budget:</strong> {formatCurrency(pr.estimatedBudget)}</span>
                <span><strong>Total Vendors:</strong> {data.vendorCount} vendors</span>
                <span><strong>Total Rounds:</strong> {roundsLabel}</span>
                {data.recommendedVendorName && (
                  <span><strong>Recommended:</strong> {data.recommendedVendorName}</span>
                )}
              </div>
            </div>
          </div>
        )}
        {compact && (
          <div className="space-y-2 mb-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
              <span>
                <strong>Entity:</strong> {pr.entityName || '—'}
                {pr.entityCode ? ` (${pr.entityCode})` : ''}
              </span>
              <span><strong>Department:</strong> {pr.department}</span>
              <span><strong>Budget:</strong> {formatCurrency(pr.estimatedBudget)}</span>
              <span><strong>Vendors:</strong> {data.vendorCount}</span>
              <span><strong>Total Rounds:</strong> {roundsLabel}</span>
            </div>
            {recommendationJustification && (
              <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-teal-800 uppercase tracking-wide mb-0.5">
                  Recommendation Justification
                </p>
                <p className="text-xs text-teal-950 whitespace-pre-wrap">{recommendationJustification}</p>
              </div>
            )}
          </div>
        )}
        {matrixTable}
      </div>
    </div>
  );
}
