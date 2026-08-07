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

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      <div className={compact ? 'bg-white' : 'bg-white rounded-xl border border-gray-200 p-6'}>
        {!compact && (
          <div className="flex items-start gap-3 mb-6">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="ri-file-list-3-line text-teal-600 text-xl"></i>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900">Purchase Request Details</h2>
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
              </div>
            </div>
          </div>
        )}
        {compact && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-gray-600">
            <span>
              <strong>Entity:</strong> {pr.entityName || '—'}
              {pr.entityCode ? ` (${pr.entityCode})` : ''}
            </span>
            <span><strong>Department:</strong> {pr.department}</span>
            <span><strong>Budget:</strong> {formatCurrency(pr.estimatedBudget)}</span>
            <span><strong>Vendors:</strong> {data.vendorCount}</span>
          </div>
        )}
        {matrixTable}
      </div>

      {vendors.some((v) => v.rounds.length > 0) && (
        <div className={compact ? 'bg-white' : 'bg-white rounded-xl border border-gray-200 p-6'}>
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <i className="ri-history-line text-teal-600"></i>
            {showFullNegotiation ? 'Quotation Rounds & Negotiation History' : 'Vendor Quotation Files'}
          </h3>
          <div className="space-y-4">
            {vendors.map((vendor) =>
              vendor.rounds.length > 0 ? (
                <div key={vendor.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 font-semibold text-sm text-gray-800 flex items-center justify-between gap-2">
                    <span className="truncate min-w-0" title={vendor.name}>{vendor.name}</span>
                    {vendor.isRecommended && (
                      <span className="text-xs text-emerald-600 font-medium flex-shrink-0">Recommended</span>
                    )}
                  </div>
                  <div className="divide-y divide-gray-100">
                    {vendor.rounds.map((round) => (
                      <div key={round.submissionId} className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
                        <span className="font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                          Round {round.round}
                        </span>
                        <span className="text-gray-600">{round.submittedAt}</span>
                        <span className="font-medium text-gray-900">
                          ₹{Number(round.values.quotedPrice || 0).toLocaleString('en-IN')}
                        </span>
                        {round.values.leadTime != null && (
                          <span className="text-gray-600">{String(round.values.leadTime)} days lead</span>
                        )}
                        {round.quotationFileName && onPreviewFile && (
                          <button
                            type="button"
                            onClick={() => onPreviewFile(round.submissionId, vendor.name, round.quotationFileName)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            <i className="ri-eye-line"></i>
                            Preview
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}
