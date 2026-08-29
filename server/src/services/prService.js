import pool from '../config/db.js';
import {
  queuePrRaisedNotification,
  queuePrApprovalPendingNotification,
  queuePostRfqActionNotification,
  queueRequesterStepProgressNotification,
  queueApproverActionConfirmationForUser,
} from './emailService.js';
import {
  getL1ManagerForEmail,
  getL2ManagerForEmail,
  ensureApproverUser,
} from './refexOneService.js';
import {
  PR_STATUS,
  STAGE,
  ROLE_STAGE_MAP,
  POST_RFQ_ROLE_MAP,
  mapStatusToFrontend,
  mapStatusToManagerUI,
  mapPriorityToFrontend,
  resolveRequesterPrDisplay,
  formatDate,
  formatDateTime,
} from '../utils/constants.js';
import { nextDocumentNumber, normalizePurchaseType, purchaseTypeLabel } from './documentNumberService.js';
import { resolveScmBuyerUser, getScmBuyerNotifyEmails, resolveScmManagerUser } from '../utils/scmAssignee.js';

async function fetchLatestPoMetaByPrIds(prIds) {
  if (!Array.isArray(prIds) || !prIds.length) return new Map();
  const [poRows] = await pool.query(
    `SELECT po.id, po.pr_id, po.po_number, po.status, po.signed_at, po.signed_pdf_path, po.pdf_path
     FROM purchase_orders po
     INNER JOIN (
       SELECT pr_id, MAX(id) AS max_id FROM purchase_orders GROUP BY pr_id
     ) latest ON latest.max_id = po.id
     WHERE po.pr_id IN (?)`,
    [prIds]
  );
  const [reviseRows] = await pool.query(
    `SELECT DISTINCT pr_id FROM workflow_tasks
     WHERE pr_id IN (?) AND task_type = 'PO_REVISION' AND status = 'pending'`,
    [prIds]
  );
  const reviseSet = new Set(reviseRows.map((r) => Number(r.pr_id)));
  const map = new Map();
  for (const po of poRows) {
    const prId = Number(po.pr_id);
    map.set(prId, {
      id: po.id,
      poNumber: po.po_number,
      status: po.status,
      signedAt: po.signed_at,
      signedPdfPath: po.signed_pdf_path,
      pdfPath: po.pdf_path,
      poSentBack: reviseSet.has(prId) && po.status === 'draft',
    });
  }
  return map;
}

function applyRequesterDisplay(pr, poMeta = null) {
  const display = resolveRequesterPrDisplay(
    pr.status,
    pr.prFlow === 'functional' ? 'functional' : 'standard',
    pr.vendorSelection === 'own' ? 'own' : 'scm',
    poMeta
  );
  return {
    ...pr,
    statusFrontend: display.statusFrontend,
    statusUI: display.statusUI,
    poId: display.poId,
    poNumber: display.poNumber,
    poStatus: display.poStatus || '',
    poDocumentAvailable: Boolean(display.poDocumentAvailable),
    poSentBack: Boolean(display.poSentBack),
    hasPurchaseOrder: Boolean(display.poId || pr.hasPurchaseOrder),
  };
}
import { applySendBackToTarget, queueSendBackNotifications } from './sendBackService.js';
import { listPrAttachments, savePrAttachments } from './prAttachmentService.js';
import { getUserPermissionCodes, isSuperAdmin } from './permissionService.js';

function clipText(value, max) {
  return String(value || '').trim().slice(0, max);
}

function normalizeRequestCategory(value) {
  const s = String(value || '').trim().toLowerCase();
  if (s === 'product') return 'Product';
  if (s === 'service') return 'Service';
  return '';
}

function parseRequisitionExtras(body = {}, fallback = {}) {
  const pick = (keys, max = 255) => {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
        return max > 255 ? String(body[key] || '').trim() : clipText(body[key], max);
      }
    }
    return fallback[keys[0]] || '';
  };
  return {
    deliveryPoc: pick(['deliveryPoc', 'pocForDelivery']),
    placeOfDelivery: pick(['placeOfDelivery'], 4000),
    billingAddress: pick(['billingAddress'], 4000),
    expectedDeliveryTimeline: pick(['expectedDeliveryTimeline']),
    paymentTerms: pick(['paymentTerms']),
    projectDetail: pick(['projectDetail', 'project_detail']),
    specialNotes: pick(['specialNotes', 'special_notes'], 4000),
    deliveryPocEmail: pick(['deliveryPocEmail', 'delivery_poc_email']),
    deliveryPocPhone: pick(['deliveryPocPhone', 'delivery_poc_phone']),
    projectManagerHo: pick(['projectManagerHo', 'project_manager_ho']),
    projectManagerContact: pick(['projectManagerContact', 'project_manager_contact']),
    projectManagerEmail: pick(['projectManagerEmail', 'project_manager_email']),
  };
}

async function resolvePrBilling(entityId, body = {}, fallback = {}) {
  const hasBilling =
    Object.prototype.hasOwnProperty.call(body, 'billingLocationId') ||
    Object.prototype.hasOwnProperty.call(body, 'billingLocation') ||
    Object.prototype.hasOwnProperty.call(body, 'billingGstNo');

  if (!hasBilling) {
    return {
      billingLocationId: fallback.billingLocationId ?? fallback.billing_location_id ?? null,
      billingLocation: fallback.billingLocation ?? fallback.billing_location ?? '',
      billingGstNo: fallback.billingGstNo ?? fallback.billing_gst_no ?? '',
    };
  }

  const requestedId =
    body.billingLocationId != null && body.billingLocationId !== ''
      ? Number(body.billingLocationId)
      : null;
  const requestedName = String(body.billingLocation || '').trim();
  const requestedGst = String(body.billingGstNo || '').trim().toUpperCase();

  if (!entityId) {
    return {
      billingLocationId: requestedId || null,
      billingLocation: requestedName,
      billingGstNo: requestedGst,
    };
  }

  const [locations] = await pool.query(
    `SELECT id, location, gst_no FROM entity_locations WHERE entity_id = ? ORDER BY sort_order ASC, id ASC`,
    [entityId]
  );

  if (!locations.length) {
    return {
      billingLocationId: requestedId || null,
      billingLocation: requestedName,
      billingGstNo: requestedGst,
    };
  }

  const loc =
    (requestedId && locations.find((row) => Number(row.id) === requestedId)) ||
    (requestedName &&
      locations.find(
        (row) => String(row.location || '').trim().toLowerCase() === requestedName.toLowerCase()
      )) ||
    null;

  if (!loc) {
    // Free-text / custom region (e.g. RFQ Entry when master has no match, or no regions loaded)
    if (!requestedId && (requestedName || requestedGst)) {
      return {
        billingLocationId: null,
        billingLocation: requestedName,
        billingGstNo: requestedGst,
      };
    }
    // Client sent empty location fields while updating address/delivery — keep existing
    if (!requestedId && !requestedName && !requestedGst) {
      return {
        billingLocationId: fallback.billingLocationId ?? fallback.billing_location_id ?? null,
        billingLocation: fallback.billingLocation ?? fallback.billing_location ?? '',
        billingGstNo: fallback.billingGstNo ?? fallback.billing_gst_no ?? '',
      };
    }
    if (requestedId || requestedName || requestedGst) {
      throw new Error('Billing GST must be selected from the entity region list');
    }
    return { billingLocationId: null, billingLocation: '', billingGstNo: '' };
  }

  return {
    billingLocationId: loc.id,
    billingLocation: loc.location,
    billingGstNo: requestedGst || String(loc.gst_no || '').trim().toUpperCase(),
  };
}

function normalizeCurrency(value) {
  const code = String(value || '')
    .trim()
    .toUpperCase();
  if (code === 'EUR' || code === 'USD' || code === 'INR') return code;
  return 'INR';
}

async function getLineItems(prId) {
  const [rows] = await pool.query('SELECT * FROM pr_line_items WHERE pr_id = ? ORDER BY id', [prId]);
  return rows;
}

function normalizeLineUnit(value) {
  const s = String(value || '').trim();
  if (!s || /^\d+(\.\d+)?$/.test(s)) return 'Nos';
  return s.slice(0, 50) || 'Nos';
}

function lineQuantity(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

function lineGstPercent(item) {
  const raw = item?.gstPercentage ?? item?.gst_percentage ?? item?.gstPercent;
  if (raw === '' || raw == null) return 18;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 18;
  return Math.min(100, n);
}

function lineInclusiveTotal(qty, cost, gstPct) {
  const q = Number(qty) || 0;
  const c = Number(cost) || 0;
  const g = Number(gstPct) || 0;
  return Math.round(q * c * (1 + g / 100) * 100) / 100;
}

function lineItemsEstimatedTotal(lineItems = []) {
  return lineItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.unitCost ?? item.estimatedCost ?? 0);
    return sum + lineInclusiveTotal(qty, cost, lineGstPercent(item));
  }, 0);
}

async function insertPrLineItem(db, prId, item) {
  const qty = Number(item.quantity);
  const cost = Number(item.unitCost ?? item.estimatedCost ?? 0);
  const gstPct = lineGstPercent(item);
  const total = lineInclusiveTotal(qty, cost, gstPct);
  const unit = normalizeLineUnit(item.unit || item.uom);
  const description = String(item.description || '').trim();
  const itemName = String(item.itemName || item.item_name || item.item || '').trim() || description;
  try {
    await db.query(
      `INSERT INTO pr_line_items (pr_id, category, item_name, description, quantity, unit, unit_cost, gst_percentage, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prId, item.category || '', itemName, description, qty, unit, cost, gstPct, total]
    );
  } catch (err) {
    const msg = String(err?.message || '');
    if (err?.code === 'ER_BAD_FIELD_ERROR' && msg.includes('item_name')) {
      try {
        await db.query(
          `INSERT INTO pr_line_items (pr_id, category, description, quantity, unit, unit_cost, gst_percentage, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [prId, item.category || '', description, qty, unit, cost, gstPct, total]
        );
        return;
      } catch (err2) {
        if (err2?.code !== 'ER_BAD_FIELD_ERROR' && !String(err2?.message || '').includes('gst_percentage')) {
          throw err2;
        }
      }
    } else if (err?.code !== 'ER_BAD_FIELD_ERROR' && !msg.includes('gst_percentage')) {
      throw err;
    }
    await db.query(
      `INSERT INTO pr_line_items (pr_id, category, description, quantity, unit, unit_cost, total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [prId, item.category || '', description, qty, unit, cost, total]
    );
  }
}

function assertPrSubmitRequirements(_extras = {}, _lineItems) {
  return;
}

/** Resolve department for draft saves when the form field is still empty. */
async function resolveDepartmentIdForSave(departmentName, userId, { requireNamed = false } = {}) {
  const name = String(departmentName || '').trim();
  if (name) {
    const [deptRows] = await pool.query('SELECT id FROM departments WHERE name = ? LIMIT 1', [name]);
    if (deptRows.length) return deptRows[0].id;
    if (requireNamed) throw new Error('Invalid department');
  } else if (requireNamed) {
    throw new Error('Department is required');
  }

  const [userRows] = await pool.query('SELECT department_id FROM users WHERE id = ? LIMIT 1', [userId]);
  if (userRows[0]?.department_id) return userRows[0].department_id;

  const [any] = await pool.query('SELECT id FROM departments ORDER BY id ASC LIMIT 1');
  if (any.length) return any[0].id;

  throw new Error('No department available — add a department in master data first');
}

function isPrAdminEditStage(stage) {
  return (
    String(stage || '')
      .toUpperCase()
      .replace(/[\s-]+/g, '_') === 'PR_ADMIN_EDIT'
  );
}

/** Keep every approval / return / submit row; fold back-to-back admin saves into one. */
function collapseConsecutiveAdminEdits(history) {
  const out = [];
  for (const entry of history) {
    const last = out[out.length - 1];
    if (last && isPrAdminEditStage(entry.stage) && isPrAdminEditStage(last.stage)) {
      last.editCount = (last.editCount || 1) + 1;
      last.date = entry.date;
      last.sortAt = entry.sortAt;
      last.user = entry.user;
      last.role = entry.role;
      last.status = entry.status;
      last.remarks = entry.remarks;
      continue;
    }
    out.push({
      ...entry,
      editCount: isPrAdminEditStage(entry.stage) ? 1 : 0,
    });
  }
  return out.map((entry) => {
    const { editCount, ...rest } = entry;
    if (editCount > 1) {
      const base = String(rest.remarks || '').trim();
      rest.remarks = base ? `${base} (${editCount} saves)` : `${editCount} admin saves`;
    }
    return rest;
  });
}

function formatPrApprovalStage(stage, prFlow = 'standard') {
  if (prFlow === 'functional') {
    const functionalLabels = {
      SUBMITTED: 'PR Submitted',
      HOD_REVIEW: 'User Approval',
      RFQ_SCM_BUYER_SELECTION: 'SCM Final RFQ',
      BUSINESS_REVIEW: 'SCM Manager Approval',
      SCM_PO_CREATE: 'PO Create',
      PO_BUYER_VERIFIED: 'SCM Buyer Final Verify',
      PO_CREATED: 'PO Create',
      PO_SIGNED: 'SCM Manager Sign',
    };
    if (functionalLabels[stage]) return functionalLabels[stage];
  }
  const labels = {
    SUBMITTED: 'PR Submitted',
    HOD_REVIEW: 'L1 Manager Approval',
    PR_MANAGER_REVIEW: 'L2 Manager Approval',
    CFO_REVIEW: 'CFO Approval',
    RFQ_REQUESTER_SUBMIT: 'RFQ Submitted — Vendor Final',
    RFQ_MANAGER_REVIEW: 'Vendor Final Approval (Manager)',
    RFQ_L2_REVIEW: 'Vendor Final — L2 Manager',
    RFQ_CFO_REVIEW: 'Vendor Final — CFO Approval',
    RFQ_SCM_BUYER_SELECTION: 'SCM Vendor Selection',
    BUSINESS_REVIEW: 'SCM Manager Approval',
    SCM_PO_CREATE: 'PO Create',
    PO_CREATED: 'PO Create',
    PO_SIGNED: 'SCM Manager Sign',
    PO_BUYER_VERIFIED: 'SCM Buyer Final Verify',
    PO_BUYER_REJECTED: 'SCM Buyer Final Verify',
    PO_BUYER_SENT_BACK: 'SCM Buyer Final Verify',
    PO_REJECTED: 'SCM Manager Approval',
    PO_SENT_BACK: 'SCM Manager Approval',
    PO_UPDATED: 'PO Updated',
  };
  return (
    labels[stage] ||
    String(stage || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

async function getApprovalHistory(prId, prFlow = 'functional') {
  const [rows] = await pool.query(
    `SELECT pa.*, u.name AS approver_name, u.role AS approver_role
     FROM pr_approvals pa
     LEFT JOIN users u ON u.id = pa.approver_id
     WHERE pa.pr_id = ?
     ORDER BY pa.created_at ASC`,
    [prId]
  );
  const history = rows.map((r) => ({
    stage: formatPrApprovalStage(r.stage, prFlow),
    user: r.approver_name || 'System',
    role: r.approver_role || formatPrApprovalStage(r.stage, prFlow),
    date: formatDateTime(r.created_at),
    status: r.action === 'submitted' ? 'Completed' : r.action.charAt(0).toUpperCase() + r.action.slice(1),
    remarks: r.remarks || '',
    sortAt: new Date(r.created_at).getTime(),
  }));

  const stages = new Set(rows.map((r) => r.stage));
  const [cfgRows] = await pool.query(
    `SELECT rc.requester_submitted_at, rc.finalized_at, ri.vendor_name
     FROM rfq_configs rc
     LEFT JOIN rfq_invitations ri ON ri.id = rc.recommended_invitation_id
     WHERE rc.pr_id = ?
     LIMIT 1`,
    [prId]
  );
  const cfg = cfgRows[0];
  if (cfg?.requester_submitted_at && !stages.has(STAGE.RFQ_REQUESTER_SUBMIT)) {
    history.push({
      stage: formatPrApprovalStage(STAGE.RFQ_REQUESTER_SUBMIT),
      user: 'Requester',
      role: 'Requester',
      date: formatDateTime(cfg.requester_submitted_at),
      status: 'Submitted',
      remarks: `RFQ submitted for Vendor Final Approval${cfg.vendor_name ? `. Recommended vendor: ${cfg.vendor_name}` : ''}`,
      sortAt: new Date(cfg.requester_submitted_at).getTime(),
    });
  }
  if (cfg?.finalized_at && !stages.has(STAGE.RFQ_SCM_BUYER_SELECTION)) {
    history.push({
      stage: formatPrApprovalStage(STAGE.RFQ_SCM_BUYER_SELECTION),
      user: 'SCM Buyer',
      role: 'SCM Buyer',
      date: formatDateTime(cfg.finalized_at),
      status: 'Approved',
      remarks: `SCM Buyer Vendor Selection${cfg.vendor_name ? ` — recommended vendor: ${cfg.vendor_name}` : ''}`,
      sortAt: new Date(cfg.finalized_at).getTime(),
    });
  }

  history.sort((a, b) => a.sortAt - b.sortAt);
  return collapseConsecutiveAdminEdits(history).map(({ sortAt: _s, ...entry }) => entry);
}

let cachedScmBuyer = null;
let cachedScmBuyerAt = 0;

async function getCachedScmBuyer() {
  const now = Date.now();
  if (cachedScmBuyer && now - cachedScmBuyerAt < 60_000) return cachedScmBuyer;
  const emails = await getScmBuyerNotifyEmails();
  const primary = await resolveScmBuyerUser();
  cachedScmBuyer = primary
    ? {
        ...primary,
        email: emails.join(', ') || primary.email,
        name: emails.length > 1 ? 'SCM Buyer' : primary.name,
      }
    : emails.length
      ? { email: emails.join(', '), name: 'SCM Buyer' }
      : null;
  cachedScmBuyerAt = now;
  return cachedScmBuyer;
}

async function getTimelineAssignees(prId, requesterId, prStatus = null) {
  const [taskRows] = await pool.query(
    `SELECT wt.assigned_role, wt.task_type, u.name AS user_name, u.email AS user_email
     FROM workflow_tasks wt
     LEFT JOIN users u ON u.id = wt.assigned_user_id
     WHERE wt.pr_id = ? AND wt.status = 'pending'
     ORDER BY wt.id DESC
     LIMIT 5`,
    [prId]
  );

  const byRole = (role) =>
    taskRows.find((t) => String(t.assigned_role || '') === role && (t.user_name || t.user_email));

  let l1Name = null;
  let l1Email = null;
  const hodTask = byRole('HOD Approver');
  if (hodTask) {
    l1Name = hodTask.user_name || null;
    l1Email = hodTask.user_email || null;
  }
  if (!l1Email && requesterId) {
    const [reqRows] = await pool.query(
      `SELECT supervisor_name, supervisor_email FROM users WHERE id = ? LIMIT 1`,
      [requesterId]
    );
    if (reqRows[0]?.supervisor_email) {
      l1Email = reqRows[0].supervisor_email;
      l1Name = reqRows[0].supervisor_name || reqRows[0].supervisor_email.split('@')[0];
    }
  }

  let scmName = null;
  let scmEmail = null;
  const scmTask = byRole('SCM Buyer');
  if (scmTask?.user_name || scmTask?.user_email) {
    scmName = scmTask.user_name || null;
    scmEmail = scmTask.user_email || null;
  } else if (
    prStatus === PR_STATUS.PENDING_SCM_PO ||
    prStatus === PR_STATUS.APPROVED ||
    !prStatus
  ) {
    const buyer = await getCachedScmBuyer();
    if (buyer) {
      scmName = buyer.name || null;
      scmEmail = buyer.email || null;
    }
  }

  let scmManagerName = null;
  let scmManagerEmail = null;
  const scmMgrTask = byRole('SCM Manager');
  if (scmMgrTask?.user_name || scmMgrTask?.user_email) {
    scmManagerName = scmMgrTask.user_name || null;
    scmManagerEmail = scmMgrTask.user_email || null;
  } else if (prStatus === PR_STATUS.PENDING_BUSINESS_APPROVAL) {
    const mgr = await resolveScmManagerUser();
    if (mgr) {
      scmManagerName = mgr.name || null;
      scmManagerEmail = mgr.email || null;
    }
  }

  const pendingTask = taskRows[0];
  const currentApproverName =
    pendingTask?.user_name ||
    (pendingTask?.assigned_role === 'HOD Approver' ? l1Name : null) ||
    (pendingTask?.assigned_role === 'SCM Buyer' ? scmName : null) ||
    (pendingTask?.assigned_role === 'SCM Manager' ? scmManagerName : null) ||
    null;
  const currentApproverEmail =
    pendingTask?.user_email ||
    (pendingTask?.assigned_role === 'HOD Approver' ? l1Email : null) ||
    (pendingTask?.assigned_role === 'SCM Buyer' ? scmEmail : null) ||
    (pendingTask?.assigned_role === 'SCM Manager' ? scmManagerEmail : null) ||
    null;

  return {
    currentApprover: currentApproverName
      ? { name: currentApproverName, email: currentApproverEmail, role: pendingTask?.assigned_role || null }
      : null,
    l1Manager: l1Name || l1Email ? { name: l1Name, email: l1Email } : null,
    scmBuyer: scmName || scmEmail ? { name: scmName, email: scmEmail } : null,
    scmManager:
      scmManagerName || scmManagerEmail
        ? { name: scmManagerName, email: scmManagerEmail }
        : null,
  };
}

async function enrichPR(row) {
  const [lineItems, approvalHistory, assignees, vendorRows, poRows, rfqMetaRows, attachments] = await Promise.all([
    getLineItems(row.id),
    getApprovalHistory(row.id, row.pr_flow),
    getTimelineAssignees(row.id, row.requester_id, row.status),
    pool
      .query(
        `SELECT ri.vendor_name
         FROM rfq_configs rc
         JOIN rfq_invitations ri ON ri.id = rc.recommended_invitation_id
         WHERE rc.pr_id = ?
         LIMIT 1`,
        [row.id]
      )
      .then(([rows]) => rows),
    pool
      .query(
        `SELECT id, po_number, status, created_at
         FROM purchase_orders
         WHERE pr_id = ?
         ORDER BY id DESC
         LIMIT 1`,
        [row.id]
      )
      .then(([rows]) => rows),
    pool
      .query(
        `SELECT finalized_at FROM rfq_configs WHERE pr_id = ? LIMIT 1`,
        [row.id]
      )
      .then(([rows]) => rows),
    listPrAttachments(row.id),
  ]);
  const po = poRows[0] || null;
  const poMeta = po
    ? {
        id: po.id,
        poNumber: po.po_number,
        status: po.status,
        signedAt: po.signed_at,
        signedPdfPath: po.signed_pdf_path,
        pdfPath: po.pdf_path,
        poSentBack: false,
      }
    : null;
  if (poMeta) {
    const [reviseRows] = await pool.query(
      `SELECT id FROM workflow_tasks
       WHERE pr_id = ? AND task_type = 'PO_REVISION' AND status = 'pending' LIMIT 1`,
      [row.id]
    );
    poMeta.poSentBack = Boolean(reviseRows.length) && po.status === 'draft';
  }
  const base = {
    id: row.id,
    prNumber: row.pr_number,
    title: row.title,
    requestType: row.request_type,
    purchaseType: row.purchase_type || 'purchase_order',
    purchaseTypeLabel: purchaseTypeLabel(row.purchase_type),
    department: row.department_name,
    departmentId: row.department_id,
    entityId: row.entity_id || null,
    entityName: row.entity_name || '',
    entityCode: row.entity_code || '',
    entityCostCenter: row.entity_cost_center || '',
    requester: row.requester_name,
    requesterId: row.requester_id,
    priority: row.priority,
    priorityLower: mapPriorityToFrontend(row.priority),
    justification: row.justification,
    requiredDate: formatDate(row.required_date),
    currency: normalizeCurrency(row.currency),
    totalAmount: Number(row.total_amount),
    status: row.status,
    statusFrontend: mapStatusToFrontend(row.status),
    statusUI: mapStatusToManagerUI(row.status, row.pr_flow, row.vendor_selection),
    vendorSelection: row.vendor_selection === 'own' ? 'own' : 'scm',
    prFlow: row.pr_flow === 'functional' ? 'functional' : 'standard',
    approvalUserId: row.approval_user_id || null,
    approvalUserIds: functionalApprovalChainFromPr(row),
    approvalUserName: row.approval_user_name || '',
    billingLocationId: row.billing_location_id || null,
    billingLocation: row.billing_location || '',
    billingGstNo: row.billing_gst_no || '',
    billingAddress: row.billing_address || '',
    deliveryPoc: row.delivery_poc || '',
    deliveryPocEmail: row.delivery_poc_email || '',
    deliveryPocPhone: row.delivery_poc_phone || '',
    projectManagerHo: row.project_manager_ho || '',
    projectManagerContact: row.project_manager_contact || '',
    projectManagerEmail: row.project_manager_email || '',
    placeOfDelivery: row.place_of_delivery || '',
    expectedDeliveryTimeline: row.expected_delivery_timeline || '',
    paymentTerms: row.payment_terms || '',
    requestCategory: normalizeRequestCategory(row.request_category),
    projectDetail: row.project_detail || '',
    specialNotes: row.special_notes || '',
    recommendedVendor: vendorRows[0]?.vendor_name || '',
    currentStage: row.current_stage,
    currentApprover: assignees.currentApprover,
    l1Manager: assignees.l1Manager,
    scmBuyer: assignees.scmBuyer,
    scmManager: assignees.scmManager,
    hasPurchaseOrder: Boolean(po),
    poNumber: po?.po_number || '',
    poId: po?.id || null,
    poStatus: po?.status || '',
    rfqFinalized: Boolean(rfqMetaRows[0]?.finalized_at),
    submittedDate: formatDate(row.submitted_at || row.created_at),
    createdAt: formatDate(row.created_at),
    lineItems: lineItems.map((li) => ({
      id: li.id,
      category: li.category,
      itemName: li.item_name || li.description,
      description: li.description,
      item: li.item_name || li.description,
      quantity: lineQuantity(li.quantity),
      unit: normalizeLineUnit(li.unit || li.uom),
      unitCost: Number(li.unit_cost),
      unitPrice: Number(li.unit_cost),
      gstPercentage: Number.isFinite(Number(li.gst_percentage)) ? Number(li.gst_percentage) : 18,
      total: Number(li.total),
    })),
    approvalHistory,
    attachments,
    items: lineItems.length,
  };
  return applyRequesterDisplay(base, poMeta);
}

export async function previewL1Manager(user, departmentName) {
  let departmentId = null;
  if (departmentName) {
    const [deptRows] = await pool.query('SELECT id FROM departments WHERE name = ? LIMIT 1', [departmentName]);
    departmentId = deptRows[0]?.id || null;
  }
  const assignment = await resolveHodAssignment(user.email, departmentId);
  return {
    nextStep: 'L1 Manager Approval',
    l1Manager: {
      name: assignment.hodName || null,
      email: assignment.hodEmail || null,
    },
  };
}

async function resolveHodAssignment(requesterEmail, departmentId) {
  let l1Manager = null;
  const email = (requesterEmail || '').toLowerCase().trim();

  // Prefer local supervisor first — avoids slow RefexOne /users fetch on every PR submit
  if (email) {
    const [localRows] = await pool.query(
      `SELECT supervisor_email, supervisor_name FROM users WHERE email = ? LIMIT 1`,
      [email]
    );
    if (localRows[0]?.supervisor_email) {
      l1Manager = {
        email: localRows[0].supervisor_email,
        name: localRows[0].supervisor_name || localRows[0].supervisor_email.split('@')[0],
      };
    }
  }

  if (!l1Manager?.email) {
    try {
      l1Manager = await getL1ManagerForEmail(requesterEmail);
    } catch (err) {
      console.warn('RefexOne L1 manager lookup failed:', err.message);
    }
  }

  if (!l1Manager?.email) {
    return { hodUserId: null, hodEmail: null, hodName: null };
  }

  const hodUserId = await ensureApproverUser(l1Manager, 'HOD Approver', departmentId);
  return {
    hodUserId,
    hodEmail: l1Manager.email,
    hodName: l1Manager.name,
  };
}

async function createHodApprovalTask(conn, prId, requesterEmail, departmentId) {
  const { hodUserId, hodEmail, hodName } = await resolveHodAssignment(requesterEmail, departmentId);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);

  await conn.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'PR_APPROVAL', 'HOD Approver', ?, 'pending', ?)`,
    [prId, hodUserId, dueDate.toISOString().split('T')[0]]
  );

  return { hodUserId, hodEmail, hodName };
}

const MAX_FUNCTIONAL_APPROVERS = 5;

function parsePrFlow(value, fallback = 'standard') {
  const raw = String(value || '').toLowerCase().trim();
  if (raw === 'standard') return 'standard';
  if (raw === 'functional') return 'functional';
  return fallback === 'functional' ? 'functional' : 'standard';
}

function parseApprovalUserIdList(value) {
  if (value == null || value === '') return [];
  let raw = value;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw)) {
    raw = raw.toString('utf8');
  }
  let list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      const n = Number(trimmed);
      if (n > 0) list = [n];
    }
  }
  const seen = new Set();
  const ids = [];
  for (const item of list) {
    const id = Number(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function functionalApprovalChainFromPr(pr = {}) {
  const chain = parseApprovalUserIdList(pr.approval_user_ids);
  if (chain.length) return chain;
  const current = Number(pr.approval_user_id);
  return current ? [current] : [];
}

function resolveFlowAndVendor(body, pr = {}) {
  const prFlow = parsePrFlow(body.prFlow ?? body.pr_flow, pr.pr_flow || 'standard');
  const vendorMode =
    body.vendorSelection === 'own' || body.vendorSelection === 'scm'
      ? body.vendorSelection
      : pr.vendor_selection === 'own'
        ? 'own'
        : 'scm';
  if (prFlow !== 'functional') {
    return { prFlow, vendorMode, approvalUserId: null, approvalUserIds: [] };
  }

  const bodyHasChain = body.approvalUserIds !== undefined || body.approval_user_ids !== undefined;
  const bodyHasSingle = body.approvalUserId !== undefined || body.approval_user_id !== undefined;
  let approvalUserIds = [];
  if (bodyHasChain) {
    approvalUserIds = parseApprovalUserIdList(body.approvalUserIds ?? body.approval_user_ids);
  } else if (bodyHasSingle) {
    const id = Number(body.approvalUserId ?? body.approval_user_id) || null;
    approvalUserIds = id ? [id] : [];
  } else {
    approvalUserIds = functionalApprovalChainFromPr(pr);
  }
  if (approvalUserIds.length > MAX_FUNCTIONAL_APPROVERS) {
    approvalUserIds = approvalUserIds.slice(0, MAX_FUNCTIONAL_APPROVERS);
  }
  return {
    prFlow,
    vendorMode,
    approvalUserId: approvalUserIds[0] || null,
    approvalUserIds,
  };
}

async function resolveSelectedApprovalUser(approvalUserId, requesterId) {
  const id = Number(approvalUserId);
  if (!id) throw new Error('Select a user for Functional Flow approval');
  if (requesterId && id === Number(requesterId)) {
    throw new Error('Select another user — you cannot approve your own Functional Flow PR');
  }
  const [rows] = await pool.query(
    `SELECT id, name, email, role FROM users
     WHERE id = ? AND is_active = 1 AND role <> 'Super Admin'`,
    [id]
  );
  if (!rows.length) throw new Error('Selected approval user is invalid or inactive');
  return rows[0];
}

async function resolveSelectedApprovalUsers(ids, requesterId) {
  const unique = parseApprovalUserIdList(ids);
  if (!unique.length) throw new Error('Select at least one user for Functional Flow approval');
  if (unique.length > MAX_FUNCTIONAL_APPROVERS) {
    throw new Error('Select up to 5 users for Functional Flow approval');
  }
  const resolved = [];
  for (const id of unique) {
    resolved.push(await resolveSelectedApprovalUser(id, requesterId));
  }
  return resolved;
}

function nextIdInApprovalChain(pr, actingUserId) {
  const chain = functionalApprovalChainFromPr(pr);
  if (chain.length <= 1) return null;
  const current = Number(pr.approval_user_id) || Number(actingUserId);
  let idx = chain.indexOf(current);
  if (idx < 0) idx = chain.indexOf(Number(actingUserId));
  if (idx < 0) return null;
  return chain[idx + 1] || null;
}

function approvalStepIndex(pr, actingUserId) {
  const chain = functionalApprovalChainFromPr(pr);
  if (!chain.length) return { step: 1, total: 1 };
  const current = Number(pr.approval_user_id) || Number(actingUserId);
  let idx = chain.indexOf(current);
  if (idx < 0) idx = chain.indexOf(Number(actingUserId));
  return { step: (idx >= 0 ? idx : 0) + 1, total: chain.length };
}

async function createSelectedUserApprovalTask(conn, prId, approvalUserId) {
  const approver = await resolveSelectedApprovalUser(approvalUserId);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);
  await conn.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'PR_APPROVAL', 'HOD Approver', ?, 'pending', ?)`,
    [prId, approver.id, dueDate.toISOString().split('T')[0]]
  );
  return { hodUserId: approver.id, hodEmail: approver.email, hodName: approver.name };
}

async function persistFunctionalOwnRfq(user, prId, body, { markSubmitted }) {
  const vendors = body.rfqVendors || body.rfq_vendors;
  if (!Array.isArray(vendors) || !vendors.length) {
    if (!markSubmitted) return;
    const [existing] = await pool.query(
      `SELECT vqs.id
       FROM rfq_invitations ri
       JOIN vendor_quotation_submissions vqs ON vqs.rfq_invitation_id = ri.id
       WHERE ri.pr_id = ? AND vqs.round = 1 AND vqs.quoted_price >= 0
         AND vqs.quotation_file_name IS NOT NULL AND vqs.quotation_file_name <> ''
       LIMIT 1`,
      [prId]
    );
    if (!existing.length) {
      throw new Error('Add at least one vendor with a round-1 quotation and file');
    }
    await pool.query(
      `UPDATE rfq_configs
       SET requester_submitted_at = COALESCE(requester_submitted_at, NOW()), updated_at = NOW()
       WHERE pr_id = ?`,
      [prId]
    );
    return;
  }
  const { seedFunctionalOwnRfq } = await import('./rfqService.js');
  await seedFunctionalOwnRfq(user, prId, vendors, {
    markSubmitted,
    maxRounds: body.maxRounds ?? body.max_rounds ?? 1,
    recommendedVendorEmail: body.rfqRecommendedVendorEmail || body.recommendedVendorEmail,
    recommendedVendorName: body.rfqRecommendedVendorName || body.recommendedVendorName,
    recommendationJustification:
      body.rfqRecommendationJustification || body.recommendationJustification,
  });
}

async function loadFunctionalOwnRfqMailPack(prFlow, vendorMode, prId) {
  if (prFlow !== 'functional' || vendorMode !== 'own' || !prId) {
    return { rfqSummary: null, attachments: [] };
  }
  try {
    const { getRfqEmailPack } = await import('./rfqService.js');
    return await getRfqEmailPack(prId);
  } catch (err) {
    console.warn('Functional RFQ email pack failed:', err.message);
    return { rfqSummary: null, attachments: [] };
  }
}

/** Never block HTTP save/submit on SMTP / WhatsApp / large quotation attachment reads. */
function queuePrSubmitNotifications({
  pr,
  user,
  departmentId,
  prFlow,
  vendorMode,
  hodAssignment,
  nextStep,
  isResubmit = false,
}) {
  const prId = pr?.id || pr?.prId;
  setImmediate(() => {
    (async () => {
      const mailPack = await loadFunctionalOwnRfqMailPack(prFlow, vendorMode, prId);
      queuePrRaisedNotification(
        pr,
        { name: user.name, email: user.email },
        isResubmit ? { isResubmit: true } : {}
      );
      queuePrApprovalPendingNotification(
        pr,
        'HOD Approver',
        { name: user.name, email: user.email },
        departmentId,
        {
          approverEmails: hodAssignment?.hodEmail ? [hodAssignment.hodEmail] : undefined,
          approverName: hodAssignment?.hodName || undefined,
          stageLabel: nextStep,
          roleDisplayName: prFlow === 'functional' ? 'Selected Approver' : undefined,
          rfqSummary: mailPack.rfqSummary,
          attachments: mailPack.attachments,
        }
      );
      // Requester FYI — PR raised / resubmitted and moved to first approval step
      queueRequesterStepProgressNotification(pr, {
        action: isResubmit ? 'submitted' : 'raised',
        actorRole: 'Requester',
        actorName: user.name,
        completedStepLabel: isResubmit ? 'PR Resubmitted' : 'PR Raised',
        nextStepLabel: nextStep || (prFlow === 'functional' ? 'Selected Approver' : 'L1 Manager Approval'),
        requesterEmail: user.email,
        requesterName: user.name,
      });
    })().catch((err) => {
      console.error('PR submit notification failed (save already committed):', err.message);
    });
  });
}

export async function listApprovalUsers(user) {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, d.name AS department
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.is_active = 1
       AND u.role <> 'Super Admin'
       AND u.id <> ?
     ORDER BY u.name ASC, u.email ASC`,
    [user.id]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    department: r.department || '',
  }));
}

async function resolveL2Assignment(requesterEmail, departmentId) {
  let l2Manager = null;
  const email = (requesterEmail || '').toLowerCase().trim();

  if (email) {
    const [localRows] = await pool.query(
      `SELECT l2_manager_email FROM users WHERE email = ? LIMIT 1`,
      [email]
    );
    if (localRows[0]?.l2_manager_email) {
      const mgr = localRows[0].l2_manager_email;
      l2Manager = { email: mgr, name: mgr.split('@')[0] };
    }
  }

  if (!l2Manager?.email) {
    try {
      l2Manager = await getL2ManagerForEmail(requesterEmail);
    } catch (err) {
      console.warn('RefexOne L2 manager lookup failed:', err.message);
    }
  }

  if (!l2Manager?.email) {
    return { userId: null, email: null, name: null };
  }

  const userId = await ensureApproverUser(l2Manager, 'PR Manager', departmentId);
  return { userId, email: l2Manager.email, name: l2Manager.name };
}

async function createL2ApprovalTask(conn, prId, requesterEmail, departmentId) {
  const assignee = await resolveL2Assignment(requesterEmail, departmentId);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);

  await conn.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'PR_APPROVAL', 'PR Manager', ?, 'pending', ?)`,
    [prId, assignee.userId, dueDate.toISOString().split('T')[0]]
  );

  return assignee;
}

export async function createPurchaseRequest(user, body) {
  const {
    title,
    requestType = 'Opex',
    purchaseType = 'purchase_order',
    department,
    priority = 'Medium',
    justification,
    requiredDate,
    vendorSelection = 'scm',
    prFlow: prFlowRaw,
    approvalUserId,
    approvalUserIds,
    entityId,
    currency = 'INR',
    lineItems = [],
    attachments = [],
    submit = false,
  } = body;
  const extras = parseRequisitionExtras(body);
  const requestCategory = normalizeRequestCategory(body.requestCategory ?? body.request_category);
  const billing = await resolvePrBilling(entityId ? Number(entityId) : null, body);

  const prFlow = parsePrFlow(prFlowRaw, 'standard');
  const vendorMode = vendorSelection === 'own' ? 'own' : 'scm';
  const normalizedPurchaseType = normalizePurchaseType(purchaseType);
  const normalizedCurrency = normalizeCurrency(currency);

  if (submit && !lineItems.length) {
    throw new Error('At least one line item is required');
  }
  if (!entityId) {
    throw new Error('Entity is required');
  }

  let selectedApprovers = [];
  const requestedApproverIds = parseApprovalUserIdList(approvalUserIds).length
    ? parseApprovalUserIdList(approvalUserIds)
    : approvalUserId
      ? [Number(approvalUserId)]
      : [];
  if (prFlow === 'functional' && (submit || requestedApproverIds.length)) {
    selectedApprovers = await resolveSelectedApprovalUsers(requestedApproverIds, user.id);
  }
  const selectedApprover = selectedApprovers[0] || null;
  const selectedApproverIds = selectedApprovers.map((u) => u.id);
  if (prFlow === 'functional' && submit && vendorMode === 'own') {
    const rfqVendors = body.rfqVendors || body.rfq_vendors;
    if (!Array.isArray(rfqVendors) || !rfqVendors.length) {
      throw new Error('Add at least one vendor with a round-1 quotation and file');
    }
  }
  if (submit) {
    assertPrSubmitRequirements(extras, lineItems);
  }

  const departmentId = await resolveDepartmentIdForSave(department, user.id, {
    requireNamed: Boolean(submit),
  });

  const [entityRows] = await pool.query(
    `SELECT id FROM entity_masters WHERE id = ? AND status = 'active'`,
    [Number(entityId)]
  );
  if (!entityRows.length) throw new Error('Invalid or inactive entity');

  const totalAmount = lineItemsEstimatedTotal(lineItems);
  const prTitle = title || lineItems[0]?.description || `${requestType} Request`;
  const status = submit ? PR_STATUS.PENDING_HOD_APPROVAL : PR_STATUS.DRAFT;
  const currentStage = submit ? STAGE.HOD_REVIEW : null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const prNumber = await nextDocumentNumber('PR', Number(entityId), conn);

    let result;
    try {
      [result] = await conn.query(
        `INSERT INTO purchase_requests
         (pr_number, title, request_type, purchase_type, department_id, entity_id, requester_id, priority, justification, required_date, currency, total_amount, status, vendor_selection, pr_flow, approval_user_id, approval_user_ids, current_stage, submitted_at,
          billing_location_id, billing_location, billing_gst_no, billing_address, delivery_poc, place_of_delivery, expected_delivery_timeline, payment_terms,
          request_category, project_detail, special_notes,
          delivery_poc_email, delivery_poc_phone, project_manager_ho, project_manager_contact, project_manager_email)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          prNumber,
          prTitle,
          requestType,
          normalizedPurchaseType,
          departmentId,
          Number(entityId),
          user.id,
          priority,
          justification,
          requiredDate || null,
          normalizedCurrency,
          totalAmount,
          status,
          vendorMode,
          prFlow,
          selectedApprover?.id || null,
          selectedApproverIds.length ? JSON.stringify(selectedApproverIds) : null,
          currentStage,
          submit ? new Date() : null,
          billing.billingLocationId,
          billing.billingLocation || null,
          billing.billingGstNo || null,
          extras.billingAddress || null,
          extras.deliveryPoc || null,
          extras.placeOfDelivery || null,
          extras.expectedDeliveryTimeline || null,
          extras.paymentTerms || null,
          requestCategory || null,
          extras.projectDetail || null,
          extras.specialNotes || null,
          extras.deliveryPocEmail || null,
          extras.deliveryPocPhone || null,
          extras.projectManagerHo || null,
          extras.projectManagerContact || null,
          extras.projectManagerEmail || null,
        ]
      );
    } catch (err) {
      if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
      [result] = await conn.query(
        `INSERT INTO purchase_requests
         (pr_number, title, request_type, purchase_type, department_id, entity_id, requester_id, priority, justification, required_date, currency, total_amount, status, vendor_selection, pr_flow, approval_user_id, approval_user_ids, current_stage, submitted_at,
          billing_location_id, billing_location, billing_gst_no, billing_address, delivery_poc, place_of_delivery, expected_delivery_timeline, payment_terms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          prNumber,
          prTitle,
          requestType,
          normalizedPurchaseType,
          departmentId,
          Number(entityId),
          user.id,
          priority,
          justification,
          requiredDate || null,
          normalizedCurrency,
          totalAmount,
          status,
          vendorMode,
          prFlow,
          selectedApprover?.id || null,
          selectedApproverIds.length ? JSON.stringify(selectedApproverIds) : null,
          currentStage,
          submit ? new Date() : null,
          billing.billingLocationId,
          billing.billingLocation || null,
          billing.billingGstNo || null,
          extras.billingAddress || null,
          extras.deliveryPoc || null,
          extras.placeOfDelivery || null,
          extras.expectedDeliveryTimeline || null,
          extras.paymentTerms || null,
        ]
      );
    }

    const prId = result.insertId;

    for (const item of lineItems) {
      await insertPrLineItem(conn, prId, item);
    }

    if (attachments.length) {
      await savePrAttachments(prId, user.id, attachments, conn);
    }

    let hodAssignment = null;

    if (submit) {
      const pathLabel =
        prFlow === 'functional'
          ? `Functional Flow · User Approval (${selectedApprovers.length}): ${selectedApprovers.map((u) => u.name || u.email).join(' → ')} · then SCM Final RFQ / RFQ Entry → Buyer Final Verify → Create PO → SCM Manager approval · Vendor path: ${vendorMode === 'own' ? 'Own Vendor (quotes on Create PR)' : 'SCM Vendor Selection'}`
          : `Vendor path: ${vendorMode === 'own' ? 'Own Vendor' : 'SCM Vendor Selection'}`;
      await conn.query(
        `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
         VALUES (?, ?, ?, ?, ?)`,
        [
          prId,
          STAGE.SUBMITTED,
          user.id,
          'submitted',
          `PR submitted for approval · ${pathLabel}`,
        ]
      );

      if (prFlow === 'functional') {
        hodAssignment = await createSelectedUserApprovalTask(conn, prId, selectedApprover.id);
      } else {
        hodAssignment = await createHodApprovalTask(conn, prId, user.email, departmentId);
        if (hodAssignment.hodEmail) {
          await conn.query(
            `UPDATE users SET supervisor_email = ?, supervisor_name = ? WHERE id = ?`,
            [hodAssignment.hodEmail, hodAssignment.hodName, user.id]
          );
        }
      }
    }

    await conn.commit();
    if (prFlow === 'functional' && vendorMode === 'own') {
      await persistFunctionalOwnRfq(user, prId, body, { markSubmitted: Boolean(submit) });
    }
    const pr = await getPurchaseRequestById(prId);
    if (submit) {
      const nextStep =
        prFlow === 'functional'
          ? selectedApprovers.length > 1
            ? `User Approval 1 of ${selectedApprovers.length}`
            : 'User Approval'
          : 'L1 Manager Approval';
      queuePrSubmitNotifications({
        pr,
        user,
        departmentId,
        prFlow,
        vendorMode,
        hodAssignment,
        nextStep,
      });
      return {
        ...pr,
        nextStep,
        l1Manager: {
          name: hodAssignment?.hodName || null,
          email: hodAssignment?.hodEmail || null,
        },
      };
    }
    return pr;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function getPurchaseRequestById(id) {
  const [rows] = await pool.query(
    `SELECT pr.*, d.name AS department_name, u.name AS requester_name,
            au.name AS approval_user_name, au.email AS approval_user_email,
            e.name AS entity_name, e.code AS entity_code, e.cost_center AS entity_cost_center
     FROM purchase_requests pr
     JOIN departments d ON d.id = pr.department_id
     JOIN users u ON u.id = pr.requester_id
     LEFT JOIN users au ON au.id = pr.approval_user_id
     LEFT JOIN entity_masters e ON e.id = pr.entity_id
     WHERE pr.id = ?`,
    [id]
  );
  if (!rows.length) return null;
  return enrichPR(rows[0]);
}

function hodAssignedTaskSql(user) {
  // Pre-RFQ HOD + post-RFQ L1 vendor final — by assigned user or requester supervisor email
  return {
    clause: ` AND pr.status IN (?, ?) AND EXISTS (
      SELECT 1 FROM workflow_tasks wt
      WHERE wt.pr_id = pr.id
        AND wt.status = 'pending'
        AND wt.task_type IN ('PR_APPROVAL', 'RFQ_POST_APPROVAL')
        AND (
          wt.assigned_user_id = ?
          OR (
            wt.assigned_user_id IS NULL
            AND wt.assigned_role = 'HOD Approver'
            AND EXISTS (
              SELECT 1 FROM users ru
              WHERE ru.id = pr.requester_id
                AND ru.supervisor_email IS NOT NULL
                AND LOWER(ru.supervisor_email) = LOWER(?)
            )
          )
        )
    )`,
    params: [
      PR_STATUS.PENDING_HOD_APPROVAL,
      PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL,
      user.id,
      user.email,
    ],
  };
}

/** Track PR / my PRs: user submitted, approved, or appears in workflow / approval chain. */
function buildPrInvolvementFilterSql(user) {
  const userId = user.id;
  const userEmail = String(user.email || '').toLowerCase().trim();
  const userIdJson = JSON.stringify(Number(userId));

  return {
    clause: ` AND (
      pr.requester_id = ?
      OR pr.approval_user_id = ?
      OR (
        pr.approval_user_ids IS NOT NULL
        AND JSON_CONTAINS(pr.approval_user_ids, ?, '$')
      )
      OR EXISTS (
        SELECT 1 FROM pr_approvals pa
        LEFT JOIN users pau ON pau.id = pa.approver_id
        WHERE pa.pr_id = pr.id
          AND (
            pa.approver_id = ?
            OR (? <> '' AND LOWER(TRIM(pau.email)) = ?)
          )
      )
      OR EXISTS (
        SELECT 1 FROM workflow_tasks wt
        LEFT JOIN users wau ON wau.id = wt.assigned_user_id
        WHERE wt.pr_id = pr.id
          AND (
            wt.assigned_user_id = ?
            OR (? <> '' AND LOWER(TRIM(wau.email)) = ?)
          )
      )
      OR EXISTS (
        SELECT 1 FROM users ru
        WHERE ru.id = pr.requester_id
          AND ru.supervisor_email IS NOT NULL
          AND ? <> ''
          AND LOWER(TRIM(ru.supervisor_email)) = ?
      )
    )`,
    params: [
      userId,
      userId,
      userIdJson,
      userId,
      userEmail,
      userEmail,
      userId,
      userEmail,
      userEmail,
      userEmail,
      userEmail,
    ],
  };
}

const REQUESTER_PENDING_STATUSES = [
  PR_STATUS.PENDING_HOD_APPROVAL,
  PR_STATUS.PENDING_PR_MANAGER_APPROVAL,
  PR_STATUS.PENDING_CFO_APPROVAL,
  PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL,
  PR_STATUS.PENDING_RFQ_L2_APPROVAL,
  PR_STATUS.PENDING_RFQ_CFO_APPROVAL,
  PR_STATUS.PENDING_BUSINESS_APPROVAL,
  PR_STATUS.PENDING_SCM_PO,
];

/** Fast requester list — no line items / approval history / assignee N+1. */
export async function listRequesterPurchaseRequests(user, filters = {}) {
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(filters.pageSize, 10) || 10));
  const offset = (page - 1) * pageSize;
  const search = String(filters.search || '').trim();
  const statusGroup = String(filters.status || 'all').toLowerCase();
  const requestType = String(filters.requestType || 'all');
  const dateFrom = String(filters.dateFrom || '').trim();
  const dateTo = String(filters.dateTo || '').trim();
  const involvedOnly =
    filters.involvedOnly === true ||
    filters.involvedOnly === 'true' ||
    String(filters.involvedOnly || '').toLowerCase() === '1';

  let where = 'WHERE 1=1';
  const params = [];

  if (involvedOnly && !isSuperAdmin(user.role)) {
    const inv = buildPrInvolvementFilterSql(user);
    where += inv.clause;
    params.push(...inv.params);
  } else if (user.role === 'Requester') {
    where += ' AND pr.requester_id = ?';
    params.push(user.id);
  }

  if (statusGroup === 'draft') {
    where += ' AND pr.status = ?';
    params.push(PR_STATUS.DRAFT);
  } else if (statusGroup === 'returned') {
    where += ` AND (
      pr.status = ?
      OR EXISTS (
        SELECT 1 FROM workflow_tasks wt
        WHERE wt.pr_id = pr.id AND wt.task_type = 'PO_REVISION' AND wt.status = 'pending'
      )
    )`;
    params.push(PR_STATUS.RETURNED);
  } else if (statusGroup === 'approved' || statusGroup === 'po_issued') {
    where += ' AND pr.status = ?';
    params.push(PR_STATUS.APPROVED);
  } else if (statusGroup === 'rejected') {
    where += ' AND pr.status = ?';
    params.push(PR_STATUS.REJECTED);
  } else if (statusGroup === 'pending_approval' || statusGroup === 'pending') {
    where += ` AND pr.status IN (${REQUESTER_PENDING_STATUSES.map(() => '?').join(',')})`;
    params.push(...REQUESTER_PENDING_STATUSES);
  }

  if (requestType && requestType !== 'all') {
    where += ' AND pr.request_type = ?';
    params.push(requestType);
  }

  if (search) {
    const like = `%${search}%`;
    where += ` AND (
      pr.pr_number LIKE ? OR pr.title LIKE ?
      OR IFNULL(e.name, '') LIKE ? OR IFNULL(e.code, '') LIKE ?
      OR d.name LIKE ?
    )`;
    params.push(like, like, like, like, like);
  }

  if (dateFrom) {
    where += ' AND DATE(COALESCE(pr.submitted_at, pr.created_at)) >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    where += ' AND DATE(COALESCE(pr.submitted_at, pr.created_at)) <= ?';
    params.push(dateTo);
  }

  const fromSql = `
    FROM purchase_requests pr
    JOIN departments d ON d.id = pr.department_id
    JOIN users u ON u.id = pr.requester_id
    LEFT JOIN entity_masters e ON e.id = pr.entity_id
    ${where}
  `;

  const [[countRow]] = await pool.query(`SELECT COUNT(*) AS total ${fromSql}`, params);
  const total = Number(countRow?.total || 0);

  const [rows] = await pool.query(
    `SELECT pr.id, pr.pr_number, pr.title, pr.request_type, pr.priority, pr.status,
            pr.total_amount, pr.justification, pr.required_date, pr.vendor_selection,
            pr.pr_flow, pr.current_stage, pr.submitted_at, pr.created_at, pr.entity_id,
            d.name AS department_name, u.name AS requester_name,
            e.name AS entity_name, e.code AS entity_code, e.cost_center AS entity_cost_center,
            (SELECT COUNT(*) FROM pr_line_items pli WHERE pli.pr_id = pr.id) AS item_count
     ${fromSql}
     ORDER BY COALESCE(pr.submitted_at, pr.created_at) DESC, pr.id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const poMetaByPrId = await fetchLatestPoMetaByPrIds(rows.map((row) => row.id));

  const data = rows.map((row) => {
    const poMeta = poMetaByPrId.get(row.id) || null;
    const enriched = applyRequesterDisplay(
      {
        id: row.id,
        prNumber: row.pr_number,
        title: row.title,
        department: row.department_name,
        entityId: row.entity_id || null,
        entityName: row.entity_name || '',
        entityCode: row.entity_code || '',
        entityCostCenter: row.entity_cost_center || '',
        totalAmount: Number(row.total_amount || 0),
        status: row.status,
        statusFrontend: mapStatusToFrontend(row.status),
        statusUI: mapStatusToManagerUI(row.status, row.pr_flow, row.vendor_selection),
        priorityLower: mapPriorityToFrontend(row.priority),
        submittedDate: formatDate(row.submitted_at || row.created_at),
        createdAt: formatDate(row.created_at),
        requiredDate: formatDate(row.required_date),
        justification: row.justification || '',
        lineItems: [],
        approvalHistory: [],
        requester: row.requester_name,
        vendorSelection: row.vendor_selection === 'own' ? 'own' : 'scm',
        prFlow: row.pr_flow === 'functional' ? 'functional' : 'standard',
        currentStage: row.current_stage,
        items: Number(row.item_count || 0),
        requestType: row.request_type,
        currentApprover: null,
        l1Manager: null,
        scmBuyer: null,
      },
      poMeta
    );
    return toRequesterDashboardFormat(enriched);
  });

  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
    },
  };
}

export async function listPurchaseRequests(user, filters = {}) {
  // Requester lists use the lean paginated path — never N+1 enrich every PR
  if (user.role === 'Requester' && !filters.pendingOnly && filters.bucket !== 'scm') {
    const result = await listRequesterPurchaseRequests(user, {
      ...filters,
      page: filters.page || 1,
      pageSize: filters.pageSize || 50,
    });
    return result.data;
  }

  let sql = `
    SELECT pr.*, d.name AS department_name, u.name AS requester_name,
           e.name AS entity_name, e.code AS entity_code, e.cost_center AS entity_cost_center
    FROM purchase_requests pr
    JOIN departments d ON d.id = pr.department_id
    JOIN users u ON u.id = pr.requester_id
    LEFT JOIN entity_masters e ON e.id = pr.entity_id
    WHERE 1=1
  `;
  const params = [];

  if (user.role === 'Requester') {
    sql += ' AND pr.requester_id = ?';
    params.push(user.id);
  } else if (user.role === 'HOD Approver') {
    const hodFilter = hodAssignedTaskSql(user);
    sql += hodFilter.clause;
    params.push(...hodFilter.params);
  } else if (user.role === 'PR Manager') {
    if (filters.pendingOnly) {
      // Only PRs assigned to this L2 manager (or unassigned role queue)
      sql += ` AND pr.status IN (?, ?)
        AND (
          EXISTS (
            SELECT 1 FROM workflow_tasks wt
            WHERE wt.pr_id = pr.id
              AND wt.status = 'pending'
              AND wt.assigned_role = 'PR Manager'
              AND (wt.assigned_user_id = ? OR wt.assigned_user_id IS NULL)
          )
          OR NOT EXISTS (
            SELECT 1 FROM workflow_tasks wt2
            WHERE wt2.pr_id = pr.id
              AND wt2.status = 'pending'
              AND wt2.assigned_role = 'PR Manager'
          )
        )`;
      params.push(
        PR_STATUS.PENDING_PR_MANAGER_APPROVAL,
        PR_STATUS.PENDING_RFQ_L2_APPROVAL,
        user.id
      );
    }
  } else if (user.role === 'CFO') {
    if (filters.pendingOnly) {
      sql += ' AND pr.status IN (?, ?)';
      params.push(PR_STATUS.PENDING_CFO_APPROVAL, PR_STATUS.PENDING_RFQ_CFO_APPROVAL);
    }
  } else if (user.role === 'SCM Manager') {
    if (filters.pendingOnly) {
      sql += ' AND pr.status = ?';
      params.push(PR_STATUS.PENDING_BUSINESS_APPROVAL);
    }
  } else if (user.role === 'SCM Buyer') {
    if (filters.pendingOnly) {
      sql += ' AND pr.status = ?';
      params.push(PR_STATUS.PENDING_SCM_PO);
    } else if (filters.bucket === 'scm') {
      // Ready for PO: pending SCM PO, or orphan APPROVED (RFQ done) with no active PO
      sql += ` AND (
        pr.status = ?
        OR (
          pr.status = ?
          AND EXISTS (
            SELECT 1 FROM rfq_configs rc
            WHERE rc.pr_id = pr.id AND rc.finalized_at IS NOT NULL
          )
          AND NOT EXISTS (
            SELECT 1 FROM purchase_orders po
            WHERE po.pr_id = pr.id
              AND po.status IN ('pending_approval', 'pending_buyer_verify', 'approved', 'sent_to_vendor')
          )
        )
      )`;
      params.push(PR_STATUS.PENDING_SCM_PO, PR_STATUS.APPROVED);
    }
  }

  if (filters.status) {
    sql += ' AND pr.status = ?';
    params.push(filters.status);
  }

  // Newest created/submitted first (HOD / approval queues)
  sql += ' ORDER BY COALESCE(pr.submitted_at, pr.created_at) DESC, pr.id DESC';

  // SCM bucket list is for dashboards only — skip heavy enrichPR (line items + approval history N+1)
  if (filters.bucket === 'scm') {
    const scmSql = `
    SELECT pr.*, d.name AS department_name, u.name AS requester_name,
           e.name AS entity_name, e.code AS entity_code, e.cost_center AS entity_cost_center,
           COALESCE((
             SELECT ri.vendor_name
             FROM rfq_configs rc
             JOIN rfq_invitations ri ON ri.id = rc.recommended_invitation_id
             WHERE rc.pr_id = pr.id
             LIMIT 1
           ), '') AS recommended_vendor_name
    FROM purchase_requests pr
    JOIN departments d ON d.id = pr.department_id
    JOIN users u ON u.id = pr.requester_id
    LEFT JOIN entity_masters e ON e.id = pr.entity_id
    WHERE 1=1
      AND (
        pr.status = ?
        OR (
          pr.status = ?
          AND EXISTS (
            SELECT 1 FROM rfq_configs rc
            WHERE rc.pr_id = pr.id AND rc.finalized_at IS NOT NULL
          )
          AND NOT EXISTS (
            SELECT 1 FROM purchase_orders po
            WHERE po.pr_id = pr.id
              AND po.status IN ('pending_approval', 'pending_buyer_verify', 'approved', 'sent_to_vendor')
          )
        )
      )
    ORDER BY COALESCE(pr.submitted_at, pr.created_at) DESC, pr.id DESC
  `;
    const [rows] = await pool.query(scmSql, [PR_STATUS.PENDING_SCM_PO, PR_STATUS.APPROVED]);
    return rows.map((row) => mapScmBucketSummary(row));
  }

  const [rows] = await pool.query(sql, params);
  return Promise.all(rows.map(enrichPR));
}

/** Lean PR row for SCM bucket lists — no line items / approval history queries. */
function mapScmBucketSummary(row) {
  return {
    id: row.id,
    prNumber: row.pr_number,
    title: row.title,
    requestType: row.request_type,
    purchaseType: row.purchase_type || 'purchase_order',
    purchaseTypeLabel: purchaseTypeLabel(row.purchase_type),
    department: row.department_name,
    departmentId: row.department_id,
    entityId: row.entity_id || null,
    entityName: row.entity_name || '',
    entityCode: row.entity_code || '',
    entityCostCenter: row.entity_cost_center || '',
    requester: row.requester_name,
    requesterId: row.requester_id,
    priority: row.priority,
    priorityLower: mapPriorityToFrontend(row.priority),
    justification: row.justification,
    requiredDate: formatDate(row.required_date),
    currency: normalizeCurrency(row.currency),
    totalAmount: Number(row.total_amount),
    status: row.status,
    statusFrontend: mapStatusToFrontend(row.status),
    statusUI: mapStatusToManagerUI(row.status, row.pr_flow, row.vendor_selection),
    vendorSelection: row.vendor_selection === 'own' ? 'own' : 'scm',
    prFlow: row.pr_flow === 'functional' ? 'functional' : 'standard',
    recommendedVendor: row.recommended_vendor_name || '',
    currentStage: row.current_stage,
    submittedDate: formatDate(row.submitted_at || row.created_at),
    createdAt: formatDate(row.created_at),
    lineItems: [],
    approvalHistory: [],
  };
}

export async function getRequesterStats(userId) {
  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS cnt FROM purchase_requests WHERE requester_id = ? GROUP BY status`,
    [userId]
  );
  const counts = Object.fromEntries(rows.map((r) => [r.status, r.cnt]));
  const pendingStatuses = [
    PR_STATUS.PENDING_HOD_APPROVAL,
    PR_STATUS.PENDING_PR_MANAGER_APPROVAL,
    PR_STATUS.PENDING_CFO_APPROVAL,
    PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL,
    PR_STATUS.PENDING_RFQ_L2_APPROVAL,
    PR_STATUS.PENDING_RFQ_CFO_APPROVAL,
    PR_STATUS.PENDING_BUSINESS_APPROVAL,
    PR_STATUS.PENDING_SCM_PO,
  ];
  const pending = pendingStatuses.reduce((sum, s) => sum + (counts[s] || 0), 0);

  // Pending PRs past 1-day SLA from submit/create time
  const [overdueRows] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM purchase_requests
     WHERE requester_id = ?
       AND status IN (${pendingStatuses.map(() => '?').join(',')})
       AND COALESCE(submitted_at, created_at) < (NOW() - INTERVAL 1 DAY)`,
    [userId, ...pendingStatuses]
  );

  return {
    myPRCount: rows.reduce((s, r) => s + r.cnt, 0),
    pendingApprovals: pending,
    approved: counts[PR_STATUS.APPROVED] || 0,
    rejected: counts[PR_STATUS.REJECTED] || 0,
    overdueSla: Number(overdueRows[0]?.cnt || 0),
    returnedForRework: counts[PR_STATUS.RETURNED] || 0,
    poIssued: counts[PR_STATUS.APPROVED] || 0,
    rfqEntryPending: await countRequesterRfqTasks(userId),
  };
}

async function countRequesterRfqTasks(userId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM workflow_tasks wt
     JOIN purchase_requests pr ON pr.id = wt.pr_id
     WHERE wt.assigned_role = 'Requester' AND wt.task_type = 'RFQ_ENTRY' AND wt.status = 'pending'
     AND pr.requester_id = ?`,
    [userId]
  );
  return rows[0].cnt;
}

export async function getManagerStats() {
  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS cnt FROM purchase_requests GROUP BY status`
  );
  const counts = Object.fromEntries(rows.map((r) => [r.status, r.cnt]));
  return {
    totalPRs: rows.reduce((s, r) => s + r.cnt, 0),
    pendingApproval:
      (counts[PR_STATUS.PENDING_PR_MANAGER_APPROVAL] || 0) +
      (counts[PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL] || 0),
    approvedThisMonth: counts[PR_STATUS.APPROVED] || 0,
    rejected: counts[PR_STATUS.REJECTED] || 0,
    overdueCount: 0,
    totalSpend: 0,
  };
}

const CFO_HIGH_VALUE_THRESHOLD = 5_000_000; // ₹50L — matches CFO dashboard label
const ENTITY_CARD_COLORS = ['#14B8A6', '#8B5CF6', '#F59E0B', '#3B82F6', '#EC4899', '#10B981', '#6366F1', '#F97316'];
const CFO_PO_EXCLUDED = ['draft', 'cancelled', 'rejected'];
const CFO_PO_PENDING = ['pending_approval', 'pending_buyer_verify'];
const CFO_PO_APPROVED = [
  'approved',
  'sent_to_vendor',
  'awaiting_grn',
  'grn_completed',
  'invoice_entry',
  'pending_accounts_approval',
  'approved_for_payment',
  'paid',
  'imported',
];
const CFO_PO_REJECTED = ['rejected', 'cancelled'];

function sqlInList(values) {
  return values.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(',');
}

function cfoDashboardPoStatusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (CFO_PO_PENDING.includes(s)) return 'Pending Approval';
  if (s === 'rejected') return 'Rejected';
  if (s === 'cancelled') return 'Cancelled';
  if (CFO_PO_APPROVED.includes(s)) return 'Approved';
  return status || 'Unknown';
}

function relativeTimeLabel(dateValue) {
  if (!dateValue) return '';
  const then = new Date(dateValue).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(dateValue);
}

/**
 * Live CFO dashboard: PO KPIs, entity PO spend, PO list, high-value POs, recent PO activity.
 */
export async function getCfoDashboard() {
  const excludedSql = sqlInList(CFO_PO_EXCLUDED);
  const pendingSql = sqlInList(CFO_PO_PENDING);
  const approvedSql = sqlInList(CFO_PO_APPROVED);
  const rejectedSql = sqlInList(CFO_PO_REJECTED);

  const [[pendingAgg]] = await pool.query(
    `SELECT
       COUNT(*) AS pending_count,
       COALESCE(SUM(CASE WHEN grand_total >= ? THEN 1 ELSE 0 END), 0) AS high_value_count,
       COALESCE(SUM(grand_total), 0) AS pending_amount
     FROM purchase_orders
     WHERE status IN (${pendingSql})`,
    [CFO_HIGH_VALUE_THRESHOLD]
  );

  const [[monthActions]] = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN status IN (${approvedSql}) THEN 1 ELSE 0 END), 0) AS approved_cnt,
       COALESCE(SUM(CASE WHEN status IN (${rejectedSql}) THEN 1 ELSE 0 END), 0) AS rejected_cnt,
       COALESCE(SUM(CASE WHEN status IN (${approvedSql}) THEN grand_total ELSE 0 END), 0) AS approved_amount
     FROM purchase_orders
     WHERE YEAR(COALESCE(signed_at, po_date, updated_at, created_at)) = YEAR(CURDATE())
       AND MONTH(COALESCE(signed_at, po_date, updated_at, created_at)) = MONTH(CURDATE())
       AND status NOT IN ('draft')`
  );

  const [[spendRow]] = await pool.query(
    `SELECT COALESCE(SUM(grand_total), 0) AS total_spend
     FROM purchase_orders
     WHERE status NOT IN (${excludedSql})`
  );

  const [entityRows] = await pool.query(
    `SELECT
       COALESCE(e.id, 0) AS entity_id,
       COALESCE(NULLIF(TRIM(e.name), ''), NULLIF(TRIM(po.entity), ''), 'Unassigned') AS entity_name,
       COALESCE(NULLIF(TRIM(e.code), ''), 'N/A') AS entity_code,
       COALESCE(SUM(CASE WHEN po.status IN (${pendingSql}) THEN 1 ELSE 0 END), 0) AS pending_count,
       COALESCE(SUM(CASE WHEN po.status IN (${pendingSql}) THEN po.grand_total ELSE 0 END), 0) AS pending_amount,
       COALESCE(SUM(CASE WHEN po.status IN (${approvedSql}) THEN po.grand_total ELSE 0 END), 0) AS approved_amount,
       COALESCE(SUM(po.grand_total), 0) AS utilized_amount
     FROM purchase_orders po
     LEFT JOIN entity_masters e ON e.id = po.entity_id
     WHERE po.status NOT IN (${excludedSql})
     GROUP BY COALESCE(e.id, 0),
              COALESCE(NULLIF(TRIM(e.name), ''), NULLIF(TRIM(po.entity), ''), 'Unassigned'),
              COALESCE(NULLIF(TRIM(e.code), ''), 'N/A')
     ORDER BY utilized_amount DESC`
  );

  const entities = entityRows.map((row, idx) => {
    const pendingCount = Number(row.pending_count || 0);
    const pendingAmount = Number(row.pending_amount || 0);
    const approvedAmount = Number(row.approved_amount || 0);
    const utilizedBudget = Number(row.utilized_amount || 0);
    const allocatedBudget = Math.max(utilizedBudget + pendingAmount, utilizedBudget, 1);
    const utilizationPercentage = Math.min(
      100,
      Math.round((utilizedBudget / allocatedBudget) * 100)
    );
    return {
      id: String(row.entity_id || 'unassigned'),
      name: row.entity_name,
      code: row.entity_code || 'N/A',
      allocatedBudget,
      utilizedBudget,
      utilizationPercentage,
      pendingPRsCount: pendingCount,
      pendingAmount,
      approvedAmount,
      color: ENTITY_CARD_COLORS[idx % ENTITY_CARD_COLORS.length],
    };
  });

  const [alertRows] = await pool.query(
    `SELECT po.id, po.po_number, po.vendor_name, po.grand_total, po.status,
            COALESCE(po.po_date, po.created_at) AS started_at,
            COALESCE(NULLIF(TRIM(e.name), ''), NULLIF(TRIM(po.entity), ''), '—') AS entity_name
     FROM purchase_orders po
     LEFT JOIN entity_masters e ON e.id = po.entity_id
     WHERE po.status IN (${pendingSql})
       AND po.grand_total >= ?
     ORDER BY po.grand_total DESC, COALESCE(po.po_date, po.created_at) ASC
     LIMIT 10`,
    [CFO_HIGH_VALUE_THRESHOLD]
  );

  const highValueAlerts = alertRows.map((row) => {
    const started = new Date(row.started_at);
    const daysWaiting = Number.isNaN(started.getTime())
      ? 0
      : Math.max(0, Math.floor((Date.now() - started.getTime()) / 86400000));
    return {
      id: row.po_number,
      prId: row.po_number,
      title: row.vendor_name || 'Purchase Order',
      entity: row.entity_name,
      amount: Number(row.grand_total),
      priority: Number(row.grand_total) >= 10_000_000 ? 'Critical' : 'High',
      daysWaiting,
      isOverdue: daysWaiting > 5,
    };
  });

  const [activityRows] = await pool.query(
    `SELECT po.id, po.po_number, po.vendor_name, po.grand_total, po.status,
            COALESCE(po.signed_at, po.updated_at, po.created_at) AS acted_at,
            COALESCE(NULLIF(TRIM(e.name), ''), NULLIF(TRIM(po.entity), ''), '—') AS entity_name
     FROM purchase_orders po
     LEFT JOIN entity_masters e ON e.id = po.entity_id
     WHERE po.status NOT IN ('draft')
     ORDER BY COALESCE(po.signed_at, po.updated_at, po.created_at) DESC, po.id DESC
     LIMIT 12`
  );

  const recentActivity = activityRows.map((row) => {
    const status = String(row.status || '').toLowerCase();
    let type = 'Created';
    if (CFO_PO_APPROVED.includes(status)) type = 'Approved';
    else if (status === 'rejected' || status === 'cancelled') type = 'Rejected';
    else if (CFO_PO_PENDING.includes(status)) type = 'Submitted';
    return {
      id: String(row.id),
      type,
      prId: row.po_number,
      entity: row.entity_name,
      amount: Number(row.grand_total || 0),
      user: row.vendor_name || '—',
      timestamp: relativeTimeLabel(row.acted_at),
    };
  });

  const [poRows] = await pool.query(
    `SELECT po.id, po.po_number, po.vendor_name, po.grand_total, po.status,
            COALESCE(po.po_date, po.created_at) AS po_date,
            po.entity_id,
            COALESCE(NULLIF(TRIM(e.name), ''), NULLIF(TRIM(po.entity), ''), '—') AS entity_name,
            COALESCE(NULLIF(TRIM(e.code), ''), 'N/A') AS entity_code
     FROM purchase_orders po
     LEFT JOIN entity_masters e ON e.id = po.entity_id
     WHERE po.status NOT IN ('draft')
     ORDER BY COALESCE(po.po_date, po.created_at) DESC, po.id DESC
     LIMIT 200`
  );

  const purchaseOrders = poRows.map((row) => ({
    id: row.po_number,
    poId: Number(row.id),
    poNumber: row.po_number,
    vendorName: row.vendor_name || '—',
    amount: Number(row.grand_total || 0),
    status: cfoDashboardPoStatusLabel(row.status),
    statusRaw: row.status,
    entity: String(row.entity_id || 'unassigned'),
    entityName: row.entity_name,
    entityCode: row.entity_code,
    poDate: formatDate(row.po_date),
    isHighValue: Number(row.grand_total || 0) >= CFO_HIGH_VALUE_THRESHOLD,
  }));

  return {
    stats: {
      totalPendingApprovals: Number(pendingAgg?.pending_count || 0),
      highValuePRs: Number(pendingAgg?.high_value_count || 0),
      approvedThisMonth: Number(monthActions?.approved_cnt || 0),
      rejectedThisMonth: Number(monthActions?.rejected_cnt || 0),
      totalSpendAllEntities: Number(spendRow?.total_spend || 0),
      pendingAmount: Number(pendingAgg?.pending_amount || 0),
      approvedAmountThisMonth: Number(monthActions?.approved_amount || 0),
    },
    entities,
    highValueAlerts,
    recentActivity,
    purchaseOrders,
  };
}

/**
 * HOD / L1 can act when My Tasks would show the PR:
 * - pending task assigned to this user id, OR
 * - pending task assigned to same email (SSO / re-synced user id), OR
 * - unassigned HOD role-queue task and this user is the requester's L1 (supervisor), OR
 * - unassigned HOD role-queue task (same visibility as listTasks)
 */
async function assertHodCanActOnPr(user, prId) {
  const userEmail = String(user.email || '').toLowerCase().trim();
  const [taskRows] = await pool.query(
    `SELECT wt.assigned_user_id, u.email AS assigned_email
     FROM workflow_tasks wt
     LEFT JOIN users u ON u.id = wt.assigned_user_id
     WHERE wt.pr_id = ?
       AND wt.status = 'pending'
       AND wt.task_type IN ('PR_APPROVAL', 'RFQ_POST_APPROVAL')
       AND (
         wt.assigned_user_id = ?
         OR wt.assigned_role = 'HOD Approver'
       )
     ORDER BY wt.id DESC
     LIMIT 1`,
    [prId, user.id]
  );

  if (!taskRows.length) {
    throw new Error('This PR is not assigned to you for approval');
  }

  const assignedUserId = taskRows[0].assigned_user_id;
  const assignedEmail = String(taskRows[0].assigned_email || '').toLowerCase().trim();

  if (assignedUserId) {
    if (assignedUserId === user.id) return;
    // Same person, different user row after SSO / RefexOne re-sync
    if (assignedEmail && userEmail && assignedEmail === userEmail) return;
    throw new Error('This PR is assigned to another L1 manager for approval');
  }

  // Unassigned HOD role-queue — same visibility as My Tasks (listTasks)
}

async function assertAssignedUserCanActOnPr(user, prId) {
  const userEmail = String(user.email || '').toLowerCase().trim();
  const [taskRows] = await pool.query(
    `SELECT wt.assigned_user_id, u.email AS assigned_email
     FROM workflow_tasks wt
     LEFT JOIN users u ON u.id = wt.assigned_user_id
     WHERE wt.pr_id = ?
       AND wt.status = 'pending'
       AND wt.task_type = 'PR_APPROVAL'
       AND wt.assigned_user_id IS NOT NULL
     ORDER BY wt.id DESC
     LIMIT 1`,
    [prId]
  );
  if (!taskRows.length) {
    throw new Error('This PR is not assigned to you for approval');
  }
  if (taskRows[0].assigned_user_id === user.id) return;
  const assignedEmail = String(taskRows[0].assigned_email || '').toLowerCase().trim();
  if (assignedEmail && userEmail && assignedEmail === userEmail) return;
  throw new Error('This PR is assigned to another person for approval');
}

const PRE_RFQ_STATUS_ACTING_ROLE = {
  [PR_STATUS.PENDING_HOD_APPROVAL]: 'HOD Approver',
  [PR_STATUS.PENDING_PR_MANAGER_APPROVAL]: 'PR Manager',
  [PR_STATUS.PENDING_CFO_APPROVAL]: 'CFO',
};

async function getPendingPrApprovalTask(prId) {
  const [rows] = await pool.query(
    `SELECT wt.assigned_user_id, wt.assigned_role, u.email AS assigned_email
     FROM workflow_tasks wt
     LEFT JOIN users u ON u.id = wt.assigned_user_id
     WHERE wt.pr_id = ?
       AND wt.status = 'pending'
       AND wt.task_type = 'PR_APPROVAL'
     ORDER BY wt.id DESC
     LIMIT 1`,
    [prId]
  );
  return rows[0] || null;
}

function userMatchesTaskAssignment(user, task) {
  if (!task) return false;
  if (task.assigned_user_id != null && Number(task.assigned_user_id) === Number(user.id)) return true;
  const userEmail = String(user.email || '').toLowerCase().trim();
  const assignedEmail = String(task.assigned_email || '').toLowerCase().trim();
  if (task.assigned_user_id != null && assignedEmail && userEmail && assignedEmail === userEmail) return true;
  return false;
}

export async function processApproval(user, prId, action, remarks, options = {}) {
  const [prRows] = await pool.query('SELECT * FROM purchase_requests WHERE id = ?', [prId]);
  if (!prRows.length) throw new Error('PR not found');

  const pr = prRows[0];
  const isFunctional = pr.pr_flow === 'functional';
  const isFunctionalUserStep = isFunctional && pr.status === PR_STATUS.PENDING_HOD_APPROVAL;
  const pendingTask = await getPendingPrApprovalTask(prId);
  const assignedToMe = userMatchesTaskAssignment(user, pendingTask);

  let actingRole = user.role;
  let roleConfig = ROLE_STAGE_MAP[user.role];
  let actingAsHod = user.role === 'HOD Approver';

  if (user.role === 'Super Admin' && PRE_RFQ_STATUS_ACTING_ROLE[pr.status]) {
    actingRole = PRE_RFQ_STATUS_ACTING_ROLE[pr.status];
    roleConfig = ROLE_STAGE_MAP[actingRole];
    actingAsHod = actingRole === 'HOD Approver';
  } else if (isFunctionalUserStep) {
    if (user.role !== 'Super Admin') {
      await assertAssignedUserCanActOnPr(user, prId);
    }
    actingRole = 'HOD Approver';
    roleConfig = ROLE_STAGE_MAP['HOD Approver'];
    actingAsHod = true;
  } else if (assignedToMe) {
    // Assigned person may approve / reject / send back regardless of JWT role
    // (Admin can assign menus + tasks to any user).
    const fromTask =
      (pendingTask.assigned_role && ROLE_STAGE_MAP[pendingTask.assigned_role]
        ? pendingTask.assigned_role
        : null) || PRE_RFQ_STATUS_ACTING_ROLE[pr.status];
    if (!fromTask || !ROLE_STAGE_MAP[fromTask]) {
      throw new Error('Role cannot approve PRs');
    }
    if (pr.status !== ROLE_STAGE_MAP[fromTask].status) {
      throw new Error(`PR is not pending your approval (current: ${pr.status})`);
    }
    actingRole = fromTask;
    roleConfig = ROLE_STAGE_MAP[fromTask];
    actingAsHod = fromTask === 'HOD Approver';
  } else {
    if (!roleConfig) throw new Error('Role cannot approve PRs');
    if (pr.status !== roleConfig.status) {
      throw new Error(`PR is not pending your approval (current: ${pr.status})`);
    }
    if (user.role === 'HOD Approver') {
      await assertHodCanActOnPr(user, prId);
    } else if (
      pendingTask?.assigned_user_id &&
      Number(pendingTask.assigned_user_id) !== Number(user.id)
    ) {
      const userEmail = String(user.email || '').toLowerCase().trim();
      const assignedEmail = String(pendingTask.assigned_email || '').toLowerCase().trim();
      if (!(assignedEmail && userEmail && assignedEmail === userEmail)) {
        throw new Error('This PR is assigned to another person for approval');
      }
    }
    actingRole = user.role;
    actingAsHod = user.role === 'HOD Approver';
  }

  if (!remarks?.trim()) throw new Error('Remarks are required');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let newStatus;
    let newStage = null;
    let nextRole = null;

    let nextAssignee = null;

    let requireCfoApproval = pr.require_cfo_approval;
    let skipToScmRfq = false;
    let nextFunctionalApprover = null;

    if (action === 'approve') {
      if (actingAsHod) {
        if (isFunctional) {
          const nextApproverId = nextIdInApprovalChain(pr, user.id);
          if (nextApproverId) {
            nextFunctionalApprover = await resolveSelectedApprovalUser(nextApproverId);
            newStatus = PR_STATUS.PENDING_HOD_APPROVAL;
            newStage = STAGE.HOD_REVIEW;
            nextRole = null;
            skipToScmRfq = false;
            const { step, total } = approvalStepIndex(pr, user.id);
            remarks = `${remarks.trim()} [User Approval ${step} of ${total} — next: ${nextFunctionalApprover.name || nextFunctionalApprover.email}]`;
          } else {
            newStatus = PR_STATUS.APPROVED;
            newStage = null;
            nextRole = null;
            skipToScmRfq = true;
            const { step, total } = approvalStepIndex(pr, user.id);
            if (total > 1) {
              remarks = `${remarks.trim()} [User Approval ${step} of ${total} — chain complete]`;
            }
          }
        } else if (pr.vendor_selection === 'own') {
          // Own: HOD → Requester RFQ Entry
          newStatus = PR_STATUS.APPROVED;
          newStage = null;
          nextRole = null;
        } else {
          // SCM: L1 chooses Business/CFO. Always go to L2 first.
          let goToBusiness = null;
          if (typeof options.goToBusinessApproval === 'boolean') {
            goToBusiness = options.goToBusinessApproval;
          } else if (options.goToBusinessApproval === 'yes' || options.goToBusinessApproval === 'true') {
            goToBusiness = true;
          } else if (options.goToBusinessApproval === 'no' || options.goToBusinessApproval === 'false') {
            goToBusiness = false;
          }
          if (goToBusiness === null) {
            throw new Error('Select Yes or No for Business / CFO Approval');
          }
          requireCfoApproval = goToBusiness ? 1 : 0;
          remarks = `${remarks.trim()} [${
            goToBusiness ? 'Go to Business: Yes — L2 → CFO if available' : 'Go to Business: No — L2 → SCM RFQ (skip CFO)'
          }]`;
          newStatus = PR_STATUS.PENDING_PR_MANAGER_APPROVAL;
          newStage = STAGE.PR_MANAGER_REVIEW;
          nextRole = 'PR Manager';
        }
      } else if (actingRole === 'PR Manager') {
        const wantCfo = pr.require_cfo_approval == null || Number(pr.require_cfo_approval) === 1;
        const [cfoRows] = await conn.query(
          `SELECT id, email, name FROM users WHERE role = 'CFO' AND is_active = 1 ORDER BY id ASC LIMIT 1`
        );
        const cfoUser = wantCfo ? cfoRows[0] || null : null;
        if (cfoUser) {
          newStatus = PR_STATUS.PENDING_CFO_APPROVAL;
          newStage = STAGE.CFO_REVIEW;
          nextRole = 'CFO';
        } else {
          // No → skip CFO. Yes but no CFO user → also skip to SCM RFQ.
          newStatus = PR_STATUS.APPROVED;
          newStage = null;
          nextRole = null;
          skipToScmRfq = pr.vendor_selection !== 'own';
        }
      } else if (actingRole === 'CFO') {
        // SCM path only (pre-RFQ): after CFO → SCM RFQ queue
        newStatus = PR_STATUS.APPROVED;
        newStage = null;
        nextRole = null;
      }
    } else if (action === 'reject') {
      newStatus = PR_STATUS.REJECTED;
    } else if (action === 'return' || action === 'rework') {
      const returnTo = options.returnTo || 'REQUESTER';
      const applyResult = await applySendBackToTarget(conn, pr, returnTo, remarks, user);
      await conn.query(
        `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks) VALUES (?, ?, ?, ?, ?)`,
        [prId, roleConfig.stage, user.id, action, applyResult.remarksLine]
      );
      await conn.commit();
      const updatedPr = await getPurchaseRequestById(prId);
      queueSendBackNotifications(updatedPr, { ...applyResult, actorRole: actingRole });
      queueApproverActionConfirmationForUser(prId, user, action, {
        remarks: applyResult.remarksLine || remarks,
        approverRole: actingRole,
      });
      return updatedPr;
    } else {
      throw new Error('Invalid action');
    }

    await conn.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks) VALUES (?, ?, ?, ?, ?)`,
      [prId, roleConfig.stage, user.id, action, remarks]
    );

    await conn.query(
      `UPDATE purchase_requests
       SET status = ?, current_stage = ?, require_cfo_approval = ?, approval_user_id = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        newStatus,
        newStage,
        requireCfoApproval,
        nextFunctionalApprover?.id || pr.approval_user_id || null,
        prId,
      ]
    );

    await conn.query(
      `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW()
       WHERE pr_id = ? AND status = 'pending' AND task_type = 'PR_APPROVAL'
         AND (assigned_user_id = ? OR assigned_role = ?)`,
      [prId, user.id, actingAsHod ? 'HOD Approver' : actingRole]
    );

    if (nextFunctionalApprover && action === 'approve') {
      nextAssignee = await createSelectedUserApprovalTask(conn, prId, nextFunctionalApprover.id);
    } else if (nextRole === 'PR Manager' && action === 'approve') {
      const [reqRows] = await conn.query(
        `SELECT u.email FROM users u WHERE u.id = ?`,
        [pr.requester_id]
      );
      nextAssignee = await createL2ApprovalTask(
        conn,
        prId,
        reqRows[0]?.email || '',
        pr.department_id
      );
    } else if (nextRole && action === 'approve') {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);
      // Prefer a particular active user for role-queued steps (e.g. CFO)
      const [roleUsers] = await conn.query(
        `SELECT id, email, name FROM users WHERE role = ? AND is_active = 1 ORDER BY id ASC LIMIT 1`,
        [nextRole]
      );
      const roleUser = roleUsers[0] || null;
      await conn.query(
        `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
         VALUES (?, 'PR_APPROVAL', ?, ?, 'pending', ?)`,
        [prId, nextRole, roleUser?.id || null, dueDate.toISOString().split('T')[0]]
      );
      if (roleUser?.email) {
        nextAssignee = { email: roleUser.email, name: roleUser.name, userId: roleUser.id };
      }
    }

    if (isFunctional && actingAsHod && action === 'approve' && skipToScmRfq) {
      await conn.query(
        `UPDATE rfq_configs SET requester_submitted_at = COALESCE(requester_submitted_at, NOW()), updated_at = NOW()
         WHERE pr_id = ?`,
        [prId]
      );
    }

    // Own vendor: Requester RFQ Entry immediately after HOD approval (Standard only)
    let rfqEntryRequester = null;
    if (
      !isFunctional &&
      actingAsHod &&
      action === 'approve' &&
      pr.vendor_selection === 'own'
    ) {
      const rfqDue = new Date();
      rfqDue.setDate(rfqDue.getDate() + 5);
      await conn.query(
        `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
         VALUES (?, 'RFQ_ENTRY', 'Requester', ?, 'pending', ?)`,
        [prId, pr.requester_id, rfqDue.toISOString().split('T')[0]]
      );
      const [reqRows] = await conn.query(`SELECT id, email, name FROM users WHERE id = ?`, [
        pr.requester_id,
      ]);
      rfqEntryRequester = reqRows[0] || null;
    }

    // SCM vendor: after CFO pre-RFQ, or L2 skip-CFO → SCM Buyer RFQ Entry
    let scmRfqBuyerEmails = [];
    if ((actingRole === 'CFO' || skipToScmRfq) && action === 'approve') {
      const rfqDue = new Date();
      rfqDue.setDate(rfqDue.getDate() + 5);
      scmRfqBuyerEmails = await getScmBuyerNotifyEmails(conn);
      await conn.query(
        `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
         VALUES (?, 'RFQ_ENTRY', 'SCM Buyer', ?, 'pending', ?)`,
        [prId, null, rfqDue.toISOString().split('T')[0]]
      );
    }

    await conn.commit();
    const updatedPr = await getPurchaseRequestById(prId);

    const notifyRequesterStepMoved = (nextStepLabel, completedStepLabel) => {
      if (action !== 'approve') return;
      queueRequesterStepProgressNotification(updatedPr, {
        action: 'approve',
        actorRole: actingAsHod ? 'HOD Approver' : actingRole,
        actorName: user.name,
        completedStepLabel:
          completedStepLabel ||
          (isFunctional ? 'User Approval' : `${actingAsHod ? 'L1 Manager' : actingRole} Approval`),
        nextStepLabel,
        remarks: typeof remarks === 'string' ? remarks.replace(/\s*\[User Approval[^\]]*\]\s*/g, ' ').trim() : '',
        requesterName: updatedPr.requester,
      });
    };

    if (nextFunctionalApprover && action === 'approve') {
      const { step, total } = approvalStepIndex(
        { ...pr, approval_user_id: nextFunctionalApprover.id },
        nextFunctionalApprover.id
      );
      const nextLabel = total > 1 ? `User Approval ${step} of ${total}` : 'User Approval';
      queuePrApprovalPendingNotification(
        updatedPr,
        'HOD Approver',
        { name: updatedPr.requester, email: '' },
        updatedPr.departmentId,
        {
          approverEmails: nextAssignee?.hodEmail || nextAssignee?.email
            ? [nextAssignee.hodEmail || nextAssignee.email]
            : undefined,
          approverName: nextAssignee?.hodName || nextAssignee?.name || undefined,
          stageLabel: nextLabel,
          roleDisplayName: 'Selected Approver',
        }
      );
      const { step: doneStep, total: doneTotal } = approvalStepIndex(pr, user.id);
      notifyRequesterStepMoved(
        nextLabel,
        doneTotal > 1 ? `User Approval ${doneStep} of ${doneTotal}` : 'User Approval'
      );
    } else if (nextRole && action === 'approve') {
      const nextLabel = nextRole === 'PR Manager' ? 'L2 Manager Approval' : `${nextRole} Approval`;
      queuePrApprovalPendingNotification(
        updatedPr,
        nextRole,
        { name: updatedPr.requester, email: '' },
        updatedPr.departmentId,
        {
          approverEmails: nextAssignee?.email ? [nextAssignee.email] : undefined,
          approverName: nextAssignee?.name || undefined,
          stageLabel: nextLabel,
        }
      );
      notifyRequesterStepMoved(nextLabel);
    } else if (rfqEntryRequester?.email) {
      // Particular requester — RFQ entry step
      queuePrApprovalPendingNotification(
        updatedPr,
        'Requester',
        { name: rfqEntryRequester.name, email: rfqEntryRequester.email },
        updatedPr.departmentId,
        {
          approverEmails: [rfqEntryRequester.email],
          approverName: rfqEntryRequester.name,
          stageLabel: 'RFQ Entry Required',
        }
      );
      notifyRequesterStepMoved('RFQ Entry (Own Vendor)', 'L1 Manager Approval');
    } else if ((actingRole === 'CFO' || skipToScmRfq) && action === 'approve') {
      // Functional Own (and any PR that already has quotation rounds) → SCM Buyer with files attached
      const scmLabel =
        isFunctional && pr.vendor_selection === 'own' ? 'SCM Final RFQ' : 'SCM RFQ Entry';
      try {
        const { queuePostQuotationApprovalMail } = await import('./rfqService.js');
        await queuePostQuotationApprovalMail(updatedPr, 'SCM Buyer', {
          rfqEntry: true,
          stageLabel: scmLabel,
          approverEmails: scmRfqBuyerEmails.length ? scmRfqBuyerEmails : undefined,
          approverName: 'SCM Buyer',
        });
      } catch (err) {
        console.warn('SCM Buyer RFQ mail pack failed, sending without files:', err.message);
        queuePrApprovalPendingNotification(
          updatedPr,
          'SCM Buyer',
          { name: updatedPr.requester, email: '' },
          updatedPr.departmentId,
          {
            rfqEntry: true,
            stageLabel: scmLabel,
            approverEmails: scmRfqBuyerEmails.length ? scmRfqBuyerEmails : undefined,
            approverName: 'SCM Buyer',
          }
        );
      }
      notifyRequesterStepMoved(
        scmLabel,
        isFunctional ? 'User Approval (chain complete)' : `${actingRole} Approval`
      );
    } else if (action === 'reject' || action === 'return' || action === 'rework') {
      // Particular requester — return / reject
      queuePostRfqActionNotification(updatedPr, actingRole, action, remarks, {
        name: updatedPr.requester,
      });
    }

    if (action === 'approve' || action === 'reject') {
      queueApproverActionConfirmationForUser(prId, user, action, {
        remarks,
        approverRole: actingAsHod ? 'HOD Approver' : actingRole,
      });
    }
    return updatedPr;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updatePrBillingDelivery(user, prId, body = {}) {
  const [prRows] = await pool.query('SELECT * FROM purchase_requests WHERE id = ?', [prId]);
  if (!prRows.length) throw new Error('PR not found');
  const pr = prRows[0];
  const isOwner = Number(pr.requester_id) === Number(user.id);
  const isRfqEditor = ['SCM Buyer', 'SCM Manager', 'Super Admin'].includes(user.role);
  if (!isOwner && !isRfqEditor) throw new Error('Unauthorized');

  const extras = parseRequisitionExtras(body, {
    deliveryPoc: pr.delivery_poc,
    placeOfDelivery: pr.place_of_delivery,
    billingAddress: pr.billing_address,
    expectedDeliveryTimeline: pr.expected_delivery_timeline,
    paymentTerms: pr.payment_terms,
    deliveryPocEmail: pr.delivery_poc_email,
    deliveryPocPhone: pr.delivery_poc_phone,
    projectManagerHo: pr.project_manager_ho,
    projectManagerContact: pr.project_manager_contact,
    projectManagerEmail: pr.project_manager_email,
  });
  const billing = await resolvePrBilling(pr.entity_id, body, pr);

  await pool.query(
    `UPDATE purchase_requests
     SET billing_location_id = ?, billing_location = ?, billing_gst_no = ?, billing_address = ?,
         delivery_poc = ?, place_of_delivery = ?, expected_delivery_timeline = ?, payment_terms = ?,
         delivery_poc_email = ?, delivery_poc_phone = ?,
         project_manager_ho = ?, project_manager_contact = ?, project_manager_email = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [
      billing.billingLocationId,
      billing.billingLocation || null,
      billing.billingGstNo || null,
      extras.billingAddress || null,
      extras.deliveryPoc || null,
      extras.placeOfDelivery || null,
      extras.expectedDeliveryTimeline || null,
      extras.paymentTerms || null,
      extras.deliveryPocEmail || null,
      extras.deliveryPocPhone || null,
      extras.projectManagerHo || null,
      extras.projectManagerContact || null,
      extras.projectManagerEmail || null,
      prId,
    ]
  );
  return getPurchaseRequestById(prId);
}

export async function updatePurchaseRequest(user, prId, body, conn = null, options = {}) {
  const [prRows] = await pool.query(
    'SELECT * FROM purchase_requests WHERE id = ? AND requester_id = ?',
    [prId, user.id]
  );
  if (!prRows.length) throw new Error('PR not found');

  const pr = prRows[0];
  const requesterEditable = new Set([
    PR_STATUS.DRAFT,
    PR_STATUS.RETURNED,
    PR_STATUS.PENDING_HOD_APPROVAL,
    PR_STATUS.PENDING_PR_MANAGER_APPROVAL,
    PR_STATUS.PENDING_CFO_APPROVAL,
  ]);
  if (!requesterEditable.has(pr.status)) {
    throw new Error('This PR can no longer be edited. Ask an approver to send it back if changes are needed.');
  }

  const {
    title,
    requestType,
    purchaseType,
    department,
    entityId,
    priority,
    justification,
    requiredDate,
    vendorSelection,
    currency,
    lineItems = [],
    attachments = [],
  } = body;
  const extras = parseRequisitionExtras(body, {
    deliveryPoc: pr.delivery_poc,
    placeOfDelivery: pr.place_of_delivery,
    billingAddress: pr.billing_address,
    expectedDeliveryTimeline: pr.expected_delivery_timeline,
    paymentTerms: pr.payment_terms,
    projectDetail: pr.project_detail,
    specialNotes: pr.special_notes,
    deliveryPocEmail: pr.delivery_poc_email,
    deliveryPocPhone: pr.delivery_poc_phone,
    projectManagerHo: pr.project_manager_ho,
    projectManagerContact: pr.project_manager_contact,
    projectManagerEmail: pr.project_manager_email,
  });
  const requestCategory = normalizeRequestCategory(
    body.requestCategory ?? body.request_category ?? pr.request_category
  );
  if (!lineItems.length && pr.status !== PR_STATUS.DRAFT && pr.status !== PR_STATUS.RETURNED) {
    throw new Error('At least one line item is required');
  }

  const isDraftLike = pr.status === PR_STATUS.DRAFT || pr.status === PR_STATUS.RETURNED;
  let nextDepartmentId = await resolveDepartmentIdForSave(department, user.id, {
    requireNamed: !isDraftLike,
  }).catch((err) => {
    if (isDraftLike && pr.department_id) return pr.department_id;
    throw err;
  });
  if (isDraftLike && !String(department || '').trim() && pr.department_id) {
    nextDepartmentId = pr.department_id;
  }

  let nextEntityId = pr.entity_id;
  if (entityId !== undefined && entityId !== null && entityId !== '') {
    nextEntityId = Number(entityId) || null;
  }

  const totalAmount = lineItemsEstimatedTotal(lineItems);
  const prTitle = title || lineItems[0]?.description || `${requestType || pr.request_type} Request`;
  const { prFlow, vendorMode, approvalUserId, approvalUserIds } = resolveFlowAndVendor(body, pr);
  if (prFlow === 'functional' && approvalUserIds.length) {
    await resolveSelectedApprovalUsers(approvalUserIds, pr.requester_id);
  }
  const currentPendingId = Number(pr.approval_user_id) || null;
  const nextCurrentApproverId =
    prFlow === 'functional' && currentPendingId && approvalUserIds.includes(currentPendingId)
      ? currentPendingId
      : approvalUserId;
  const normalizedPurchaseType = purchaseType
    ? normalizePurchaseType(purchaseType)
    : normalizePurchaseType(pr.purchase_type);
  const normalizedCurrency = normalizeCurrency(currency ?? pr.currency);
  const billing = await resolvePrBilling(nextEntityId, body, pr);

  // Draft: never wipe existing line items with an accidental empty payload (autosave / race).
  const shouldReplaceLineItems =
    !isDraftLike || (Array.isArray(lineItems) && lineItems.length > 0);
  const nextTotalAmount = shouldReplaceLineItems
    ? totalAmount
    : Number(pr.total_amount) || 0;
  const nextTitle =
    title ||
    (shouldReplaceLineItems ? lineItems[0]?.description : null) ||
    pr.title ||
    `${requestType || pr.request_type} Request`;

  const run = async (db) => {
    await db.query(
      `UPDATE purchase_requests
       SET title = ?, request_type = ?, purchase_type = ?, department_id = ?, entity_id = ?, priority = ?, justification = ?,
           required_date = ?, currency = ?, total_amount = ?, vendor_selection = ?, pr_flow = ?, approval_user_id = ?, approval_user_ids = ?,
           billing_location_id = ?, billing_location = ?, billing_gst_no = ?, billing_address = ?,
           delivery_poc = ?, place_of_delivery = ?, expected_delivery_timeline = ?, payment_terms = ?,
           request_category = ?, project_detail = ?, special_notes = ?,
           delivery_poc_email = ?, delivery_poc_phone = ?,
           project_manager_ho = ?, project_manager_contact = ?, project_manager_email = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        nextTitle,
        requestType || pr.request_type,
        normalizedPurchaseType,
        nextDepartmentId,
        nextEntityId,
        priority || pr.priority,
        justification,
        requiredDate || null,
        normalizedCurrency,
        nextTotalAmount,
        vendorMode,
        prFlow,
        nextCurrentApproverId,
        approvalUserIds.length ? JSON.stringify(approvalUserIds) : null,
        billing.billingLocationId,
        billing.billingLocation || null,
        billing.billingGstNo || null,
        extras.billingAddress || null,
        extras.deliveryPoc || null,
        extras.placeOfDelivery || null,
        extras.expectedDeliveryTimeline || null,
        extras.paymentTerms || null,
        requestCategory || null,
        extras.projectDetail || null,
        extras.specialNotes || null,
        extras.deliveryPocEmail || null,
        extras.deliveryPocPhone || null,
        extras.projectManagerHo || null,
        extras.projectManagerContact || null,
        extras.projectManagerEmail || null,
        prId,
      ]
    );

    if (prFlow === 'functional' && nextCurrentApproverId && pr.status === PR_STATUS.PENDING_HOD_APPROVAL) {
      await db.query(
        `UPDATE workflow_tasks
         SET assigned_user_id = ?
         WHERE pr_id = ? AND task_type = 'PR_APPROVAL' AND status = 'pending'`,
        [nextCurrentApproverId, prId]
      );
    }

    if (shouldReplaceLineItems) {
      await db.query('DELETE FROM pr_line_items WHERE pr_id = ?', [prId]);
      for (const item of lineItems) {
        await insertPrLineItem(db, prId, item);
      }
    }

    if (attachments.length) {
      await savePrAttachments(prId, user.id, attachments, db);
    }
  };

  if (conn) {
    await run(conn);
  } else {
    const ownConn = await pool.getConnection();
    try {
      await ownConn.beginTransaction();
      await run(ownConn);
      await ownConn.commit();
    } catch (err) {
      await ownConn.rollback();
      throw err;
    } finally {
      ownConn.release();
    }
  }

  // Skip when caller (e.g. resubmit) will persist RFQ once with markSubmitted — avoids double delete/recreate + BLOB I/O.
  if (
    !options.skipRfqPersist &&
    prFlow === 'functional' &&
    vendorMode === 'own' &&
    (body.rfqVendors || body.rfq_vendors)
  ) {
    await persistFunctionalOwnRfq(user, prId, body, {
      markSubmitted: pr.status !== PR_STATUS.DRAFT,
    });
  }

  return getPurchaseRequestById(prId);
}

/**
 * Post-RFQ / admin edit of any PR header + line items (not limited to draft/returned).
 * Used from RFQ Approval detail so approvers can correct PR details before decision.
 */
export async function adminUpdatePurchaseRequest(user, prId, body = {}) {
  const allowed = [
    'Super Admin',
    'SCM Manager',
    'SCM Buyer',
    'HOD Approver',
    'PR Manager',
    'CFO',
    'Requester',
  ];
  const allowedByRole = allowed.includes(user.role) || isSuperAdmin(user.role);
  if (!allowedByRole) {
    const codes = await getUserPermissionCodes(user.id, user.role);
    const ok = [
      'nav.rfq_approval',
      'nav.track_pr',
      'nav.tasks',
      'nav.pr_manager_dashboard',
      'nav.rfq_entry',
      'nav.scm_rfq_entry',
    ].some((c) => codes.includes(c));
    if (!ok) throw new Error('Unauthorized');
  }

  const [prRows] = await pool.query('SELECT * FROM purchase_requests WHERE id = ?', [prId]);
  if (!prRows.length) throw new Error('PR not found');
  const pr = prRows[0];
  if (user.role === 'Requester' && Number(pr.requester_id) !== Number(user.id) && !isSuperAdmin(user.role)) {
    throw new Error('Unauthorized');
  }

  const {
    title,
    requestType,
    purchaseType,
    department,
    entityId,
    priority,
    justification,
    requiredDate,
    vendorSelection,
    currency,
    lineItems = [],
  } = body;
  const extras = parseRequisitionExtras(body, {
    deliveryPoc: pr.delivery_poc,
    placeOfDelivery: pr.place_of_delivery,
    billingAddress: pr.billing_address,
    expectedDeliveryTimeline: pr.expected_delivery_timeline,
    paymentTerms: pr.payment_terms,
    projectDetail: pr.project_detail,
    specialNotes: pr.special_notes,
    deliveryPocEmail: pr.delivery_poc_email,
    deliveryPocPhone: pr.delivery_poc_phone,
    projectManagerHo: pr.project_manager_ho,
    projectManagerContact: pr.project_manager_contact,
    projectManagerEmail: pr.project_manager_email,
  });
  const requestCategory = normalizeRequestCategory(
    body.requestCategory ?? body.request_category ?? pr.request_category
  );
  if (!Array.isArray(lineItems) || !lineItems.length) {
    throw new Error('At least one line item is required');
  }

  let departmentId = pr.department_id;
  if (department) {
    const [deptRows] = await pool.query('SELECT id FROM departments WHERE name = ? LIMIT 1', [
      department,
    ]);
    if (!deptRows.length) throw new Error('Invalid department');
    departmentId = deptRows[0].id;
  } else if (!departmentId) {
    throw new Error('Department is required');
  }

  let nextEntityId = pr.entity_id;
  if (entityId !== undefined && entityId !== null && entityId !== '') {
    nextEntityId = Number(entityId) || null;
  }

  const totalAmount = lineItemsEstimatedTotal(lineItems);
  const prTitle = title || lineItems[0]?.description || `${requestType || pr.request_type} Request`;
  const { prFlow, vendorMode, approvalUserId, approvalUserIds } = resolveFlowAndVendor(body, pr);
  if (prFlow === 'functional' && approvalUserIds.length) {
    await resolveSelectedApprovalUsers(approvalUserIds, pr.requester_id);
  }
  const currentPendingId = Number(pr.approval_user_id) || null;
  const nextCurrentApproverId =
    prFlow === 'functional' && currentPendingId && approvalUserIds.includes(currentPendingId)
      ? currentPendingId
      : approvalUserId;
  const normalizedPurchaseType = purchaseType
    ? normalizePurchaseType(purchaseType)
    : normalizePurchaseType(pr.purchase_type);
  const normalizedCurrency = normalizeCurrency(currency ?? pr.currency);
  const billing = await resolvePrBilling(nextEntityId, body, pr);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE purchase_requests
       SET title = ?, request_type = ?, purchase_type = ?, department_id = ?, entity_id = ?,
           priority = ?, justification = ?, required_date = ?, currency = ?, total_amount = ?,
           vendor_selection = ?, pr_flow = ?, approval_user_id = ?, approval_user_ids = ?,
           billing_location_id = ?, billing_location = ?, billing_gst_no = ?, billing_address = ?,
           delivery_poc = ?, place_of_delivery = ?, expected_delivery_timeline = ?, payment_terms = ?,
           request_category = ?, project_detail = ?, special_notes = ?,
           delivery_poc_email = ?, delivery_poc_phone = ?,
           project_manager_ho = ?, project_manager_contact = ?, project_manager_email = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        prTitle,
        requestType || pr.request_type,
        normalizedPurchaseType,
        departmentId,
        nextEntityId,
        priority || pr.priority,
        justification ?? pr.justification,
        requiredDate || null,
        normalizedCurrency,
        totalAmount,
        vendorMode,
        prFlow,
        nextCurrentApproverId,
        approvalUserIds.length ? JSON.stringify(approvalUserIds) : null,
        billing.billingLocationId,
        billing.billingLocation || null,
        billing.billingGstNo || null,
        extras.billingAddress || null,
        extras.deliveryPoc || null,
        extras.placeOfDelivery || null,
        extras.expectedDeliveryTimeline || null,
        extras.paymentTerms || null,
        requestCategory || null,
        extras.projectDetail || null,
        extras.specialNotes || null,
        extras.deliveryPocEmail || null,
        extras.deliveryPocPhone || null,
        extras.projectManagerHo || null,
        extras.projectManagerContact || null,
        extras.projectManagerEmail || null,
        prId,
      ]
    );

    await conn.query('DELETE FROM pr_line_items WHERE pr_id = ?', [prId]);
    for (const item of lineItems) {
      await insertPrLineItem(conn, prId, item);
    }

    // Leave/autosave must not spam PR_ADMIN_EDIT rows — that hides real approvals.
    if (!body.silent) {
      const remarks = `PR details updated by ${user.name || user.role} (${user.role})`;
      const [lastRows] = await conn.query(
        `SELECT id, stage, approver_id, created_at
         FROM pr_approvals
         WHERE pr_id = ?
         ORDER BY id DESC
         LIMIT 1`,
        [prId]
      );
      const last = lastRows[0];
      const sameBurst =
        last &&
        last.stage === 'PR_ADMIN_EDIT' &&
        Number(last.approver_id) === Number(user.id) &&
        Date.now() - new Date(last.created_at).getTime() < 15 * 60 * 1000;
      if (sameBurst) {
        await conn.query(
          `UPDATE pr_approvals SET remarks = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [remarks, last.id]
        );
      } else {
        await conn.query(
          `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
           VALUES (?, 'PR_ADMIN_EDIT', ?, 'updated', ?)`,
          [prId, user.id, remarks]
        );
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // Track PR / admin Edit PR: persist quotation file replacements (header-only update used to drop them).
  if (prFlow === 'functional' && vendorMode === 'own' && (body.rfqVendors || body.rfq_vendors)) {
    await persistFunctionalOwnRfq(user, prId, body, {
      markSubmitted: pr.status !== PR_STATUS.DRAFT,
    });
  }

  return getPurchaseRequestById(prId);
}

const ADMIN_SEND_BACK_ROLES = [
  'Super Admin',
  'SCM Manager',
  'SCM Buyer',
  'HOD Approver',
  'PR Manager',
  'CFO',
];

/**
 * Admin override: send PR back to any prior workflow step (Track PR).
 * Does not require the actor to hold the current approval task.
 */
export async function adminSendBackPurchaseRequest(user, prId, returnTo, remarks) {
  if (!ADMIN_SEND_BACK_ROLES.includes(user.role) && !isSuperAdmin(user.role)) {
    const codes = await getUserPermissionCodes(user.id, user.role);
    const ok = ['nav.rfq_approval', 'nav.track_pr', 'nav.tasks', 'nav.pr_manager_dashboard'].some((c) =>
      codes.includes(c)
    );
    if (!ok) throw new Error('Unauthorized');
  }
  const remarksText = String(remarks || '').trim();
  if (!remarksText) throw new Error('Remarks are required for send back');
  if (!returnTo) throw new Error('Select a previous stage to send back to');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [prRows] = await conn.query('SELECT * FROM purchase_requests WHERE id = ? FOR UPDATE', [
      prId,
    ]);
    if (!prRows.length) throw new Error('PR not found');
    const pr = prRows[0];

    if (
      pr.status === PR_STATUS.DRAFT ||
      pr.status === PR_STATUS.REJECTED ||
      pr.status === PR_STATUS.RETURNED
    ) {
      throw new Error('Cannot send back a draft, rejected, or already-returned PR from Track PR');
    }

    const applyResult = await applySendBackToTarget(conn, pr, returnTo, remarksText, user, {
      admin: true,
    });

    await conn.query(
      `UPDATE purchase_orders
       SET status = 'cancelled',
           cancellation_reason = ?,
           cancelled_by = ?,
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE pr_id = ? AND status IN ('draft', 'pending_approval')`,
      [`Send-back from workflow: ${remarksText.slice(0, 450)}`, user.id, prId]
    );

    await conn.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks) VALUES (?, ?, ?, ?, ?)`,
      [
        prId,
        pr.current_stage || 'ADMIN_SEND_BACK',
        user.id,
        'rework',
        `[Admin send-back by ${user.name || user.role}] ${applyResult.remarksLine}`,
      ]
    );

    await conn.commit();
    const updatedPr = await getPurchaseRequestById(prId);
    queueSendBackNotifications(updatedPr, { ...applyResult, actorRole: user.role });
    queueApproverActionConfirmationForUser(prId, user, 'rework', {
      remarks: remarksText,
      approverRole: user.role,
    });
    return updatedPr;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function resubmitPurchaseRequest(user, prId, body = {}) {
  const { remarks, ...updateFields } = body;
  const hasUpdates = Object.keys(updateFields).length > 0;

  const [prRows] = await pool.query(
    'SELECT * FROM purchase_requests WHERE id = ? AND requester_id = ?',
    [prId, user.id]
  );
  if (!prRows.length) throw new Error('PR not found');

  const pr = prRows[0];
  if (pr.status !== PR_STATUS.RETURNED && pr.status !== PR_STATUS.DRAFT) {
    throw new Error('Only returned or draft PRs can be resubmitted');
  }

  const extrasForSubmit = parseRequisitionExtras(updateFields, {
    deliveryPoc: pr.delivery_poc,
    placeOfDelivery: pr.place_of_delivery,
    expectedDeliveryTimeline: pr.expected_delivery_timeline,
  });
  const lineItemsForSubmit = Array.isArray(updateFields.lineItems) ? updateFields.lineItems : undefined;
  assertPrSubmitRequirements(extrasForSubmit, lineItemsForSubmit);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (hasUpdates) {
      await updatePurchaseRequest(user, prId, updateFields, conn, { skipRfqPersist: true });
    }

    await conn.query(
      `UPDATE purchase_requests
       SET status = ?, current_stage = ?, submitted_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [PR_STATUS.PENDING_HOD_APPROVAL, STAGE.HOD_REVIEW, prId]
    );

    await conn.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks) VALUES (?, ?, ?, ?, ?)`,
      [
        prId,
        STAGE.SUBMITTED,
        user.id,
        'resubmitted',
        remarks?.trim() || 'PR resubmitted after rework',
      ]
    );

    await conn.query(
      `UPDATE workflow_tasks SET status = 'cancelled', completed_at = NOW()
       WHERE pr_id = ? AND status = 'pending'`,
      [prId]
    );

    const [freshRows] = await conn.query(
      `SELECT pr_flow, approval_user_id, approval_user_ids, department_id, vendor_selection FROM purchase_requests WHERE id = ?`,
      [prId]
    );
    const current = freshRows[0] || pr;
    const isFunctional = current.pr_flow === 'functional';
    const chain = functionalApprovalChainFromPr(current);
    const firstApproverId = chain[0] || current.approval_user_id;
    if (isFunctional && firstApproverId && Number(firstApproverId) !== Number(current.approval_user_id)) {
      await conn.query(`UPDATE purchase_requests SET approval_user_id = ? WHERE id = ?`, [
        firstApproverId,
        prId,
      ]);
    }

    let hodAssignment;
    if (isFunctional) {
      hodAssignment = await createSelectedUserApprovalTask(conn, prId, firstApproverId);
    } else {
      hodAssignment = await createHodApprovalTask(conn, prId, user.email, current.department_id);
      if (hodAssignment.hodEmail) {
        await conn.query(
          `UPDATE users SET supervisor_email = ?, supervisor_name = ? WHERE id = ?`,
          [hodAssignment.hodEmail, hodAssignment.hodName, user.id]
        );
      }
    }

    await conn.commit();
    if (isFunctional && current.vendor_selection === 'own') {
      await persistFunctionalOwnRfq(user, prId, body, { markSubmitted: true });
    }
    const updatedPr = await getPurchaseRequestById(prId);
    const chainLen = functionalApprovalChainFromPr(current).length;
    const nextStep = isFunctional
      ? chainLen > 1
        ? `User Approval 1 of ${chainLen}`
        : 'User Approval'
      : 'L1 Manager Approval';
    queuePrSubmitNotifications({
      pr: updatedPr,
      user,
      departmentId: current.department_id,
      prFlow: isFunctional ? 'functional' : 'standard',
      vendorMode: current.vendor_selection,
      hodAssignment,
      nextStep,
      isResubmit: true,
    });
    return {
      ...updatedPr,
      nextStep,
      l1Manager: {
        name: hodAssignment?.hodName || null,
        email: hodAssignment?.hodEmail || null,
      },
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listRequesterTasks(userId) {
  const [rows] = await pool.query(
    `SELECT wt.id, wt.pr_id, wt.task_type, wt.due_date, wt.created_at,
            pr.pr_number, pr.title, pr.total_amount, pr.status AS pr_status, pr.request_type,
            d.name AS department_name
     FROM workflow_tasks wt
     JOIN purchase_requests pr ON pr.id = wt.pr_id
     JOIN departments d ON d.id = pr.department_id
     WHERE wt.status = 'pending'
       AND (
         (wt.assigned_role = 'Requester' AND pr.requester_id = ?
           AND NOT (wt.task_type = 'RFQ_ENTRY' AND pr.pr_flow = 'functional'))
         OR (wt.task_type = 'PR_APPROVAL' AND wt.assigned_user_id = ?)
       )
     ORDER BY wt.created_at DESC`,
    [userId, userId]
  );

  return rows.map((r) => {
    const isUserApproval = r.task_type === 'PR_APPROVAL';
    return {
      id: String(r.id),
      taskId: r.id,
      prId: r.pr_id,
      taskType: r.task_type,
      prNumber: r.pr_number,
      title: r.title,
      department: r.department_name,
      totalAmount: Number(r.total_amount),
      requestType: r.request_type,
      prStatus: r.pr_status,
      dueDate: formatDate(r.due_date),
      label: isUserApproval
        ? 'User Approval'
        : r.task_type === 'RFQ_ENTRY'
          ? 'RFQ Entry'
          : r.task_type.replace(/_/g, ' '),
      actionPath: isUserApproval
        ? `/tasks?prId=${r.pr_id}`
        : `/requester/rfq-entry/${r.pr_id}?taskId=${r.id}`,
      cta: isUserApproval ? 'Review & Approve' : 'Start RFQ Entry',
    };
  });
}

export async function completeRequesterTask(user, taskId) {
  const [rows] = await pool.query(
    `SELECT wt.*, pr.requester_id FROM workflow_tasks wt
     JOIN purchase_requests pr ON pr.id = wt.pr_id
     WHERE wt.id = ? AND wt.assigned_role = 'Requester' AND wt.status = 'pending'`,
    [taskId]
  );
  if (!rows.length) throw new Error('Task not found');
  if (rows[0].requester_id !== user.id) throw new Error('Unauthorized');

  await pool.query(
    `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW() WHERE id = ?`,
    [taskId]
  );
  return { success: true };
}

function mapApproverActionToTaskStatus(action) {
  if (action === 'approve') return 'approved';
  if (action === 'reject') return 'rejected';
  if (action === 'return' || action === 'rework') return 'returned';
  return 'pending_approval';
}

/**
 * Latest submitted quote for the recommended vendor (post-RFQ amount).
 * Returns Map<prId, number>.
 */
export async function getRecommendedQuotedAmounts(prIds = []) {
  const ids = [...new Set((prIds || []).map((id) => Number(id)).filter((id) => id > 0))];
  const map = new Map();
  if (!ids.length) return map;

  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT rc.pr_id AS pr_id,
            (
              SELECT vqs.quoted_price
              FROM vendor_quotation_submissions vqs
              WHERE vqs.rfq_invitation_id = rc.recommended_invitation_id
                AND vqs.status IN ('submitted', 'sent_back')
                AND vqs.quoted_price IS NOT NULL
                AND vqs.quoted_price > 0
              ORDER BY vqs.round DESC, vqs.id DESC
              LIMIT 1
            ) AS quoted_price
     FROM rfq_configs rc
     WHERE rc.pr_id IN (${placeholders})
       AND rc.recommended_invitation_id IS NOT NULL`,
    ids
  );

  for (const row of rows) {
    const amount = Number(row.quoted_price);
    if (Number.isFinite(amount) && amount > 0) {
      map.set(Number(row.pr_id), amount);
    }
  }
  return map;
}

function buildTaskRow(pr, { status, isPostRfq = false, decidedAt = null, displayAmount = null }) {
  const due = new Date(pr.submittedDate || Date.now());
  due.setDate(due.getDate() + 1);
  const hoursLeft = Math.max(0, Math.round((due.getTime() - Date.now()) / 3600000));
  const pending = status === 'pending_approval';
  const amount =
    displayAmount != null && Number.isFinite(Number(displayAmount))
      ? Number(displayAmount)
      : Number(pr.totalAmount) || 0;

  return {
    id: String(pr.id),
    taskId: pr.id,
    prId: pr.id,
    prNumber: pr.prNumber,
    title: pr.title,
    requester: pr.requester,
    department: pr.department,
    entityId: pr.entityId || null,
    entityName: pr.entityName || '',
    entityCode: pr.entityCode || '',
    totalAmount: amount,
    priority: pr.priorityLower || mapPriorityToFrontend(pr.priority),
    status,
    statusUI: pr.statusUI,
    submittedDate: decidedAt ? formatDate(decidedAt) : pr.submittedDate,
    dueDate: formatDate(due),
    slaRemaining: pending ? hoursLeft || 24 : 0,
    isOverdue: pending && hoursLeft <= 0,
    lineItems: Array.isArray(pr.lineItems) ? pr.lineItems.length : (pr.items || 0),
    requestType: pr.requestType,
    requesterRole: 'Requester',
    requesterAvatar: (pr.requester || 'R').charAt(0).toUpperCase(),
    justification: pr.justification,
    isPostRfq,
    actionPath: isPostRfq ? `/rfq-approval/${pr.id}` : undefined,
    vendorSelection: pr.vendorSelection === 'own' ? 'own' : 'scm',
    prFlow: pr.prFlow === 'functional' ? 'functional' : 'standard',
    askBusinessApproval: Boolean(
      pending &&
        !isPostRfq &&
        pr.prFlow !== 'functional' &&
        pr.vendorSelection !== 'own' &&
        pr.status === PR_STATUS.PENDING_HOD_APPROVAL
    ),
  };
}

/** Latest approve/reject/return decisions by this user (any stage they acted on). */
async function listMyApprovalDecisions(user) {
  const userEmail = String(user.email || '').toLowerCase().trim();
  // L2 (PR Manager) can also be the Functional "User Approval" performer.
  // That decision is stored as HOD_REVIEW, not PR_MANAGER_REVIEW — include it
  // so Approved on My Tasks is not empty after they approve.
  const stages = [
    ...new Set(
      [
        ROLE_STAGE_MAP[user.role]?.stage,
        POST_RFQ_ROLE_MAP[user.role]?.stage,
        STAGE.HOD_REVIEW,
        STAGE.PR_MANAGER_REVIEW,
        STAGE.RFQ_MANAGER_REVIEW,
        STAGE.RFQ_L2_REVIEW,
        STAGE.CFO_REVIEW,
        STAGE.RFQ_CFO_REVIEW,
      ].filter(Boolean)
    ),
  ];

  const placeholders = stages.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT pr.*, d.name AS department_name, u.name AS requester_name,
            e.name AS entity_name, e.code AS entity_code, e.cost_center AS entity_cost_center,
            pa.action AS my_action, pa.created_at AS decided_at, pa.stage AS my_stage
     FROM pr_approvals pa
     INNER JOIN (
       SELECT pa2.pr_id, MAX(pa2.id) AS max_id
       FROM pr_approvals pa2
       LEFT JOIN users au ON au.id = pa2.approver_id
       WHERE pa2.action IN ('approve', 'reject', 'return', 'rework')
         AND pa2.stage IN (${placeholders})
         AND (
           pa2.approver_id = ?
           OR (? <> '' AND LOWER(TRIM(au.email)) = ?)
         )
       GROUP BY pa2.pr_id
     ) latest ON latest.max_id = pa.id
     JOIN purchase_requests pr ON pr.id = pa.pr_id
     JOIN departments d ON d.id = pr.department_id
     JOIN users u ON u.id = pr.requester_id
     LEFT JOIN entity_masters e ON e.id = pr.entity_id
     ORDER BY pa.created_at DESC`,
    [...stages, user.id, userEmail, userEmail]
  );

  return rows.map((row) => {
    const summary = mapScmBucketSummary(row);
    return {
      ...summary,
      items: 0,
      myAction: row.my_action,
      decidedAt: row.decided_at,
      myStage: row.my_stage,
    };
  });
}

export async function listTasks(user) {
  const roleConfig = ROLE_STAGE_MAP[user.role];
  const postRfqConfig = POST_RFQ_ROLE_MAP[user.role];
  const postRfqStatuses = new Set(Object.values(POST_RFQ_ROLE_MAP).map((c) => c.status));
  const allowedStatuses = new Set(
    [roleConfig?.status, postRfqConfig?.status].filter(Boolean)
  );

  let prs = [];

  if (user.role === 'HOD Approver') {
    prs = await listPurchaseRequests(user, { pendingOnly: true });
  } else if (roleConfig || postRfqConfig) {
    const all = await listPurchaseRequests(user, { pendingOnly: true });
    prs = all.filter((p) => allowedStatuses.has(p.status));
  }

  // Always include PRs where this user is the assigned approver / User Approval performer.
  // Match by user id or email (SSO / re-synced user rows).
  const userEmail = String(user.email || '').toLowerCase().trim();
  const [assignedRows] = await pool.query(
    `SELECT DISTINCT pr.id, wt.task_type, pr.status AS pr_status
     FROM purchase_requests pr
     JOIN workflow_tasks wt ON wt.pr_id = pr.id
     LEFT JOIN users au ON au.id = wt.assigned_user_id
     WHERE wt.status = 'pending'
       AND wt.task_type IN ('PR_APPROVAL', 'RFQ_POST_APPROVAL')
       AND (
         wt.assigned_user_id = ?
         OR (wt.assigned_user_id IS NULL AND wt.assigned_role = ?)
         OR (? <> '' AND LOWER(TRIM(au.email)) = ?)
       )`,
    [user.id, user.role, userEmail, userEmail]
  );
  const pendingIds = new Set(prs.map((p) => p.id));
  // Only RFQ_POST_APPROVAL (or post-RFQ statuses) count as post-RFQ — not every assigned PR
  const assignedPostRfqIds = new Set(
    assignedRows
      .filter(
        (r) =>
          r.task_type === 'RFQ_POST_APPROVAL' ||
          postRfqStatuses.has(r.pr_status)
      )
      .map((r) => r.id)
  );
  for (const row of assignedRows) {
    if (!pendingIds.has(row.id)) {
      const pr = await getPurchaseRequestById(row.id);
      if (pr) {
        prs.push(pr);
        pendingIds.add(pr.id);
      }
    }
  }

  // Include PRs this approver already acted on (Approved / Rejected / Returned)
  const decided = await listMyApprovalDecisions(user);
  const decidedByPrId = new Map();
  for (const pr of decided) {
    decidedByPrId.set(pr.id, pr);
    if (!pendingIds.has(pr.id)) {
      prs.push(pr);
    }
  }

  // Pending first (newest), then completed
  prs.sort((a, b) => {
    const aPending = pendingIds.has(a.id) ? 0 : 1;
    const bPending = pendingIds.has(b.id) ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    const aTime = new Date(
      decidedByPrId.get(a.id)?.decidedAt || a.submittedDate || a.createdAt || 0
    ).getTime();
    const bTime = new Date(
      decidedByPrId.get(b.id)?.decidedAt || b.submittedDate || b.createdAt || 0
    ).getTime();
    if (bTime !== aTime) return bTime - aTime;
    return Number(b.id) - Number(a.id);
  });

  // Prefetch recommended vendor quote amounts for vendor-final / post-RFQ rows
  const quoteAmountByPr = await getRecommendedQuotedAmounts(prs.map((p) => p.id));

  const tasks = prs.map((pr) => {
    const isPending = pendingIds.has(pr.id);
    const decision = decidedByPrId.get(pr.id);
    const status = isPending
      ? 'pending_approval'
      : mapApproverActionToTaskStatus(decision?.myAction);
    // Pending post-RFQ stages, or a pending RFQ_POST_APPROVAL assignment.
    // Do NOT treat completed decisions as post-RFQ for routing.
    const isPostRfq = isPending
      ? postRfqStatuses.has(pr.status) || assignedPostRfqIds.has(pr.id)
      : decision?.myStage === POST_RFQ_ROLE_MAP[user.role]?.stage;
    const recommendedQuote = quoteAmountByPr.get(Number(pr.id));
    const displayAmount =
      isPostRfq && recommendedQuote != null
        ? recommendedQuote
        : recommendedQuote != null && !(Number(pr.totalAmount) > 0)
          ? recommendedQuote
          : pr.totalAmount;

    return buildTaskRow(pr, {
      status,
      isPostRfq,
      decidedAt: !isPending ? decision?.decidedAt : null,
      displayAmount,
    });
  });

  // SCM Buyer final verify after Manager sign-off
  if (user.role === 'SCM Buyer') {
    const [buyerVerifyRows] = await pool.query(
      `SELECT po.id AS po_id, po.po_number, po.grand_total, po.pr_id, pr.title, pr.priority,
              d.name AS department_name, u.name AS requester_name, wt.due_date,
              e.id AS entity_id, e.name AS entity_name, e.code AS entity_code
       FROM purchase_orders po
       JOIN purchase_requests pr ON pr.id = po.pr_id
       JOIN departments d ON d.id = pr.department_id
       JOIN users u ON u.id = pr.requester_id
       LEFT JOIN entity_masters e ON e.id = pr.entity_id
       LEFT JOIN workflow_tasks wt ON wt.pr_id = po.pr_id
         AND wt.task_type = 'PO_BUYER_VERIFY' AND wt.status = 'pending'
       WHERE po.status = 'pending_buyer_verify'
       ORDER BY po.signed_at DESC, po.updated_at DESC`
    );
    for (const row of buyerVerifyRows) {
      const due = row.due_date ? new Date(row.due_date) : new Date();
      if (!row.due_date) due.setDate(due.getDate() + 1);
      const hoursLeft = Math.max(0, Math.round((due.getTime() - Date.now()) / 3600000));
      tasks.push({
        id: `po-verify-${row.po_id}`,
        taskId: row.po_id,
        prId: row.pr_id,
        prNumber: row.po_number,
        title: `${row.title} — Final Verify`,
        requester: row.requester_name,
        department: row.department_name,
        entityId: row.entity_id || null,
        entityName: row.entity_name || '',
        entityCode: row.entity_code || '',
        totalAmount: Number(row.grand_total),
        priority: mapPriorityToFrontend(row.priority),
        status: 'pending_approval',
        statusUI: 'Pending Buyer Verify',
        submittedDate: formatDate(due),
        dueDate: formatDate(due),
        slaRemaining: hoursLeft || 24,
        isOverdue: hoursLeft <= 0,
        lineItems: 0,
        requestType: 'PO',
        requesterRole: 'SCM Manager',
        requesterAvatar: 'S',
        justification: 'SCM Manager signed — final verify before sending to vendor',
        isPostRfq: false,
        actionPath: '/scm/buyer-final-verify',
      });
    }

    const [buyerReviseRows] = await pool.query(
      `SELECT po.id AS po_id, po.po_number, po.grand_total, po.pr_id, pr.title, pr.priority,
              d.name AS department_name, u.name AS requester_name, wt.due_date,
              e.id AS entity_id, e.name AS entity_name, e.code AS entity_code
       FROM purchase_orders po
       JOIN purchase_requests pr ON pr.id = po.pr_id
       JOIN departments d ON d.id = pr.department_id
       JOIN users u ON u.id = pr.requester_id
       LEFT JOIN entity_masters e ON e.id = pr.entity_id
       LEFT JOIN workflow_tasks wt ON wt.pr_id = po.pr_id
         AND wt.task_type = 'PO_REVISION' AND wt.status = 'pending'
       WHERE po.status = 'draft'
         AND EXISTS (
           SELECT 1 FROM pr_approvals pa
           WHERE pa.pr_id = po.pr_id AND pa.stage = 'PO_SENT_BACK'
         )
       ORDER BY po.updated_at DESC`
    );
    for (const row of buyerReviseRows) {
      const due = row.due_date ? new Date(row.due_date) : new Date();
      if (!row.due_date) due.setDate(due.getDate() + 2);
      const hoursLeft = Math.max(0, Math.round((due.getTime() - Date.now()) / 3600000));
      tasks.push({
        id: `po-revise-${row.po_id}`,
        taskId: row.po_id,
        poId: row.po_id,
        prId: row.pr_id,
        prNumber: row.po_number,
        title: `${row.title} — Revise PO`,
        requester: row.requester_name,
        department: row.department_name,
        entityId: row.entity_id || null,
        entityName: row.entity_name || '',
        entityCode: row.entity_code || '',
        totalAmount: Number(row.grand_total),
        priority: mapPriorityToFrontend(row.priority),
        status: 'pending_approval',
        statusUI: 'Sent Back — Revise PO',
        submittedDate: formatDate(due),
        dueDate: formatDate(due),
        slaRemaining: hoursLeft || 48,
        isOverdue: hoursLeft <= 0,
        lineItems: 0,
        requestType: 'PO',
        requesterRole: 'SCM Manager',
        requesterAvatar: 'S',
        justification: 'SCM Manager sent the PO back — revise and resubmit for sign',
        isPostRfq: false,
        isPoRevise: true,
        actionPath: `/scm/create-po?poId=${row.po_id}`,
      });
    }
  }

  if (user.role === 'SCM Manager') {
    const [poSignRows] = await pool.query(
      `SELECT po.id AS po_id, po.po_number, po.grand_total, po.pr_id, pr.title, pr.priority,
              d.name AS department_name, u.name AS requester_name, wt.due_date,
              e.id AS entity_id, e.name AS entity_name, e.code AS entity_code
       FROM purchase_orders po
       JOIN purchase_requests pr ON pr.id = po.pr_id
       JOIN departments d ON d.id = pr.department_id
       JOIN users u ON u.id = pr.requester_id
       LEFT JOIN entity_masters e ON e.id = pr.entity_id
       LEFT JOIN workflow_tasks wt ON wt.pr_id = po.pr_id
         AND wt.task_type = 'PO_APPROVAL' AND wt.status = 'pending'
       WHERE po.status = 'pending_approval'
       ORDER BY po.updated_at DESC`
    );
    for (const row of poSignRows) {
      const due = row.due_date ? new Date(row.due_date) : new Date();
      if (!row.due_date) due.setDate(due.getDate() + 2);
      const hoursLeft = Math.max(0, Math.round((due.getTime() - Date.now()) / 3600000));
      tasks.push({
        id: `po-sign-${row.po_id}`,
        taskId: row.po_id,
        poId: row.po_id,
        prId: row.pr_id,
        prNumber: row.po_number,
        title: `${row.title} — PO Sign`,
        requester: row.requester_name,
        department: row.department_name,
        entityId: row.entity_id || null,
        entityName: row.entity_name || '',
        entityCode: row.entity_code || '',
        totalAmount: Number(row.grand_total),
        priority: mapPriorityToFrontend(row.priority),
        status: 'pending_approval',
        statusUI: 'Pending PO Sign',
        submittedDate: formatDate(due),
        dueDate: formatDate(due),
        slaRemaining: hoursLeft || 48,
        isOverdue: hoursLeft <= 0,
        lineItems: 0,
        requestType: 'PO',
        requesterRole: 'SCM Buyer',
        requesterAvatar: 'B',
        justification: 'PO awaiting SCM Manager signature',
        isPostRfq: false,
        isPoSign: true,
        actionPath: '/scm/po-approval',
      });
    }
  }

  return tasks;
}

export function toRequesterDashboardFormat(pr) {
  return {
    // Dashboard-compatible fields
    id: pr.prNumber,
    prId: pr.id,
    title: pr.title,
    department: pr.department,
    entityId: pr.entityId || null,
    entityName: pr.entityName || '',
    entityCode: pr.entityCode || '',
    entityCostCenter: pr.entityCostCenter || '',
    amount: pr.totalAmount,
    status: pr.statusFrontend,
    priority: pr.priorityLower,
    date: pr.submittedDate || pr.createdAt,
    items: pr.items,
    requestType: pr.requestType,
    // Full fields for Track PR / expanded views
    prNumber: pr.prNumber,
    totalAmount: pr.totalAmount,
    statusRaw: pr.status,
    statusFrontend: pr.statusFrontend,
    statusUI: pr.statusUI,
    priorityLower: pr.priorityLower,
    submittedDate: pr.submittedDate,
    createdAt: pr.createdAt,
    requiredDate: pr.requiredDate,
    justification: pr.justification,
    requestCategory: pr.requestCategory || '',
    projectDetail: pr.projectDetail || '',
    specialNotes: pr.specialNotes || '',
    lineItems: pr.lineItems,
    approvalHistory: pr.approvalHistory,
    requester: pr.requester,
    vendorSelection: pr.vendorSelection,
    prFlow: pr.prFlow,
    currentStage: pr.currentStage,
    currentApprover: pr.currentApprover || null,
    l1Manager: pr.l1Manager || null,
    scmBuyer: pr.scmBuyer || null,
    poId: pr.poId || null,
    poNumber: pr.poNumber || '',
    poStatus: pr.poStatus || '',
    poDocumentAvailable: Boolean(pr.poDocumentAvailable),
    poSentBack: Boolean(pr.poSentBack),
    hasPurchaseOrder: Boolean(pr.hasPurchaseOrder || pr.poId),
  };
}

export function toManagerDashboardFormat(pr) {
  const due = new Date(pr.submittedDate);
  due.setDate(due.getDate() + 5);
  const isPostRfq = Boolean(
    POST_RFQ_ROLE_MAP['PR Manager'] &&
      (pr.status === PR_STATUS.PENDING_RFQ_L2_APPROVAL ||
        pr.status === PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL ||
        pr.status === PR_STATUS.PENDING_RFQ_CFO_APPROVAL ||
        pr.status === PR_STATUS.PENDING_BUSINESS_APPROVAL)
  );
  return {
    id: pr.prNumber,
    prId: pr.id,
    title: pr.title,
    requester: pr.requester,
    department: pr.department,
    entityName: pr.entityName || '',
    entityCode: pr.entityCode || '',
    amount: pr.totalAmount,
    priority: pr.priority,
    status: pr.statusUI,
    statusKey: pr.status,
    isPostRfq,
    submittedDate: pr.submittedDate,
    dueDate: formatDate(due),
    isOverdue: false,
    justification: pr.justification,
    lineItems: pr.lineItems,
    approvalHistory: pr.approvalHistory,
  };
}

export function toCfoDashboardFormat(pr) {
  const due = new Date(pr.submittedDate || Date.now());
  due.setDate(due.getDate() + 5);
  const submittedAt = pr.submittedDate ? new Date(pr.submittedDate) : new Date();
  const daysWaiting = Math.max(0, Math.floor((Date.now() - submittedAt.getTime()) / 86400000));
  const entityKey = pr.entityId != null ? String(pr.entityId) : 'unassigned';
  return {
    id: pr.prNumber,
    prId: pr.id,
    title: pr.title,
    requester: pr.requester,
    department: pr.department,
    entity: entityKey,
    entityName: pr.entityName || (entityKey === 'unassigned' ? 'Unassigned Entity' : ''),
    entityCode: pr.entityCode || '',
    amount: pr.totalAmount,
    priority: pr.priority,
    status:
      pr.status === PR_STATUS.PENDING_CFO_APPROVAL || pr.status === PR_STATUS.PENDING_RFQ_CFO_APPROVAL
        ? 'Pending CFO Approval'
        : pr.statusUI,
    submittedDate: pr.submittedDate,
    dueDate: formatDate(due),
    justification: pr.justification,
    isHighValue: Number(pr.totalAmount) >= CFO_HIGH_VALUE_THRESHOLD,
    isOverdue: daysWaiting > 5,
    vendorSelection: pr.vendorSelection === 'own' ? 'own' : 'scm',
    lineItems: (pr.lineItems || []).map((li) => ({
      id: String(li.id),
      itemName: li.itemName || li.description,
      description: li.description,
      quantity: li.quantity,
      unit: li.unit || li.uom || 'Nos',
      estimatedPrice: li.unitPrice,
      totalPrice: li.total,
      gstPercentage: li.gstPercentage,
      category: li.category,
    })),
    approvalHistory: (pr.approvalHistory || []).map((h) => ({
      stage: h.stage,
      approver: h.user,
      role: h.role,
      action: h.status,
      remarks: h.remarks,
      timestamp: h.date,
    })),
  };
}
