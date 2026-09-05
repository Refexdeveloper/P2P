import { useCallback, useState } from 'react';
import { rfqApi, type VendorComparisonData } from '../../services/api';
import { formatDisplayDateTime } from '../../utils/formatDate';
import {
  allQuotationFilesForRound,
  allQuotationFilesForVendor,
  type QuotationFileView,
} from '../../utils/quotationFiles';

type QuoteLine = {
  lineItemId?: string | number;
  description?: string;
  quantity?: number;
  quotedUnitPrice?: number;
  gstPercent?: number;
  quotedTotal?: number;
};

interface Props {
  data: VendorComparisonData;
  onPreviewFile?: (submissionId: number, vendorName: string, fileName: string) => void;
}

const money = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number(n) || 0);

function asQuoteLines(raw: unknown): QuoteLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = (item || {}) as QuoteLine;
      return {
        lineItemId: row.lineItemId,
        description: String(row.description || '').trim(),
        quantity: Number(row.quantity) || 0,
        quotedUnitPrice: Number(row.quotedUnitPrice) || 0,
        gstPercent: row.gstPercent != null && String(row.gstPercent) !== '' ? Number(row.gstPercent) : undefined,
        quotedTotal: Number(row.quotedTotal) || 0,
      };
    })
    .filter((row) => row.description || row.quotedUnitPrice > 0 || row.quotedTotal > 0 || row.quantity > 0);
}

function linesFromValues(values?: Record<string, unknown> | null): QuoteLine[] {
  return asQuoteLines(values?.quoteLineItems);
}

function roundQuotedPrice(round: VendorComparisonData['vendors'][number]['rounds'][number]): number {
  return Number(round.values?.quotedPrice ?? 0) || 0;
}

function vendorLatestPrice(vendor: VendorComparisonData['vendors'][number]): number {
  const rounds = [...(vendor.rounds || [])].sort((a, b) => a.round - b.round);
  const last = rounds[rounds.length - 1];
  return Number(last ? roundQuotedPrice(last) : vendor.latest?.quotedPrice) || 0;
}

function quoteLinesForVendor(vendor: VendorComparisonData['vendors'][number]): QuoteLine[] {
  const fromVendor = asQuoteLines(vendor.quoteLineItems);
  if (fromVendor.length) return fromVendor;
  const fromLatest = linesFromValues(vendor.latest);
  if (fromLatest.length) return fromLatest;
  const rounds = [...(vendor.rounds || [])].sort((a, b) => a.round - b.round);
  const last = rounds[rounds.length - 1];
  if (last) {
    const fromRound = asQuoteLines(last.quoteLineItems);
    if (fromRound.length) return fromRound;
    return linesFromValues(last.values);
  }
  return [];
}

function lineTotal(line: QuoteLine): number {
  if (Number(line.quotedTotal) > 0) return Number(line.quotedTotal);
  const qty = Number(line.quantity) || 0;
  const unit = Number(line.quotedUnitPrice) || 0;
  const gst = Number(line.gstPercent) || 0;
  return Math.round(qty * unit * (1 + gst / 100) * 100) / 100;
}

export default function ManagerRfqQuoteSummary({ data, onPreviewFile }: Props) {
  const [fileBusy, setFileBusy] = useState<string | null>(null);
  const [fileError, setFileError] = useState('');

  const vendors = data.vendors || [];
  const recommended = vendors.find((v) => v.isRecommended) || vendors[0] || null;
  const fromApi = asQuoteLines(data.recommendedQuoteLineItems);
  const recLines = fromApi.length ? fromApi : recommended ? quoteLinesForVendor(recommended) : [];
  const recommendedRound =
    Number(data.recommendedRound) ||
    Math.max(0, ...(recommended?.rounds || []).map((r) => Number(r.round) || 0)) ||
    1;
  const recommendedQuotedTotal = recommended
    ? Number(recommended.latest?.quotedPrice) ||
      vendorLatestPrice(recommended) ||
      recLines.reduce((sum, line) => sum + lineTotal(line), 0)
    : recLines.reduce((sum, line) => sum + lineTotal(line), 0);

  const totalRounds = Math.max(
    Number(data.totalRounds) || 1,
    ...vendors.map((v) => Math.max(0, ...(v.rounds || []).map((r) => Number(r.round) || 0))),
    1
  );
  const maxRoundsCap = Number(data.maxRounds) || 0;
  const roundsLabel = maxRoundsCap > 0 ? `${totalRounds} of ${maxRoundsCap}` : String(totalRounds);

  const openQuoteFile = useCallback(
    async (
      file: QuotationFileView,
      vendorName: string,
      mode: 'view' | 'download'
    ) => {
      const submissionId = Number(file.submissionId) || 0;
      const extraId = Number(file.extraFileId) || 0;
      const busyKey = `${submissionId}-${extraId}-${mode}`;
      setFileError('');
      setFileBusy(busyKey);
      try {
        if (mode === 'view' && onPreviewFile && submissionId && !extraId) {
          onPreviewFile(submissionId, vendorName, file.fileName);
          return;
        }
        const token = localStorage.getItem('p2p_token');
        const url = extraId
          ? rfqApi.quotationExtraFileUrl(extraId)
          : rfqApi.quotationFileUrl(submissionId);
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Could not load quotation file');
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        if (mode === 'download') {
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = file.fileName || 'quotation.pdf';
          a.click();
          setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
        } else {
          window.open(blobUrl, '_blank', 'noopener,noreferrer');
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        }
      } catch (err) {
        setFileError(err instanceof Error ? err.message : `Could not ${mode} quotation file`);
      } finally {
        setFileBusy(null);
      }
    },
    [onPreviewFile]
  );

  const fileActions = (files: QuotationFileView[], vendorName: string) => {
    if (!files.length) {
      return <span className="text-slate-400 text-sm">—</span>;
    }
    return (
      <div className="flex flex-col gap-2 min-w-0 max-w-[200px]">
        {files.map((file, idx) => {
          const busyBase = `${Number(file.submissionId) || 0}-${Number(file.extraFileId) || 0}`;
          return (
            <div key={`${file.fileName}-${idx}`} className="inline-flex flex-col items-center gap-1 min-w-0">
              <p className="text-[11px] text-slate-600 truncate w-full text-center" title={file.fileName}>
                {file.fileName}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1">
                <button
                  type="button"
                  disabled={fileBusy === `${busyBase}-view`}
                  onClick={() => void openQuoteFile(file, vendorName, 'view')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-teal-200 text-teal-700 text-[11px] font-semibold hover:bg-teal-50 disabled:opacity-50 cursor-pointer"
                >
                  <i className="ri-eye-line" />
                  View
                </button>
                <button
                  type="button"
                  disabled={fileBusy === `${busyBase}-download`}
                  onClick={() => void openQuoteFile(file, vendorName, 'download')}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 text-slate-700 text-[11px] font-semibold hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  <i className="ri-download-line" />
                  Download
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const justification = String(data.recommendationJustification || '').trim();
  const businessJustification = String(data.pr?.justification || '').trim();

  const renderQuoteLinesTable = (lines: QuoteLine[], quotedTotal: number, recommendedTable: boolean) => {
    const headCls = recommendedTable ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-700';
    const footCls = recommendedTable ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-slate-50';
    const totalCls = recommendedTable ? 'text-emerald-700' : 'text-slate-900';
    return (
      <div className="overflow-x-auto bg-white">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className={headCls}>
              <th className="px-3 py-2 text-center text-[11px] font-bold w-10">#</th>
              <th className="px-3 py-2 text-left text-[11px] font-bold">Description</th>
              <th className="px-3 py-2 text-center text-[11px] font-bold">Qty</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold">Unit</th>
              <th className="px-3 py-2 text-center text-[11px] font-bold">GST</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={`ql-${idx}`} className="border-t border-gray-100">
                <td className="px-3 py-2 text-center text-slate-500">{idx + 1}</td>
                <td className="px-3 py-2 text-slate-900">{line.description || '—'}</td>
                <td className="px-3 py-2 text-center tabular-nums">{line.quantity || '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(line.quotedUnitPrice || 0)}</td>
                <td className="px-3 py-2 text-center text-slate-500">
                  {line.gstPercent != null ? `${line.gstPercent}%` : '—'}
                </td>
                <td className={`px-3 py-2 text-right font-bold tabular-nums ${totalCls}`}>{money(lineTotal(line))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={`border-t ${footCls}`}>
              <td colSpan={5} className={`px-3 py-2.5 text-right text-sm font-bold ${recommendedTable ? 'text-emerald-900' : 'text-slate-700'}`}>
                Quoted total
              </td>
              <td className={`px-3 py-2.5 text-right text-base font-extrabold tabular-nums ${totalCls}`}>
                {money(quotedTotal || lines.reduce((sum, line) => sum + lineTotal(line), 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {fileError ? (
        <div className="px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{fileError}</div>
      ) : null}

      <section className="rounded-xl overflow-hidden border-2 border-amber-300 bg-amber-50 shadow-sm ring-2 ring-amber-200/60">
        <div className="px-4 py-3 bg-amber-100 border-b border-amber-300 flex items-center gap-2">
          <i className="ri-lightbulb-flash-line text-amber-700 text-lg" aria-hidden />
          <div>
            <p className="text-[11px] font-extrabold tracking-wide uppercase text-amber-900">
              Business Justification
            </p>
            <p className="text-xs text-amber-800/90 mt-0.5">Requester rationale for this purchase</p>
          </div>
        </div>
        {businessJustification ? (
          <p className="px-4 py-3.5 text-sm text-amber-950 leading-relaxed whitespace-pre-wrap font-medium">
            {businessJustification}
          </p>
        ) : (
          <p className="px-4 py-3.5 text-sm italic text-amber-800/80">No business justification provided.</p>
        )}
      </section>

      {justification || data.recommendedVendorName ? (
        <section className="rounded-xl overflow-hidden border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="px-4 py-3 bg-emerald-100/80 border-b border-emerald-200">
            <p className="text-[11px] font-extrabold tracking-wide uppercase text-emerald-800">
              Recommendation justification
            </p>
            <p className="text-base font-bold text-emerald-950 mt-0.5">
              {data.recommendedVendorName || recommended?.name || 'Recommended vendor'}
              {recommendedQuotedTotal > 0 ? (
                <span className="ml-2 text-sm font-semibold text-emerald-700">{money(recommendedQuotedTotal)}</span>
              ) : null}
            </p>
          </div>
          {justification ? (
            <p className="px-4 py-3 text-sm text-emerald-950 leading-relaxed whitespace-pre-wrap">{justification}</p>
          ) : (
            <p className="px-4 py-3 text-sm italic text-emerald-700">
              No justification was provided with this recommendation.
            </p>
          )}
        </section>
      ) : null}

      {recLines.length > 0 ? (
        <section className="rounded-xl overflow-hidden border border-emerald-200 bg-emerald-50/40">
          <div className="px-4 py-3 bg-emerald-600 text-white">
            <p className="text-[11px] font-bold tracking-wider uppercase">Recommended quotation — line items</p>
            <p className="text-sm font-semibold mt-0.5 opacity-95">
              {data.recommendedVendorName || recommended?.name || 'Recommended vendor'}
              {recommendedRound ? ` · Quote ${recommendedRound}` : ''}
            </p>
          </div>
          {renderQuoteLinesTable(recLines, recommendedQuotedTotal, true)}
        </section>
      ) : null}

      {vendors
        .filter((vendor) => !vendor.isRecommended)
        .map((vendor) => {
          const lines = quoteLinesForVendor(vendor);
          if (!lines.length) return null;
          const lastRound = Math.max(1, ...(vendor.rounds || []).map((r) => Number(r.round) || 1));
          return (
            <section key={`vendor-lines-${vendor.id}`} className="rounded-xl overflow-hidden border border-slate-200">
              <div className="px-4 py-3 bg-slate-700 text-white">
                <p className="text-[11px] font-bold tracking-wider uppercase">Vendor quotation — line items</p>
                <p className="text-sm font-semibold mt-0.5 opacity-95">
                  {vendor.name} · Quote {lastRound}
                </p>
              </div>
              {renderQuoteLinesTable(lines, vendorLatestPrice(vendor), false)}
            </section>
          );
        })}

      {vendors.length > 0 ? (
        <section className="rounded-xl overflow-hidden border border-teal-200">
          <div className="px-4 py-3 bg-teal-50 border-b border-teal-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-extrabold text-teal-950">Price Negotiation Trend</h2>
              <p className="text-xs text-teal-700 mt-0.5">How prices changed across quotation rounds.</p>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-[11px] font-bold">
              Total Rounds: {roundsLabel}
            </span>
          </div>
          <div className="overflow-x-auto bg-white">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Vendor
                  </th>
                  {Array.from({ length: totalRounds }, (_, i) => (
                    <th
                      key={`round-h-${i}`}
                      className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-teal-700"
                    >
                      Quotation Round {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => {
                  const rounds = [...(vendor.rounds || [])].sort((a, b) => a.round - b.round);
                  const last = rounds[rounds.length - 1];
                  const lastPrice = last ? roundQuotedPrice(last) : vendorLatestPrice(vendor);
                  return (
                    <tr key={`trend-${vendor.id}`} className="border-t border-slate-100">
                      <td
                        className={`px-3 py-3 align-top ${vendor.isRecommended ? 'bg-emerald-50' : ''}`}
                      >
                        <p className="text-sm font-bold text-slate-900">{vendor.name}</p>
                        {vendor.isRecommended ? (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                            ★ Recommended
                          </span>
                        ) : null}
                        <p className="text-[11px] text-slate-400 mt-1">
                          {rounds.length} round{rounds.length === 1 ? '' : 's'}
                        </p>
                        <p className="text-[11px] text-slate-500">Last: {lastPrice ? money(lastPrice) : '—'}</p>
                      </td>
                      {Array.from({ length: totalRounds }, (_, i) => {
                        const roundNum = i + 1;
                        const use = rounds.find((r) => Number(r.round) === roundNum) || null;
                        if (!use) {
                          return (
                            <td key={`${vendor.id}-r${roundNum}`} className="px-3 py-3 text-center text-slate-300">
                              —
                            </td>
                          );
                        }
                        const price = roundQuotedPrice(use);
                        const prev = rounds.find((r) => Number(r.round) === roundNum - 1);
                        const prevPrice = prev ? roundQuotedPrice(prev) : 0;
                        const change = prev && prevPrice ? price - prevPrice : 0;
                        const changePct = prev && prevPrice ? ((change / prevPrice) * 100).toFixed(1) : null;
                        const isLast = use === last;
                        return (
                          <td
                            key={`${vendor.id}-r${roundNum}`}
                            className={`px-3 py-3 text-center align-top ${isLast ? 'bg-teal-50/70' : ''}`}
                          >
                            <p className="text-[10px] font-bold uppercase text-slate-400">Price</p>
                            <p className={`text-sm font-extrabold mt-0.5 ${isLast ? 'text-teal-700' : 'text-slate-900'}`}>
                              {price ? money(price) : '—'}
                            </p>
                            {changePct != null ? (
                              <p
                                className={`text-[11px] font-bold mt-0.5 ${
                                  change < 0 ? 'text-emerald-600' : 'text-red-600'
                                }`}
                              >
                                {change < 0 ? '▼' : '▲'} {Math.abs(Number(changePct))}%
                              </p>
                            ) : null}
                            <div className="mt-2">
                              {fileActions(allQuotationFilesForRound(use), vendor.name)}
                            </div>
                            {use.submittedAt ? (
                              <p className="text-[10px] text-slate-400 mt-1">{formatDisplayDateTime(use.submittedAt)}</p>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500">
            Quotation files for each round can be viewed or downloaded above.
          </p>
        </section>
      ) : null}

      {vendors.length > 0 ? (
        <section className="rounded-xl overflow-hidden border border-slate-200">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h2 className="text-[15px] font-extrabold text-slate-900">Vendor Comparison</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {data.vendorCount || vendors.length} vendors · Recommended:{' '}
              <strong className="text-emerald-700">{data.recommendedVendorName || recommended?.name || '—'}</strong>
            </p>
          </div>
          <div className="overflow-x-auto bg-white">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-50">
                    Parameter
                  </th>
                  {vendors.map((vendor) => (
                    <th
                      key={`cmp-h-${vendor.id}`}
                      className={`px-3 py-2.5 text-center text-sm font-bold ${
                        vendor.isRecommended ? 'bg-emerald-50 text-emerald-950' : 'bg-slate-50 text-slate-900'
                      }`}
                    >
                      {vendor.name}
                      {vendor.isRecommended ? (
                        <div className="mt-1 text-[10px] font-bold text-emerald-700">★ Recommended</div>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2.5 text-sm font-semibold text-slate-600">Quoted Price (₹)</td>
                  {vendors.map((vendor) => {
                    const price = vendorLatestPrice(vendor);
                    return (
                      <td
                        key={`cmp-price-${vendor.id}`}
                        className={`px-3 py-2.5 text-center font-bold tabular-nums ${
                          vendor.isRecommended ? 'bg-emerald-50/70 text-emerald-800' : 'text-slate-800'
                        }`}
                      >
                        {price ? money(price) : '—'}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2.5 text-sm font-semibold text-slate-600">Quotation File</td>
                  {vendors.map((vendor) => (
                      <td
                        key={`cmp-file-${vendor.id}`}
                        className={`px-3 py-2.5 text-center ${vendor.isRecommended ? 'bg-emerald-50/70' : ''}`}
                      >
                        {fileActions(allQuotationFilesForVendor(vendor), vendor.name)}
                      </td>
                    ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {vendors.some((v) =>
        (v.rounds || []).some((r) => r.quotationFileName || r.hasQuotationFile || (r.quotationFiles?.length ?? 0) > 0)
      ) ? (
        <section className="rounded-xl overflow-hidden border border-indigo-200">
          <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-200">
            <h2 className="text-[15px] font-extrabold text-indigo-950">Quotation Files</h2>
            <p className="text-xs text-indigo-700 mt-0.5">PDFs / images for each vendor quotation round</p>
          </div>
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-white">
            {vendors.flatMap((vendor) =>
              (vendor.rounds || [])
                .filter(
                  (r) =>
                    r.quotationFileName ||
                    r.hasQuotationFile ||
                    (r.quotationFiles?.length ?? 0) > 0
                )
                .map((round) => (
                  <div
                    key={`file-${vendor.id}-${round.round}`}
                    className={`rounded-xl border p-3 ${
                      vendor.isRecommended ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-800 truncate" title={vendor.name}>
                      {vendor.name}
                      {vendor.isRecommended ? (
                        <span className="ml-1 text-[10px] font-semibold text-emerald-700">Recommended</span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-slate-500 mb-2">Quote {round.round}</p>
                    {fileActions(allQuotationFilesForRound(round), vendor.name)}
                  </div>
                ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
