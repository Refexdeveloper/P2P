import { useEffect, useMemo, useState } from 'react';
import VendorSearchSelect from '../../requester/rfq-entry/components/VendorSearchSelect';
import type { VendorRecord } from '../../../services/api';
import { PR_PAYMENT_TERM_OPTIONS } from '../../../constants/prRequisition';
import RfqVendorQuoteTable, {
  type RfqQuoteTableRow,
} from '../../requester/rfq-entry/components/RfqVendorQuoteTable';

export type ManualPrDetails = {
  prNumber: string;
  title: string;
  department: string;
  requester: string;
  justification: string;
  requestType: string;
  priority: string;
};

export type ManualVendorQuoteRow = {
  key: string;
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
  quotedPrice: string;
  leadTime: string;
  paymentTerms: string;
  recommended: boolean;
  files: File[];
  storedFiles?: Array<{ fileName: string; storedName?: string; mimeType?: string | null }>;
};

export type ManualComparisonRound = {
  key: string;
  round: number;
  label: string;
  notes: string;
  vendorQuotes: ManualVendorQuoteRow[];
};

export function emptyManualVendorQuote(key = `vq-${Date.now()}`): ManualVendorQuoteRow {
  return {
    key,
    vendorId: '',
    vendorName: '',
    vendorEmail: '',
    quotedPrice: '',
    leadTime: '',
    paymentTerms: 'Net 30 Days',
    recommended: false,
    files: [],
  };
}

export function emptyComparisonRound(roundNum = 1): ManualComparisonRound {
  return {
    key: `round-${Date.now()}-${roundNum}`,
    round: roundNum,
    label: `Round ${roundNum}`,
    notes: '',
    vendorQuotes: [],
  };
}

function vendorStableKey(q: ManualVendorQuoteRow): string {
  if (q.vendorId) return `id:${q.vendorId}`;
  const email = q.vendorEmail.trim().toLowerCase();
  if (email) return `email:${email}`;
  const name = q.vendorName.trim().toLowerCase();
  if (name) return `name:${name}`;
  return `key:${q.key}`;
}

function quoteHasData(q: ManualVendorQuoteRow) {
  return (
    Number(q.quotedPrice) > 0 ||
    q.files.length > 0 ||
    (q.storedFiles?.length ?? 0) > 0 ||
    q.vendorName.trim() ||
    q.vendorEmail.trim()
  );
}

type PivotedVendor = {
  vendorKey: string;
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
  quotesByRound: Map<number, ManualVendorQuoteRow>;
};

function pivotVendors(rounds: ManualComparisonRound[]): PivotedVendor[] {
  const map = new Map<string, PivotedVendor>();
  for (const round of rounds) {
    for (const q of round.vendorQuotes) {
      const vk = vendorStableKey(q);
      let entry = map.get(vk);
      if (!entry) {
        entry = {
          vendorKey: vk,
          vendorId: q.vendorId,
          vendorName: q.vendorName,
          vendorEmail: q.vendorEmail,
          quotesByRound: new Map(),
        };
        map.set(vk, entry);
      }
      entry.quotesByRound.set(round.round, q);
      if (q.vendorName.trim()) entry.vendorName = q.vendorName.trim();
      if (q.vendorEmail.trim()) entry.vendorEmail = q.vendorEmail.trim();
      if (q.vendorId) entry.vendorId = q.vendorId;
    }
  }
  return Array.from(map.values());
}

function maxRoundNum(rounds: ManualComparisonRound[]) {
  return Math.max(1, ...rounds.map((r) => Number(r.round) || 1));
}

export function findRecommendedManualQuote(
  rounds: ManualComparisonRound[]
): ManualVendorQuoteRow | undefined {
  for (const round of rounds) {
    const hit = round.vendorQuotes.find((row) => row.recommended);
    if (hit) return hit;
  }
  const lastRound = rounds[rounds.length - 1];
  return lastRound?.vendorQuotes[0];
}

type StoredManualQuote = {
  vendorId?: string;
  vendorName?: string;
  vendorEmail?: string;
  quotedPrice?: number | string;
  leadTime?: string;
  paymentTerms?: string;
  recommended?: boolean;
  files?: Array<{ fileName?: string; storedName?: string; mimeType?: string | null }>;
};

type StoredComparisonRound = {
  round?: number;
  label?: string;
  notes?: string;
  vendorQuotes?: StoredManualQuote[];
};

export function hydrateComparisonRoundsFromStored(
  storedRounds: StoredComparisonRound[] = [],
  flatQuotes: StoredManualQuote[] = []
): ManualComparisonRound[] {
  const rounds =
    storedRounds.length > 0
      ? storedRounds
      : flatQuotes.length
        ? [{ round: 1, label: 'Round 1', notes: '', vendorQuotes: flatQuotes }]
        : [];

  return rounds.map((round, roundIdx) => {
    const roundNum = Number(round.round) || roundIdx + 1;
    return {
      key: `round-stored-${roundNum}-${roundIdx}`,
      round: roundNum,
      label: String(round.label || `Round ${roundNum}`),
      notes: String(round.notes || ''),
      vendorQuotes: (round.vendorQuotes || []).map((q, qi) => ({
        key: `vq-stored-${roundNum}-${qi}-${Date.now()}`,
        vendorId: String(q.vendorId || ''),
        vendorName: String(q.vendorName || ''),
        vendorEmail: String(q.vendorEmail || ''),
        quotedPrice: q.quotedPrice != null ? String(q.quotedPrice) : '',
        leadTime: String(q.leadTime || ''),
        paymentTerms: String(q.paymentTerms || 'Net 30 Days'),
        recommended: Boolean(q.recommended),
        files: [],
        storedFiles: (q.files || []).filter((f) => f?.fileName),
      })),
    };
  });
}

export function hydrateManualPrDetailsFromStored(
  prDetails: Partial<ManualPrDetails> | null | undefined,
  poFallback?: { title?: string; department?: string; requester?: string; prNumber?: string }
): ManualPrDetails {
  return {
    prNumber: String(prDetails?.prNumber || poFallback?.prNumber || ''),
    title: String(prDetails?.title || poFallback?.title || ''),
    department: String(prDetails?.department || poFallback?.department || ''),
    requester: String(prDetails?.requester || poFallback?.requester || ''),
    justification: String(prDetails?.justification || ''),
    requestType: String(prDetails?.requestType || 'Opex'),
    priority: String(prDetails?.priority || 'Medium'),
  };
}

function quoteFilesForDisplay(q: ManualVendorQuoteRow) {
  const local = q.files.map((f) => ({ fileName: f.name, isLocal: true }));
  const stored = (q.storedFiles || []).map((f) => ({
    fileName: f.fileName,
    isLocal: false,
  }));
  return [...local, ...stored];
}

type Props = {
  prDetails: ManualPrDetails;
  onPrDetailsChange: (next: ManualPrDetails) => void;
  comparisonRounds: ManualComparisonRound[];
  onComparisonRoundsChange: (next: ManualComparisonRound[]) => void;
  vendors: VendorRecord[];
  currencySymbol: string;
  currency?: string | null;
};

export default function ManualPoContextSection({
  prDetails,
  onPrDetailsChange,
  comparisonRounds,
  onComparisonRoundsChange,
  vendors,
  currencySymbol,
  currency,
}: Props) {
  const [prDetailsOpen, setPrDetailsOpen] = useState(false);
  const [preferredTab, setPreferredTab] = useState<number | null>(1);
  const [editTarget, setEditTarget] = useState<{
    vendorKey: string;
    roundNum: number;
    quoteKey: string;
    roundKey: string;
  } | null>(null);

  const pivoted = useMemo(() => pivotVendors(comparisonRounds), [comparisonRounds]);
  const roundCount = maxRoundNum(comparisonRounds);

  const recommendedQuoteKey = useMemo(() => {
    for (const round of comparisonRounds) {
      const hit = round.vendorQuotes.find((v) => v.recommended);
      if (hit) return vendorStableKey(hit);
    }
    return '';
  }, [comparisonRounds]);

  const comparisonRows: RfqQuoteTableRow[] = useMemo(() => {
    return pivoted.map((v, i) => {
      const submittedQuotes = Array.from(v.quotesByRound.entries())
        .filter(([, q]) => quoteHasData(q) && (Number(q.quotedPrice) > 0 || quoteFilesForDisplay(q).length > 0))
        .map(([roundNum, q]) => {
          const files = quoteFilesForDisplay(q);
          return {
            round: roundNum,
            quotedPrice: Number(q.quotedPrice) || 0,
            status: 'submitted' as const,
            quotationFileName: files[0]?.fileName || '',
            quotationFiles: files,
          };
        });
      const hasActiveQuote = submittedQuotes.length > 0;
      const latestRound = submittedQuotes.reduce((m, q) => Math.max(m, q.round), 0);
      const fileRound = latestRound || 1;
      const fileQuote = v.quotesByRound.get(fileRound);
      const rowFiles = fileQuote ? quoteFilesForDisplay(fileQuote) : [];
      return {
        id: v.vendorKey,
        invitationId: i + 1,
        vendorName: v.vendorName || 'Vendor',
        inviteMode: 'manual' as const,
        status: hasActiveQuote ? 'submitted' : 'invited',
        round: latestRound || 1,
        hasActiveQuote,
        canSendBack: hasActiveQuote && latestRound > 0 && latestRound < 20,
        isRecommended: recommendedQuoteKey === v.vendorKey,
        quotationFileName: rowFiles[0]?.fileName,
        quotationFiles: rowFiles,
        hasLocalQuotationFile: rowFiles.length > 0,
        quotes: submittedQuotes,
      };
    });
  }, [pivoted, recommendedQuoteKey, roundCount]);

  const quotedCount = comparisonRows.filter((r) => r.hasActiveQuote).length;

  const ensureRound = (roundNum: number): ManualComparisonRound[] => {
    if (comparisonRounds.some((r) => r.round === roundNum)) return comparisonRounds;
    const next = emptyComparisonRound(roundNum);
    return [...comparisonRounds, next].sort((a, b) => a.round - b.round);
  };

  const findQuoteInRounds = (vendorKey: string, roundNum: number) => {
    const vendor = pivoted.find((v) => v.vendorKey === vendorKey);
    const quote = vendor?.quotesByRound.get(roundNum);
    const round = comparisonRounds.find((r) => r.round === roundNum);
    return { vendor, quote, round };
  };

  const upsertQuote = (
    rounds: ManualComparisonRound[],
    roundNum: number,
    quoteKey: string,
    patch: Partial<ManualVendorQuoteRow>
  ) => {
    return rounds.map((round) => {
      if (round.round !== roundNum) return round;
      const exists = round.vendorQuotes.some((q) => q.key === quoteKey);
      if (!exists) {
        const base = emptyManualVendorQuote(quoteKey);
        return {
          ...round,
          vendorQuotes: [...round.vendorQuotes, { ...base, ...patch, key: quoteKey }],
        };
      }
      return {
        ...round,
        vendorQuotes: round.vendorQuotes.map((q) =>
          q.key === quoteKey ? { ...q, ...patch } : q
        ),
      };
    });
  };

  const openEdit = (vendorKey: string, targetRound?: number) => {
    const roundNum = Math.min(roundCount, Math.max(1, Number(targetRound) || preferredTab || 1));
    let rounds = ensureRound(roundNum);
    const { vendor, quote, round } = findQuoteInRounds(vendorKey);
    if (!round) {
      rounds = ensureRound(roundNum);
    }
    const roundRow = rounds.find((r) => r.round === roundNum);
    if (!roundRow) return;

    let quoteKey = quote?.key;
    if (!quoteKey) {
      const newQuote = emptyManualVendorQuote(`vq-${Date.now()}-${roundNum}`);
      if (vendor) {
        newQuote.vendorId = vendor.vendorId;
        newQuote.vendorName = vendor.vendorName;
        newQuote.vendorEmail = vendor.vendorEmail;
      }
      quoteKey = newQuote.key;
      rounds = rounds.map((r) =>
        r.round === roundNum
          ? { ...r, vendorQuotes: [...r.vendorQuotes, newQuote] }
          : r
      );
    }

    onComparisonRoundsChange(rounds);
    setPreferredTab(roundNum);
    setEditTarget({
      vendorKey,
      roundNum,
      quoteKey: quoteKey!,
      roundKey: roundRow.key,
    });
  };

  const addVendor = () => {
    const roundNum = 1;
    let rounds = ensureRound(roundNum);
    const newQuote = emptyManualVendorQuote(`vq-${Date.now()}-new`);
    rounds = rounds.map((r) =>
      r.round === roundNum ? { ...r, vendorQuotes: [...r.vendorQuotes, newQuote] } : r
    );
    onComparisonRoundsChange(rounds);
    setPreferredTab(roundNum);
    setEditTarget({
      vendorKey: vendorStableKey(newQuote),
      roundNum,
      quoteKey: newQuote.key,
      roundKey: rounds.find((r) => r.round === roundNum)!.key,
    });
  };

  const removeVendor = (vendorKey: string) => {
    onComparisonRoundsChange(
      comparisonRounds.map((round) => ({
        ...round,
        vendorQuotes: round.vendorQuotes.filter((q) => vendorStableKey(q) !== vendorKey),
      }))
    );
    if (editTarget?.vendorKey === vendorKey) setEditTarget(null);
  };

  const setRecommendedVendor = (vendorKey: string) => {
    onComparisonRoundsChange(
      comparisonRounds.map((round) => ({
        ...round,
        vendorQuotes: round.vendorQuotes.map((q) => ({
          ...q,
          recommended: vendorStableKey(q) === vendorKey,
        })),
      }))
    );
  };

  const addNextRound = (nextRound: number) => {
    if (nextRound > 20) return;
    const rounds = ensureRound(nextRound);
    onComparisonRoundsChange(rounds);
    setPreferredTab(nextRound);
  };

  const editingQuote = useMemo(() => {
    if (!editTarget) return null;
    const round = comparisonRounds.find((r) => r.round === editTarget.roundNum);
    return round?.vendorQuotes.find((q) => q.key === editTarget.quoteKey) || null;
  }, [editTarget, comparisonRounds]);

  const saveEdit = () => {
    if (!editTarget || !editingQuote) return;
    if (!editingQuote.vendorName.trim()) {
      alert('Please select or enter vendor name');
      return;
    }
    onComparisonRoundsChange(
      upsertQuote(comparisonRounds, editTarget.roundNum, editTarget.quoteKey, editingQuote)
    );
    setEditTarget(null);
  };

  const updateEditingQuote = (patch: Partial<ManualVendorQuoteRow>) => {
    if (!editTarget) return;
    onComparisonRoundsChange(
      upsertQuote(comparisonRounds, editTarget.roundNum, editTarget.quoteKey, {
        ...editingQuote,
        ...patch,
      })
    );
  };

  const openLocalFile = (row: RfqQuoteTableRow) => {
    const vendor = pivoted.find((v) => v.vendorKey === row.id);
    if (!vendor) return;
    const roundNum =
      preferredTab && preferredTab > 0
        ? preferredTab
        : row.quotes?.reduce((m, q) => Math.max(m, q.round), 1) || 1;
    const quote = vendor.quotesByRound.get(roundNum) || vendor.quotesByRound.get(1);
    const fileName = row.quotationFileName;
    const file =
      quote?.files.find((f) => f.name === fileName) || quote?.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  useEffect(() => {
    if (!editTarget) return;
    const stillThere = comparisonRounds.some((r) =>
      r.vendorQuotes.some((q) => q.key === editTarget.quoteKey)
    );
    if (!stillThere) setEditTarget(null);
  }, [comparisonRounds, editTarget]);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setPrDetailsOpen((open) => !open)}
          className="w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-gray-50/80 transition-colors cursor-pointer"
        >
          <div>
            <h3 className="text-sm font-bold text-gray-900">PR details (reference)</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {prDetailsOpen
                ? 'Optional PR reference — no approval workflow, data entry only'
                : 'Click to add optional PR reference fields'}
            </p>
          </div>
          <span className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-teal-700">
            {prDetailsOpen ? 'Hide' : 'Show'}
            <i className={`ri-arrow-${prDetailsOpen ? 'up' : 'down'}-s-line text-base`} />
          </span>
        </button>
        {prDetailsOpen ? (
          <div className="px-5 pb-5 pt-0 border-t border-gray-100 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">PR reference no.</label>
            <input
              value={prDetails.prNumber}
              onChange={(e) => onPrDetailsChange({ ...prDetails, prNumber: e.target.value })}
              className="w-full h-11 px-3.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Optional reference"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Title</label>
            <input
              value={prDetails.title}
              onChange={(e) => onPrDetailsChange({ ...prDetails, title: e.target.value })}
              className="w-full h-11 px-3.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Purchase title"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Department</label>
            <input
              value={prDetails.department}
              onChange={(e) => onPrDetailsChange({ ...prDetails, department: e.target.value })}
              className="w-full h-11 px-3.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Department"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Requester</label>
            <input
              value={prDetails.requester}
              onChange={(e) => onPrDetailsChange({ ...prDetails, requester: e.target.value })}
              className="w-full h-11 px-3.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Requester name"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Request type</label>
            <select
              value={prDetails.requestType}
              onChange={(e) => onPrDetailsChange({ ...prDetails, requestType: e.target.value })}
              className="w-full h-11 px-3.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="Opex">Opex</option>
              <option value="Capex">Capex</option>
              <option value="Service">Service</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Priority</label>
            <select
              value={prDetails.priority}
              onChange={(e) => onPrDetailsChange({ ...prDetails, priority: e.target.value })}
              className="w-full h-11 px-3.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Justification</label>
            <textarea
              value={prDetails.justification}
              onChange={(e) => onPrDetailsChange({ ...prDetails, justification: e.target.value })}
              rows={3}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Business justification"
            />
          </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Vendor comparison</p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5">Get quotes and pick a vendor</h2>
            <p className="text-sm text-gray-500 mt-1">
              Switch tabs, tap <strong>Edit</strong> to fill the round, then <strong>Choose</strong> a vendor.
              Fill <strong>Q1</strong> first — tap <strong>Next round</strong> to add and show <strong>Q2</strong>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-xs font-semibold text-gray-600">
              {quotedCount} of {comparisonRows.length || pivoted.length} quotes received
            </span>
            <button
              type="button"
              onClick={addVendor}
              className="px-3 py-1.5 text-xs font-semibold text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50"
            >
              <i className="ri-add-line mr-1" />
              Add vendor
            </button>
          </div>
        </div>

        {comparisonRows.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <p className="text-sm text-gray-500 mb-3">No vendors yet.</p>
            <button
              type="button"
              onClick={addVendor}
              className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700"
            >
              <i className="ri-add-line mr-1" />
              Add vendor
            </button>
          </div>
        ) : (
          <RfqVendorQuoteTable
            rows={comparisonRows}
            currency={currency}
            recommendedId={
              recommendedQuoteKey
                ? comparisonRows.find((r) => r.id === recommendedQuoteKey)?.invitationId ?? null
                : null
            }
            quotedCount={quotedCount}
            preferredTab={preferredTab}
            onEdit={(row, targetRound) => openEdit(row.id, targetRound)}
            onChoose={(row) => {
              if (!row.hasActiveQuote) return;
              setRecommendedVendor(row.id);
            }}
            onRemove={(row) => removeVendor(row.id)}
            onSendBack={(row) => {
              const vendor = pivoted.find((v) => v.vendorKey === row.id);
              const latest = vendor
                ? Array.from(vendor.quotesByRound.keys()).reduce((m, n) => Math.max(m, n), 0)
                : 0;
              const next = latest + 1;
              if (next > 20) return;
              addNextRound(next);
              openEdit(row.id, next);
            }}
            onNextRound={(nextRound) => addNextRound(nextRound)}
            onViewFile={(row) => openLocalFile(row)}
          />
        )}

        {recommendedQuoteKey ? (
          <p className="text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
            Selected vendor will be used on the PO document.
          </p>
        ) : (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Tap <strong>Choose</strong> on a vendor with a quote to select them for the PO.
          </p>
        )}
      </div>

      {editTarget && editingQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Edit quote — {editingQuote.vendorName || 'Vendor'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Round Q{editTarget.roundNum} — upload quotation and enter price ({currencySymbol})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Vendor <span className="text-red-500">*</span>
                  </label>
                  <VendorSearchSelect
                    vendors={vendors}
                    value={editingQuote.vendorId}
                    onChange={(id) => {
                      const v = vendors.find((x) => String(x.id) === String(id));
                      updateEditingQuote({
                        vendorId: id,
                        vendorName: v?.name || '',
                        vendorEmail: (v?.email || '').trim(),
                      });
                    }}
                    placeholder="Search vendor"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={editingQuote.vendorEmail}
                    onChange={(e) => updateEditingQuote({ vendorEmail: e.target.value })}
                    className="w-full h-11 px-3.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Quoted price ({currencySymbol}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingQuote.quotedPrice}
                    onChange={(e) => updateEditingQuote({ quotedPrice: e.target.value })}
                    className="w-full h-11 px-3.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Lead time</label>
                  <input
                    value={editingQuote.leadTime}
                    onChange={(e) => updateEditingQuote({ leadTime: e.target.value })}
                    className="w-full h-11 px-3.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="e.g. 15 days"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payment terms</label>
                  <select
                    value={editingQuote.paymentTerms}
                    onChange={(e) => updateEditingQuote({ paymentTerms: e.target.value })}
                    className="w-full h-11 px-3.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {PR_PAYMENT_TERM_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quotation file(s)</label>
                <label
                  className="flex flex-wrap items-center gap-3 px-4 py-3.5 border-2 border-dashed border-teal-200 rounded-xl cursor-pointer bg-teal-50/40 hover:bg-teal-50"
                >
                  <i className="ri-upload-cloud-2-line text-teal-600 text-xl" />
                  <span className="text-sm text-gray-700">Upload PDF, Excel, or image</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length) {
                        updateEditingQuote({ files: [...editingQuote.files, ...files] });
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
                {editingQuote.files.length ? (
                  <ul className="mt-3 space-y-1.5">
                    {editingQuote.files.map((f, fi) => (
                      <li
                        key={`${f.name}-${fi}`}
                        className="flex items-center justify-between gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2"
                      >
                        <span className="truncate flex items-center gap-1.5">
                          <i className="ri-file-line text-teal-600" />
                          {f.name}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateEditingQuote({
                              files: editingQuote.files.filter((_, i) => i !== fi),
                            })
                          }
                          className="text-rose-600 text-xs font-semibold"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/80">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700"
              >
                Save quote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
