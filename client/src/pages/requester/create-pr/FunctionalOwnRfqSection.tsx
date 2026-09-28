import { useMemo, useState } from 'react';
import VendorSearchSelect from '../rfq-entry/components/VendorSearchSelect';
import RfqVendorQuoteTable, { RfqQuoteTableFile, RfqQuoteTableRow } from '../rfq-entry/components/RfqVendorQuoteTable';
import CreateVendorForm from '../../scm/vendor-master/components/CreateVendorForm';
import RfqChatbot from '../../../components/feature/RfqChatbot';
import { openRfqChat } from '../../../components/feature/rfqChatOpen';
import type { VendorRecord } from '../../../services/api';
import { rfqApi } from '../../../services/api';
import { PR_PAYMENT_TERM_OPTIONS } from '../../../constants/prRequisition';
import { formatMoney, currencySymbol, normalizeCurrency } from '../../../constants/currency';
import type { CurrencyCode } from '../../../constants/currency';

const softWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;

const softCard =
  'relative overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]';

export type SavedQuotationFile = {
  id?: number | null;
  fileName: string;
  isPrimary?: boolean;
};

export type FunctionalRfqQuote = {
  round: number;
  quotedPrice: string;
  leadTime: string;
  paymentTerms: string;
  file: File | null;
  files: File[];
  savedFiles?: SavedQuotationFile[];
  /** File name already stored on the server (no re-upload needed). */
  savedFileName?: string;
  /** Server submission id — used to Open/View saved quotation file. */
  savedSubmissionId?: number;
};

export function localQuoteFiles(q: FunctionalRfqQuote | undefined): File[] {
  if (!q) return [];
  if (Array.isArray(q.files) && q.files.length) return q.files;
  return q.file ? [q.file] : [];
}

export function savedQuoteFiles(q: FunctionalRfqQuote | undefined): SavedQuotationFile[] {
  if (!q) return [];
  if (Array.isArray(q.savedFiles) && q.savedFiles.length) return q.savedFiles;
  if (q.savedFileName) return [{ id: null, fileName: q.savedFileName, isPrimary: true }];
  return [];
}

export function quoteHasQuotationFile(q: FunctionalRfqQuote | undefined): boolean {
  return localQuoteFiles(q).length > 0 || savedQuoteFiles(q).length > 0;
}

function quoteTableFiles(q: FunctionalRfqQuote | undefined): RfqQuoteTableFile[] {
  if (!q) return [];
  const saved = savedQuoteFiles(q).map((sf, i) => ({
    fileName: sf.fileName,
    extraFileId: sf.id ?? null,
    isLocal: false,
    isPrimary: Boolean(sf.isPrimary ?? i === 0),
  }));
  const locals = localQuoteFiles(q).map((f, i) => ({
    fileName: f.name,
    extraFileId: null,
    isLocal: true,
    isPrimary: saved.length === 0 && i === 0,
  }));
  return [...saved, ...locals].filter((f) => f.fileName);
}

export function filesFromSubmission(sub?: {
  id?: number;
  quotationFileName?: string;
  quotationFiles?: Array<{ id?: number | null; fileName?: string; isPrimary?: boolean }>;
}): SavedQuotationFile[] {
  const extra = Array.isArray(sub?.quotationFiles) ? sub.quotationFiles : [];
  if (extra.length) {
    return extra
      .map((f, i) => ({
        id: f.id ?? null,
        fileName: String(f.fileName || ''),
        isPrimary: Boolean(f.isPrimary ?? i === 0),
      }))
      .filter((f) => f.fileName);
  }
  if (sub?.quotationFileName) {
    return [{ id: null, fileName: sub.quotationFileName, isPrimary: true }];
  }
  return [];
}

export type FunctionalRfqVendorRow = {
  key: string;
  vendorId: string;
  name: string;
  email: string;
  quotes: FunctionalRfqQuote[];
};

function emptyQuotes(maxRounds: number): FunctionalRfqQuote[] {
  const rounds = Math.min(4, Math.max(1, maxRounds));
  return Array.from({ length: rounds }, (_, i) => ({
    round: i + 1,
    quotedPrice: '',
    leadTime: '',
    paymentTerms: '',
    file: null,
    files: [],
  }));
}

export function newFunctionalRfqVendorRow(maxRounds: number): FunctionalRfqVendorRow {
  return {
    key: `rfq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    vendorId: '',
    name: '',
    email: '',
    quotes: emptyQuotes(maxRounds),
  };
}

function syncQuotes(quotes: FunctionalRfqQuote[], maxRounds: number): FunctionalRfqQuote[] {
  const next = emptyQuotes(maxRounds);
  return next.map((slot) => quotes.find((q) => q.round === slot.round) || slot);
}

interface Props {
  vendors: VendorRecord[];
  rows: FunctionalRfqVendorRow[];
  maxRounds: number;
  error?: string;
  existingQuoteNote?: string;
  prNumber?: string;
  currency?: CurrencyCode | string | null;
  /** Persisted Choose selection (survives Save Draft / reload). */
  recommendedKey?: string | null;
  recommendationJustification?: string;
  onRecommendedChange?: (payload: {
    key: string | null;
    vendorId?: string;
    vendorName?: string;
    vendorEmail?: string;
    justification: string;
  }) => void;
  onMaxRoundsChange: (n: number) => void;
  onChange: (rows: FunctionalRfqVendorRow[]) => void;
  onVendorsRefresh?: (vendor?: VendorRecord) => void;
}

export default function FunctionalOwnRfqSection({
  vendors,
  rows,
  maxRounds,
  currency: currencyProp,
  error,
  existingQuoteNote,
  prNumber,
  recommendedKey: recommendedKeyProp = null,
  recommendationJustification: recommendationJustificationProp = '',
  onRecommendedChange,
  onMaxRoundsChange,
  onChange,
  onVendorsRefresh,
}: Props) {
  const moneyCode = normalizeCurrency(currencyProp);
  const moneySym = currencySymbol(moneyCode);
  const moneyFmt = (n: number) =>
    formatMoney(n, moneyCode, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  const [searchVendorId, setSearchVendorId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [fileViewBusy, setFileViewBusy] = useState(false);
  const [fileViewError, setFileViewError] = useState('');
  const [recommendModal, setRecommendModal] = useState<{
    key: string;
    vendorName: string;
  } | null>(null);
  const [recommendDraft, setRecommendDraft] = useState('');

  const recommendedKey = recommendedKeyProp;
  const recommendationJustification = recommendationJustificationProp;
  const [toast, setToast] = useState('');
  const [localError, setLocalError] = useState('');
  const [quoteKey, setQuoteKey] = useState<string | null>(null);
  const [quoteRound, setQuoteRound] = useState(1);
  const [quoteDraft, setQuoteDraft] = useState<FunctionalRfqVendorRow | null>(null);
  const [focusTab, setFocusTab] = useState(1);

  const visibleRounds = Math.min(4, Math.max(1, Number(maxRounds) || 1));

  const takenIds = useMemo(() => new Set(rows.map((r) => r.vendorId).filter(Boolean)), [rows]);
  const quotedCount = rows.filter((r) => {
    const q1 = r.quotes.find((q) => q.round === 1);
    return Number(q1?.quotedPrice) >= 0 && String(q1?.quotedPrice || '').trim() !== '' && quoteHasQuotationFile(q1);
  }).length;
  const guideStep = quotedCount > 0 ? 2 : rows.length > 0 ? 2 : 1;

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3500);
  };

  const selectedSearch = vendors.find((v) => String(v.id) === String(searchVendorId));

  const commitVendor = (vendor: { id: string; name: string; email: string }) => {
    const existing = rows.find((r) => r.vendorId === vendor.id);
    if (existing) return { row: existing, nextRows: rows, isNew: false };
    const row: FunctionalRfqVendorRow = {
      ...newFunctionalRfqVendorRow(visibleRounds),
      vendorId: vendor.id,
      name: vendor.name,
      email: vendor.email,
    };
    return { row, nextRows: [...rows, row], isNew: true };
  };

  /**
   * Add vendor (if needed) and always open the quote popup for amount + file.
   */
  const addVendorAndOpenQuote = (
    vendor: { id: string; name: string; email: string },
    round = 1
  ) => {
    setLocalError('');
    const added = commitVendor({
      id: String(vendor.id),
      name: vendor.name,
      email: vendor.email || '',
    });
    setSearchVendorId('');
    openQuote(added.row, round, added.nextRows);
    if (added.isNew) {
      showToast(`${vendor.name} added — enter quoted amount and upload quotation file`);
    }
  };

  const applyRows = (nextRows: FunctionalRfqVendorRow[], round = visibleRounds) => {
    const nextVisible = Math.min(4, Math.max(visibleRounds, round, 1));
    if (nextVisible !== visibleRounds) onMaxRoundsChange(nextVisible);
    const synced = nextRows.map((r) => ({ ...r, quotes: syncQuotes(r.quotes, nextVisible) }));
    onChange(synced);
    setFocusTab(nextVisible);
    return { synced, nextVisible };
  };

  /**
   * Delete one quotation round (Q2+) for every vendor — vendors stay.
   * Higher rounds are renumbered down so tabs stay Q1, Q2, Q3… with no gaps.
   */
  const removeRound = (round: number) => {
    const target = Math.min(4, Math.max(1, Number(round) || 1));
    if (target <= 1) {
      showToast('Round Q1 cannot be deleted');
      return;
    }
    if (target > visibleRounds) return;

    const nextVisible = Math.max(1, visibleRounds - 1);
    onMaxRoundsChange(nextVisible);

    const trimmed = rows.map((r) => {
      const renumbered = r.quotes
        .filter((q) => q.round !== target)
        .map((q) => (q.round > target ? { ...q, round: q.round - 1 } : q))
        .filter((q) => q.round >= 1 && q.round <= nextVisible);
      return { ...r, quotes: syncQuotes(renumbered, nextVisible) };
    });
    onChange(trimmed);
    setFocusTab(Math.min(focusTab, nextVisible));
    if (quoteRound === target) {
      setQuoteRound(Math.max(1, target - 1));
    } else if (quoteRound > target) {
      setQuoteRound(quoteRound - 1);
    }
    if (quoteKey) {
      const saved = trimmed.find((r) => r.key === quoteKey);
      if (saved) setQuoteDraft(saved);
    }
    showToast(`Round Q${target} deleted. Vendors kept. Save draft to confirm.`);
  };

  const openQuote = (row: FunctionalRfqVendorRow, round = 1, baseRows: FunctionalRfqVendorRow[] = rows) => {
    const nextVisible = Math.min(4, Math.max(visibleRounds, round, 1));
    if (nextVisible !== visibleRounds) onMaxRoundsChange(nextVisible);
    const synced = baseRows.map((r) => ({ ...r, quotes: syncQuotes(r.quotes, nextVisible) }));
    const saved =
      synced.find((r) => r.key === row.key) ||
      ({ ...row, quotes: syncQuotes(row.quotes || [], nextVisible) } as FunctionalRfqVendorRow);
    const withRow = synced.some((r) => r.key === saved.key) ? synced : [...synced, saved];
    onChange(withRow);
    setFocusTab(nextVisible);
    // Set draft + key after list update so modal always has quote slots to show
    setQuoteDraft(saved);
    setQuoteKey(saved.key);
    setQuoteRound(Math.min(nextVisible, Math.max(1, round)));
  };

  const closeQuote = () => {
    setQuoteKey(null);
    setQuoteDraft(null);
  };

  const editing =
    (quoteKey && rows.find((r) => r.key === quoteKey)) ||
    (quoteKey && quoteDraft?.key === quoteKey ? quoteDraft : null) ||
    null;
  // Prefer draft quotes when parent rows have not flushed the new vendor yet
  const editingSource =
    quoteDraft?.key === quoteKey && quoteDraft
      ? quoteDraft
      : editing;
  const editingQuotes = editingSource
    ? syncQuotes(editingSource.quotes, Math.max(visibleRounds, quoteRound, 1))
    : [];
  const editingQuote = editingQuotes.find((q) => q.round === quoteRound);

  const updateQuote = (key: string, round: number, patch: Partial<FunctionalRfqQuote>) => {
    const patchList = (list: FunctionalRfqVendorRow[]) =>
      list.map((r) =>
        r.key === key
          ? { ...r, quotes: syncQuotes(r.quotes, visibleRounds).map((q) => (q.round === round ? { ...q, ...patch } : q)) }
          : r
      );
    const source = rows.some((r) => r.key === key)
      ? rows
      : quoteDraft?.key === key
        ? [...rows, quoteDraft]
        : rows;
    const next = patchList(source);
    onChange(next);
    const saved = next.find((r) => r.key === key);
    if (saved) setQuoteDraft(saved);
  };

  const openQuotationPreview = async (
    quote: FunctionalRfqQuote,
    target?: { file?: File; saved?: SavedQuotationFile }
  ) => {
    setFileViewError('');
    setFileViewBusy(true);
    try {
      const local = target?.file || localQuoteFiles(quote)[0];
      const saved = target?.saved || savedQuoteFiles(quote)[0];
      const openBlob = (blob: Blob, name: string) => {
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank', 'noopener,noreferrer');
        if (!win) {
          const a = document.createElement('a');
          a.href = url;
          a.download = name || 'quotation';
          a.click();
        }
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      };
      if (local) {
        openBlob(local, local.name);
        return;
      }
      const token = localStorage.getItem('p2p_token');
      let url = '';
      let name = saved?.fileName || quote.savedFileName || 'quotation.pdf';
      if (saved?.id) {
        url = rfqApi.quotationExtraFileUrl(saved.id);
      } else if (quote.savedSubmissionId) {
        url = rfqApi.quotationFileUrl(quote.savedSubmissionId);
      }
      if (!url) {
        setFileViewError('No file to open yet — upload a quotation first');
        return;
      }
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        let message = 'Could not open quotation file';
        try {
          const body = (await res.json()) as { message?: string };
          if (body?.message) message = body.message;
        } catch {
          /* keep */
        }
        throw new Error(message);
      }
      openBlob(await res.blob(), name);
    } catch (err) {
      setFileViewError(err instanceof Error ? err.message : 'Could not open quotation file');
    } finally {
      setFileViewBusy(false);
    }
  };

  const steps = [
    { n: 1, title: 'Add vendors', hint: 'Choose who should quote', done: rows.length > 0 },
    { n: 2, title: 'Get quotes', hint: 'Email them, type a quote, or upload with AI', done: quotedCount > 0 },
    { n: 3, title: 'Pick one vendor', hint: 'Recommend the winner and send for approval', done: Boolean(recommendedKey) },
  ];

  const comparisonRows: RfqQuoteTableRow[] = rows.map((r, i) => {
    const quotes = r.quotes
      .filter((q) => Number.isFinite(Number(q.quotedPrice)) && String(q.quotedPrice).trim() !== '' && Number(q.quotedPrice) >= 0)
      .map((q) => {
        const files = quoteTableFiles(q);
        return {
          round: q.round,
          quotedPrice: Number(q.quotedPrice),
          status: 'submitted' as const,
          quotationFileName: files[0]?.fileName || '',
          quotationFiles: files,
          submissionId: q.savedSubmissionId || null,
        };
      });
    const hasActive = quotes.length > 0;
    const fileQuote =
      r.quotes.find((q) => q.round === (quotes.reduce((max, q) => Math.max(max, q.round), 1))) ||
      r.quotes.find((q) => q.file || q.files?.length || q.savedFileName || q.savedFiles?.length || q.savedSubmissionId) ||
      r.quotes.find((q) => q.round === 1);
    const rowFiles = quoteTableFiles(fileQuote);
    return {
      id: r.key,
      invitationId: i + 1,
      vendorName: r.name,
      inviteMode: 'manual' as const,
      status: hasActive ? 'submitted' : 'draft',
      round: quotes.reduce((max, q) => Math.max(max, q.round), 1),
      hasActiveQuote: hasActive,
      canSendBack: hasActive && quotes.reduce((max, q) => Math.max(max, q.round), 0) < 4,
      isRecommended: recommendedKey === r.key,
      quotationFileName: rowFiles[0]?.fileName,
      quotationFiles: rowFiles,
      quotationSubmissionId: fileQuote?.savedSubmissionId,
      hasLocalQuotationFile: localQuoteFiles(fileQuote).length > 0,
      quotes,
    };
  });

  const confirmRecommend = () => {
    if (!recommendModal) return;
    const text = recommendDraft.trim();
    if (!text) {
      setLocalError('Justification is required to choose a vendor');
      return;
    }
    const row = rows.find((r) => r.key === recommendModal.key);
    if (!row) return;
    setLocalError('');
    onRecommendedChange?.({
      key: row.key,
      vendorId: row.vendorId,
      vendorName: row.name,
      vendorEmail: row.email,
      justification: text,
    });
    setRecommendModal(null);
    showToast(`${row.name} marked as recommended`);
  };

  const nextRequoteRound = (row: FunctionalRfqVendorRow) => {
    const filled = row.quotes.filter((q) => Number(q.quotedPrice) > 0).map((q) => q.round);
    const latest = filled.length ? Math.max(...filled) : 0;
    return Math.min(4, latest + 1 || 1);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {steps.map((s) => {
          const active = guideStep === s.n;
          return (
            <div
              key={s.n}
              className={`${softCard} px-4 py-3.5 ${
                s.done
                  ? 'ring-1 ring-[#90CAF9]/70'
                  : active
                    ? 'ring-2 ring-[#90CAF9]'
                    : ''
              }`}
            >
              <div className="pointer-events-none absolute inset-0" style={softWash} />
              <div className="relative z-[1] flex items-center gap-2.5">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold ${
                    s.done
                      ? 'bg-[#1E88E5] text-white'
                      : active
                        ? 'bg-[#1E88E5] text-white'
                        : 'bg-[#E3F2FD] text-[#1E88E5]'
                  }`}
                >
                  {s.done ? <i className="ri-check-line" /> : s.n}
                </span>
                <p className="text-sm font-semibold text-[#2C3E50]">{s.title}</p>
              </div>
              <p className="relative z-[1] mt-1.5 pl-10 text-xs text-slate-500">{s.hint}</p>
            </div>
          );
        })}
      </div>

      {existingQuoteNote && (
        <div className="rounded-xl border border-transparent bg-[#E3F2FD]/70 px-3.5 py-3 text-sm text-[#1565C0] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.08)]">
          {existingQuoteNote}
        </div>
      )}
      {(localError || error) && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{localError || error}</div>
      )}
      {toast && (
        <div className="rounded-xl border border-transparent bg-[#E3F2FD]/80 px-3.5 py-3 text-sm text-[#1565C0] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.08)]">
          {toast}
        </div>
      )}

      <div className={softCard}>
        <div className="pointer-events-none absolute inset-0" style={softWash} />
        <div className="relative z-[1] border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/40 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1E88E5]">Step 1</p>
          <h2 className="mt-0.5 text-base font-bold text-[#2C3E50]">Add vendors</h2>
          <p className="mt-1 text-sm text-slate-500">
            Type and select a vendor — a popup opens for quoted amount and quotation file.
          </p>
        </div>

        <div className="relative z-[1] space-y-4 p-5">
        {rows.length > 0 && (
          <div className="space-y-2.5">
            {rows.map((row) => {
              const round1 = row.quotes.find((q) => q.round === 1);
              const hasQuote =
                Number(round1?.quotedPrice) >= 0 &&
                String(round1?.quotedPrice || '').trim() !== '' &&
                quoteHasQuotationFile(round1);
              return (
                <div
                  key={row.key}
                  className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-transparent bg-white px-3.5 py-3 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] transition-[border-color] hover:border-[#90CAF9] sm:rounded-[18px]"
                >
                  <div className="pointer-events-none absolute inset-0" style={softWash} />
                  <span className="relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E3F2FD] text-[#1E88E5]">
                    <i className="ri-store-2-line" />
                  </span>
                  <div className="relative z-[1] min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#2C3E50]">{row.name || 'Vendor'}</p>
                    <p className="truncate text-xs text-slate-500">
                      {row.email || 'No email on file'}
                      {hasQuote ? ` · ${moneyFmt(Number(round1?.quotedPrice))}` : ' · Quote pending'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openQuote(row, 1)}
                    className="relative z-[1] cursor-pointer rounded-xl bg-[#1E88E5] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1565C0]"
                  >
                    {hasQuote ? 'Edit' : 'Quote'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(rows.filter((x) => x.key !== row.key))}
                    className="relative z-[1] cursor-pointer px-2 text-sm text-slate-400 transition-colors hover:text-rose-500"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Search vendor</label>
          <VendorSearchSelect
            vendors={vendors}
            value={searchVendorId}
            takenIds={takenIds}
            onChange={(id) => {
              setSearchVendorId(id);
              if (!id) return;
              const v = vendors.find((x) => String(x.id) === String(id));
              if (!v) return;
              // Selecting a vendor immediately opens quote popup (amount + file)
              addVendorAndOpenQuote({
                id: String(v.id),
                name: v.name,
                email: v.email || '',
              });
            }}
            placeholder="Type name, vendor code, or email — then enter quote"
            emptyHint="No match. Use Create new to add them to Vendor Master."
          />
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-[#1E88E5] hover:text-[#1565C0]"
          >
            <i className="ri-user-add-line" />
            Vendor not in the list? Create new
          </button>
        </div>

        <p className="text-sm font-semibold text-[#2C3E50]">Or choose how to add the quote</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => {
              if (!selectedSearch) {
                setLocalError('Search and select a vendor first');
                return;
              }
              addVendorAndOpenQuote({
                id: String(selectedSearch.id),
                name: selectedSearch.name,
                email: selectedSearch.email || '',
              });
            }}
            className="relative cursor-pointer overflow-hidden rounded-2xl border border-transparent bg-white p-4 text-left shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] transition-[border-color,box-shadow] hover:border-[#90CAF9] hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.16)] sm:rounded-[18px]"
          >
            <div className="pointer-events-none absolute inset-0" style={softWash} />
            <span className="relative z-[1] mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#E3F2FD] text-[#1E88E5]">
              <i className="ri-mail-send-line" />
            </span>
            <p className="relative z-[1] text-sm font-bold text-[#2C3E50]">Email the vendor</p>
            <p className="relative z-[1] mt-1 text-xs text-slate-500">Add them and attach the quote amount + file now.</p>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selectedSearch) {
                setLocalError('Search and select a vendor first');
                return;
              }
              addVendorAndOpenQuote({
                id: String(selectedSearch.id),
                name: selectedSearch.name,
                email: selectedSearch.email || '',
              });
            }}
            className="relative cursor-pointer overflow-hidden rounded-2xl border border-transparent bg-white p-4 text-left shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] transition-[border-color,box-shadow] hover:border-[#90CAF9] hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.16)] sm:rounded-[18px]"
          >
            <div className="pointer-events-none absolute inset-0" style={softWash} />
            <span className="relative z-[1] mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E88E5] text-white">
              <i className="ri-edit-line" />
            </span>
            <p className="relative z-[1] text-sm font-bold text-[#2C3E50]">I will type the quote</p>
            <p className="relative z-[1] mt-1 text-xs text-slate-500">Opens popup for quoted amount and quotation file upload.</p>
          </button>
          <button
            type="button"
            onClick={() => {
              setLocalError('');
              if (selectedSearch) {
                const added = commitVendor({
                  id: String(selectedSearch.id),
                  name: selectedSearch.name,
                  email: selectedSearch.email || '',
                });
                applyRows(added.nextRows);
                setSearchVendorId('');
                openRfqChat({ vendor: selectedSearch });
                return;
              }
              openRfqChat();
            }}
            className="relative cursor-pointer overflow-hidden rounded-2xl border border-transparent bg-white p-4 text-left shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] transition-[border-color,box-shadow] hover:border-[#90CAF9] hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.16)] sm:rounded-[18px]"
          >
            <div className="pointer-events-none absolute inset-0" style={softWash} />
            <span className="relative z-[1] mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-white">
              <i className="ri-robot-2-line" />
            </span>
            <p className="relative z-[1] text-sm font-bold text-[#2C3E50]">Upload with AI</p>
            <p className="relative z-[1] mt-1 text-xs text-slate-500">Chat asks the vendor name, then you upload the quotation file.</p>
          </button>
        </div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className={`${softCard} px-5 py-4`}>
            <div className="pointer-events-none absolute inset-0" style={softWash} />
            <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1E88E5]">Step 2 &amp; 3</p>
                <h2 className="mt-0.5 text-base font-bold text-[#2C3E50]">Get quotes and pick a vendor</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Switch tabs to edit each round. Click the <strong>×</strong> on Q2/Q3/Q4 to delete that round only (vendors stay). <strong>Remove vendor</strong> deletes that vendor and all their rounds.
                </p>
              </div>
              <span className="rounded-full bg-[#E3F2FD] px-3 py-1.5 text-xs font-semibold text-[#1E88E5]">
                {quotedCount} of {rows.length} quotes received
              </span>
            </div>
          </div>
          <RfqVendorQuoteTable
            rows={comparisonRows}
            currency={moneyCode}
            recommendedId={
              recommendedKey
                ? comparisonRows.find((r) => r.id === recommendedKey)?.invitationId ?? null
                : null
            }
            quotedCount={quotedCount}
            maxRounds={visibleRounds}
            roundCeiling={4}
            preferredTab={focusTab}
            onNextRound={(next) => {
              const capped = Math.min(4, Math.max(1, Number(next) || 1));
              if (capped > visibleRounds) {
                onMaxRoundsChange(capped);
                onChange(rows.map((r) => ({ ...r, quotes: syncQuotes(r.quotes, capped) })));
              }
              setFocusTab(capped);
            }}
            onRemoveRound={removeRound}
            onEdit={(tableRow, targetRound) => {
              const row = rows.find((r) => r.key === tableRow.id);
              if (!row) return;
              openQuote(row, Math.min(4, Math.max(1, Number(targetRound) || 1)));
            }}
            onChoose={(tableRow) => {
              const row = rows.find((r) => r.key === tableRow.id);
              if (!row || !tableRow.hasActiveQuote) return;
              setRecommendDraft(
                recommendedKey === row.key ? recommendationJustification : ''
              );
              setRecommendModal({ key: row.key, vendorName: row.name });
              setLocalError('');
            }}
            onViewFile={(tableRow) => {
              const row = rows.find((r) => r.key === tableRow.id);
              if (!row) return;
              const sid = Number(tableRow.quotationSubmissionId || tableRow.submissionId) || 0;
              const extraId = Number(tableRow.quotationExtraFileId) || 0;
              const named = String(tableRow.quotationFileName || '');
              const quote =
                (sid ? row.quotes.find((q) => Number(q.savedSubmissionId) === sid) : null) ||
                row.quotes.find((q) => localQuoteFiles(q).some((f) => f.name === named)) ||
                row.quotes.find((q) => savedQuoteFiles(q).some((f) => f.fileName === named || Number(f.id) === extraId)) ||
                row.quotes.find((q) => q.file || q.files?.length || q.savedSubmissionId || q.savedFileName || q.savedFiles?.length) ||
                row.quotes.find((q) => q.round === 1);
              if (!quote) {
                setFileViewError('No quotation file to open');
                return;
              }
              if (extraId) {
                const saved = savedQuoteFiles(quote).find((f) => Number(f.id) === extraId);
                void openQuotationPreview(quote, { saved: saved || { id: extraId, fileName: named } });
                return;
              }
              const local = localQuoteFiles(quote).find((f) => f.name === named);
              if (local) {
                void openQuotationPreview(quote, { file: local });
                return;
              }
              const saved = savedQuoteFiles(quote).find((f) => f.fileName === named);
              void openQuotationPreview(quote, saved ? { saved } : undefined);
            }}
            onRemove={(tableRow) => {
              onChange(rows.filter((r) => r.key !== tableRow.id));
              if (recommendedKey === tableRow.id) {
                onRecommendedChange?.({ key: null, justification: '' });
              }
            }}
            onSendBack={(tableRow) => {
              const row = rows.find((r) => r.key === tableRow.id);
              if (!row) return;
              const next = nextRequoteRound(row);
              if (next > 4) {
                showToast('All four rounds are already in use. Edit the latest round to update it.');
                openQuote(row, 4);
                return;
              }
              openQuote(row, next);
              showToast(`Round Q${next} added. Enter the re-quote for ${row.name}.`);
            }}
          />
        </div>
      )}

      {editingSource && editingQuote && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)] sm:rounded-[18px]">
            <div className="pointer-events-none absolute inset-0" style={softWash} />
            <div className="relative z-[1] flex items-center justify-between border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/40 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-[#2C3E50]">
                  Enter quote — {editingSource.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Upload the quotation file and enter the quoted amount (required for round 1).
                </p>
              </div>
              <button type="button" onClick={closeQuote} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-slate-500 hover:bg-[#E3F2FD] hover:text-[#1E88E5]">
                ×
              </button>
            </div>
            <div className="relative z-[1] flex-1 space-y-5 overflow-y-auto p-5">
              <div className="flex flex-wrap items-center gap-2">
                {editingQuotes.map((q) => (
                  <button
                    key={q.round}
                    type="button"
                    onClick={() => setQuoteRound(q.round)}
                    className={`cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                      quoteRound === q.round
                        ? 'bg-[#1E88E5] text-white'
                        : 'border border-transparent bg-white text-slate-600 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.08)] hover:border-[#90CAF9]'
                    }`}
                  >
                    Round {q.round}
                    {q.round === 1 ? ' *' : ''}
                  </button>
                ))}
                {quoteRound > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const r = quoteRound;
                      removeRound(r);
                      closeQuote();
                    }}
                    className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100"
                  >
                    <i className="ri-delete-bin-line" />
                    Delete round {quoteRound} only
                  </button>
                )}
              </div>
              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Quotation files {quoteRound === 1 ? <span className="text-rose-500">*</span> : null}
                </p>
                {(() => {
                  const locals = localQuoteFiles(editingQuote);
                  const saved = savedQuoteFiles(editingQuote);
                  const hasAny = locals.length + saved.length > 0;
                  return (
                    <>
                <label
                  className={`flex cursor-pointer flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-3.5 sm:rounded-[18px] ${
                    hasAny
                      ? 'border-[#90CAF9] bg-[#E3F2FD]/40 hover:bg-[#E3F2FD]/70'
                      : 'border-rose-200 bg-rose-50/40 hover:bg-rose-50/70'
                  }`}
                >
                  <i
                    className={`shrink-0 text-xl ${
                      hasAny ? 'ri-upload-2-line text-[#1E88E5]' : 'ri-upload-cloud-2-line text-rose-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${hasAny ? 'text-[#1565C0]' : 'text-rose-700'}`}>
                      {hasAny
                        ? `Add more files (${locals.length + saved.length} attached)`
                        : 'Upload quotation files (required)'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">PDF, Word, Excel, or photo · you can select multiple</p>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                    className="max-w-full text-xs"
                    onChange={(e) => {
                      const picked = Array.from(e.target.files || []);
                      e.target.value = '';
                      if (!picked.length) return;
                      const nextFiles = [...locals, ...picked];
                      updateQuote(editing.key, quoteRound, {
                        files: nextFiles,
                        file: nextFiles[0] || null,
                      });
                      setFileViewError('');
                    }}
                  />
                </label>
                {(saved.length > 0 || locals.length > 0) && (
                  <ul className="mt-2 space-y-1.5">
                    {saved.map((sf, idx) => (
                      <li
                        key={`saved-${sf.id || sf.fileName}-${idx}`}
                        className="flex items-center gap-2 rounded-xl border border-transparent bg-[#E3F2FD]/50 px-3 py-2 text-xs shadow-[0_8px_24px_-12px_rgba(15,23,42,0.06)]"
                      >
                        <i className="ri-file-check-line shrink-0 text-[#1E88E5]" />
                        <span className="min-w-0 flex-1 truncate font-medium text-[#1565C0]" title={sf.fileName}>
                          {sf.fileName}
                        </span>
                        <button
                          type="button"
                          disabled={fileViewBusy || (!sf.id && !editingQuote.savedSubmissionId)}
                          onClick={() => void openQuotationPreview(editingQuote, { saved: sf })}
                          className="cursor-pointer font-semibold text-[#1E88E5] hover:underline disabled:opacity-50"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const nextSaved = saved.filter((_, i) => i !== idx);
                            updateQuote(editing.key, quoteRound, {
                              savedFiles: nextSaved,
                              savedFileName: nextSaved[0]?.fileName,
                            });
                          }}
                          className="cursor-pointer text-slate-400 hover:text-rose-500"
                          title="Remove"
                        >
                          <i className="ri-close-line" />
                        </button>
                      </li>
                    ))}
                    {locals.map((lf, idx) => (
                      <li
                        key={`local-${lf.name}-${idx}`}
                        className="flex items-center gap-2 rounded-xl border border-transparent bg-white px-3 py-2 text-xs shadow-[0_8px_24px_-12px_rgba(15,23,42,0.08)]"
                      >
                        <i className="ri-file-add-line shrink-0 text-slate-500" />
                        <span className="min-w-0 flex-1 truncate font-medium text-slate-800" title={lf.name}>
                          {lf.name}
                        </span>
                        <span className="text-[10px] text-slate-400">New</span>
                        <button
                          type="button"
                          onClick={() => void openQuotationPreview(editingQuote, { file: lf })}
                          className="cursor-pointer font-semibold text-[#1E88E5] hover:underline"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const nextFiles = locals.filter((_, i) => i !== idx);
                            updateQuote(editing.key, quoteRound, {
                              files: nextFiles,
                              file: nextFiles[0] || null,
                            });
                          }}
                          className="cursor-pointer text-slate-400 hover:text-rose-500"
                          title="Remove"
                        >
                          <i className="ri-close-line" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                    </>
                  );
                })()}
                {fileViewError ? (
                  <p className="mt-2 flex items-center gap-1 text-xs text-rose-600">
                    <i className="ri-error-warning-line" />
                    {fileViewError}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Quoted price ({moneySym}) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingQuote.quotedPrice}
                    onChange={(e) => updateQuote(editing.key, quoteRound, { quotedPrice: e.target.value })}
                    className="box-border h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Lead time (days)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingQuote.leadTime}
                    onChange={(e) => updateQuote(editing.key, quoteRound, { leadTime: e.target.value })}
                    className="box-border h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Payment terms</label>
                  <select
                    value={editingQuote.paymentTerms}
                    onChange={(e) => updateQuote(editing.key, quoteRound, { paymentTerms: e.target.value })}
                    className="box-border h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/30"
                  >
                    <option value="">Select</option>
                    {PR_PAYMENT_TERM_OPTIONS.map((term) => (
                      <option key={term} value={term}>{term}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="relative z-[1] flex justify-end gap-2 border-t border-slate-100/80 px-5 py-4">
              <button
                type="button"
                onClick={closeQuote}
                className="cursor-pointer rounded-xl border border-transparent bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  if (quoteRound === 1 && !(Number.isFinite(Number(editingQuote.quotedPrice)) && Number(editingQuote.quotedPrice) >= 0 && editingQuote.quotedPrice !== '')) {
                    setLocalError('Round 1 needs a quoted price (0 is allowed)');
                    return;
                  }
                  if (quoteRound === 1 && !quoteHasQuotationFile(editingQuote) && !existingQuoteNote) {
                    setLocalError('Round 1 needs a quotation file');
                    return;
                  }
                  setLocalError('');
                  closeQuote();
                  showToast(`Quote saved for ${editingSource.name}`);
                }}
                className="cursor-pointer rounded-xl bg-[#1E88E5] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1565C0]"
              >
                Save quote + file
              </button>
            </div>
          </div>
        </div>
      )}

      {recommendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)] sm:rounded-[18px]">
            <div className="pointer-events-none absolute inset-0" style={softWash} />
            <div className="relative z-[1] flex items-center justify-between border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/40 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-[#2C3E50]">Choose this vendor</h3>
                <p className="mt-0.5 text-xs text-slate-500">{recommendModal.vendorName}</p>
              </div>
              <button
                type="button"
                onClick={() => setRecommendModal(null)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-slate-500 hover:bg-[#E3F2FD] hover:text-[#1E88E5]"
              >
                ×
              </button>
            </div>
            <div className="relative z-[1] space-y-3 p-5">
              <label className="block text-sm font-semibold text-[#2C3E50]">
                Why this vendor? <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={recommendDraft}
                onChange={(e) => setRecommendDraft(e.target.value)}
                rows={4}
                placeholder="Example: Lowest price and delivery in 10 days"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/30"
              />
              <p className="text-xs text-slate-500">
                Saved with the draft. Managers will see this reason.
              </p>
              {localError && <p className="text-xs text-rose-600">{localError}</p>}
            </div>
            <div className="relative z-[1] flex justify-end gap-2 border-t border-slate-100/80 px-5 py-4">
              <button
                type="button"
                onClick={() => setRecommendModal(null)}
                className="cursor-pointer rounded-xl border border-transparent bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRecommend}
                className="cursor-pointer rounded-xl bg-[#1E88E5] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1565C0]"
              >
                Confirm choose
              </button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-transparent bg-white p-6 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)] sm:rounded-[18px]">
            <div className="pointer-events-none absolute inset-0" style={softWash} />
            <div className="relative z-[1]">
            <CreateVendorForm
              compact
              onSuccess={(vendor) => {
                setCreateOpen(false);
                onVendorsRefresh?.(vendor);
                if (vendor) {
                  addVendorAndOpenQuote({
                    id: String(vendor.id),
                    name: vendor.name,
                    email: vendor.email || '',
                  });
                }
              }}
              onCancel={() => setCreateOpen(false)}
            />
            </div>
          </div>
        </div>
      )}


      <RfqChatbot
        prNumber={prNumber}
        vendors={vendors}
        tableRows={rows.map((r, i) => ({
          invitationId: i + 1,
          vendorName: r.name,
          hasActiveQuote: Number(r.quotes.find((q) => q.round === 1)?.quotedPrice) > 0,
        }))}
        lineItems={[]}
        onRefresh={() => undefined}
        onToast={showToast}
        hideFab
        onLocalSave={async ({ vendor, file, quotedPrice }) => {
          const master = vendors.find(
            (v) =>
              String(v.id) === String(vendor.id || '') ||
              v.name.toLowerCase() === vendor.name.toLowerCase()
          );
          const id = master ? String(master.id) : vendor.id || `manual-${Date.now()}`;
          const existing = rows.find((r) => r.vendorId === id || r.name.toLowerCase() === vendor.name.toLowerCase());
          const targetRound = existing ? nextRequoteRound(existing) : 1;
          const nextVisible = Math.min(4, Math.max(visibleRounds, targetRound));
          onMaxRoundsChange(nextVisible);
          setFocusTab(nextVisible);
          const nextQuotes = syncQuotes(existing?.quotes || emptyQuotes(nextVisible), nextVisible).map((q) =>
            q.round === targetRound
              ? {
                  ...q,
                  quotedPrice: String(quotedPrice),
                  file,
                  files: [file],
                  paymentTerms: q.paymentTerms || 'Net 30 Days',
                }
              : q
          );
          if (existing) {
            onChange(rows.map((r) => ({
              ...r,
              quotes: r.key === existing.key ? nextQuotes : syncQuotes(r.quotes, nextVisible),
              email: r.key === existing.key ? vendor.email || r.email : r.email,
            })));
          } else {
            onChange([
              ...rows.map((r) => ({ ...r, quotes: syncQuotes(r.quotes, nextVisible) })),
              {
                ...newFunctionalRfqVendorRow(nextVisible),
                vendorId: id,
                name: master?.name || vendor.name,
                email: master?.email || vendor.email,
                quotes: nextQuotes,
              },
            ]);
          }
        }}
      />
    </div>
  );
}
