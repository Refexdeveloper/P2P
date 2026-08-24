import { PR_STATUS, STAGE } from './constants.js';

/**
 * Send-back target definitions (shared by pre-RFQ + post-RFQ flows).
 * `key` is what the client sends as `returnTo`.
 */
export const SEND_BACK_TARGET_DEFS = {
  REQUESTER: {
    key: 'REQUESTER',
    label: 'Requester (Edit PR)',
    status: PR_STATUS.RETURNED,
    stage: null,
    taskType: null,
    assignedRole: null,
    resetRfqSubmit: true,
    resetRfqFinalize: true,
  },
  REQUESTER_RFQ: {
    key: 'REQUESTER_RFQ',
    label: 'Requester RFQ Entry',
    status: PR_STATUS.APPROVED,
    stage: null,
    taskType: 'RFQ_ENTRY',
    assignedRole: 'Requester',
    resetRfqSubmit: true,
    resetRfqFinalize: true,
    clearRecommendation: true,
  },
  SCM_RFQ: {
    key: 'SCM_RFQ',
    label: 'SCM RFQ Entry',
    status: PR_STATUS.APPROVED,
    stage: null,
    taskType: 'RFQ_ENTRY',
    assignedRole: 'SCM Buyer',
    resetRfqSubmit: false,
    resetRfqFinalize: true,
    clearRecommendation: true,
  },
  HOD_PRE: {
    key: 'HOD_PRE',
    label: 'L1 Manager (PR Approval)',
    status: PR_STATUS.PENDING_HOD_APPROVAL,
    stage: STAGE.HOD_REVIEW,
    taskType: 'PR_APPROVAL',
    assignedRole: 'HOD Approver',
    resetRfqSubmit: true,
    resetRfqFinalize: true,
  },
  L2_PRE: {
    key: 'L2_PRE',
    label: 'L2 Manager (PR Approval)',
    status: PR_STATUS.PENDING_PR_MANAGER_APPROVAL,
    stage: STAGE.PR_MANAGER_REVIEW,
    taskType: 'PR_APPROVAL',
    assignedRole: 'PR Manager',
    resetRfqSubmit: true,
    resetRfqFinalize: true,
  },
  CFO_PRE: {
    key: 'CFO_PRE',
    label: 'CFO (PR Approval)',
    status: PR_STATUS.PENDING_CFO_APPROVAL,
    stage: STAGE.CFO_REVIEW,
    taskType: 'PR_APPROVAL',
    assignedRole: 'CFO',
    resetRfqSubmit: true,
    resetRfqFinalize: true,
  },
  HOD_VENDOR: {
    key: 'HOD_VENDOR',
    label: 'L1 Manager Vendor Final',
    status: PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL,
    stage: STAGE.RFQ_MANAGER_REVIEW,
    taskType: 'RFQ_POST_APPROVAL',
    assignedRole: 'HOD Approver',
    resetRfqSubmit: false,
    resetRfqFinalize: false,
  },
  L2_VENDOR: {
    key: 'L2_VENDOR',
    label: 'L2 Manager (Vendor Approval)',
    status: PR_STATUS.PENDING_RFQ_L2_APPROVAL,
    stage: STAGE.RFQ_L2_REVIEW,
    taskType: 'RFQ_POST_APPROVAL',
    assignedRole: 'PR Manager',
    resetRfqSubmit: false,
    resetRfqFinalize: false,
  },
  CFO_VENDOR: {
    key: 'CFO_VENDOR',
    label: 'CFO (Vendor Approval)',
    status: PR_STATUS.PENDING_RFQ_CFO_APPROVAL,
    stage: STAGE.RFQ_CFO_REVIEW,
    taskType: 'RFQ_POST_APPROVAL',
    assignedRole: 'CFO',
    resetRfqSubmit: false,
    resetRfqFinalize: false,
  },
  SCM_MANAGER: {
    key: 'SCM_MANAGER',
    label: 'SCM Manager Vendor Selection',
    status: PR_STATUS.PENDING_BUSINESS_APPROVAL,
    stage: STAGE.BUSINESS_REVIEW,
    taskType: 'RFQ_POST_APPROVAL',
    assignedRole: 'SCM Manager',
    resetRfqSubmit: false,
    resetRfqFinalize: false,
  },
};

const FUNCTIONAL_PREVIOUS_BY_STATUS = {
  [PR_STATUS.PENDING_HOD_APPROVAL]: ['REQUESTER'],
  [PR_STATUS.APPROVED]: ['REQUESTER', 'HOD_PRE', 'SCM_RFQ'],
  [PR_STATUS.PENDING_BUSINESS_APPROVAL]: ['SCM_RFQ', 'HOD_PRE', 'REQUESTER'],
  [PR_STATUS.PENDING_SCM_PO]: ['SCM_MANAGER', 'SCM_RFQ', 'HOD_PRE', 'REQUESTER'],
};

const ADMIN_FUNCTIONAL_KEYS = ['REQUESTER', 'HOD_PRE', 'SCM_RFQ', 'SCM_MANAGER'];

function withFunctionalLabels(def) {
  if (!def) return def;
  if (def.key === 'HOD_PRE') return { ...def, label: 'User Approval' };
  return def;
}

/** Previous steps available from each current status */
const PREVIOUS_BY_STATUS = {
  [PR_STATUS.PENDING_HOD_APPROVAL]: ['REQUESTER'],
  [PR_STATUS.PENDING_PR_MANAGER_APPROVAL]: ['REQUESTER', 'HOD_PRE'],
  [PR_STATUS.PENDING_CFO_APPROVAL]: ['REQUESTER', 'HOD_PRE', 'L2_PRE'],

  [PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL]: ['REQUESTER', 'REQUESTER_RFQ', 'HOD_PRE'],
  [PR_STATUS.PENDING_RFQ_L2_APPROVAL]: ['REQUESTER', 'REQUESTER_RFQ', 'HOD_PRE', 'HOD_VENDOR'],
  [PR_STATUS.PENDING_RFQ_CFO_APPROVAL]: ['REQUESTER', 'REQUESTER_RFQ', 'HOD_PRE', 'HOD_VENDOR', 'L2_VENDOR'],

  // SCM Manager vendor approval — default first target is SCM RFQ Entry
  [PR_STATUS.PENDING_BUSINESS_APPROVAL]: ['SCM_RFQ', 'REQUESTER', 'HOD_PRE', 'L2_PRE', 'CFO_PRE'],
  [PR_STATUS.PENDING_SCM_PO]: ['SCM_MANAGER', 'SCM_RFQ', 'REQUESTER', 'HOD_PRE', 'L2_PRE', 'CFO_PRE'],

  // During / after RFQ entry (status APPROVED until post-RFQ queue starts)
  [PR_STATUS.APPROVED]: ['REQUESTER', 'REQUESTER_RFQ', 'SCM_RFQ', 'HOD_PRE', 'L2_PRE', 'CFO_PRE', 'HOD_VENDOR', 'L2_VENDOR', 'CFO_VENDOR'],
};

/** Full catalog for admin override — any prior workflow step for the PR path */
const ADMIN_OWN_KEYS = [
  'REQUESTER',
  'HOD_PRE',
  'REQUESTER_RFQ',
  'HOD_VENDOR',
  'L2_VENDOR',
  'CFO_VENDOR',
  'SCM_RFQ',
];
const ADMIN_SCM_KEYS = [
  'REQUESTER',
  'HOD_PRE',
  'L2_PRE',
  'CFO_PRE',
  'SCM_RFQ',
  'SCM_MANAGER',
];

const OWN_ONLY_KEYS = new Set(['REQUESTER_RFQ', 'HOD_VENDOR', 'L2_VENDOR', 'CFO_VENDOR']);
const SCM_ONLY_KEYS = new Set(['SCM_RFQ', 'SCM_MANAGER', 'L2_PRE', 'CFO_PRE']);

/**
 * List send-back targets for a PR at its current status.
 * Filters own vs SCM where useful (e.g. hide SCM_RFQ on own path).
 */
export function listSendBackTargets(status, vendorSelection = 'scm', prFlow = 'standard') {
  if (prFlow === 'functional') {
    const keys = FUNCTIONAL_PREVIOUS_BY_STATUS[status] || ['REQUESTER'];
    return keys
      .map((key) => withFunctionalLabels(SEND_BACK_TARGET_DEFS[key]))
      .filter(Boolean)
      .map((def) => ({ key: def.key, label: def.label }));
  }

  const isOwn = vendorSelection === 'own';
  const keys = PREVIOUS_BY_STATUS[status] || ['REQUESTER'];

  return keys
    .filter((key) => {
      if (isOwn && SCM_ONLY_KEYS.has(key)) return false;
      if (!isOwn && OWN_ONLY_KEYS.has(key)) return false;
      return true;
    })
    .map((key) => {
      const def = SEND_BACK_TARGET_DEFS[key];
      return { key: def.key, label: def.label };
    });
}

/**
 * Admin: every prior stage for this vendor path (not limited to immediate predecessors).
 * Excludes targets that would leave the PR at the same status.
 */
export function listAdminSendBackTargets(status, vendorSelection = 'scm', prFlow = 'standard') {
  if (prFlow === 'functional') {
    return ADMIN_FUNCTIONAL_KEYS
      .map((key) => withFunctionalLabels(SEND_BACK_TARGET_DEFS[key]))
      .filter((def) => def && def.status !== status)
      .map((def) => ({ key: def.key, label: def.label }));
  }
  const isOwn = vendorSelection === 'own';
  const keys = isOwn ? ADMIN_OWN_KEYS : ADMIN_SCM_KEYS;
  return keys
    .map((key) => SEND_BACK_TARGET_DEFS[key])
    .filter((def) => def && def.status !== status)
    .map((def) => ({ key: def.key, label: def.label }));
}

export function resolveSendBackTarget(returnTo) {
  if (!returnTo) return null;
  return SEND_BACK_TARGET_DEFS[returnTo] || null;
}
