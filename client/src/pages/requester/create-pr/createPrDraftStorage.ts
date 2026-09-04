const PREFIX = 'p2p.createPr.draft';
const ACTIVE_PREFIX = 'p2p.createPr.active';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CreatePrDraftSnapshot = {
  v: 1;
  savedAt: number;
  backendPrId: number | null;
  prNumber?: string;
  isAdminEditFlow?: boolean;
  prTitle: string;
  department: string;
  entityId: number | '';
  requestType: 'Capex' | 'Opex' | 'Service';
  purchaseType: 'purchase_order' | 'work_order' | 'sass';
  vendorSelection: 'own' | 'scm';
  /** SASS — vendor known on Create PR (no RFQ). */
  sassVendorId?: string | null;
  prFlow: 'standard' | 'functional';
  approvalUserIds: number[];
  rfqMaxRounds: number;
  /** Functional Own — recommended vendor row key (or vendorId/email fallback). */
  rfqRecommendedKey?: string | null;
  rfqRecommendedVendorId?: string | null;
  rfqRecommendedVendorEmail?: string | null;
  rfqRecommendedVendorName?: string | null;
  rfqRecommendationJustification?: string;
  rfqVendors: Array<{
    key: string;
    vendorId: string;
    name: string;
    email: string;
    quotes: Array<{
      round: number;
      quotedPrice: string;
      leadTime: string;
      paymentTerms: string;
      savedFileName?: string;
      savedSubmissionId?: number;
      savedFiles?: Array<{ id?: number | null; fileName: string; isPrimary?: boolean }>;
    }>;
  }>;
  priority: string;
  currency: string;
  businessJustification: string;
  requiredDate: string;
  workStartDate?: string;
  workEndDate?: string;
  billingLocationId: number | '';
  billingLocation: string;
  billingGstNo: string;
  billingAddress: string;
  deliveryPoc: string;
  deliveryPocEmail?: string;
  deliveryPocPhone?: string;
  projectManagerHo?: string;
  projectManagerContact?: string;
  projectManagerEmail?: string;
  placeOfDelivery: string;
  expectedDeliveryTimeline: string;
  paymentTerms: string;
  requestCategory?: 'Product' | 'Service' | '';
  projectDetail?: string;
  specialNotes?: string;
  lineItems: Array<{
    id: string;
    itemId?: number | null;
    itemName?: string;
    description: string;
    quantity: number;
    estimatedCost: number;
    category: string;
    unit?: string;
    hsnCode?: string;
    gstPercentage?: number;
  }>;
  attachedFiles: Array<{ id: string; name: string; size: number; existingId?: number }>;
};

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** One-time migrate older sessionStorage drafts into localStorage. */
function migrateFromSession(key: string, store: Storage) {
  try {
    if (store.getItem(key)) return;
    const legacy = window.sessionStorage.getItem(key);
    if (!legacy) return;
    store.setItem(key, legacy);
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function createPrDraftKey(userId: number | string | undefined, prId: number | null) {
  return `${PREFIX}.${userId || 'anon'}.${prId ?? 'new'}`;
}

function activeDraftKey(userId: number | string | undefined) {
  return `${ACTIVE_PREFIX}.${userId || 'anon'}`;
}

export function draftContentScore(draft: CreatePrDraftSnapshot | null | undefined): number {
  if (!draft) return 0;
  return (
    (draft.lineItems?.length || 0) * 10 +
    (draft.businessJustification?.trim() ? 8 : 0) +
    (draft.billingAddress?.trim() ? 4 : 0) +
    (draft.placeOfDelivery?.trim() ? 4 : 0) +
    (draft.deliveryPoc?.trim() ? 3 : 0) +
    (draft.expectedDeliveryTimeline?.trim() ? 3 : 0) +
    (draft.paymentTerms?.trim() ? 2 : 0) +
    (draft.prTitle?.trim() ? 2 : 0) +
    (draft.rfqVendors?.length || 0) * 3 +
    (draft.entityId ? 1 : 0)
  );
}

export function hasMeaningfulCreatePrDraft(draft: CreatePrDraftSnapshot | null | undefined): boolean {
  if (!draft) return false;
  return draftContentScore(draft) > 0 || Boolean(draft.backendPrId) || Boolean(draft.prNumber && draft.prNumber !== 'Auto on save');
}

function parseDraft(raw: string | null): CreatePrDraftSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CreatePrDraftSnapshot;
    if (!parsed || parsed.v !== 1 || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readCreatePrDraft(
  userId: number | string | undefined,
  prId: number | null
): CreatePrDraftSnapshot | null {
  const store = storage();
  if (!store) return null;
  try {
    migrateFromSession(createPrDraftKey(userId, prId), store);
    migrateFromSession(createPrDraftKey(userId, null), store);
    migrateFromSession(activeDraftKey(userId), store);
    migrateFromSession(createPrDraftKey('anon', prId), store);
    migrateFromSession(createPrDraftKey(undefined, prId), store);

    const primary = parseDraft(store.getItem(createPrDraftKey(userId, prId)));
    if (primary) return primary;

    // Draft may have been written before auth resolved (anon / undefined user key).
    if (userId && userId !== 'anon') {
      const anonDraft =
        parseDraft(store.getItem(createPrDraftKey('anon', prId))) ||
        parseDraft(store.getItem(createPrDraftKey(undefined, prId)));
      if (anonDraft) return anonDraft;
    }

    // /create-pr after soft-save assigned a backend id — look up active pointer / id key.
    if (prId == null) {
      const activeRaw =
        store.getItem(activeDraftKey(userId)) ||
        store.getItem(activeDraftKey('anon')) ||
        store.getItem(activeDraftKey(undefined));
      const activeId = activeRaw ? Number(activeRaw) : NaN;
      if (Number.isFinite(activeId) && activeId > 0) {
        const byActive =
          parseDraft(store.getItem(createPrDraftKey(userId, activeId))) ||
          parseDraft(store.getItem(createPrDraftKey('anon', activeId))) ||
          parseDraft(store.getItem(createPrDraftKey(undefined, activeId)));
        if (byActive) return byActive;
      }
    }

    // Opening /edit-pr/:id after Save Draft from /create-pr — migrate the "new" snapshot.
    if (prId != null) {
      const legacy =
        parseDraft(store.getItem(createPrDraftKey(userId, null))) ||
        parseDraft(store.getItem(createPrDraftKey('anon', null))) ||
        parseDraft(store.getItem(createPrDraftKey(undefined, null)));
      if (!legacy || Number(legacy.backendPrId) !== Number(prId)) return null;
      store.setItem(createPrDraftKey(userId, prId), JSON.stringify(legacy));
      store.removeItem(createPrDraftKey(userId, null));
      if (userId) store.setItem(activeDraftKey(userId), String(prId));
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCreatePrDraft(
  userId: number | string | undefined,
  prId: number | null,
  draft: CreatePrDraftSnapshot
) {
  const store = storage();
  if (!store) return;
  try {
    if (!hasMeaningfulCreatePrDraft(draft)) return;
    const id = prId ?? draft.backendPrId ?? null;
    const payload: CreatePrDraftSnapshot = {
      ...draft,
      savedAt: Date.now(),
      backendPrId: draft.backendPrId ?? id,
    };

    // Never clobber a richer recent draft with an empty remount snapshot (React Strict Mode).
    const existing =
      parseDraft(store.getItem(createPrDraftKey(userId, id))) ||
      (id == null ? null : parseDraft(store.getItem(createPrDraftKey(userId, null))));
    if (existing) {
      // Never drop saved line items because of an empty autosave race.
      if ((existing.lineItems?.length || 0) > (payload.lineItems?.length || 0)) {
        payload.lineItems = existing.lineItems;
      }
      if (
        draftContentScore(payload) < draftContentScore(existing) &&
        Date.now() - existing.savedAt < 120_000
      ) {
        return;
      }
    }

    store.setItem(createPrDraftKey(userId, id), JSON.stringify(payload));
    // Keep /create-pr restore working after backend id is assigned (same tab refresh).
    if (id != null) {
      store.setItem(createPrDraftKey(userId, null), JSON.stringify(payload));
      store.setItem(activeDraftKey(userId), String(id));
    } else if (payload.backendPrId) {
      store.setItem(activeDraftKey(userId), String(payload.backendPrId));
    }
  } catch {
    /* quota / private mode */
  }
}

export function clearCreatePrDraft(userId: number | string | undefined, prId: number | null) {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(createPrDraftKey(userId, prId));
    store.removeItem(createPrDraftKey(userId, null));
    if (prId != null) store.removeItem(createPrDraftKey(userId, prId));
    const activeRaw = store.getItem(activeDraftKey(userId));
    if (!activeRaw || prId == null || Number(activeRaw) === Number(prId)) {
      store.removeItem(activeDraftKey(userId));
    }
    store.removeItem(activeDraftKey('anon'));
    store.removeItem(activeDraftKey(undefined));
  } catch {
    /* ignore */
  }
}

const SOFT_RESUME_KEY = 'p2p.createPr.softResume';

/** Remember in-progress Create PR when user navigates to another menu. */
export function markCreatePrSoftResume(prId: number | null | undefined) {
  try {
    const id = prId && Number(prId) > 0 ? String(prId) : 'local';
    sessionStorage.setItem(SOFT_RESUME_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Returns soft-resume PR id, or 'local', or null if none. Consumes the flag. */
export function consumeCreatePrSoftResume(): number | 'local' | null {
  try {
    const raw = sessionStorage.getItem(SOFT_RESUME_KEY);
    sessionStorage.removeItem(SOFT_RESUME_KEY);
    if (!raw) return null;
    if (raw === 'local') return 'local';
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function peekCreatePrSoftResume(): number | 'local' | null {
  try {
    const raw = sessionStorage.getItem(SOFT_RESUME_KEY);
    if (!raw) return null;
    if (raw === 'local') return 'local';
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/** Clear local in-progress draft so Create PR starts blank (does not delete server PRs). */
export function startFreshCreatePr(userId: number | string | undefined) {
  clearCreatePrDraft(userId, null);
  try {
    sessionStorage.removeItem(SOFT_RESUME_KEY);
    const store = storage();
    if (!store) return;
    store.removeItem(activeDraftKey(userId));
    store.removeItem(activeDraftKey('anon'));
    store.removeItem(activeDraftKey(undefined));
    store.removeItem(createPrDraftKey(userId, null));
    store.removeItem(createPrDraftKey('anon', null));
    store.removeItem(createPrDraftKey(undefined, null));
  } catch {
    /* ignore */
  }
}
