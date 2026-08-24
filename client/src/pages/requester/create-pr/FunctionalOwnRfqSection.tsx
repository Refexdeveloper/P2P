import { useMemo, useState } from 'react';
import VendorSearchSelect from '../rfq-entry/components/VendorSearchSelect';
import RfqVendorQuoteTable, { RfqQuoteTableRow } from '../rfq-entry/components/RfqVendorQuoteTable';
import CreateVendorForm from '../../scm/vendor-master/components/CreateVendorForm';
import RfqChatbot from '../../../components/feature/RfqChatbot';
import { openRfqChat } from '../../../components/feature/rfqChatOpen';
import type { VendorRecord } from '../../../services/api';
import { PR_PAYMENT_TERM_OPTIONS } from '../../../constants/prRequisition';

export type FunctionalRfqQuote = {
  round: number;
  quotedPrice: string;
  leadTime: string;
  paymentTerms: string;
  file: File | null;
};

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

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

interface Props {
  vendors: VendorRecord[];
  rows: FunctionalRfqVendorRow[];
  maxRounds: number;
  error?: string;
  existingQuoteNote?: string;
  prNumber?: string;
  onMaxRoundsChange: (n: number) => void;
  onChange: (rows: FunctionalRfqVendorRow[]) => void;
  onVendorsRefresh?: (vendor?: VendorRecord) => void;
}

export default function FunctionalOwnRfqSection({
  vendors,
  rows,
  maxRounds,
  error,
  existingQuoteNote,
  prNumber,
  onMaxRoundsChange,
  onChange,
  onVendorsRefresh,
}: Props) {
  const [searchVendorId, setSearchVendorId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [localError, setLocalError] = useState('');
  const [quoteKey, setQuoteKey] = useState<string | null>(null);
  const [quoteRound, setQuoteRound] = useState(1);
  const [quoteDraft, setQuoteDraft] = useState<FunctionalRfqVendorRow | null>(null);
  const [recommendedKey, setRecommendedKey] = useState<string | null>(null);
  const [focusTab, setFocusTab] = useState(1);

  const visibleRounds = Math.min(4, Math.max(1, Number(maxRounds) || 1));

  const takenIds = useMemo(() => new Set(rows.map((r) => r.vendorId).filter(Boolean)), [rows]);
  const quotedCount = rows.filter((r) => Number(r.quotes.find((q) => q.round === 1)?.quotedPrice) > 0 && r.quotes.find((q) => q.round === 1)?.file).length;
  const guideStep = quotedCount > 0 ? 2 : rows.length > 0 ? 2 : 1;

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3500);
  };

  const selectedSearch = vendors.find((v) => String(v.id) === String(searchVendorId));

  const commitVendor = (vendor: { id: string; name: string; email: string }) => {
    const existing = rows.find((r) => r.vendorId === vendor.id);
    if (existing) return { row: existing, nextRows: rows };
    const row: FunctionalRfqVendorRow = {
      ...newFunctionalRfqVendorRow(visibleRounds),
      vendorId: vendor.id,
      name: vendor.name,
      email: vendor.email,
    };
    return { row, nextRows: [...rows, row] };
  };

  const requireSelectedVendor = () => {
    if (!selectedSearch) {
      setLocalError('Search and select a vendor first');
      return null;
    }
    setLocalError('');
    setSearchVendorId('');
    return commitVendor({
      id: String(selectedSearch.id),
      name: selectedSearch.name,
      email: selectedSearch.email || '',
    });
  };

  const applyRows = (nextRows: FunctionalRfqVendorRow[], round = visibleRounds) => {
    const nextVisible = Math.min(4, Math.max(visibleRounds, round, 1));
    if (nextVisible !== visibleRounds) onMaxRoundsChange(nextVisible);
    const synced = nextRows.map((r) => ({ ...r, quotes: syncQuotes(r.quotes, nextVisible) }));
    onChange(synced);
    setFocusTab(nextVisible);
    return { synced, nextVisible };
  };

  const openQuote = (row: FunctionalRfqVendorRow, round = 1, baseRows: FunctionalRfqVendorRow[] = rows) => {
    const { synced, nextVisible } = applyRows(baseRows, round);
    const saved = synced.find((r) => r.key === row.key) || row;
    setQuoteDraft(saved);
    setQuoteKey(saved.key);
    setQuoteRound(Math.min(nextVisible, Math.max(1, round)));
  };

  const closeQuote = () => {
    setQuoteKey(null);
    setQuoteDraft(null);
  };

  const editing = (quoteKey && rows.find((r) => r.key === quoteKey)) || (quoteKey && quoteDraft?.key === quoteKey ? quoteDraft : null);
  const editingQuotes = editing ? syncQuotes(editing.quotes, visibleRounds) : [];
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

  const steps = [
    { n: 1, title: 'Add vendors', hint: 'Choose who should quote', done: rows.length > 0 },
    { n: 2, title: 'Get quotes', hint: 'Email them, type a quote, or upload with AI', done: quotedCount > 0 },
    { n: 3, title: 'Pick one vendor', hint: 'Recommend the winner and send for approval', done: Boolean(recommendedKey) },
  ];

  const comparisonRows: RfqQuoteTableRow[] = rows.map((r, i) => {
    const quotes = r.quotes
      .filter((q) => Number(q.quotedPrice) > 0)
      .map((q) => ({ round: q.round, quotedPrice: Number(q.quotedPrice), status: 'submitted' }));
    const hasActive = quotes.length > 0;
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
      quotationFileName: r.quotes.find((q) => q.file)?.file?.name,
      quotes,
    };
  });

  const nextRequoteRound = (row: FunctionalRfqVendorRow) => {
    const filled = row.quotes.filter((q) => Number(q.quotedPrice) > 0).map((q) => q.round);
    const latest = filled.length ? Math.max(...filled) : 0;
    return Math.min(4, latest + 1 || 1);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {steps.map((s) => {
          const active = guideStep === s.n;
          return (
            <div
              key={s.n}
              className={`rounded-2xl border px-4 py-3 ${
                s.done
                  ? 'border-emerald-200 bg-emerald-50'
                  : active
                    ? 'border-teal-300 bg-teal-50 shadow-sm'
                    : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${
                    s.done
                      ? 'bg-emerald-600 text-white'
                      : active
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {s.done ? <i className="ri-check-line" /> : s.n}
                </span>
                <p className="text-sm font-semibold text-gray-900">{s.title}</p>
              </div>
              <p className="text-xs text-gray-500 mt-1.5 pl-9">{s.hint}</p>
            </div>
          );
        })}
      </div>

      {existingQuoteNote && (
        <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-800">{existingQuoteNote}</div>
      )}
      {(localError || error) && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{localError || error}</div>
      )}
      {toast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">{toast}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Step 1</p>
          <h2 className="text-base font-bold text-gray-900 mt-0.5">Add vendors</h2>
          <p className="text-sm text-gray-500 mt-1">Search a vendor, then choose email, type the quote, or upload with AI.</p>
        </div>

        {rows.length > 0 && (
          <div className="space-y-2 mb-4">
            {rows.map((row) => {
              const round1 = row.quotes.find((q) => q.round === 1);
              const hasQuote = Number(round1?.quotedPrice) > 0 && Boolean(round1?.file);
              return (
                <div
                  key={row.key}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-teal-200 bg-teal-50/60"
                >
                  <span className="w-8 h-8 rounded-lg bg-white border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
                    <i className="ri-store-2-line" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{row.name || 'Vendor'}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {row.email || 'No email on file'}
                      {hasQuote ? ` · ${formatMoney(Number(round1?.quotedPrice))}` : ' · Quote pending'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openQuote(row, 1)}
                    className="text-sm font-semibold text-teal-700 px-2"
                  >
                    {hasQuote ? 'Edit' : 'Quote'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(rows.filter((x) => x.key !== row.key))}
                    className="text-sm text-gray-500 hover:text-red-600 px-2"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-2 mb-4">
          <label className="text-xs font-semibold text-gray-600">Search vendor</label>
          <VendorSearchSelect
            vendors={vendors}
            value={searchVendorId}
            takenIds={takenIds}
            onChange={setSearchVendorId}
            placeholder="Type name, vendor code, or email"
            emptyHint="No match. Use Create new to add them to Vendor Master."
          />
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="text-sm text-teal-700 font-semibold inline-flex items-center gap-1.5"
          >
            <i className="ri-user-add-line" />
            Vendor not in the list? Create new
          </button>
        </div>

        <p className="text-sm font-semibold text-gray-800 mb-2">How do you want to get the quote?</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => {
              const added = requireSelectedVendor();
              if (!added) return;
              applyRows(added.nextRows);
              showToast('Vendor added. On Create PR, type the quote or upload with AI — email invite happens at SCM RFQ if needed.');
            }}
            className="text-left rounded-2xl border border-amber-200 bg-amber-50/70 p-4 hover:border-amber-300"
          >
            <span className="w-9 h-9 rounded-lg bg-amber-500 text-white inline-flex items-center justify-center mb-2">
              <i className="ri-mail-send-line" />
            </span>
            <p className="text-sm font-bold text-gray-900">Email the vendor</p>
            <p className="text-xs text-gray-600 mt-1">Add them now. Attach the quote here if you already have it.</p>
          </button>
          <button
            type="button"
            onClick={() => {
              const added = requireSelectedVendor();
              if (!added) return;
              openQuote(added.row, 1, added.nextRows);
            }}
            className="text-left rounded-2xl border border-teal-200 bg-teal-50/70 p-4 hover:border-teal-300"
          >
            <span className="w-9 h-9 rounded-lg bg-teal-600 text-white inline-flex items-center justify-center mb-2">
              <i className="ri-edit-line" />
            </span>
            <p className="text-sm font-bold text-gray-900">I will type the quote</p>
            <p className="text-xs text-gray-600 mt-1">You already have the price. Fill it here and attach the file.</p>
          </button>
          <button
            type="button"
            onClick={() => {
              setLocalError('');
              if (selectedSearch) {
                const added = requireSelectedVendor();
                if (added) applyRows(added.nextRows);
                openRfqChat({ vendor: selectedSearch });
                return;
              }
              openRfqChat();
            }}
            className="text-left rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:border-slate-300"
          >
            <span className="w-9 h-9 rounded-lg bg-slate-900 text-white inline-flex items-center justify-center mb-2">
              <i className="ri-robot-2-line" />
            </span>
            <p className="text-sm font-bold text-gray-900">Upload with AI</p>
            <p className="text-xs text-gray-600 mt-1">Chat asks the vendor name, then you upload the quotation file.</p>
          </button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Step 2 &amp; 3</p>
              <h2 className="text-base font-bold text-gray-900 mt-0.5">Get quotes and pick a vendor</h2>
              <p className="text-sm text-gray-500 mt-1">
                Switch tabs, tap <strong>Edit</strong> to fill the round, then <strong>Choose</strong> a vendor. Fill <strong>Q1</strong> first — tap <strong>Re-quote</strong> to add and show <strong>Q2</strong>.
              </p>
            </div>
            <span className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-xs font-semibold text-gray-600">
              {quotedCount} of {rows.length} quotes received
            </span>
          </div>
          <RfqVendorQuoteTable
            rows={comparisonRows}
            recommendedId={
              recommendedKey
                ? comparisonRows.find((r) => r.id === recommendedKey)?.invitationId ?? null
                : null
            }
            quotedCount={quotedCount}
            maxRounds={visibleRounds}
            preferredTab={focusTab}
            onEdit={(tableRow, targetRound) => {
              const row = rows.find((r) => r.key === tableRow.id);
              if (!row) return;
              openQuote(row, Math.min(4, Math.max(1, Number(targetRound) || 1)));
            }}
            onChoose={(tableRow) => {
              const row = rows.find((r) => r.key === tableRow.id);
              if (!row || !tableRow.hasActiveQuote) return;
              setRecommendedKey(row.key);
              showToast(`${row.name} marked as recommended`);
            }}
            onRemove={(tableRow) => {
              onChange(rows.filter((r) => r.key !== tableRow.id));
              if (recommendedKey === tableRow.id) setRecommendedKey(null);
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

      {editing && editingQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
              <div>
                <h3 className="text-base font-bold text-gray-900">Edit quote — {editing.name}</h3>
                <p className="text-xs text-gray-500 mt-1">First upload the quotation file, then fill quoted price. Those are required for round 1.</p>
              </div>
              <button type="button" onClick={closeQuote} className="w-8 h-8 rounded-lg hover:bg-gray-100">
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="flex flex-wrap gap-2">
                {editingQuotes.map((q) => (
                  <button
                    key={q.round}
                    type="button"
                    onClick={() => setQuoteRound(q.round)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      quoteRound === q.round ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Round {q.round}
                    {q.round === 1 ? ' *' : ''}
                  </button>
                ))}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
                  Quotation file {quoteRound === 1 ? <span className="text-red-500">*</span> : null}
                </p>
                <label
                  className={`flex flex-wrap items-center gap-3 px-4 py-3.5 border-2 border-dashed rounded-xl cursor-pointer ${
                    editingQuote.file ? 'border-teal-300 bg-teal-50/40 hover:bg-teal-50' : 'border-red-200 bg-red-50/40 hover:bg-red-50/70'
                  }`}
                >
                  <i className={`text-xl shrink-0 ${editingQuote.file ? 'ri-upload-2-line text-teal-700' : 'ri-upload-cloud-2-line text-red-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate ${editingQuote.file ? 'text-teal-800' : 'text-red-700'}`}>
                      {editingQuote.file?.name || 'Upload quotation file (required)'}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">PDF, Word, or photo · then type quoted price</p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                    className="text-xs max-w-full"
                    onChange={(e) => updateQuote(editing.key, quoteRound, { file: e.target.files?.[0] || null })}
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Quoted price *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingQuote.quotedPrice}
                    onChange={(e) => updateQuote(editing.key, quoteRound, { quotedPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Lead time (days)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingQuote.leadTime}
                    onChange={(e) => updateQuote(editing.key, quoteRound, { leadTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Payment terms</label>
                  <select
                    value={editingQuote.paymentTerms}
                    onChange={(e) => updateQuote(editing.key, quoteRound, { paymentTerms: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="">Select</option>
                    {PR_PAYMENT_TERM_OPTIONS.map((term) => (
                      <option key={term} value={term}>{term}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeQuote}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  if (quoteRound === 1 && (!(Number(editingQuote.quotedPrice) > 0) || !editingQuote.file)) {
                    setLocalError('Round 1 needs a quoted price and quotation file');
                    return;
                  }
                  setLocalError('');
                  closeQuote();
                  showToast(`Quote saved for ${editing.name}`);
                }}
                className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700"
              >
                Save quote + file
              </button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <CreateVendorForm
              compact
              onSuccess={(vendor) => {
                setCreateOpen(false);
                onVendorsRefresh?.(vendor);
                if (vendor) {
                  setSearchVendorId(String(vendor.id));
                  showToast(`Vendor ${vendor.name} added`);
                }
              }}
              onCancel={() => setCreateOpen(false)}
            />
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
              ? { ...q, quotedPrice: String(quotedPrice), file, paymentTerms: q.paymentTerms || 'Net 30 Days' }
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
