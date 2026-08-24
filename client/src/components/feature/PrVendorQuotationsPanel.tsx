import { useEffect, useMemo, useRef, useState } from 'react';
import { rfqApi } from '../../services/api';

type QuoteRound = {
  submissionId?: number;
  round: number;
  quotedPrice: number;
  leadTime?: number;
  paymentTerms?: string;
  quotationFileName?: string;
  status?: string;
};

type QuoteRow = {
  invitationId: number;
  vendorName: string;
  isRecommended?: boolean;
  quotes?: QuoteRound[];
};

const formatMoney = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

function hasQuotedPrice(q: QuoteRound) {
  return Number(q.quotedPrice) > 0;
}

interface Props {
  prId: number;
  onPresenceChange?: (hasQuotes: boolean) => void;
}

export default function PrVendorQuotationsPanel({ prId, onPresenceChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [preview, setPreview] = useState<{ url: string; fileName: string } | null>(null);

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

  const openFile = async (submissionId: number, fileName: string) => {
    const token = localStorage.getItem('p2p_token');
    const res = await fetch(rfqApi.quotationFileUrl(submissionId), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      setError('Could not open quotation file');
      return;
    }
    const blob = await res.blob();
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview({ url: URL.createObjectURL(blob), fileName });
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
          <p className="text-xs text-gray-500 mt-0.5">Round prices and quotation files on this PR</p>
        </div>
        <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
          {rows.length} vendor{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      {rows.map((row) => {
        const quotes = [...(row.quotes || [])].filter(hasQuotedPrice).sort((a, b) => a.round - b.round);
        const latest = quotes[quotes.length - 1];
        return (
          <div key={row.invitationId} className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-gray-100 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{row.vendorName}</p>
                {latest && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Latest Q{latest.round}: {formatMoney(Number(latest.quotedPrice))}
                    {latest.paymentTerms ? ` · ${latest.paymentTerms}` : ''}
                  </p>
                )}
              </div>
              {row.isRecommended ? (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  Recommended
                </span>
              ) : null}
            </div>
            <div className="divide-y divide-gray-50">
              {Array.from({ length: maxRound }, (_, i) => i + 1).map((round) => {
                const quote = quotes.find((q) => Number(q.round) === round);
                if (!quote) return null;
                return (
                  <div key={round} className="px-3.5 py-2.5 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 text-xs font-bold flex items-center justify-center shrink-0">
                      Q{round}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900">{formatMoney(Number(quote.quotedPrice))}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {[quote.leadTime ? `${quote.leadTime} days` : '', quote.paymentTerms].filter(Boolean).join(' · ') ||
                          'Quoted'}
                      </p>
                    </div>
                    {quote.quotationFileName && quote.submissionId ? (
                      <button
                        type="button"
                        onClick={() => void openFile(quote.submissionId!, quote.quotationFileName || 'quotation')}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-100 rounded-lg hover:bg-teal-100"
                      >
                        <i className="ri-file-pdf-line" />
                        View file
                      </button>
                    ) : (
                      <span className="text-[11px] text-gray-400">No file</span>
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
            <div className="p-4 flex-1 overflow-auto">
              {/\.pdf$/i.test(preview.fileName) ? (
                <iframe title="quotation" src={preview.url} className="w-full h-[70vh] border rounded" />
              ) : (
                <img src={preview.url} alt="" className="max-h-[70vh] mx-auto" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
