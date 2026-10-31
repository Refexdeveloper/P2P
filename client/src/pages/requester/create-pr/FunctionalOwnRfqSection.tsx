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
  return [...saved, ...locals].filter((f) => f.fileName).filter((f, index, all) => {
    const key = f.fileName.trim().toLowerCase();
    return all.findIndex((item) => item.fileName.trim().toLowerCase() === key) === index;
  });
}

export function filesFromSubmission(sub?: {
  id?: number;
  quotationFileName?: string;
  quotationFiles?: Array<{ id?: number | null; fileName?: string; isPrimary?: boolean }>;
}): SavedQuotationFile[] {
  const extra = Array.isArray(sub?.quotationFiles) ? sub.quotationFiles : [];
  if (extra.length) {
    const seen = new Set<string>();
    return extra
      .map((f, i) => ({
        id: f.id ?? null,
        fileName: String(f.fileName || ''),
        isPrimary: Boolean(f.isPrimary ?? i === 0),
      }))
      .filter((f) => {
        const key = f.fileName.trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
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
    const slotCount = Math.min(4, Math.max(visibleRounds, round, 1));
    if (slotCount > visibleRounds) onMaxRoundsChange(slotCount);
    const patchList = (list: FunctionalRfqVendorRow[]) =>
      list.map((r) =>
        r.key === key
          ? { ...r, quotes: syncQuotes(r.quotes, slotCount).map((q) => (q.round === round ? { ...q, ...patch } : q)) }
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
    const filled = row.quotes
      .filter((q) => String(q.quotedPrice ?? '').trim() !== '' && Number(q.quotedPrice) >= 0)
      .map((q) => q.round);
    const latest = filled.length ? Math.max(...filled) : 0;
    return Math.min(4, latest + 1);
  };

  const pendingNames = rows
    .filter((r) => {
      const q1 = r.quotes.find((q) => q.round === 1);
      return !(
        Number(q1?.quotedPrice) >= 0 &&
        String(q1?.quotedPrice || '').trim() !== '' &&
        quoteHasQuotationFile(q1)
      );
    })
    .map((r) => r.name || 'Vendor');
  const recommendedName = rows.find((r) => r.key === recommendedKey)?.name || '';
  const stepStatus = [
    rows.length ? `${rows.length} vendor${rows.length === 1 ? '' : 's'} added` : 'No vendors yet',
    rows.length ? `${quotedCount} of ${rows.length} quotes entered` : 'Waiting for vendors',
    recommendedName ? `${recommendedName} chosen` : 'Not chosen yet',
  ];
  const activeStep = steps.find((s) => !s.done)?.n ?? 0;
  const nextHint =
    rows.length === 0
      ? 'Search for a vendor below and select them. A form opens to enter their price.'
      : pendingNames.length > 0
        ? `Enter the quote for ${pendingNames.slice(0, 2).join(', ')}${
            pendingNames.length > 2 ? ` and ${pendingNames.length - 2} more` : ''
          } — click "Add quote" next to the vendor.`
        : !recommendedKey
          ? 'All Q1 quotes are in. Compare them below, use Next round for a revised Q2 price, then click Choose.'
          : `${recommendedName} is selected. You can continue to the next step.`;

  const handleQuoteFiles = (picked: File[]) => {
    if (!picked.length || !editing) return;
    const nextFiles = [...localQuoteFiles(editingQuote), ...picked];
    updateQuote(editing.key, quoteRound, {
      files: nextFiles,
      file: nextFiles[0] || null,
    });
    setFileViewError('');
  };

  return (
    <div className="vr-root space-y-4">
      {/* ── How it works ── */}
      <div className="vr-guide">
        <div className="vr-guide-head">
          <span className="vr-guide-ic">
            <i className="ri-lightbulb-flash-line" />
          </span>
          <div className="min-w-0">
            <h3>Collect vendor quotes in 3 simple steps</h3>
            <p>Add the vendors you asked for a price, enter what each one quoted, then pick the best one.</p>
          </div>
        </div>
        <ol className="vr-steps">
          {steps.map((s, i) => (
            <li
              key={s.n}
              className={`vr-step${s.done ? ' is-done' : ''}${activeStep === s.n ? ' is-active' : ''}`}
            >
              <span className="vr-step-no">{s.done ? <i className="ri-check-line" /> : s.n}</span>
              <div className="min-w-0">
                <p className="vr-step-title">
                  {s.n === 1 ? 'Add vendors' : s.n === 2 ? 'Enter their quotes' : 'Choose the winner'}
                </p>
                <p className="vr-step-status">{stepStatus[i]}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className={`vr-next${activeStep === 0 ? ' is-done' : ''}`}>
          <i className={activeStep === 0 ? 'ri-checkbox-circle-fill' : 'ri-arrow-right-circle-fill'} />
          <span>
            <b>{activeStep === 0 ? 'All done: ' : 'Next: '}</b>
            {nextHint}
          </span>
        </div>
      </div>

      {existingQuoteNote && (
        <div className="vr-banner info">
          <i className="ri-information-line" />
          <span>{existingQuoteNote}</span>
        </div>
      )}
      {(localError || error) && (
        <div className="vr-banner error">
          <i className="ri-error-warning-line" />
          <span>{localError || error}</span>
        </div>
      )}
      {toast && (
        <div className="vr-banner success">
          <i className="ri-checkbox-circle-line" />
          <span>{toast}</span>
        </div>
      )}

      {/* ── Step 1: add vendors ── */}
      <div className="vr-card">
        <div className="vr-card-head">
          <span className="vr-badge">1</span>
          <div className="min-w-0">
            <h2>Add vendors and their quotes</h2>
            <p>Search a vendor and select them — a form opens where you enter their price and attach the quotation file.</p>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="vr-search">
            <label className="vr-label">
              <i className="ri-search-line" /> Find a vendor
            </label>
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
              placeholder="Type vendor name, code or email…"
              emptyHint="No match. Use Create new to add them to Vendor Master."
            />
            <div className="vr-alt">
              <button type="button" onClick={() => setCreateOpen(true)} className="vr-alt-btn">
                <i className="ri-user-add-line" />
                <span>
                  <b>Vendor not in the list?</b>
                  <small>Create a new vendor</small>
                </span>
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
                className="vr-alt-btn ai"
              >
                <i className="ri-robot-2-line" />
                <span>
                  <b>Have the quotation file?</b>
                  <small>Upload it and let AI fill in the price</small>
                </span>
              </button>
            </div>
          </div>

          {rows.length > 0 ? (
            <div className="space-y-2.5">
              <p className="vr-label">
                <i className="ri-store-2-line" /> Vendors added ({rows.length})
              </p>
              {rows.map((row, idx) => {
                const round1 = row.quotes.find((q) => q.round === 1);
                const priced = row.quotes.filter(
                  (q) => String(q.quotedPrice ?? '').trim() !== '' && Number(q.quotedPrice) >= 0
                );
                const hasQuote =
                  Number(round1?.quotedPrice) >= 0 &&
                  String(round1?.quotedPrice || '').trim() !== '' &&
                  quoteHasQuotationFile(round1);
                const fileCount = localQuoteFiles(round1).length + savedQuoteFiles(round1).length;
                const editRound = Math.min(4, Math.max(1, focusTab || 1));
                return (
                  <div key={row.key} className={`vr-vendor${hasQuote ? ' is-quoted' : ''}`}>
                    <span className="vr-vendor-no">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="vr-vendor-name">
                        {row.name || 'Vendor'}
                        {recommendedKey === row.key ? (
                          <span className="vr-pill chosen">
                            <i className="ri-award-line" /> Chosen
                          </span>
                        ) : null}
                      </p>
                      <p className="vr-vendor-meta">{row.email || 'No email on file'}</p>
                    </div>
                    <span className={`vr-pill ${hasQuote ? 'ok' : 'wait'}`}>
                      {hasQuote ? (
                        <>
                          <i className="ri-checkbox-circle-fill" />
                          {priced
                            .map((q) => `Q${q.round} ${moneyFmt(Number(q.quotedPrice))}`)
                            .join(' · ') || moneyFmt(Number(round1?.quotedPrice))}
                          {fileCount > 0 ? ` · ${fileCount} file${fileCount === 1 ? '' : 's'}` : ''}
                        </>
                      ) : (
                        <>
                          <i className="ri-time-line" /> Waiting for quote
                        </>
                      )}
                    </span>
                    <div className="vr-vendor-acts">
                      <button
                        type="button"
                        onClick={() => openQuote(row, hasQuote ? editRound : 1)}
                        className={`vr-btn sm ${hasQuote ? 'ghost' : 'primary'}`}
                      >
                        <i className={hasQuote ? 'ri-edit-line' : 'ri-add-line'} />
                        {hasQuote ? (visibleRounds > 1 ? `Edit Q${editRound}` : 'Edit quote') : 'Add quote'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onChange(rows.filter((x) => x.key !== row.key))}
                        className="vr-icon-btn danger"
                        title="Remove this vendor"
                        aria-label="Remove this vendor"
                      >
                        <i className="ri-delete-bin-line" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="vr-empty">
              <i className="ri-store-2-line" />
              <p>No vendors added yet</p>
              <small>Use the search above to add the first vendor.</small>
            </div>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="vr-card">
            <div className="vr-card-head">
              <span className="vr-badge">2</span>
              <div className="min-w-0 flex-1">
                <h2>Compare quotes and choose the winner</h2>
                <p>
                  Q1 is the first quote. Use Next round to add Q2 when a vendor revises the price, then choose the winner.
                </p>
              </div>
              <span className="vr-count">
                {quotedCount} of {rows.length} quotes entered
              </span>
            </div>
            <div className="vr-tips">
              <div className="vr-tip">
                <span className="vr-tip-ic">
                  <i className="ri-edit-line" />
                </span>
                <div>
                  <b>Edit</b>
                  <small>Change the price or quotation file.</small>
                </div>
              </div>
              <div className="vr-tip green">
                <span className="vr-tip-ic">
                  <i className="ri-award-line" />
                </span>
                <div>
                  <b>Choose</b>
                  <small>Pick the winning vendor and write a short reason.</small>
                </div>
              </div>
              <div className="vr-tip red">
                <span className="vr-tip-ic">
                  <i className="ri-delete-bin-line" />
                </span>
                <div>
                  <b>Remove</b>
                  <small>Takes that vendor off this quotation.</small>
                </div>
              </div>
            </div>
          </div>
            <RfqVendorQuoteTable
            rows={comparisonRows}
            currency={moneyCode}
            maxRounds={visibleRounds}
            roundCeiling={4}
            recommendedId={
              recommendedKey
                ? comparisonRows.find((r) => r.id === recommendedKey)?.invitationId ?? null
                : null
            }
            quotedCount={quotedCount}
            preferredTab={focusTab}
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
            onNextRound={(next) => {
              applyRows(rows, Math.min(4, Math.max(1, Number(next) || visibleRounds + 1)));
            }}
            onRemoveRound={removeRound}
            onSendBack={(tableRow) => {
              const row = rows.find((r) => r.key === tableRow.id);
              if (!row) return;
              openQuote(row, nextRequoteRound(row));
            }}
          />
        </div>
      )}

      {editingSource && editingQuote && (
        <div className="vr-modal-wrap fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="vr-modal relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden">
            <div className="vr-modal-head">
              <span className="vr-modal-ic">
                <i className="ri-price-tag-3-line" />
              </span>
              <div className="min-w-0 flex-1">
                <h3>Quote from {editingSource.name}</h3>
                <p>Round Q{quoteRound}. Enter the price this vendor quoted and attach their quotation file.</p>
              </div>
              <button type="button" onClick={closeQuote} className="vr-icon-btn" aria-label="Close">
                <i className="ri-close-line" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {Math.max(visibleRounds, quoteRound) > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: Math.min(4, Math.max(visibleRounds, quoteRound)) }, (_, i) => i + 1).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setQuoteRound(r)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                        quoteRound === r
                          ? 'bg-[#1E88E5] text-white'
                          : 'bg-[#E3F2FD] text-[#1565C0] hover:bg-[#BBDEFB]'
                      }`}
                    >
                      Q{r}
                    </button>
                  ))}
                </div>
              )}
              {/* File */}
              <section>
                <p className="vr-sec-title">
                  <span>1</span> Quotation file <em>Required</em>
                </p>
                {(() => {
                  const locals = localQuoteFiles(editingQuote);
                  const saved = savedQuoteFiles(editingQuote);
                  const hasAny = locals.length + saved.length > 0;
                  return (
                    <>
                      <label
                        className={`vr-drop${hasAny ? ' has-files' : ''}${!hasAny ? ' is-required' : ''}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleQuoteFiles(Array.from(e.dataTransfer.files || []));
                        }}
                      >
                        <span className="vr-drop-ic">
                          <i className={hasAny ? 'ri-file-add-line' : 'ri-upload-cloud-2-line'} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="vr-drop-title">
                            {hasAny
                              ? `Add more files (${locals.length + saved.length} attached)`
                              : 'Drop the quotation here or click to upload'}
                          </p>
                          <p className="vr-drop-sub">PDF, Word, Excel or photo · you can select multiple files</p>
                        </div>
                        <span className="vr-btn sm ghost">
                          <i className="ri-folder-open-line" /> Browse
                        </span>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                          className="sr-only"
                          onChange={(e) => {
                            const picked = Array.from(e.target.files || []);
                            e.target.value = '';
                            handleQuoteFiles(picked);
                          }}
                        />
                      </label>
                      {(saved.length > 0 || locals.length > 0) && (
                        <ul className="mt-2 space-y-1.5">
                          {saved.map((sf, idx) => (
                            <li key={`saved-${sf.id || sf.fileName}-${idx}`} className="vr-file">
                              <i className="ri-file-check-line vr-file-ic" />
                              <span className="vr-file-name" title={sf.fileName}>
                                {sf.fileName}
                              </span>
                              <span className="vr-file-tag">Saved</span>
                              <button
                                type="button"
                                disabled={fileViewBusy || (!sf.id && !editingQuote.savedSubmissionId)}
                                onClick={() => void openQuotationPreview(editingQuote, { saved: sf })}
                                className="vr-link"
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
                                className="vr-icon-btn danger xs"
                                title="Remove"
                              >
                                <i className="ri-close-line" />
                              </button>
                            </li>
                          ))}
                          {locals.map((lf, idx) => (
                            <li key={`local-${lf.name}-${idx}`} className="vr-file">
                              <i className="ri-file-text-line vr-file-ic" />
                              <span className="vr-file-name" title={lf.name}>
                                {lf.name}
                              </span>
                              <span className="vr-file-tag new">New</span>
                              <button
                                type="button"
                                onClick={() => void openQuotationPreview(editingQuote, { file: lf })}
                                className="vr-link"
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
                                className="vr-icon-btn danger xs"
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
              </section>

              {/* Price */}
              <section>
                <p className="vr-sec-title">
                  <span>2</span> Price details
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="vr-field-label">
                      Quoted price <span className="text-rose-500">*</span>
                    </label>
                    <div className="vr-input-wrap">
                      <span className="vr-prefix">{moneySym}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editingQuote.quotedPrice}
                        placeholder="0.00"
                        onChange={(e) => updateQuote(editing.key, quoteRound, { quotedPrice: e.target.value })}
                        className="vr-input has-prefix"
                      />
                    </div>
                    <small className="vr-field-help">Total amount the vendor quoted</small>
                  </div>
                  <div>
                    <label className="vr-field-label">Delivery time</label>
                    <div className="vr-input-wrap">
                      <input
                        type="number"
                        min="0"
                        value={editingQuote.leadTime}
                        placeholder="e.g. 15"
                        onChange={(e) => updateQuote(editing.key, quoteRound, { leadTime: e.target.value })}
                        className="vr-input has-suffix"
                      />
                      <span className="vr-suffix">days</span>
                    </div>
                    <small className="vr-field-help">Optional</small>
                  </div>
                  <div>
                    <label className="vr-field-label">Payment terms</label>
                    <select
                      value={editingQuote.paymentTerms}
                      onChange={(e) => updateQuote(editing.key, quoteRound, { paymentTerms: e.target.value })}
                      className="vr-input"
                    >
                      <option value="">Select</option>
                      {PR_PAYMENT_TERM_OPTIONS.map((term) => (
                        <option key={term} value={term}>{term}</option>
                      ))}
                    </select>
                    <small className="vr-field-help">Optional</small>
                  </div>
                </div>
              </section>
              {localError ? (
                <div className="vr-banner error">
                  <i className="ri-error-warning-line" />
                  <span>{localError}</span>
                </div>
              ) : null}
            </div>

            <div className="vr-modal-foot">
              <span className="vr-foot-note">
                <span className="text-rose-500">*</span> Round Q{quoteRound} needs a price and a file
              </span>
              <button type="button" onClick={closeQuote} className="vr-btn ghost">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!(Number.isFinite(Number(editingQuote.quotedPrice)) && Number(editingQuote.quotedPrice) >= 0 && String(editingQuote.quotedPrice ?? '').trim() !== '')) {
                    setLocalError(`Round Q${quoteRound} needs a quoted price (0 is allowed)`);
                    return;
                  }
                  if (!quoteHasQuotationFile(editingQuote) && !(quoteRound === 1 && existingQuoteNote)) {
                    setLocalError(`Round Q${quoteRound} needs a quotation file`);
                    return;
                  }
                  setLocalError('');
                  closeQuote();
                  showToast(`Quote saved for ${editingSource.name}`);
                }}
                className="vr-btn primary"
              >
                <i className="ri-check-line" />
                Save quote
              </button>
            </div>
          </div>
        </div>
      )}

      {recommendModal && (
        <div className="vr-modal-wrap fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="vr-modal relative w-full max-w-lg overflow-hidden">
            <div className="vr-modal-head">
              <span className="vr-modal-ic green">
                <i className="ri-award-line" />
              </span>
              <div className="min-w-0 flex-1">
                <h3>Choose {recommendModal.vendorName}</h3>
                <p>This vendor will be recommended to the approvers.</p>
              </div>
              <button
                type="button"
                onClick={() => setRecommendModal(null)}
                className="vr-icon-btn"
                aria-label="Close"
              >
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="space-y-2 p-5">
              <label className="vr-field-label">
                Why this vendor? <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={recommendDraft}
                onChange={(e) => setRecommendDraft(e.target.value)}
                rows={4}
                placeholder="Example: Lowest price and delivery in 10 days"
                className="vr-input min-h-[110px] py-2.5"
              />
              <p className="vr-field-help">Saved with the draft. Managers will see this reason.</p>
              {localError && <p className="text-xs text-rose-600">{localError}</p>}
            </div>
            <div className="vr-modal-foot">
              <span className="vr-foot-note" />
              <button type="button" onClick={() => setRecommendModal(null)} className="vr-btn ghost">
                Cancel
              </button>
              <button type="button" onClick={confirmRecommend} className="vr-btn primary">
                <i className="ri-check-double-line" />
                Confirm vendor
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
          const filledRounds = (existing?.quotes || [])
            .filter((q) => Number(q.quotedPrice) > 0)
            .map((q) => q.round);
          const targetRound = filledRounds.length ? Math.max(...filledRounds) : 1;
          const nextVisible = Math.max(visibleRounds, targetRound, 1);
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
