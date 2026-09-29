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
    label: 'Mugesh (PR Approval)',
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
    label: 'Mugesh (Vendor Approval)',
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
  SCM_PO: {
    key: 'SCM_PO',
    label: 'SCM Buyer Create PO',
    status: PR_STATUS.PENDING_SCM_PO,
    stage: STAGE.SCM_PO_CREATE,
    taskType: 'RFQ_POST_APPROVAL',
    assignedRole: 'SCM Buyer',
    resetRfqSubmit: false,
    resetRfqFinalize: false,
  },
  REQUESTER_PO: {
    key: 'REQUESTER_PO',
    label: 'Requester Create PO',
    status: PR_STATUS.PENDING_SCM_PO,
    stage: STAGE.SCM_PO_CREATE,
    taskType: 'RFQ_POST_APPROVAL',
    assignedRole: 'Requester',
    resetRfqSubmit: false,
    resetRfqFinalize: false,
  },
  PO_MANAGER_SIGN: {
    key: 'PO_MANAGER_SIGN',
    label: 'SCM Manager PO Sign',
    status: PR_STATUS.APPROVED,
    stage: STAGE.PO_CREATED,
    taskType: 'PO_APPROVAL',
    assignedRole: 'SCM Manager',
    resetRfqSubmit: false,
    resetRfqFinalize: false,
    poStatus: 'pending_approval',
  },
  PO_BUYER_VERIFY: {
    key: 'PO_BUYER_VERIFY',
    label: 'SCM Buyer Final Verify',
    status: PR_STATUS.APPROVED,
    stage: STAGE.PO_CREATED,
    taskType: 'PO_BUYER_VERIFY',
    assignedRole: 'SCM Buyer',
    resetRfqSubmit: false,
    resetRfqFinalize: false,
    poStatus: 'pending_buyer_verify',
  },
  PO_MUGESH_SIGN: {
    key: 'PO_MUGESH_SIGN',
    label: 'Mugesh Sign & Upload',
    status: PR_STATUS.APPROVED,
    stage: STAGE.PO_CREATED,
    taskType: 'PO_MUGESH_SIGN',
    assignedRole: 'CFO',
    resetRfqSubmit: false,
    resetRfqFinalize: false,
    poStatus: 'pending_approval',
    poSignStep: 'mugesh',
  },
  PO_REQUESTER_VERIFY: {
    key: 'PO_REQUESTER_VERIFY',
    label: 'Requester Buyer Final Verify',
    status: PR_STATUS.APPROVED,
    stage: STAGE.PO_CREATED,
    taskType: 'PO_BUYER_VERIFY',
    assignedRole: 'Requester',
    resetRfqSubmit: false,
    resetRfqFinalize: false,
    poStatus: 'pending_buyer_verify',
    poSignStep: 'signed',
  },
};

const FUNCTIONAL_PREVIOUS_BY_STATUS = {
  [PR_STATUS.PENDING_HOD_APPROVAL]: ['REQUESTER'],
  [PR_STATUS.APPROVED]: ['REQUESTER', 'HOD_PRE', 'SCM_RFQ'],
  [PR_STATUS.PENDING_BUSINESS_APPROVAL]: ['SCM_RFQ', 'HOD_PRE', 'REQUESTER'],
  [PR_STATUS.PENDING_SCM_PO]: ['SCM_MANAGER', 'SCM_RFQ', 'HOD_PRE', 'REQUESTER'],
};

function withFunctionalLabels(def) {
  if (!def) return def;
  if (def.key === 'HOD_PRE') return { ...def, label: 'User Approval' };
  return def;
}

/** Previous steps available from each current status (manager / task holder) */
const PREVIOUS_BY_STATUS = {
  [PR_STATUS.PENDING_HOD_APPROVAL]: ['REQUESTER'],
  [PR_STATUS.PENDING_PR_MANAGER_APPROVAL]: ['REQUESTER', 'HOD_PRE'],
  [PR_STATUS.PENDING_CFO_APPROVAL]: ['REQUESTER', 'HOD_PRE', 'L2_PRE'],

  [PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL]: ['REQUESTER', 'REQUESTER_RFQ', 'HOD_PRE'],
  [PR_STATUS.PENDING_RFQ_L2_APPROVAL]: ['REQUESTER', 'REQUESTER_RFQ', 'HOD_PRE', 'HOD_VENDOR'],
  [PR_STATUS.PENDING_RFQ_CFO_APPROVAL]: ['REQUESTER', 'REQUESTER_RFQ', 'HOD_PRE', 'HOD_VENDOR', 'L2_VENDOR'],

  [PR_STATUS.PENDING_BUSINESS_APPROVAL]: ['SCM_RFQ', 'REQUESTER_RFQ', 'REQUESTER', 'HOD_PRE', 'L2_PRE', 'CFO_PRE'],
  [PR_STATUS.PENDING_SCM_PO]: ['SCM_MANAGER', 'SCM_RFQ', 'REQUESTER_RFQ', 'REQUESTER', 'HOD_PRE', 'L2_PRE', 'CFO_PRE'],

  [PR_STATUS.APPROVED]: [
    'REQUESTER',
    'REQUESTER_RFQ',
    'SCM_RFQ',
    'HOD_PRE',
    'L2_PRE',
    'CFO_PRE',
    'HOD_VENDOR',
    'L2_VENDOR',
    'CFO_VENDOR',
  ],
};

/**
 * Admin full catalog — any workflow step (not limited to predecessors).
 * First three are RFQ-entry related: Edit PR, Requester RFQ Entry, SCM RFQ Entry.
 */
const ADMIN_ANY_STEP_KEYS = [
  'REQUESTER',
  'REQUESTER_RFQ',
  'SCM_RFQ',
  'HOD_PRE',
  'L2_PRE',
  'CFO_PRE',
  'HOD_VENDOR',
  'L2_VENDOR',
  'CFO_VENDOR',
  'SCM_MANAGER',
  'SCM_PO',
  'PO_MANAGER_SIGN',
  'PO_BUYER_VERIFY',
];

/** Requester-created PO: same early steps, then requester PO steps. No SCM Buyer / SCM Manager. */
const ADMIN_REQUESTER_PO_STEP_KEYS = [
  'REQUESTER',
  'REQUESTER_RFQ',
  'HOD_PRE',
  'L2_PRE',
  'CFO_PRE',
  'HOD_VENDOR',
  'L2_VENDOR',
  'CFO_VENDOR',
  'REQUESTER_PO',
  'PO_MUGESH_SIGN',
  'PO_REQUESTER_VERIFY',
];

const OWN_ONLY_KEYS = new Set(['REQUESTER_RFQ', 'HOD_VENDOR', 'L2_VENDOR', 'CFO_VENDOR']);
const SCM_ONLY_KEYS = new Set(['SCM_RFQ', 'SCM_MANAGER', 'L2_PRE', 'CFO_PRE']);

/**
 * List send-back targets for a PR at its current status (manager / task holder).
 * Filters own vs SCM where useful.
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
 * Admin: every workflow step (Edit PR + RFQ Entry steps + all approval stages).
 * Not limited by current status or own/SCM path — admin may reopen any step.
 */
export function listAdminSendBackTargets(_status, _vendorSelection = 'scm', prFlow = 'standard', poCreationBy = 'scm') {
  const functional = prFlow === 'functional';
  const requesterPo = String(poCreationBy || 'scm') === 'requester';
  const keys = requesterPo ? ADMIN_REQUESTER_PO_STEP_KEYS : ADMIN_ANY_STEP_KEYS;
  return keys.map((key) => {
    const def = SEND_BACK_TARGET_DEFS[key];
    if (!def) return null;
    return functional ? withFunctionalLabels(def) : def;
  })
    .filter(Boolean)
    .map((def) => ({ key: def.key, label: def.label }));
}

export function resolveSendBackTarget(returnTo) {
  if (!returnTo) return null;
  return SEND_BACK_TARGET_DEFS[returnTo] || null;
}

/** Roles that may use the full admin send-back catalog (Track PR / override). */
export const ADMIN_SEND_BACK_ROLES = [
  'Super Admin',
  'SCM Manager',
  'SCM Buyer',
  'HOD Approver',
  'PR Manager',
  'CFO',
];

/** Roles that may use the full admin send-back catalog on task approve/return. */
export function canUseAdminSendBackCatalog(user) {
  if (!user) return false;
  if (user.isSuperAdmin || user.role === 'Super Admin') return true;
  // SCM leads: full override from My Tasks / RFQ Approval (same as Track PR admin for these roles)
  return user.role === 'SCM Manager' || user.role === 'SCM Buyer';
}
