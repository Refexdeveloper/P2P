import { useEffect, useMemo, useState } from 'react';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const roundColors = [
  { header: 'text-emerald-600', badge: 'bg-teal-100 text-teal-700', tab: 'bg-teal-600 text-white', idle: 'text-teal-700 hover:bg-teal-50' },
  { header: 'text-amber-600', badge: 'bg-amber-100 text-amber-700', tab: 'bg-amber-500 text-white', idle: 'text-amber-700 hover:bg-amber-50' },
  { header: 'text-violet-600', badge: 'bg-violet-100 text-violet-700', tab: 'bg-violet-600 text-white', idle: 'text-violet-700 hover:bg-violet-50' },
  { header: 'text-rose-600', badge: 'bg-rose-100 text-rose-700', tab: 'bg-rose-600 text-white', idle: 'text-rose-700 hover:bg-rose-50' },
];

function roundStyle(r: number) {
  return roundColors[(Math.max(1, r) - 1) % roundColors.length];
}

export interface RfqQuoteTableRow {
  id: string;
  invitationId: number;
  vendorName: string;
  inviteMode?: 'email' | 'manual';
  status: string;
  round: number;
  hasActiveQuote?: boolean;
  isRecommended?: boolean;
  canSendBack?: boolean;
  quotationFileName?: string;
  /** Server submission id for Open / View of saved quotation file */
  quotationSubmissionId?: number;
  /** True when a local File is still in browser memory (not yet uploaded) */
  hasLocalQuotationFile?: boolean;
  quotes?: Array<{ round: number; quotedPrice: number; status?: string }>;
  fieldValues?: Record<string, unknown>;
}

interface Props {
  rows: RfqQuoteTableRow[];
  recommendedId: number | null;
  quotedCount: number;
  isFinalized?: boolean;
  maxRounds?: number | null;
  onEdit: (row: RfqQuoteTableRow, targetRound?: number) => void;
  onChoose: (row: RfqQuoteTableRow) => void;
  onRemove: (row: RfqQuoteTableRow) => void;
  onResend?: (row: RfqQuoteTableRow) => void;
  onSendBack?: (row: RfqQuoteTableRow) => void;
  onViewFile?: (row: RfqQuoteTableRow) => void;
  onNextRound?: (nextRound: number) => void;
  removingId?: number | null;
  resendingId?: number | null;
  preferredTab?: number | null;
}

function roundQuote(row: RfqQuoteTableRow, roundNum: number) {
  const quotes = Array.isArray(row.quotes) ? row.quotes : [];
  return (
    quotes.find((q) => Number(q.round) === roundNum && q.status === 'submitted') ||
    quotes.find((q) => Number(q.round) === roundNum && Number(q.quotedPrice) > 0) ||
    quotes.find((q) => Number(q.round) === roundNum) ||
    null
  );
}

function roundPrice(row: RfqQuoteTableRow, roundNum: number): number | null {
  const hit = roundQuote(row, roundNum);
  if (hit) return Number(hit.quotedPrice) || 0;
  if (roundNum === 1 && row.hasActiveQuote) {
    const latest = [...(row.quotes || [])].reverse().find((q) => q.status === 'submitted' || Number(q.quotedPrice) > 0);
    if (latest) return Number(latest.quotedPrice) || 0;
    if (row.fieldValues?.quotedPrice != null) return Number(row.fieldValues.quotedPrice) || 0;
  }
  return null;
}

function usedRoundCount(rows: RfqQuoteTableRow[]) {
  let max = 1;
  for (const row of rows) {
    max = Math.max(max, Number(row.round) || 1);
    for (const q of row.quotes || []) {
      max = Math.max(max, Number(q.round) || 0);
    }
  }
  return Math.max(1, max);
}

type RoundTab = 'all' | number;

export default function RfqVendorQuoteTable({
  rows,
  recommendedId,
  quotedCount,
  isFinalized,
  onEdit,
  onChoose,
  onRemove,
  onResend,
  onSendBack,
  onViewFile,
  onNextRound,
  removingId,
  resendingId,
  preferredTab,
}: Props) {
  const dataRounds = usedRoundCount(rows);
  const [addedTabs, setAddedTabs] = useState(0);
  const roundCount = Math.max(dataRounds, addedTabs, 1);
  const [activeTab, setActiveTab] = useState<RoundTab>(dataRounds);

  useEffect(() => {
    setAddedTabs((prev) => Math.max(prev, dataRounds));
  }, [dataRounds]);

  useEffect(() => {
    const tab = Number(preferredTab);
    if (tab >= 1 && tab <= roundCount) setActiveTab(tab);
  }, [preferredTab, roundCount]);

  const visibleRounds = useMemo(() => {
    if (activeTab === 'all') return Array.from({ length: roundCount }, (_, i) => i + 1);
    return Array.from({ length: Number(activeTab) }, (_, i) => i + 1);
  }, [activeTab, roundCount]);

  const addNextRound = () => {
    const next = roundCount + 1;
    if (next > 20) return;
    setAddedTabs(next);
    setActiveTab(next);
    onNextRound?.(next);
  };

  const stats = rows.map((row) => {
    const prices = Array.from({ length: roundCount }, (_, i) => roundPrice(row, i + 1));
    const filled = prices.filter((p) => p != null) as number[];
    const q1 = prices[0] ?? filled[0] ?? 0;
    const latest = filled.length ? filled[filled.length - 1] : 0;
    const latestRound = prices.reduce((acc, p, i) => (p != null ? i + 1 : acc), filled.length ? 1 : 0);
    const focusRound = activeTab === 'all' ? latestRound : Number(activeTab);
    const focusPrice = prices[focusRound - 1];
    const prevPrice = focusRound > 1 ? prices[focusRound - 2] : null;
    const reduction =
      activeTab === 'all'
        ? filled.length >= 2
          ? q1 - latest
          : 0
        : prevPrice != null && focusPrice != null
          ? prevPrice - focusPrice
          : 0;
    const reductionBase = activeTab === 'all' ? q1 : prevPrice ?? 0;
    const reductionPct =
      reductionBase > 0 && (activeTab === 'all' ? latestRound >= 2 : focusRound >= 2 && focusPrice != null)
        ? (reduction / reductionBase) * 100
        : 0;
    return { row, prices, q1, latest, latestRound, focusRound, focusPrice, reduction, reductionPct };
  });
  const highest = stats.reduce((max, s) => Math.max(max, s.q1, s.latest, s.focusPrice ?? 0), 0);
  const quotedInTab =
    activeTab === 'all' ? quotedCount : stats.filter((s) => s.prices[Number(activeTab) - 1] != null).length;

  const tabLabel =
    activeTab === 'all'
      ? 'All rounds — Q1 vs latest price'
      : `Round Q${activeTab} — tap Edit to fill this round`;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex items-center justify-center bg-teal-50 rounded-lg">
            <i className="ri-bar-chart-grouped-line text-teal-600 text-lg" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Quotation Comparison Summary</h2>
            <p className="text-xs text-gray-500 mt-0.5">{tabLabel}</p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-600">
          {quotedInTab} of {rows.length} {activeTab === 'all' ? 'quoted' : `quoted in Q${activeTab}`}
        </span>
      </div>

      <div className="px-5 sm:px-6 pt-3 pb-0 border-b border-gray-100 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {Array.from({ length: roundCount }, (_, i) => i + 1).map((r) => {
            const color = roundStyle(r);
            const selected = activeTab === r;
            const count = stats.filter((s) => s.prices[r - 1] != null).length;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setActiveTab(r)}
                className={`px-4 py-2 rounded-t-lg text-sm font-bold border-b-2 transition-colors ${
                  selected
                    ? `${color.tab} border-transparent`
                    : `bg-transparent border-transparent ${color.idle}`
                }`}
              >
                Q{r}
                <span className={`ml-1.5 text-[11px] font-semibold ${selected ? 'text-white/80' : 'opacity-70'}`}>
                  {count}/{rows.length}
                </span>
              </button>
            );
          })}
          {roundCount > 1 && (
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-t-lg text-sm font-bold border-b-2 ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white border-transparent'
                  : 'text-gray-600 hover:bg-gray-50 border-transparent'
              }`}
            >
              All rounds
            </button>
          )}
          {!isFinalized && roundCount < 20 && (
            <button
              type="button"
              onClick={addNextRound}
              className="ml-1 px-3 py-2 rounded-t-lg text-sm font-bold text-teal-700 hover:bg-teal-50 border-b-2 border-transparent inline-flex items-center gap-1"
            >
              <i className="ri-add-line" />
              Next round
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
              {visibleRounds.map((r) => (
                <th
                  key={r}
                  className={`px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider ${roundStyle(r).header} ${
                    activeTab === r ? 'bg-white' : ''
                  }`}
                >
                  Q{r} Price
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Reduction (₹)
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Reduction %
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Progress Bar
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Quotation file
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stats.map(({ row, prices, q1, latest, latestRound, focusPrice, reduction, reductionPct }) => {
              const isRecommended = Number(recommendedId) === Number(row.invitationId) || Boolean(row.isRecommended);
              const awaitingManual = row.inviteMode === 'manual' && !row.hasActiveQuote;
              const awaitingEmail =
                row.inviteMode !== 'manual' &&
                !row.hasActiveQuote &&
                (row.status === 'invited' || row.status === 'sent_back');
              const tabRound = activeTab === 'all' ? null : Number(activeTab);
              const hasTabQuote = tabRound ? prices[tabRound - 1] != null : row.hasActiveQuote;
              const barValue = tabRound ? focusPrice : latest;
              return (
                <tr key={row.id} className={`hover:bg-gray-50 ${isRecommended ? 'bg-teal-50/40' : ''}`}>
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-gray-900">{row.vendorName}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {prices.map((p, i) =>
                        p != null && visibleRounds.includes(i + 1) ? (
                          <span key={i} className={`px-1.5 py-0.5 rounded text-xs font-bold ${roundStyle(i + 1).badge}`}>
                            Q{i + 1}
                          </span>
                        ) : null
                      )}
                      {awaitingManual && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-teal-50 text-teal-700">Your turn</span>
                      )}
                      {awaitingEmail && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700">Waiting</span>
                      )}
                      {isRecommended && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">Selected</span>
                      )}
                      {tabRound && !hasTabQuote && row.hasActiveQuote && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-500">No Q{tabRound}</span>
                      )}
                    </div>
                  </td>
                  {visibleRounds.map((r) => {
                    const p = prices[r - 1];
                    return (
                      <td key={r} className={`px-4 py-3.5 text-right ${activeTab === r ? 'bg-white' : ''}`}>
                        {p != null ? (
                          <span className="text-sm font-semibold text-gray-900">{formatCurrency(p)}</span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3.5 text-right">
                    {(activeTab === 'all' ? latestRound >= 2 : Number(activeTab) >= 2 && focusPrice != null) && reduction !== 0 ? (
                      <span className={`text-sm font-bold ${reduction > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {reduction > 0 ? '-' : '+'}
                        {formatCurrency(Math.abs(reduction))}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {(activeTab === 'all' ? latestRound >= 2 : Number(activeTab) >= 2 && focusPrice != null) && reductionPct !== 0 ? (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          reductionPct > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {Math.abs(reductionPct).toFixed(1)}%
                      </span>
                    ) : (activeTab === 'all' ? latestRound : Number(activeTab)) <= 1 ? (
                      <span className="text-xs text-gray-400">{prices[0] != null ? 'Single round' : 'No quote yet'}</span>
                    ) : (
                      <span className="text-xs text-gray-400">{focusPrice != null ? 'No change' : 'No quote yet'}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 min-w-[140px]">
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-2.5 rounded-full bg-teal-400"
                        style={{ width: `${highest > 0 && (barValue ?? 0) > 0 ? Math.min(100, ((barValue ?? 0) / highest) * 100) : 0}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {row.quotationFileName || row.hasLocalQuotationFile || row.quotationSubmissionId ? (
                      <div className="flex flex-col gap-1 min-w-[120px]">
                        <p
                          className="text-[11px] text-slate-600 truncate max-w-[140px]"
                          title={row.quotationFileName || 'Quotation file'}
                        >
                          <i className="ri-file-pdf-2-line text-teal-600 mr-1" />
                          {row.quotationFileName || 'Attached'}
                        </p>
                        {onViewFile && (row.hasLocalQuotationFile || row.quotationSubmissionId) ? (
                          <button
                            type="button"
                            onClick={() => onViewFile(row)}
                            className="inline-flex items-center gap-1 self-start px-2 py-1 rounded-md border border-teal-200 text-teal-700 text-[11px] font-semibold hover:bg-teal-50"
                          >
                            <i className="ri-eye-line" />
                            View
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEdit(row, activeTab === 'all' ? undefined : Number(activeTab))}
                        disabled={isFinalized}
                        title="Fill quote fields"
                        className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-40 inline-flex items-center gap-1"
                      >
                        <i className="ri-edit-line" />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isFinalized || !row.hasActiveQuote}
                        onClick={() => onChoose(row)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-40 ${
                          isRecommended
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-gray-700 border-gray-200'
                        }`}
                      >
                        {isRecommended ? 'Selected' : 'Choose'}
                      </button>
                      {awaitingEmail && onResend && (
                        <button
                          type="button"
                          disabled={resendingId === row.invitationId}
                          onClick={() => onResend(row)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold"
                        >
                          {resendingId === row.invitationId ? '…' : 'Resend'}
                        </button>
                      )}
                      {row.canSendBack && onSendBack && !isFinalized && (
                        <button
                          type="button"
                          onClick={() => onSendBack(row)}
                          className="px-3 py-1.5 rounded-lg border border-amber-200 text-amber-800 text-xs font-semibold"
                        >
                          Re-quote
                        </button>
                      )}
                      {!isFinalized && (
                        <button
                          type="button"
                          disabled={removingId === row.invitationId}
                          onClick={() => onRemove(row)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold"
                        >
                          {removingId === row.invitationId ? '…' : 'Remove'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
