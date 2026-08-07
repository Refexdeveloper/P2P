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
  RFQ_MANAGER_REVIEW: 'RFQ_MANAGER_REVIEW', // HOD vendor final
  RFQ_L2_REVIEW: 'RFQ_L2_REVIEW',
  RFQ_CFO_REVIEW: 'RFQ_CFO_REVIEW',
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

export function mapStatusToManagerUI(status) {
  const map = {
    [PR_STATUS.PENDING_HOD_APPROVAL]: 'Pending HOD Approval',
    [PR_STATUS.PENDING_PR_MANAGER_APPROVAL]: 'Pending L2 Manager Approval',
    [PR_STATUS.PENDING_CFO_APPROVAL]: 'Pending CFO Approval',
    [PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL]: 'Pending HOD Vendor Final',
    [PR_STATUS.PENDING_RFQ_L2_APPROVAL]: 'Pending L2 Manager Approval',
    [PR_STATUS.PENDING_RFQ_CFO_APPROVAL]: 'Pending RFQ CFO Approval',
    [PR_STATUS.PENDING_BUSINESS_APPROVAL]: 'Pending SCM Manager Vendor Approval',
    [PR_STATUS.PENDING_SCM_PO]: 'Pending SCM PO',
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
  return d.toISOString().split('T')[0];
}

export function formatDateTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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
