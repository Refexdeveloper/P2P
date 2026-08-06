import {
  PO_CSV_HEADERS,
  PO_CSV_SAMPLE_ROWS,
  PO_CSV_COLUMN_LABELS,
  downloadPoImportSampleCsv,
} from '../../utils/poCsvImport';

interface Props {
  className?: string;
  showDownload?: boolean;
  title?: string;
}

/** Preview table for PO import sample CSV columns + example rows. */
export default function PoSampleCsvTable({
  className = '',
  showDownload = true,
  title = 'Sample CSV format',
}: Props) {
  return (
    <div className={`rounded-xl border border-emerald-200 bg-emerald-50/40 overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-emerald-100 bg-white/70">
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Match these column headers in your CSV. Fill header fields (PR, address, terms, etc.) on the first item row; add more rows for extra line items / terms / annexure.
          </p>
        </div>
        {showDownload && (
          <button
            type="button"
            onClick={downloadPoImportSampleCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
          >
            <i className="ri-download-2-line"></i>
            Download Sample CSV
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-xs">
          <thead>
            <tr className="bg-emerald-100/80 text-left">
              {PO_CSV_HEADERS.map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 font-semibold text-emerald-900 uppercase tracking-wide whitespace-nowrap border-b border-emerald-200"
                >
                  {PO_CSV_COLUMN_LABELS[h]}
                  <span className="block normal-case font-mono text-[10px] text-emerald-700/80 font-normal mt-0.5">
                    {h}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PO_CSV_SAMPLE_ROWS.map((row, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-emerald-50/50'}>
                {PO_CSV_HEADERS.map((h) => (
                  <td
                    key={h}
                    className="px-3 py-2 text-gray-700 border-b border-emerald-100 max-w-[180px] truncate"
                    title={row[h] || undefined}
                  >
                    {row[h] || <span className="text-gray-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
