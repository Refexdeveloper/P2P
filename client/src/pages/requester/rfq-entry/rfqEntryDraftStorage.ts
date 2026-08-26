const PREFIX = 'p2p.rfqEntry.draft';
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type RfqEntryBillingDraft = {
  billingLocationId: number | '' | null;
  billingLocation: string;
  billingGstNo: string;
  billingAddress: string;
  deliveryPoc: string;
  placeOfDelivery: string;
  expectedDeliveryTimeline: string;
  paymentTerms: string;
};

export type RfqEntryDraftSnapshot = {
  v: 1;
  savedAt: number;
  prId: number;
  recommendedInvitationId: number | null;
  recommendationJustification: string;
  maxRounds: number | null;
  draftRows: Array<{
    key: string;
    vendorId: string;
    vendorName: string;
    vendorEmail: string;
  }>;
  /** In-progress quote form values keyed by invitation id (no File objects). */
  manualDrafts: Record<string, Record<string, unknown>>;
  /** Billing & delivery — also saved on server; kept locally so reload always restores. */
  billing?: RfqEntryBillingDraft | null;
};

function storageKey(userId: number | string | undefined | null, prId: number) {
  const uid = userId != null && String(userId).trim() !== '' ? String(userId) : 'anon';
  return `${PREFIX}.${uid}.${prId}`;
}

function isUsableSnapshot(parsed: unknown, prId: number): parsed is RfqEntryDraftSnapshot {
  if (!parsed || typeof parsed !== 'object') return false;
  const snap = parsed as RfqEntryDraftSnapshot;
  if (snap.v !== 1 || Number(snap.prId) !== Number(prId)) return false;
  if (Date.now() - Number(snap.savedAt || 0) > TTL_MS) return false;
  return true;
}

function billingFilled(b?: RfqEntryBillingDraft | null): number {
  if (!b) return 0;
  let n = 0;
  if (b.billingLocationId) n += 1;
  if (String(b.billingLocation || '').trim()) n += 2;
  if (String(b.billingGstNo || '').trim()) n += 1;
  if (String(b.billingAddress || '').trim()) n += 2;
  if (String(b.deliveryPoc || '').trim()) n += 1;
  if (String(b.placeOfDelivery || '').trim()) n += 1;
  if (String(b.expectedDeliveryTimeline || '').trim()) n += 1;
  if (String(b.paymentTerms || '').trim()) n += 1;
  return n;
}

function draftRichness(snap: RfqEntryDraftSnapshot | null): number {
  if (!snap) return 0;
  let n = billingFilled(snap.billing);
  if (snap.recommendedInvitationId != null) n += 2;
  if (String(snap.recommendationJustification || '').trim()) n += 2;
  n += Object.keys(snap.manualDrafts || {}).length * 3;
  n += (snap.draftRows || []).filter((r) => r.vendorId || r.vendorName).length;
  for (const vals of Object.values(snap.manualDrafts || {})) {
    if (!vals || typeof vals !== 'object') continue;
    n += Object.keys(vals).length;
    const lines = vals.quoteLineItems;
    if (Array.isArray(lines)) n += lines.length * 2;
  }
  return n;
}

/** Strip non-JSON values (File, undefined) so localStorage write never fails silently. */
function sanitizeManualDrafts(
  manualDrafts: Record<string | number, Record<string, unknown>>
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [id, vals] of Object.entries(manualDrafts || {})) {
    if (!vals || typeof vals !== 'object') continue;
    try {
      out[String(id)] = JSON.parse(JSON.stringify(vals)) as Record<string, unknown>;
    } catch {
      const safe: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(vals)) {
        if (v == null) continue;
        if (typeof File !== 'undefined' && v instanceof File) continue;
        if (typeof v === 'function') continue;
        try {
          JSON.stringify(v);
          safe[k] = v;
        } catch {
          /* skip */
        }
      }
      if (Object.keys(safe).length) out[String(id)] = safe;
    }
  }
  return out;
}

function sanitizeBilling(billing?: RfqEntryBillingDraft | null): RfqEntryBillingDraft | null {
  if (!billing || typeof billing !== 'object') return null;
  return {
    billingLocationId:
      billing.billingLocationId === '' || billing.billingLocationId == null
        ? ''
        : Number(billing.billingLocationId) || '',
    billingLocation: String(billing.billingLocation || ''),
    billingGstNo: String(billing.billingGstNo || ''),
    billingAddress: String(billing.billingAddress || ''),
    deliveryPoc: String(billing.deliveryPoc || ''),
    placeOfDelivery: String(billing.placeOfDelivery || ''),
    expectedDeliveryTimeline: String(billing.expectedDeliveryTimeline || ''),
    paymentTerms: String(billing.paymentTerms || ''),
  };
}

export function readRfqEntryDraft(
  userId: number | string | undefined | null,
  prId: number
): RfqEntryDraftSnapshot | null {
  if (!prId || typeof localStorage === 'undefined') return null;
  try {
    const candidates: RfqEntryDraftSnapshot[] = [];
    const tryKey = (key: string) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (isUsableSnapshot(parsed, prId)) candidates.push(parsed);
        else if (parsed && Number(parsed.prId) === Number(prId)) {
          localStorage.removeItem(key);
        }
      } catch {
        /* ignore */
      }
    };

    tryKey(storageKey(userId, prId));
    tryKey(storageKey('anon', prId));
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PREFIX) || !key.endsWith(`.${prId}`)) continue;
      tryKey(key);
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => {
      const rich = draftRichness(b) - draftRichness(a);
      if (rich !== 0) return rich;
      return Number(b.savedAt || 0) - Number(a.savedAt || 0);
    });
    return candidates[0];
  } catch {
    return null;
  }
}

export function writeRfqEntryDraft(
  userId: number | string | undefined | null,
  prId: number,
  draft: Omit<RfqEntryDraftSnapshot, 'v' | 'savedAt' | 'prId'>,
  options?: { allowEmptyOverwrite?: boolean }
): boolean {
  if (!prId || typeof localStorage === 'undefined') return false;
  try {
    const payload: RfqEntryDraftSnapshot = {
      v: 1,
      savedAt: Date.now(),
      prId: Number(prId),
      recommendedInvitationId: draft.recommendedInvitationId ?? null,
      recommendationJustification: draft.recommendationJustification || '',
      maxRounds: draft.maxRounds ?? null,
      draftRows: Array.isArray(draft.draftRows) ? draft.draftRows : [],
      manualDrafts: sanitizeManualDrafts(draft.manualDrafts || {}),
      billing: sanitizeBilling(draft.billing),
    };

    if (!options?.allowEmptyOverwrite) {
      const existing = readRfqEntryDraft(userId, prId);
      if (existing && draftRichness(payload) < draftRichness(existing)) {
        return false;
      }
    }

    const key = storageKey(userId, prId);
    localStorage.setItem(key, JSON.stringify(payload));
    if (userId != null && String(userId) !== 'anon') {
      try {
        localStorage.setItem(storageKey('anon', prId), JSON.stringify(payload));
      } catch {
        /* ignore */
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function clearRfqEntryDraft(userId: number | string | undefined | null, prId: number): void {
  if (!prId || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(userId, prId));
    localStorage.removeItem(storageKey('anon', prId));
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX) && key.endsWith(`.${prId}`)) toRemove.push(key);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function billingFromDraft(snap: RfqEntryDraftSnapshot | null): RfqEntryBillingDraft | null {
  return sanitizeBilling(snap?.billing);
}
