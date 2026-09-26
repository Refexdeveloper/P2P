import { useEffect, useMemo, useState } from 'react';
import { currencySymbol, formatMoney, normalizeCurrency } from '../../../../constants/currency';

const softWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;

const roundColors = [
  { header: 'text-[#1E88E5]', badge: 'bg-[#E3F2FD] text-[#1E88E5]', tab: 'bg-[#1E88E5] text-white', idle: 'text-[#1E88E5] hover:bg-[#E3F2FD]' },
  { header: 'text-amber-600', badge: 'bg-amber-100 text-amber-700', tab: 'bg-amber-500 text-white', idle: 'text-amber-700 hover:bg-amber-50' },
  { header: 'text-violet-600', badge: 'bg-violet-100 text-violet-700', tab: 'bg-violet-600 text-white', idle: 'text-violet-700 hover:bg-violet-50' },
  { header: 'text-rose-600', badge: 'bg-rose-100 text-rose-700', tab: 'bg-rose-600 text-white', idle: 'text-rose-700 hover:bg-rose-50' },
];

function roundStyle(r: number) {
  return roundColors[(Math.max(1, r) - 1) % roundColors.length];
}

export interface RfqQuoteTableFile {
  fileName: string;
  extraFileId?: number | null;
  isLocal?: boolean;
  isPrimary?: boolean;
  /** Manual Create PO — stored on disk/GCS after Save Draft */
  storedName?: string | null;
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
  /** All quotation files for the focused round (local + saved). */
  quotationFiles?: RfqQuoteTableFile[];
  /** Extra-file id when previewing a specific saved attachment (not the primary blob). */
  quotationExtraFileId?: number | null;
  /** Server submission id for Open / View of saved quotation file */
  quotationSubmissionId?: number | null;
  /** Alias used by RFQ detail API table rows */
  submissionId?: number | null;
  /** True when a local File is still in browser memory (not yet uploaded) */
  hasLocalQuotationFile?: boolean;
  /** Manual Create PO — GCS/disk storedName for Preview after Save */
  quotationStoredName?: string | null;
  quotes?: Array<{
    round: number;
    quotedPrice: number;
    status?: string;
    submissionId?: number | null;
    quotationFileName?: string;
    quotationFiles?: RfqQuoteTableFile[];
  }>;
  fieldValues?: Record<string, unknown>;
}

interface Props {
  rows: RfqQuoteTableRow[];
  recommendedId: number | null;
  quotedCount: number;
  isFinalized?: boolean;
  /** Super Admin: allow Edit on existing quotes after RFQ finalize / PO sign */
  allowEditWhenFinalized?: boolean;
  maxRounds?: number | null;
  /** Hard ceiling for “Next round” (Create PR uses 4). Defaults to 20. */
  roundCeiling?: number | null;
  /** PR currency for price / reduction display (INR | USD | EUR). */
  currency?: string | null;
  onEdit: (row: RfqQuoteTableRow, targetRound?: number) => void;
  onChoose: (row: RfqQuoteTableRow) => void;
  onRemove: (row: RfqQuoteTableRow) => void;
  onResend?: (row: RfqQuoteTableRow) => void;
  onSendBack?: (row: RfqQuoteTableRow) => void;
  onViewFile?: (row: RfqQuoteTableRow) => void;
  onNextRound?: (nextRound: number) => void;
  /** Delete a quotation round (Q2+) for all vendors — does NOT remove the vendor */
  onRemoveRound?: (round: number) => void;
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

function fileMetaForRow(row: RfqQuoteTableRow, focusRound: number) {
  const quote = roundQuote(row, focusRound);
  const fileName =
    (quote?.quotationFileName && String(quote.quotationFileName)) ||
    (row.quotationFileName && String(row.quotationFileName)) ||
    '';
  const submissionId =
    (quote?.submissionId != null && Number(quote.submissionId)) ||
    (row.quotationSubmissionId != null && Number(row.quotationSubmissionId)) ||
    (row.submissionId != null && Number(row.submissionId)) ||
    null;
  return {
    fileName,
    submissionId: submissionId && Number.isFinite(submissionId) && submissionId > 0 ? submissionId : null,
  };
}

function normalizeQuoteFiles(
  files?: Array<{
    fileName?: string;
    extraFileId?: number | null;
    id?: number | null;
    isLocal?: boolean;
    isPrimary?: boolean;
    storedName?: string | null;
  }>
): RfqQuoteTableFile[] {
  if (!Array.isArray(files)) return [];
  return files
    .map((f) => ({
      fileName: String(f.fileName || ''),
      extraFileId: f.extraFileId ?? f.id ?? null,
      isLocal: Boolean(f.isLocal),
      isPrimary: Boolean(f.isPrimary),
      storedName: f.storedName ? String(f.storedName) : null,
    }))
    .filter((f) => f.fileName);
}

function filesForRow(row: RfqQuoteTableRow, focusRound: number): RfqQuoteTableFile[] {
  const quote = roundQuote(row, focusRound);
  const fromQuote = normalizeQuoteFiles(quote?.quotationFiles);
  if (fromQuote.length) return fromQuote;
  const fromRow = normalizeQuoteFiles(row.quotationFiles);
  if (fromRow.length) return fromRow;
  const meta = fileMetaForRow(row, focusRound);
  if (meta.fileName || row.hasLocalQuotationFile) {
    return [
      {
        fileName: meta.fileName || 'Attached',
        extraFileId: null,
        isLocal: Boolean(row.hasLocalQuotationFile) && !meta.submissionId,
        isPrimary: true,
      },
    ];
  }
  return [];
}

function isImageFileName(name: string) {
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(name || '');
}

function isPdfFileName(name: string) {
  return /\.pdf$/i.test(name || '');
}

function roundPrice(row: RfqQuoteTableRow, roundNum: number): number | null {
  const hit = roundQuote(row, roundNum);
  if (hit && Number(hit.quotedPrice) > 0) return Number(hit.quotedPrice) || 0;
  if (hit && hit.status === 'submitted') return Number(hit.quotedPrice) || 0;
  // Do not fall back to another round's price — Q1/Q2 must stay independent
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
  allowEditWhenFinalized = false,
  maxRounds = null,
  roundCeiling = null,
  onEdit,
  onChoose,
  onRemove,
  onResend,
  onSendBack,
  onViewFile,
  onNextRound,
  onRemoveRound,
  removingId,
  resendingId,
  preferredTab,
  currency,
}: Props) {
  const quoteEditLocked = Boolean(isFinalized) && !allowEditWhenFinalized;
  const moneyCode = normalizeCurrency(currency);
  const moneySym = currencySymbol(moneyCode);
  const formatCurrency = (n: number) =>
    formatMoney(n, moneyCode, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  const dataRounds = usedRoundCount(rows);
  const ceiling =
    roundCeiling != null && Number(roundCeiling) > 0
      ? Math.min(20, Math.max(1, Number(roundCeiling)))
      : 20;
  /** Current open rounds from parent (after delete). Fall back to data/added tabs. */
  const currentMax =
    maxRounds != null && Number(maxRounds) > 0 ? Math.min(ceiling, Math.max(1, Number(maxRounds))) : null;
  const [addedTabs, setAddedTabs] = useState(0);
  const roundCount = Math.max(
    1,
    Math.min(ceiling, currentMax != null ? currentMax : Math.max(dataRounds, addedTabs, 1))
  );
  const [activeTab, setActiveTab] = useState<RoundTab>(dataRounds);

  useEffect(() => {
    if (currentMax != null) {
      setAddedTabs(currentMax);
      setActiveTab((tab) => {
        if (tab === 'all') return tab;
        const n = Number(tab);
        return n > currentMax ? currentMax : tab;
      });
      return;
    }
    setAddedTabs((prev) => Math.min(ceiling, Math.max(prev, dataRounds)));
  }, [dataRounds, currentMax, ceiling]);

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
    if (next > ceiling) return;
    setAddedTabs(next);
    setActiveTab(next);
    onNextRound?.(next);
  };

  const deleteRoundTab = (round: number) => {
    if (round <= 1 || !onRemoveRound) return;
    onRemoveRound(round);
    const nextCount = Math.max(1, roundCount - 1);
    setAddedTabs(nextCount);
    setActiveTab((tab) => {
      if (tab === 'all') return 'all';
      const n = Number(tab);
      if (n === round) return Math.max(1, round - 1);
      if (n > round) return Math.max(1, n - 1);
      return tab;
    });
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
    <div className="relative overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
      <div className="pointer-events-none absolute inset-0" style={softWash} />
      <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/40 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E3F2FD] text-[#1E88E5]">
            <i className="ri-bar-chart-grouped-line text-lg" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#2C3E50]">Quotation Comparison Summary</h2>
            <p className="mt-0.5 text-xs text-slate-500">{tabLabel}</p>
          </div>
        </div>
        <span className="rounded-full bg-[#E3F2FD] px-3 py-1 text-xs font-semibold text-[#1E88E5]">
          {quotedInTab} of {rows.length} {activeTab === 'all' ? 'quoted' : `quoted in Q${activeTab}`}
        </span>
      </div>

      <div className="relative z-[1] overflow-x-auto border-b border-slate-100/80 px-5 pb-0 pt-3 sm:px-6">
        <div className="flex items-center gap-1.5 min-w-max">
          {Array.from({ length: roundCount }, (_, i) => i + 1).map((r) => {
            const color = roundStyle(r);
            const selected = activeTab === r;
            const count = stats.filter((s) => s.prices[r - 1] != null).length;
            return (
              <div key={r} className="inline-flex items-stretch">
                <button
                  type="button"
                  onClick={() => setActiveTab(r)}
                  className={`px-4 py-2 rounded-t-lg text-sm font-bold border-b-2 transition-colors ${
                    selected
                      ? `${color.tab} border-transparent`
                      : `bg-transparent border-transparent ${color.idle}`
                  } ${r > 1 && onRemoveRound && !isFinalized ? 'rounded-tr-none' : ''}`}
                >
                  Q{r}
                  <span className={`ml-1.5 text-[11px] font-semibold ${selected ? 'text-white/80' : 'opacity-70'}`}>
                    {count}/{rows.length}
                  </span>
                </button>
                {r > 1 && onRemoveRound && !isFinalized && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRoundTab(r);
                    }}
                    className={`px-2 py-2 rounded-t-lg border-b-2 border-transparent text-xs font-bold ${
                      selected
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'text-red-600 hover:bg-red-50'
                    }`}
                    title={`Delete round Q${r} only (vendors stay)`}
                    aria-label={`Delete round Q${r}`}
                  >
                    <i className="ri-close-line text-base" />
                  </button>
                )}
              </div>
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
          {!isFinalized && roundCount < ceiling && (
            <button
              type="button"
              onClick={addNextRound}
              className="ml-1 px-3 py-2 rounded-t-lg text-sm font-bold text-[#1E88E5] hover:bg-[#E3F2FD] border-b-2 border-transparent inline-flex items-center gap-1"
            >
              <i className="ri-add-line" />
              Next round
            </button>
          )}
        </div>
      </div>

      <div className="relative z-[1] overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-[#F8FBFF]">
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
                Reduction ({moneySym})
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Reduction %
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Progress Bar
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Quotation files
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
              const fileFocusRound = tabRound || latestRound || Number(row.round) || 1;
              const fileMeta = fileMetaForRow(row, fileFocusRound);
              const quoteFiles = filesForRow(row, fileFocusRound);
              const canPreviewFile = (file: RfqQuoteTableFile) =>
                Boolean(onViewFile) &&
                (Boolean(fileMeta.submissionId) ||
                  Boolean(file.extraFileId) ||
                  Boolean(file.isLocal) ||
                  Boolean(file.storedName) ||
                  Boolean(row.hasLocalQuotationFile));
              return (
                <tr key={row.id} className={`hover:bg-[#E3F2FD]/35 ${isRecommended ? 'bg-[#E3F2FD]/50' : ''}`}>
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
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-[#E3F2FD] text-[#1E88E5]">Your turn</span>
                      )}
                      {awaitingEmail && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700">Waiting</span>
                      )}
                        {isRecommended && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-[#1E88E5] text-white">Selected</span>
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
                        className="h-2.5 rounded-full bg-[#1E88E5]"
                        style={{ width: `${highest > 0 && (barValue ?? 0) > 0 ? Math.min(100, ((barValue ?? 0) / highest) * 100) : 0}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {quoteFiles.length > 0 ? (
                      <div className="flex flex-col gap-2 min-w-[160px] max-w-[220px]">
                        {quoteFiles.map((file, idx) => {
                          const canPreview = canPreviewFile(file);
                          return (
                            <div
                              key={`${file.extraFileId || file.fileName}-${idx}`}
                              className="flex flex-col gap-1"
                            >
                              <p
                                className="text-[11px] text-slate-600 truncate"
                                title={file.fileName}
                              >
                                <i
                                  className={`mr-1 ${
                                    isPdfFileName(file.fileName)
                                      ? 'ri-file-pdf-2-line text-red-500'
                                      : isImageFileName(file.fileName)
                                        ? 'ri-image-line text-[#1E88E5]'
                                        : 'ri-attachment-2 text-[#1E88E5]'
                                  }`}
                                />
                                {file.fileName}
                              </p>
                              {canPreview ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onViewFile?.({
                                      ...row,
                                      quotationFileName: file.fileName,
                                      quotationExtraFileId: file.extraFileId ?? null,
                                      quotationSubmissionId: fileMeta.submissionId,
                                      submissionId: fileMeta.submissionId,
                                      hasLocalQuotationFile: Boolean(file.isLocal),
                                      quotationStoredName: file.storedName ?? null,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 self-start px-2.5 py-1 rounded-lg bg-[#E3F2FD] text-[#1E88E5] text-[11px] font-semibold hover:bg-[#BBDEFB]"
                                >
                                  <i className="ri-eye-line" />
                                  {isImageFileName(file.fileName) || isPdfFileName(file.fileName)
                                    ? 'Preview'
                                    : 'View'}
                                </button>
                              ) : (
                                <span className="text-[10px] text-amber-700">File saved — open Edit to preview</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (quoteEditLocked) return;
                          onEdit(row, activeTab === 'all' ? undefined : Number(activeTab));
                        }}
                        disabled={quoteEditLocked}
                        title={
                          quoteEditLocked
                            ? 'RFQ is approved — editing is locked'
                            : allowEditWhenFinalized && isFinalized
                              ? 'Admin: update quote amount or files'
                              : 'Fill quote fields'
                        }
                        className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-[#1E88E5] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1565C0] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#1E88E5]"
                      >
                        <i className="ri-edit-line" />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(isFinalized) || !row.hasActiveQuote}
                        onClick={() => onChoose(row)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none ${
                          isRecommended
                            ? 'border-[#1E88E5] bg-[#1E88E5] text-white'
                            : 'border-transparent bg-white text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9]'
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
                          className="px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100"
                          title="Request vendor re-quote for next round"
                        >
                          <i className="ri-refresh-line mr-1"></i>
                          Re-quote
                        </button>
                      )}
                      {!isFinalized && (
                        <button
                          type="button"
                          disabled={removingId === row.invitationId}
                          onClick={() => onRemove(row)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold"
                          title="Remove this vendor and all of their quotation rounds"
                        >
                          {removingId === row.invitationId
                            ? '…'
                            : onRemoveRound
                              ? 'Remove vendor'
                              : 'Remove'}
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
