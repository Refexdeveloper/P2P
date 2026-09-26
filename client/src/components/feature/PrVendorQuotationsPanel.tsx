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

const softWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;

const softCard =
  'relative overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]';

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
  const [recommendationJustification, setRecommendationJustification] = useState('');
  const [recommendedVendorName, setRecommendedVendorName] = useState('');
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
        const payload = res.data as {
          tableRows?: QuoteRow[];
          config?: { recommendationJustification?: string; recommendedInvitationId?: number | null };
        };
        const tableRows = (payload?.tableRows || []) as QuoteRow[];
        const withQuotes = tableRows.filter((row) => (row.quotes || []).some(hasQuotedPrice));
        setRows(withQuotes);
        const recJust = String(payload?.config?.recommendationJustification || '').trim();
        setRecommendationJustification(recJust);
        const recommended =
          withQuotes.find((r) => r.isRecommended) ||
          withQuotes.find(
            (r) =>
              payload?.config?.recommendedInvitationId != null &&
              Number(r.invitationId) === Number(payload.config.recommendedInvitationId)
          ) ||
          null;
        setRecommendedVendorName(recommended?.vendorName || '');
        onPresenceRef.current?.(withQuotes.length > 0);
        const expandTarget = recommended || withQuotes[0];
        if (expandTarget) {
          const quotes = [...(expandTarget.quotes || [])]
            .filter(hasQuotedPrice)
            .sort((a, b) => a.round - b.round);
          const latest = quotes[quotes.length - 1];
          if (latest && linesForQuote(latest).length) {
            setExpandedRound(`${expandTarget.invitationId}-r${latest.round}`);
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        setRecommendationJustification('');
        setRecommendedVendorName('');
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
    return (
      <div className={`${softCard} px-4 py-8 text-center`}>
        <div className="pointer-events-none absolute inset-0" style={softWash} />
        <p className="relative z-[1] text-sm text-slate-500">Loading vendor quotations…</p>
      </div>
    );
  }
  if (!rows.length) {
    if (error) return <p className="py-4 text-sm text-red-600">{error}</p>;
    if (!recommendationJustification && !recommendedVendorName) return null;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {error && <p className="text-xs text-red-600">{error}</p>}

      {(recommendedVendorName || recommendationJustification) && (
        <section className={softCard}>
          <div className="pointer-events-none absolute inset-0" style={softWash} />
          <div className="relative z-[1] flex items-start gap-3 border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/50 px-4 py-3.5 sm:px-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E3F2FD] text-[#1E88E5]">
              <i className="ri-award-fill text-base" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Vendor Recommendation
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-[#2C3E50]">
                {recommendedVendorName || 'Recommended vendor'}
              </p>
            </div>
          </div>
          {recommendationJustification ? (
            <p className="relative z-[1] whitespace-pre-wrap px-4 py-3.5 text-sm leading-relaxed text-slate-700 sm:px-5">
              {recommendationJustification}
            </p>
          ) : (
            <p className="relative z-[1] px-4 py-3.5 text-sm italic text-slate-500 sm:px-5">
              No justification was provided with this recommendation.
            </p>
          )}
        </section>
      )}

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Vendor quotations</h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Round prices, line items, and quotation files
            </p>
          </div>
          <span className="rounded-full bg-[#E3F2FD] px-2.5 py-1 text-[11px] font-semibold text-[#1E88E5]">
            {rows.length} vendor{rows.length === 1 ? '' : 's'} · up to Q{maxRound}
          </span>
        </div>
      )}

      {rows.map((row) => {
        const quotes = [...(row.quotes || [])].filter(hasQuotedPrice).sort((a, b) => a.round - b.round);
        const latest = quotes[quotes.length - 1];
        const isRecommended = Boolean(row.isRecommended);
        return (
          <div
            key={row.invitationId}
            className={`${softCard} ${
              isRecommended ? 'ring-2 ring-[#90CAF9]/80' : ''
            }`}
          >
            <div className="pointer-events-none absolute inset-0" style={softWash} />
            <div className="relative z-[1] flex items-center justify-between gap-2 border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/40 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#2C3E50]">{row.vendorName}</p>
                {latest && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    Latest Q{latest.round}: {formatMoney(Number(latest.quotedPrice))}
                    {latest.paymentTerms ? ` · ${latest.paymentTerms}` : ''}
                  </p>
                )}
              </div>
              {isRecommended && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1E88E5] px-2.5 py-1 text-[10px] font-bold uppercase text-white">
                  <i className="ri-checkbox-circle-fill text-[10px]" />
                  Recommended
                </span>
              )}
            </div>

            <div className="relative z-[1] divide-y divide-slate-100/80">
              {quotes.map((quote) => {
                const round = Number(quote.round) || 1;
                const key = `${row.invitationId}-r${round}`;
                const lines = linesForQuote(quote);
                const open = expandedRound === key;
                return (
                  <div key={key}>
                    <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                          isRecommended && quote === latest
                            ? 'bg-[#1E88E5] text-white'
                            : 'bg-[#E3F2FD] text-[#1E88E5]'
                        }`}
                      >
                        Q{round}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold tabular-nums text-[#2C3E50]">
                          {formatMoney(Number(quote.quotedPrice))}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {[quote.leadTime ? `${quote.leadTime} days` : '', quote.paymentTerms]
                            .filter(Boolean)
                            .join(' · ') || 'Quoted'}
                          {lines.length
                            ? ` · ${lines.length} line item${lines.length === 1 ? '' : 's'}`
                            : ''}
                        </p>
                      </div>
                      {lines.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedRound(open ? null : key)}
                          className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                            open
                              ? 'bg-[#1E88E5] text-white'
                              : 'border border-transparent bg-white text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9]'
                          }`}
                        >
                          <i className={open ? 'ri-arrow-up-s-line' : 'ri-list-check-2'} />
                          {open ? 'Hide lines' : 'Line items'}
                        </button>
                      )}
                      {(() => {
                        const files = allQuotationFilesForQuote(quote);
                        if (!files.length) {
                          return <span className="text-[11px] text-slate-400">No file</span>;
                        }
                        return (
                          <div className="flex max-w-[180px] shrink-0 flex-col gap-1.5">
                            {files.map((file, idx) => (
                              <div key={`${file.fileName}-${idx}`} className="flex flex-col gap-0.5">
                                <p
                                  className="truncate text-[10px] text-slate-600"
                                  title={file.fileName}
                                >
                                  <i className="ri-attachment-2 mr-0.5" />
                                  {file.fileName}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => void openFile(file)}
                                  className="inline-flex cursor-pointer items-center gap-1 self-start rounded-lg bg-[#E3F2FD] px-2 py-1 text-[10px] font-semibold text-[#1E88E5] transition-colors hover:bg-[#BBDEFB]"
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
                      <div className="px-4 pb-4 sm:px-5">
                        <div className="overflow-hidden rounded-xl border border-transparent bg-[#F8FAFC] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.08)]">
                          <table className="w-full text-xs">
                            <thead>
                              <tr>
                                <th className="px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  #
                                </th>
                                <th className="px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  Description
                                </th>
                                <th className="px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  Qty
                                </th>
                                <th className="px-2.5 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  Unit
                                </th>
                                <th className="px-2.5 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  GST
                                </th>
                                <th className="px-2.5 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  Total
                                </th>
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
                                  <tr key={`${key}-${idx}`} className="border-t border-slate-100/80">
                                    <td className="px-2.5 py-2 text-slate-500">{idx + 1}</td>
                                    <td className="px-2.5 py-2 font-medium text-[#2C3E50]">
                                      {String(li.description || '—')}
                                    </td>
                                    <td className="px-2.5 py-2 text-center tabular-nums">{qty}</td>
                                    <td className="px-2.5 py-2 text-right tabular-nums">
                                      {formatMoney(unit)}
                                    </td>
                                    <td className="px-2.5 py-2 text-center text-slate-600">
                                      {gst != null ? `${gst}%` : '—'}
                                    </td>
                                    <td className="px-2.5 py-2 text-right font-semibold tabular-nums text-[#1E88E5]">
                                      {formatMoney(total)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-slate-100/80 bg-white/70">
                                <td
                                  colSpan={5}
                                  className="px-2.5 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                                >
                                  Round total
                                </td>
                                <td className="px-2.5 py-2 text-right text-sm font-bold tabular-nums text-[#1E88E5]">
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
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-[18px]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <span className="truncate font-semibold text-slate-800">{preview.fileName}</span>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(preview.url);
                  setPreview(null);
                }}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-white text-slate-500 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:text-[#1E88E5]"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-[#F8FAFC] p-4">
              {/\.pdf$/i.test(preview.fileName) ? (
                <iframe
                  title="quotation"
                  src={preview.url}
                  className="h-[70vh] w-full rounded-xl border-0 bg-white"
                />
              ) : (
                <img
                  src={preview.url}
                  alt=""
                  className="mx-auto max-h-[70vh] max-w-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
