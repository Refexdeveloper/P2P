const PREFIX = 'p2p.createPr.draft';
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
  purchaseType: 'purchase_order' | 'work_order';
  vendorSelection: 'own' | 'scm';
  prFlow: 'standard' | 'functional';
  approvalUserIds: number[];
  rfqMaxRounds: number;
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
    }>;
  }>;
  priority: string;
  currency: string;
  businessJustification: string;
  requiredDate: string;
  billingLocationId: number | '';
  billingLocation: string;
  billingGstNo: string;
  billingAddress: string;
  deliveryPoc: string;
  placeOfDelivery: string;
  expectedDeliveryTimeline: string;
  paymentTerms: string;
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

export function createPrDraftKey(userId: number | string | undefined, prId: number | null) {
  return `${PREFIX}.${userId || 'anon'}.${prId ?? 'new'}`;
}

export function hasMeaningfulCreatePrDraft(draft: CreatePrDraftSnapshot | null | undefined): boolean {
  if (!draft) return false;
  return Boolean(
    draft.prTitle.trim() ||
      draft.businessJustification.trim() ||
      draft.deliveryPoc.trim() ||
      draft.placeOfDelivery.trim() ||
      draft.expectedDeliveryTimeline.trim() ||
      draft.lineItems.length > 0 ||
      (draft.prNumber && draft.prNumber !== 'Auto on save') ||
      draft.backendPrId
  );
}

export function readCreatePrDraft(
  userId: number | string | undefined,
  prId: number | null
): CreatePrDraftSnapshot | null {
  try {
    const raw = sessionStorage.getItem(createPrDraftKey(userId, prId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CreatePrDraftSnapshot;
    if (!parsed || parsed.v !== 1 || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      sessionStorage.removeItem(createPrDraftKey(userId, prId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeCreatePrDraft(
  userId: number | string | undefined,
  prId: number | null,
  draft: CreatePrDraftSnapshot
) {
  try {
    if (!hasMeaningfulCreatePrDraft(draft)) return;
    sessionStorage.setItem(createPrDraftKey(userId, prId), JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    /* quota / private mode */
  }
}

export function clearCreatePrDraft(userId: number | string | undefined, prId: number | null) {
  try {
    sessionStorage.removeItem(createPrDraftKey(userId, prId));
  } catch {
    /* ignore */
  }
}
