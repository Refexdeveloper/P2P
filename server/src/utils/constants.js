export const PR_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_HOD_APPROVAL: 'PENDING_HOD_APPROVAL',
  PENDING_PR_MANAGER_APPROVAL: 'PENDING_PR_MANAGER_APPROVAL', // L2 Manager (pre-RFQ, SCM path)
  PENDING_CFO_APPROVAL: 'PENDING_CFO_APPROVAL',
  PENDING_RFQ_MANAGER_APPROVAL: 'PENDING_RFQ_MANAGER_APPROVAL', // HOD vendor final (Own path)
  PENDING_RFQ_L2_APPROVAL: 'PENDING_RFQ_L2_APPROVAL', // L2 Manager (post-RFQ, Own path)
  PENDING_RFQ_CFO_APPROVAL: 'PENDING_RFQ_CFO_APPROVAL', // CFO (post-RFQ, Own path)
  PENDING_BUSINESS_APPROVAL: 'PENDING_BUSINESS_APPROVAL', // SCM Manager vendor approval (SCM path)
  PENDING_SCM_PO: 'PENDING_SCM_PO',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RETURNED: 'RETURNED',
};

export const STAGE = {
  SUBMITTED: 'SUBMITTED',
  HOD_REVIEW: 'HOD_REVIEW',
  PR_MANAGER_REVIEW: 'PR_MANAGER_REVIEW', // L2 Manager review
  CFO_REVIEW: 'CFO_REVIEW',
  RFQ_REQUESTER_SUBMIT: 'RFQ_REQUESTER_SUBMIT', // Own path: requester submits RFQ for vendor final
  RFQ_MANAGER_REVIEW: 'RFQ_MANAGER_REVIEW', // HOD / L1 vendor final
  RFQ_L2_REVIEW: 'RFQ_L2_REVIEW',
  RFQ_CFO_REVIEW: 'RFQ_CFO_REVIEW',
  RFQ_SCM_BUYER_SELECTION: 'RFQ_SCM_BUYER_SELECTION', // SCM Buyer vendor selection / final RFQ
  BUSINESS_REVIEW: 'BUSINESS_REVIEW', // SCM Manager vendor approval
  SCM_PO_CREATE: 'SCM_PO_CREATE',
  PO_CREATED: 'PO_CREATED',
};

/** Pre-RFQ approval chain (SCM path: HOD → L2 → CFO). Own path branches after HOD. */
export const ROLE_STAGE_MAP = {
  'HOD Approver': { status: PR_STATUS.PENDING_HOD_APPROVAL, stage: STAGE.HOD_REVIEW, nextRole: 'PR Manager' },
  'PR Manager': { status: PR_STATUS.PENDING_PR_MANAGER_APPROVAL, stage: STAGE.PR_MANAGER_REVIEW, nextRole: 'CFO' },
  CFO: { status: PR_STATUS.PENDING_CFO_APPROVAL, stage: STAGE.CFO_REVIEW, nextRole: null },
};

/**
 * Post-RFQ approval chain
 * Own: HOD vendor final → L2 → (optional CFO) → APPROVED (SCM final RFQ)
 *      Yes: L2 → CFO → SCM Final | No: L2 → SCM Final (skip CFO)
 * SCM: SCM Manager vendor approval → Create PO
 */
export const POST_RFQ_ROLE_MAP = {
  'HOD Approver': {
    status: PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL,
    stage: STAGE.RFQ_MANAGER_REVIEW,
    nextRole: 'PR Manager',
    nextStatus: PR_STATUS.PENDING_RFQ_L2_APPROVAL,
    nextStage: STAGE.RFQ_L2_REVIEW,
    label: 'L1 Manager Vendor Final Approval',
    showFullNegotiation: true,
  },
  'PR Manager': {
    status: PR_STATUS.PENDING_RFQ_L2_APPROVAL,
    stage: STAGE.RFQ_L2_REVIEW,
    nextRole: 'CFO',
    nextStatus: PR_STATUS.PENDING_RFQ_CFO_APPROVAL,
    nextStage: STAGE.RFQ_CFO_REVIEW,
    label: 'L2 Manager Approval',
    showFullNegotiation: true,
  },
  CFO: {
    status: PR_STATUS.PENDING_RFQ_CFO_APPROVAL,
    stage: STAGE.RFQ_CFO_REVIEW,
    nextRole: null,
    nextStatus: PR_STATUS.APPROVED,
    nextStage: null,
    label: 'CFO Approval',
    showFullNegotiation: true,
  },
  'SCM Manager': {
    status: PR_STATUS.PENDING_BUSINESS_APPROVAL,
    stage: STAGE.BUSINESS_REVIEW,
    nextRole: 'SCM Buyer',
    nextStatus: PR_STATUS.PENDING_SCM_PO,
    nextStage: STAGE.SCM_PO_CREATE,
    label: 'SCM Manager Vendor Approval',
    showFullNegotiation: true,
  },
  'SCM Buyer': {
    status: PR_STATUS.PENDING_SCM_PO,
    stage: STAGE.SCM_PO_CREATE,
    nextRole: null,
    nextStatus: PR_STATUS.APPROVED,
    nextStage: STAGE.PO_CREATED,
    label: 'SCM PO Create',
    showFullNegotiation: true,
  },
};

export function getPostRfqRoleConfig(role) {
  return POST_RFQ_ROLE_MAP[role] || null;
}

export function getPostRfqPendingStatusesForRole(role) {
  const cfg = POST_RFQ_ROLE_MAP[role];
  return cfg ? [cfg.status] : [];
}

export function mapStatusToFrontend(status) {
  const map = {
    [PR_STATUS.DRAFT]: 'draft',
    [PR_STATUS.PENDING_HOD_APPROVAL]: 'pending_approval',
    [PR_STATUS.PENDING_PR_MANAGER_APPROVAL]: 'pending_approval',
    [PR_STATUS.PENDING_CFO_APPROVAL]: 'pending_approval',
    [PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL]: 'pending_approval',
    [PR_STATUS.PENDING_RFQ_L2_APPROVAL]: 'pending_approval',
    [PR_STATUS.PENDING_RFQ_CFO_APPROVAL]: 'pending_approval',
    [PR_STATUS.PENDING_BUSINESS_APPROVAL]: 'pending_approval',
    [PR_STATUS.PENDING_SCM_PO]: 'pending_approval',
    [PR_STATUS.APPROVED]: 'approved',
    [PR_STATUS.REJECTED]: 'rejected',
    [PR_STATUS.RETURNED]: 'returned',
  };
  return map[status] || status.toLowerCase();
}

/** PO statuses where the signed document may be viewed by the PR requester. */
export const REQUESTER_PO_DOCUMENT_STATUSES = new Set([
  'sent_to_vendor',
  'awaiting_grn',
  'grn_completed',
  'invoice_entry',
  'pending_accounts_approval',
  'approved_for_payment',
  'paid',
]);

/**
 * Requester-facing status labels — accounts for PO send-back and signed/released POs
 * while the PR row may still be APPROVED.
 */
export function resolveRequesterPrDisplay(prStatus, prFlow = 'standard', vendorSelection = 'scm', poMeta = null) {
  const po = poMeta && typeof poMeta === 'object' ? poMeta : {};
  const poId = po.id ? Number(po.id) : null;
  const poNumber = po.poNumber || po.po_number || '';
  const poStatus = String(po.status || '');
  const poSentBack = Boolean(po.poSentBack);
  const poSigned = Boolean(po.signedAt || po.signed_at || po.signedPdfPath || po.signed_pdf_path);

  let statusFrontend = mapStatusToFrontend(prStatus);
  let statusUI = mapStatusToManagerUI(prStatus, prFlow, vendorSelection);
  let poDocumentAvailable = false;

  if (prStatus === PR_STATUS.RETURNED) {
    return {
      statusFrontend: 'returned',
      statusUI: 'Returned for Rework',
      poId,
      poNumber,
      poStatus,
      poDocumentAvailable: false,
      poSentBack: false,
    };
  }

  if (prStatus === PR_STATUS.REJECTED) {
    return {
      statusFrontend: 'rejected',
      statusUI: 'Rejected',
      poId,
      poNumber,
      poStatus,
      poDocumentAvailable: false,
      poSentBack: false,
    };
  }

  if (poId && poSentBack && poStatus === 'draft') {
    return {
      statusFrontend: 'returned',
      statusUI: 'Sent Back — Revise PO',
      poId,
      poNumber,
      poStatus,
      poDocumentAvailable: false,
      poSentBack: true,
    };
  }

  if (poId) {
    if (poStatus === 'pending_buyer_verify' && poSigned) {
      return {
        statusFrontend: 'approved',
        statusUI: 'PO Signed — Pending Buyer Verify',
        poId,
        poNumber,
        poStatus,
        poDocumentAvailable: false,
        poSentBack: false,
      };
    }
    if (poStatus === 'approved') {
      return {
        statusFrontend: 'approved',
        statusUI: 'PO Approved — Pending Release',
        poId,
        poNumber,
        poStatus,
        poDocumentAvailable: false,
        poSentBack: false,
      };
    }
    if (REQUESTER_PO_DOCUMENT_STATUSES.has(poStatus)) {
      const releasedLabel =
        poStatus === 'sent_to_vendor'
          ? 'PO Released to Vendor'
          : 'PO Released';
      return {
        statusFrontend: 'po_issued',
        statusUI: releasedLabel,
        poId,
        poNumber,
        poStatus,
        poDocumentAvailable: true,
        poSentBack: false,
      };
    }
    if (poStatus === 'pending_approval') {
      return {
        statusFrontend: 'pending_approval',
        statusUI: 'Pending SCM Manager PO Sign',
        poId,
        poNumber,
        poStatus,
        poDocumentAvailable: false,
        poSentBack: false,
      };
    }
    if (poStatus === 'draft') {
      return {
        statusFrontend: 'pending_approval',
        statusUI: 'PO Creation In Progress',
        poId,
        poNumber,
        poStatus,
        poDocumentAvailable: false,
        poSentBack: false,
      };
    }
  }

  if (prStatus === PR_STATUS.APPROVED && !poId) {
    statusFrontend = 'approved';
    statusUI = 'Approved — Awaiting PO';
  }

  return {
    statusFrontend,
    statusUI,
    poId,
    poNumber,
    poStatus,
    poDocumentAvailable,
    poSentBack: false,
  };
}

export function mapStatusToManagerUI(status, prFlow = 'standard', vendorSelection = 'scm') {
  if (prFlow === 'functional') {
    const functionalMap = {
      [PR_STATUS.PENDING_HOD_APPROVAL]: 'Pending User Approval',
      [PR_STATUS.APPROVED]:
        vendorSelection === 'own' ? 'SCM Final RFQ' : 'SCM RFQ Entry',
      [PR_STATUS.REJECTED]: 'Rejected',
      [PR_STATUS.RETURNED]: 'Returned for Rework',
      [PR_STATUS.DRAFT]: 'Draft',
    };
    if (functionalMap[status]) return functionalMap[status];
  }
  const map = {
    [PR_STATUS.PENDING_HOD_APPROVAL]: 'Pending L1 Manager Approval',
    [PR_STATUS.PENDING_PR_MANAGER_APPROVAL]: 'Pending L2 Manager Approval',
    [PR_STATUS.PENDING_CFO_APPROVAL]: 'Pending CFO Approval',
    [PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL]: 'Pending L1 Vendor Final',
    [PR_STATUS.PENDING_RFQ_L2_APPROVAL]: 'Pending L2 Manager Approval',
    [PR_STATUS.PENDING_RFQ_CFO_APPROVAL]: 'Pending RFQ CFO Approval',
    [PR_STATUS.PENDING_BUSINESS_APPROVAL]: 'Pending SCM Manager Vendor Approval',
    [PR_STATUS.PENDING_SCM_PO]: 'Pending SCM Buyer Create PO',
    [PR_STATUS.APPROVED]: 'Approved',
    [PR_STATUS.REJECTED]: 'Rejected',
    [PR_STATUS.RETURNED]: 'Returned for Rework',
    [PR_STATUS.DRAFT]: 'Draft',
  };
  return map[status] || status;
}

export function mapPriorityToFrontend(priority) {
  return (priority || 'Medium').toLowerCase();
}

export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function formatDateTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export async function generatePrNumber(pool) {
  // Legacy helper — prefer nextDocumentNumber('PR', entityId)
  const year = new Date().getFullYear();
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS cnt FROM purchase_requests WHERE YEAR(created_at) = ?',
    [year]
  );
  const seq = String(Number(rows[0].cnt) + 1).padStart(4, '0');
  return `PR-${year}-${seq}`;
}
