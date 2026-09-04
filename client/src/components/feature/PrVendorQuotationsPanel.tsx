import { useEffect, useMemo, useRef, useState } from 'react';
import { rfqApi } from '../../services/api';
import { allQuotationFilesForQuote, type QuotationFileView } from '../../utils/quotationFiles';
import { formatMoney as formatMoneyByCurrency } from '../../constants/currency';

type QuoteLineItem = {
  lineItemId?: string | number;
  description?: string;
  quantity?: number;
  quotedUnitPrice?: number;
  gstPercent?: number;
  quotedTotal?: number;
};

type QuoteRound = {
  submissionId?: number;
  round: number;
  quotedPrice: number;
  leadTime?: number;
  paymentTerms?: string;
  quotationFileName?: string;
  quotationFiles?: Array<{ id?: number | null; fileName: string; isPrimary?: boolean }>;
  status?: string;
  quoteLineItems?: QuoteLineItem[];
  fieldValues?: Record<string, unknown>;
};

type QuoteRow = {
  invitationId: number;
  vendorName: string;
  isRecommended?: boolean;
  quotes?: QuoteRound[];
};

function hasQuotedPrice(q: QuoteRound) {
  return Number(q.quotedPrice) >= 0 && (Number(q.quotedPrice) > 0 || Boolean(q.submissionId));
}

function linesForQuote(q: QuoteRound): QuoteLineItem[] {
  if (Array.isArray(q.quoteLineItems) && q.quoteLineItems.length) return q.quoteLineItems;
  const fromValues = q.fieldValues?.quoteLineItems;
  if (Array.isArray(fromValues)) return fromValues as QuoteLineItem[];
  return [];
}

interface Props {
  prId: number;
  currency?: string | null;
  onPresenceChange?: (hasQuotes: boolean) => void;
}

export default function PrVendorQuotationsPanel({ prId, currency, onPresenceChange }: Props) {
  const formatMoney = (n: number) =>
    formatMoneyByCurrency(n, currency, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [preview, setPreview] = useState<{ url: string; fileName: string } | null>(null);
  const [expandedRound, setExpandedRound] = useState<string | null>(null);

  const onPresenceRef = useRef(onPresenceChange);
  onPresenceRef.current = onPresenceChange;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    rfqApi
      .getByPr(prId)
      .then((res) => {
        if (cancelled) return;
        const tableRows = ((res.data as { tableRows?: QuoteRow[] })?.tableRows || []) as QuoteRow[];
        const withQuotes = tableRows.filter((row) => (row.quotes || []).some(hasQuotedPrice));
        setRows(withQuotes);
        onPresenceRef.current?.(withQuotes.length > 0);
        // Auto-expand recommended vendor's latest round line items
        const recommended = withQuotes.find((r) => r.isRecommended) || withQuotes[0];
        if (recommended) {
          const quotes = [...(recommended.quotes || [])]
            .filter(hasQuotedPrice)
            .sort((a, b) => a.round - b.round);
          const latest = quotes[quotes.length - 1];
          if (latest && linesForQuote(latest).length) {
            setExpandedRound(`${recommended.invitationId}-r${latest.round}`);
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        onPresenceRef.current?.(false);
        setError(err instanceof Error ? err.message : 'Could not load vendor quotations');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [prId]);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const maxRound = useMemo(() => {
    const rounds = rows.flatMap((r) => (r.quotes || []).filter(hasQuotedPrice).map((q) => Number(q.round) || 1));
    return Math.min(4, Math.max(1, ...rounds, 1));
  }, [rows]);

  const openFile = async (file: QuotationFileView) => {
    const token = localStorage.getItem('p2p_token');
    const submissionId = Number(file.submissionId) || 0;
    const extraId = Number(file.extraFileId) || 0;
    const url = extraId
      ? rfqApi.quotationExtraFileUrl(extraId)
      : submissionId
        ? rfqApi.quotationFileUrl(submissionId)
        : '';
    if (!url) {
      setError('Could not open quotation file');
      return;
    }
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      setError('Could not open quotation file');
      return;
    }
    const blob = await res.blob();
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview({ url: URL.createObjectURL(blob), fileName: file.fileName });
  };

  if (loading) {
    return <p className="text-sm text-gray-500 py-6 text-center">Loading vendor quotations…</p>;
  }
  if (!rows.length) {
    if (error) return <p className="text-sm text-red-600 py-4">{error}</p>;
    return null;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Vendor quotations</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Round prices, line items, and quotation files — recommended round expands by default
          </p>
        </div>
        <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
          {rows.length} vendor{rows.length === 1 ? '' : 's'} · up to Q{maxRound}
        </span>
      </div>

      {rows.map((row) => {
        const quotes = [...(row.quotes || [])].filter(hasQuotedPrice).sort((a, b) => a.round - b.round);
        const latest = quotes[quotes.length - 1];
        const isRecommended = Boolean(row.isRecommended);
        return (
          <div
            key={row.invitationId}
            className={`rounded-xl overflow-hidden ${
              isRecommended
                ? 'border-2 border-emerald-500 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-200/80'
                : 'border border-gray-200'
            }`}
          >
            <div
              className={`px-3.5 py-2.5 border-b flex items-center justify-between gap-2 ${
                isRecommended
                  ? 'bg-emerald-100/90 border-emerald-200'
                  : 'bg-slate-50 border-gray-100'
              }`}
            >
              <div className="min-w-0">
                <p
                  className={`text-sm font-semibold truncate ${
                    isRecommended ? 'text-emerald-950' : 'text-gray-900'
                  }`}
                >
                  {row.vendorName}
                </p>
                {latest && (
                  <p className={`text-xs mt-0.5 ${isRecommended ? 'text-emerald-800/80' : 'text-gray-500'}`}>
                    Latest Q{latest.round}: {formatMoney(Number(latest.quotedPrice))}
                    {latest.paymentTerms ? ` · ${latest.paymentTerms}` : ''}
                  </p>
                )}
              </div>
              {isRecommended && (
                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase">
                  <i className="ri-checkbox-circle-fill text-[10px]" />
                  Recommended
                </span>
              )}
            </div>

            <div className="divide-y divide-gray-100 bg-white">
              {quotes.map((quote) => {
                const round = Number(quote.round) || 1;
                const key = `${row.invitationId}-r${round}`;
                const lines = linesForQuote(quote);
                const open = expandedRound === key;
                return (
                  <div key={key} className={isRecommended && quote === latest ? 'bg-emerald-50/30' : ''}>
                    <div className="px-3.5 py-2.5 flex items-center gap-3">
                      <span
                        className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                          isRecommended && quote === latest
                            ? 'bg-emerald-600 text-white'
                            : 'bg-teal-50 text-teal-700'
                        }`}
                      >
                        Q{round}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900">{formatMoney(Number(quote.quotedPrice))}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {[quote.leadTime ? `${quote.leadTime} days` : '', quote.paymentTerms].filter(Boolean).join(' · ') ||
                            'Quoted'}
                          {lines.length ? ` · ${lines.length} line item${lines.length === 1 ? '' : 's'}` : ''}
                        </p>
                      </div>
                      {lines.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedRound(open ? null : key)}
                          className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border ${
                            open
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'text-slate-700 bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <i className={open ? 'ri-arrow-up-s-line' : 'ri-list-check-2'} />
                          {open ? 'Hide lines' : 'Line items'}
                        </button>
                      )}
                      {(() => {
                        const files = allQuotationFilesForQuote(quote);
                        if (!files.length) {
                          return <span className="text-[11px] text-gray-400">No file</span>;
                        }
                        return (
                          <div className="flex flex-col gap-1.5 shrink-0 max-w-[180px]">
                            {files.map((file, idx) => (
                              <div key={`${file.fileName}-${idx}`} className="flex flex-col gap-0.5">
                                <p className="text-[10px] text-slate-600 truncate" title={file.fileName}>
                                  <i className="ri-attachment-2 mr-0.5" />
                                  {file.fileName}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => void openFile(file)}
                                  className={`inline-flex items-center gap-1 self-start px-2 py-1 text-[10px] font-semibold rounded-md ${
                                    isRecommended
                                      ? 'text-emerald-800 bg-emerald-100 border border-emerald-300 hover:bg-emerald-200'
                                      : 'text-teal-700 bg-teal-50 border border-teal-100 hover:bg-teal-100'
                                  }`}
                                >
                                  <i className="ri-eye-line" />
                                  Preview
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {open && lines.length > 0 && (
                      <div className="px-3.5 pb-3">
                        <div className="border border-emerald-100 rounded-lg overflow-hidden bg-white">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-emerald-50/80 text-emerald-900">
                                <th className="text-left px-2.5 py-1.5 font-semibold">#</th>
                                <th className="text-left px-2.5 py-1.5 font-semibold">Description</th>
                                <th className="text-center px-2.5 py-1.5 font-semibold">Qty</th>
                                <th className="text-right px-2.5 py-1.5 font-semibold">Unit</th>
                                <th className="text-center px-2.5 py-1.5 font-semibold">GST</th>
                                <th className="text-right px-2.5 py-1.5 font-semibold">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lines.map((li, idx) => {
                                const qty = Number(li.quantity) || 0;
                                const unit = Number(li.quotedUnitPrice) || 0;
                                const gst = li.gstPercent != null ? Number(li.gstPercent) : null;
                                const total =
                                  Number(li.quotedTotal) ||
                                  Math.round(qty * unit * (1 + (gst || 0) / 100) * 100) / 100;
                                return (
                                  <tr key={`${key}-${idx}`} className="border-t border-gray-100">
                                    <td className="px-2.5 py-1.5 text-gray-500">{idx + 1}</td>
                                    <td className="px-2.5 py-1.5 text-gray-900 font-medium">
                                      {String(li.description || '—')}
                                    </td>
                                    <td className="px-2.5 py-1.5 text-center tabular-nums">{qty}</td>
                                    <td className="px-2.5 py-1.5 text-right tabular-nums">{formatMoney(unit)}</td>
                                    <td className="px-2.5 py-1.5 text-center text-gray-600">
                                      {gst != null ? `${gst}%` : '—'}
                                    </td>
                                    <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums text-emerald-800">
                                      {formatMoney(total)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-emerald-100 bg-emerald-50/50">
                                <td colSpan={5} className="px-2.5 py-2 text-right text-[11px] font-bold text-emerald-900 uppercase">
                                  Round total
                                </td>
                                <td className="px-2.5 py-2 text-right text-sm font-bold text-emerald-800">
                                  {formatMoney(Number(quote.quotedPrice) || 0)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {preview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-xl">
            <div className="p-4 border-b flex justify-between items-center gap-3">
              <span className="font-semibold text-gray-900 truncate">{preview.fileName}</span>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(preview.url);
                  setPreview(null);
                }}
                className="w-8 h-8 rounded-lg hover:bg-gray-100"
              >
                ×
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto bg-slate-100/80">
              {/\.pdf$/i.test(preview.fileName) ? (
                <iframe title="quotation" src={preview.url} className="w-full h-[70vh] border rounded bg-white" />
              ) : (
                <img src={preview.url} alt="" className="max-h-[70vh] max-w-full mx-auto object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
